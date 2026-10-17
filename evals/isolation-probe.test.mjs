import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertWorkRoot, defaultWorkRoot } from './configs.mjs';
import { findListeners, killByPort } from './ports.mjs';
import { killByPath, runProcess } from './runner.mjs';
import { createReaper, sweptLater } from '../bin/lib/process-tree.testkit.mjs';
import {
  DUMMY_API_KEY, PROBE_ENV_VARS, claudeMdMarkers, defaultTrees, diffSnapshots, formatSummary, leakHits, main, parseEnvLines, probeCommand, runIsolationProbe, scanFile,
  keyLeaks, snapshotTrees, splitByControl, startFakeApi,
} from './isolation-probe.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FAKE_CLAUDE = path.join(here, 'fixtures', 'fake-claude.mjs');

// The runs of this file are not about what a process leaves behind, so their sweep is put off: each run is
// recorded and the search the real sweep makes is made once, when the file ends (`sweptLater`). A process a
// run left behind therefore lives until then, and fails the file by name here.
const later = sweptLater(runProcess);
after(() => {
  const left = later.check();
  assert.deepEqual(
    left,
    [],
    `processes outlived the run that started them: ${left.map(({ pid, name }) => `${name} (${pid})`).join(', ')}`,
  );
});

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-isoprobe-test-'));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));
let counter = 0;
const tmp = (name) => {
  const dir = path.join(scratch, `${name}-${counter++}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

// ---- the fake Messages API --------------------------------------------------------------------------------

const NONCE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

/** Starts a fake API for the duration of `fn`, and closes it after. */
async function withApi(fn, { nonce = NONCE, workspace = path.join(scratch, 'ws') } = {}) {
  const api = await startFakeApi({ nonce, workspace });
  try {
    return await fn(api, { nonce, workspace });
  } finally {
    await api.close();
  }
}

const post = (api, route, body, headers = {}) => fetch(`${api.url}${route}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const TOOLS = [{ name: 'Bash' }, { name: 'Write' }, { name: 'Read' }];
const ask = (extra = {}) => ({ model: 'claude-opus-5-5', max_tokens: 64, messages: [{ role: 'user', content: 'hi' }], ...extra });

/** The events of an SSE body as `{ event, data }`, in order. */
function parseSse(text) {
  return text.split('\n\n').filter((block) => block.trim() !== '').map((block) => {
    const event = /^event: (.+)$/m.exec(block)[1];
    const data = JSON.parse(/^data: (.+)$/m.exec(block)[1]);
    assert.equal(data.type, event, 'the event name and the data type agree');
    return { event, data };
  });
}

/** The conversation after the assistant used `toolUse` and the agent answered with `resultText`. */
const afterTool = (toolUse, resultText, before = []) => [
  { role: 'user', content: 'hi' },
  ...before,
  { role: 'assistant', content: [{ type: 'tool_use', id: toolUse.id, name: toolUse.name, input: toolUse.input }] },
  { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: [{ type: 'text', text: resultText }] }] },
];

test('the fake API answers a request with no tools in plain text, as JSON, and carries the nonce', async () => {
  await withApi(async (api) => {
    const res = await post(api, '/v1/messages', ask());
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    const message = await res.json();
    assert.equal(message.type, 'message');
    assert.equal(message.role, 'assistant');
    assert.equal(message.model, 'claude-opus-5-5');
    assert.equal(message.stop_reason, 'end_turn');
    assert.equal(message.content.length, 1);
    assert.equal(message.content[0].type, 'text');
    assert.ok(message.content[0].text.includes(NONCE));
    assert.ok(message.usage.input_tokens > 0 && message.usage.output_tokens > 0, 'usage is small and nonzero');
  });
});

test('the fake API streams a text reply as well-formed SSE, in the order the SDK expects', async () => {
  await withApi(async (api) => {
    const res = await post(api, '/v1/messages?beta=true', ask({ stream: true }));
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/event-stream/);
    const events = parseSse(await res.text());
    assert.deepEqual(events.map((e) => e.event), ['message_start', 'content_block_start', 'content_block_delta', 'content_block_stop', 'message_delta', 'message_stop']);
    assert.equal(events[0].data.message.role, 'assistant');
    assert.deepEqual(events[0].data.message.content, []);
    assert.equal(events[1].data.content_block.type, 'text');
    assert.equal(events[2].data.delta.type, 'text_delta');
    assert.ok(events[2].data.delta.text.includes(NONCE));
    assert.equal(events[4].data.delta.stop_reason, 'end_turn');
    assert.ok(events[4].data.usage.output_tokens > 0);
  });
});

test('the fake API scripts the agent: a Bash call that records the environment and the nonce, then a Write, then text', async () => {
  await withApi(async (api, { workspace }) => {
    const first = await (await post(api, '/v1/messages', ask({ tools: TOOLS }))).json();
    assert.equal(first.stop_reason, 'tool_use');
    const bash = first.content.find((block) => block.type === 'tool_use');
    assert.equal(bash.name, 'Bash');
    assert.match(bash.id, /^toolu_/);
    assert.ok(bash.input.command.includes('probe-env.txt'));
    assert.ok(bash.input.command.includes(`echo ${NONCE} > probe-nonce.txt`));

    const second = await (await post(api, '/v1/messages', ask({ tools: TOOLS, messages: afterTool(bash, 'HOME=/x') }))).json();
    assert.equal(second.stop_reason, 'tool_use');
    const writer = second.content.find((block) => block.type === 'tool_use');
    assert.equal(writer.name, 'Write');
    assert.equal(writer.input.file_path, path.join(workspace, 'probe-write.txt'));
    assert.equal(writer.input.content, NONCE);

    const history = afterTool(bash, 'HOME=/x');
    const third = await (await post(api, '/v1/messages', ask({ tools: TOOLS, messages: [...history, ...afterTool(writer, 'ok').slice(1)] }))).json();
    assert.equal(third.stop_reason, 'end_turn');
    assert.ok(third.content[0].text.includes(NONCE));
  });
});

test('a tool call streams as input_json_delta pieces that join into the tool input', async () => {
  await withApi(async (api, { workspace }) => {
    const res = await post(api, '/v1/messages', ask({ stream: true, tools: TOOLS }));
    const events = parseSse(await res.text());
    const start = events.find((e) => e.event === 'content_block_start');
    assert.equal(start.data.content_block.type, 'tool_use');
    assert.equal(start.data.content_block.name, 'Bash');
    assert.deepEqual(start.data.content_block.input, {});
    const pieces = events.filter((e) => e.event === 'content_block_delta');
    assert.ok(pieces.length >= 2, 'the JSON arrives in more than one piece');
    assert.ok(pieces.every((e) => e.data.delta.type === 'input_json_delta'));
    const input = JSON.parse(pieces.map((e) => e.data.delta.partial_json).join(''));
    assert.ok(input.command.includes(NONCE));
    assert.equal(events.at(-2).data.delta.stop_reason, 'tool_use');
    assert.equal(workspace, path.join(scratch, 'ws'));
  });
});

test('without a Bash tool the script goes straight to Write; a small model or no tools gets plain text', async () => {
  await withApi(async (api) => {
    const noBash = await (await post(api, '/v1/messages', ask({ tools: [{ name: 'Write' }] }))).json();
    assert.equal(noBash.content.find((b) => b.type === 'tool_use').name, 'Write');
    const haiku = await (await post(api, '/v1/messages', ask({ model: 'claude-haiku-4-5', tools: TOOLS }))).json();
    assert.equal(haiku.stop_reason, 'end_turn');
    assert.equal(haiku.content[0].type, 'text');
    const none = await (await post(api, '/v1/messages', ask({ tools: [] }))).json();
    assert.equal(none.stop_reason, 'end_turn');
  });
});

// ---- the plugin's paths: a memory write through the engram MCP tool, and a subagent --------------------------------

const MEM_SAVE = 'mcp__engram__mem_save';
const ENGRAM_TOOLS = [...TOOLS, { name: MEM_SAVE }, { name: 'Agent' }];

/** Walks the scripted conversation with every tool offered, answering each tool call as the agent would. */
async function walkScript(api, tools) {
  const messages = [{ role: 'user', content: 'hi' }];
  const steps = [];
  for (let turn = 0; turn < 8; turn += 1) {
    const reply = await (await post(api, '/v1/messages', ask({ tools, messages: [...messages] }))).json();
    const calls = reply.content.filter((block) => block.type === 'tool_use');
    if (calls.length === 0) {
      steps.push('text');
      return { steps, reply };
    }
    steps.push({ name: calls[0].name, input: calls[0].input });
    messages.push({ role: 'assistant', content: reply.content });
    messages.push({ role: 'user', content: calls.map((call) => ({ type: 'tool_result', tool_use_id: call.id, content: [{ type: 'text', text: 'ok' }] })) });
  }
  throw new Error('the script did not end');
}

test('with the engram tool and a subagent tool offered, the script goes Bash, Write, mem_save, Agent, then text', async () => {
  await withApi(async (api) => {
    const { steps } = await walkScript(api, ENGRAM_TOOLS);
    assert.deepEqual(steps.map((step) => step.name ?? step), ['Bash', 'Write', MEM_SAVE, 'Agent', 'text']);
    const save = steps[2].input;
    assert.equal(save.content, `memsave:${NONCE}`, 'the memory carries its own marker, so a write by the MCP server is told from the prompt hook');
    assert.ok(typeof save.title === 'string' && save.title.length > 0);
    const agent = steps[3].input;
    assert.match(agent.prompt, /Isolation probe subagent/);
    assert.ok(!agent.prompt.includes(NONCE), 'the subagent prompt is not the nonce: its text is what the stop hook stores');
  });
});

test('the script takes the engram tool whatever the server is called, and the older name of the subagent tool', async () => {
  await withApi(async (api) => {
    const { steps } = await walkScript(api, [...TOOLS, { name: 'mcp__plugin_engram_engram__mem_save' }, { name: 'Task' }]);
    assert.deepEqual(steps.map((step) => step.name ?? step), ['Bash', 'Write', 'mcp__plugin_engram_engram__mem_save', 'Task', 'text']);
  });
});

test('a tool whose name only ends like the engram one, or a subagent tool that is not one, is not scripted', async () => {
  await withApi(async (api) => {
    const { steps } = await walkScript(api, [...TOOLS, { name: 'mcp__other__mem_save' }, { name: 'mcp__engram__mem_search' }, { name: 'TaskList' }]);
    assert.deepEqual(steps.map((step) => step.name ?? step), ['Bash', 'Write', 'text']);
  });
});

test('without the engram tool the script skips the memory write, and without a subagent tool the subagent', async () => {
  await withApi(async (api) => {
    assert.deepEqual((await walkScript(api, [...TOOLS, { name: 'Agent' }])).steps.map((step) => step.name ?? step), ['Bash', 'Write', 'Agent', 'text']);
    assert.deepEqual((await walkScript(api, [...TOOLS, { name: MEM_SAVE }])).steps.map((step) => step.name ?? step), ['Bash', 'Write', MEM_SAVE, 'text']);
  });
});

test('a subagent request is answered in text with its own marker and no tool call, whatever it is offered, and is logged as such', async () => {
  await withApi(async (api) => {
    const body = ask({ tools: ENGRAM_TOOLS, messages: [{ role: 'user', content: [{ type: 'text', text: '<system-reminder>x</system-reminder>' }, { type: 'text', text: 'Isolation probe subagent: reply in one line.' }] }] });
    const reply = await (await post(api, '/v1/messages', body)).json();
    assert.equal(reply.stop_reason, 'end_turn');
    assert.deepEqual(reply.content.map((block) => block.type), ['text']);
    assert.ok(reply.content[0].text.includes(`subagent:${NONCE}`));
    assert.equal(api.requests.at(-1).reply, 'subagent');
  });
});

test('the request log says whether an engram tool was offered, as a boolean, and still keeps nothing else', async () => {
  await withApi(async (api) => {
    await post(api, '/v1/messages', ask({ tools: TOOLS }));
    await post(api, '/v1/messages', ask({ tools: ENGRAM_TOOLS }));
    assert.deepEqual(api.requests.map((request) => request.engramToolOffered), [false, true]);
  });
});

test('the Bash command prints the engram variables too, so the report shows what the hooks would resolve', () => {
  for (const name of ['ENGRAM_PORT', 'ENGRAM_URL', 'ENGRAM_SOCKET']) {
    assert.ok(PROBE_ENV_VARS.includes(name), name);
    assert.ok(probeCommand(NONCE).includes(`printf '${name}=%s`), name);
  }
});

test('the fake API counts tokens, answers the preflight, and returns a JSON 404 for anything else', async () => {
  await withApi(async (api) => {
    const counted = await post(api, '/v1/messages/count_tokens', ask());
    assert.equal(counted.status, 200);
    assert.deepEqual(await counted.json(), { input_tokens: 1 });

    const hello = await fetch(`${api.url}/api/hello`, { method: 'HEAD' });
    assert.equal(hello.status, 200);

    const unknown = await fetch(`${api.url}/v1/models`);
    assert.equal(unknown.status, 404);
    assert.match(unknown.headers.get('content-type'), /application\/json/);
    assert.equal((await unknown.json()).type, 'error');
    const wrongMethod = await fetch(`${api.url}/v1/messages`);
    assert.equal(wrongMethod.status, 404);
  });
});

test('a body that is not JSON is a 400, recorded, and the server keeps serving', async () => {
  await withApi(async (api) => {
    const bad = await fetch(`${api.url}/v1/messages`, { method: 'POST', body: '{nope' });
    assert.equal(bad.status, 400);
    assert.equal((await post(api, '/v1/messages', ask())).status, 200);
    assert.deepEqual(api.requests.map((r) => r.reply), ['400', 'text']);
  });
});

test('the request log keeps method, path, model and whether tools were offered, and nothing else', async () => {
  await withApi(async (api) => {
    await post(api, '/v1/messages?beta=true', ask({ tools: TOOLS, stream: true, system: `secret system prompt ${NONCE}` }), { 'x-api-key': DUMMY_API_KEY, authorization: `Bearer ${DUMMY_API_KEY}` });
    await post(api, '/v1/messages/count_tokens', ask(), { 'x-api-key': DUMMY_API_KEY });
    await fetch(`${api.url}/v1/models`, { headers: { 'x-api-key': DUMMY_API_KEY } });
    assert.deepEqual(api.requests, [
      { method: 'POST', path: '/v1/messages', model: 'claude-opus-5-5', stream: true, toolsOffered: true, engramToolOffered: false, globalClaudeMd: false, reply: 'tool_use:Bash' },
      { method: 'POST', path: '/v1/messages/count_tokens', model: 'claude-opus-5-5', stream: false, toolsOffered: false, engramToolOffered: false, globalClaudeMd: false, reply: 'count_tokens' },
      { method: 'GET', path: '/v1/models', model: null, stream: false, toolsOffered: false, engramToolOffered: false, globalClaudeMd: false, reply: '404' },
    ]);
    const log = JSON.stringify(api.requests);
    assert.ok(!log.includes(NONCE) && !log.includes(DUMMY_API_KEY) && !/secret system prompt/.test(log));
  });
});

// ---- the contamination marker: is the real global CLAUDE.md in what the model is sent? ---------------------

const LONG = (word) => `The ${word} rule of this global file is stated in one line that is far longer than fifty characters.`;

test('claudeMdMarkers keeps the distinctive lines: long ones, whitespace-normalized, once each, longest first, at most 40', () => {
  const text = [
    '# Title', '', '   short line', `  ${LONG('first')}  `, LONG('first'), `${LONG('second')} with a tail that makes it the longest of the three lines in this file`,
    LONG('third').replace(/ /g, '   '), '```', 'x'.repeat(10),
  ].join('\n');
  const markers = claudeMdMarkers(text);
  assert.equal(markers.length, 3);
  assert.ok(markers[0].includes('with a tail'), 'the longest comes first');
  assert.ok(markers.includes(LONG('first')) && markers.includes(LONG('third')), 'trimmed and with single spaces');
  assert.ok(markers.every((marker) => marker.length >= 50 && !/\s{2}/.test(marker)));
  const many = Array.from({ length: 60 }, (_, i) => `Distinctive line number ${String(i).padStart(2, '0')} with enough words in it to pass the length floor.`).join('\n');
  assert.equal(claudeMdMarkers(many).length, 40);
  assert.deepEqual(claudeMdMarkers('# a\nshort\n\n'), []);
  assert.deepEqual(claudeMdMarkers(''), []);
});

test('the request log records whether a request carries the global CLAUDE.md, as a boolean, from two or more markers in the system prompt or the messages', async () => {
  const markers = [LONG('alpha'), LONG('beta'), LONG('gamma')];
  const api = await startFakeApi({ nonce: NONCE, workspace: scratch, markers });
  try {
    const asked = (extra) => post(api, '/v1/messages', ask({ tools: TOOLS, ...extra }));
    await asked({ system: `${markers[0]}\n\n${markers[1]}` });
    await asked({ system: `${markers[0]}` });
    await asked({ system: [{ type: 'text', text: `intro ${markers[1].replace(/ /g, '\n  ')} and ${markers[2]}` }] });
    await asked({ messages: [{ role: 'user', content: [{ type: 'text', text: `<system-reminder>${markers[0]}\n${markers[2]}</system-reminder>` }] }] });
    await asked({ messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Read', input: {} }] }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: [{ type: 'text', text: `${markers[1]} ${markers[2]}` }] }] }] });
    await asked({ system: 'nothing of the kind' });
    assert.deepEqual(api.requests.map((request) => request.globalClaudeMd), [true, false, true, true, true, false]);
    assert.ok(!JSON.stringify(api.requests).includes('alpha'), 'the log never holds a marker');
  } finally {
    await api.close();
  }
});

test('with no markers nothing is ever a hit, and with a single marker one is enough', async () => {
  const lone = await startFakeApi({ nonce: NONCE, workspace: scratch, markers: [LONG('only')] });
  const none = await startFakeApi({ nonce: NONCE, workspace: scratch });
  try {
    await post(lone, '/v1/messages', ask({ system: LONG('only') }));
    await post(none, '/v1/messages', ask({ system: LONG('only') }));
    assert.equal(lone.requests[0].globalClaudeMd, true);
    assert.equal(none.requests[0].globalClaudeMd, false);
  } finally {
    await lone.close();
    await none.close();
  }
});

test('the text of every tool_result the agent sends back is captured once, by tool_use id', async () => {
  await withApi(async (api) => {
    const bash = { id: 'toolu_1', name: 'Bash', input: { command: 'x' } };
    const messages = [
      ...afterTool(bash, 'HOME=/sandbox/home\nTEMP=/sandbox/tmp'),
      { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_2', name: 'Write', input: {} }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_2', content: 'File created' }] },
    ];
    await post(api, '/v1/messages', ask({ tools: TOOLS, messages }));
    await post(api, '/v1/messages', ask({ tools: TOOLS, messages }));
    assert.deepEqual(api.toolResults(), [
      { toolUseId: 'toolu_1', text: 'HOME=/sandbox/home\nTEMP=/sandbox/tmp' },
      { toolUseId: 'toolu_2', text: 'File created' },
    ]);
  });
});

test('after close the fake API accepts no more connections', async () => {
  const api = await startFakeApi({ nonce: NONCE, workspace: scratch });
  assert.match(api.url, /^http:\/\/127\.0\.0\.1:\d+$/);
  await api.close();
  await assert.rejects(fetch(`${api.url}/v1/messages`, { method: 'POST', body: '{}' }));
});

// ---- hashing, diffing and scanning real trees ------------------------------------------------------------

const sha = (content) => crypto.createHash('sha256').update(content).digest('hex');
/** An `openRead` that records every file it is asked to open, and fails for the ones in `forbidden`. */
function spyOpen(forbidden = []) {
  const opened = [];
  const open = (file, { chunkSize }) => {
    opened.push(path.basename(file));
    if (forbidden.includes(path.basename(file))) throw new Error(`the probe opened ${file}, which it must never read`);
    return fs.createReadStream(file, { highWaterMark: chunkSize });
  };
  return { open, opened };
}
const contentTree = (root, extra = {}) => ({ name: 't', root, mode: 'content', ...extra });
const noChange = { added: [], removed: [], changed: [], appeared: false, vanished: false };

test('a content snapshot holds each file as sha256 and size under a relative, slash-separated path', async () => {
  const root = tmp('tree');
  write(path.join(root, 'a.txt'), 'alpha');
  write(path.join(root, 'sub', 'deep', 'b.bin'), Buffer.from([1, 2, 3, 4]));
  const snapshot = await snapshotTrees([contentTree(root)]);
  const tree = snapshot.trees.t;
  assert.equal(tree.status, 'present');
  assert.deepEqual([...tree.files].sort(), [
    ['a.txt', `sha256:${sha('alpha')}:5`],
    ['sub/deep/b.bin', `sha256:${sha(Buffer.from([1, 2, 3, 4]))}:4`],
  ]);
  assert.equal(tree.bytes, 9);
  assert.equal(typeof snapshot.ms, 'number');
});

test('a big file is hashed as a stream: the digest is right whatever the chunk size', async () => {
  const root = tmp('stream');
  const content = crypto.randomBytes(100_000);
  write(path.join(root, 'big.bin'), content);
  for (const chunkSize of [7, 4096, 1 << 20]) {
    const { trees } = await snapshotTrees([contentTree(root)], { chunkSize });
    assert.equal(trees.t.files.get('big.bin'), `sha256:${sha(content)}:100000`, `chunk size ${chunkSize}`);
  }
});

test('a diff lists what was added, removed and changed, and leaves unchanged files out', async () => {
  const root = tmp('diff');
  write(path.join(root, 'same.txt'), 'same');
  write(path.join(root, 'edited.txt'), 'one');
  write(path.join(root, 'gone.txt'), 'bye');
  const before = await snapshotTrees([contentTree(root)]);
  write(path.join(root, 'edited.txt'), 'two');
  write(path.join(root, 'new', 'file.txt'), 'hi');
  fs.rmSync(path.join(root, 'gone.txt'));
  const after = await snapshotTrees([contentTree(root)]);
  assert.deepEqual(diffSnapshots(before, after).t, { ...noChange, added: ['new/file.txt'], removed: ['gone.txt'], changed: ['edited.txt'] });
});

test('a tree that is missing is recorded as missing, and one that appears (or vanishes) is a change', async () => {
  const root = path.join(tmp('appear'), 'later');
  const before = await snapshotTrees([contentTree(root)]);
  assert.equal(before.trees.t.status, 'missing');
  assert.equal(before.trees.t.files.size, 0);
  write(path.join(root, 'x.txt'), 'x');
  const after = await snapshotTrees([contentTree(root)]);
  assert.deepEqual(diffSnapshots(before, after).t, { ...noChange, added: ['x.txt'], appeared: true });
  fs.rmSync(root, { recursive: true });
  const gone = await snapshotTrees([contentTree(root)]);
  assert.deepEqual(diffSnapshots(after, gone).t, { ...noChange, removed: ['x.txt'], vanished: true });
  assert.deepEqual(diffSnapshots(before, before).t, noChange);
});

test('a stat-only tree is never opened: it is told apart by size and mtime alone', async () => {
  const root = tmp('stat');
  write(path.join(root, 'binary.exe'), 'MZ-pretend-this-is-700MB');
  const { open, opened } = spyOpen(['binary.exe']);
  const before = await snapshotTrees([{ name: 'big', root, mode: 'stat' }], { openRead: open });
  assert.deepEqual(opened, [], 'nothing was opened');
  const stat = fs.statSync(path.join(root, 'binary.exe'));
  assert.equal(before.trees.big.files.get('binary.exe'), `stat:${stat.size}:${stat.mtimeMs}`);
  write(path.join(root, 'binary.exe'), 'MZ-a-different-length-now');
  const after = await snapshotTrees([{ name: 'big', root, mode: 'stat' }], { openRead: open });
  assert.deepEqual(diffSnapshots(before, after).big.changed, ['binary.exe']);
  assert.deepEqual(opened, []);
});

test('a file named stat-only inside a content tree (the credentials file) is never opened either', async () => {
  const root = tmp('creds');
  write(path.join(root, '.credentials.json'), '{"token":"never-read"}');
  write(path.join(root, 'settings.json'), '{}');
  const { open, opened } = spyOpen(['.credentials.json']);
  const { trees } = await snapshotTrees([contentTree(root, { statOnly: ['.credentials.json'] })], { openRead: open, needles: [{ label: 'nonce', values: ['never-read'] }] });
  assert.deepEqual(opened, ['settings.json']);
  assert.match(trees.t.files.get('.credentials.json'), /^stat:\d+:/);
  assert.match(trees.t.files.get('settings.json'), /^sha256:/);
  assert.deepEqual(trees.t.hits, [], 'a file that is not read cannot be a hit');
});

test('a single file as a tree (.claude.json) is keyed ".", and a names-only tree lists its top level only', async () => {
  const dir = tmp('single');
  write(path.join(dir, '.claude.json'), '{"a":1}');
  write(path.join(dir, 'visible', 'deep.txt'), 'x');
  const { trees } = await snapshotTrees([
    { name: 'file', root: path.join(dir, '.claude.json'), mode: 'content' },
    { name: 'top', root: dir, mode: 'names' },
  ]);
  assert.deepEqual([...trees.file.files], [['.', `sha256:${sha('{"a":1}')}:7`]]);
  assert.deepEqual([...trees.top.files].map(([name]) => name).sort(), ['.claude.json', 'visible']);
});

test('a link in a tree is recorded and never followed, so a junction out of the tree is not scanned or hashed', async () => {
  const root = tmp('links');
  const outside = tmp('outside');
  write(path.join(outside, 'secret.txt'), 'NONCE-IN-THE-OTHER-TREE');
  write(path.join(root, 'plain.txt'), 'p');
  fs.symlinkSync(outside, path.join(root, 'junction'), 'junction');
  const { open, opened } = spyOpen();
  const { trees } = await snapshotTrees([contentTree(root)], { openRead: open, needles: [{ label: 'nonce', values: ['NONCE-IN-THE-OTHER-TREE'] }] });
  assert.deepEqual(opened, ['plain.txt']);
  assert.match(trees.t.files.get('junction'), /^link:/);
  assert.deepEqual([...trees.t.files.keys()].sort(), ['junction', 'plain.txt']);
  assert.deepEqual(trees.t.hits, []);
});

test('a file that cannot be read is recorded as unreadable and the snapshot goes on', async () => {
  const root = tmp('busy');
  write(path.join(root, 'locked.db'), 'x');
  write(path.join(root, 'fine.txt'), 'y');
  const open = (file, { chunkSize }) => {
    if (path.basename(file) === 'locked.db') throw Object.assign(new Error('busy'), { code: 'EBUSY' });
    return fs.createReadStream(file, { highWaterMark: chunkSize });
  };
  const { trees } = await snapshotTrees([contentTree(root)], { openRead: open });
  assert.equal(trees.t.files.get('locked.db'), 'unreadable:EBUSY');
  assert.deepEqual(trees.t.unreadable, [{ path: 'locked.db', code: 'EBUSY' }]);
  assert.match(trees.t.files.get('fine.txt'), /^sha256:/);
});

test('the scan finds a planted nonce in a nested file and reports its path, never the nonce', async () => {
  const root = tmp('scan');
  const nonce = 'c0ffee00c0ffee00c0ffee00c0ffee00';
  write(path.join(root, 'clean.txt'), 'nothing here');
  write(path.join(root, 'projects', 'x', 'session.jsonl'), `{"text":"prefix ${nonce} suffix"}\n`);
  const snapshot = await snapshotTrees([contentTree(root)], { needles: [{ label: 'nonce', values: [nonce] }] });
  const hits = leakHits(snapshot);
  assert.deepEqual(hits, [{ tree: 't', path: 'projects/x/session.jsonl', found: ['nonce'], via: 'content' }]);
  assert.ok(!JSON.stringify(hits).includes(nonce));
});

test('the scan sees a needle that straddles two chunks, and one written as UTF-16', async () => {
  const root = tmp('straddle');
  const nonce = 'deadbeefdeadbeefdeadbeefdeadbeef';
  write(path.join(root, 'split.txt'), `${'z'.repeat(13)}${nonce}${'z'.repeat(9)}`);
  write(path.join(root, 'wide.txt'), Buffer.from(`header ${nonce}`, 'utf16le'));
  write(path.join(root, 'near-miss.txt'), nonce.slice(0, -1));
  const snapshot = await snapshotTrees([contentTree(root)], { chunkSize: 5, needles: [{ label: 'nonce', values: [nonce] }] });
  assert.deepEqual(leakHits(snapshot).map((hit) => hit.path), ['split.txt', 'wide.txt']);
});

test('a path name that holds a needle is a hit too, in any mode (a leaked project folder is named after its cwd)', async () => {
  const root = tmp('names');
  write(path.join(root, 'projects', 'C--tmp-js-harness-iso-probe-AbC123-workspace', 'x.json'), '{}');
  write(path.join(root, 'projects', 'other', 'y.json'), '{}');
  for (const mode of ['content', 'stat']) {
    const snapshot = await snapshotTrees([{ name: 't', root, mode }], { needles: [{ label: 'sandbox', values: ['js-harness-iso-probe-AbC123'] }] });
    assert.deepEqual(leakHits(snapshot), [{ tree: 't', path: 'projects/C--tmp-js-harness-iso-probe-AbC123-workspace/x.json', found: ['sandbox'], via: 'name' }], mode);
  }
});

test('scanFile reports which needles a file holds, by label', async () => {
  const file = path.join(tmp('one'), 'f.txt');
  write(file, 'has alpha-needle only');
  assert.deepEqual(await scanFile(file, [{ label: 'a', values: ['alpha-needle'] }, { label: 'b', values: ['beta-needle'] }]), ['a']);
});

test('a diff of the trial window splits into the paths that also changed in the control window, and new ones', () => {
  const trial = {
    t: { ...noChange, added: ['new.txt', 'churn-added.txt'], changed: ['live.log', 'fresh.log'], removed: ['gone.txt'] },
    u: { ...noChange, appeared: true, added: ['x'] },
  };
  const control = { t: { ...noChange, changed: ['live.log'], added: ['churn-added.txt'] }, u: noChange };
  assert.deepEqual(splitByControl(trial, control), {
    fresh: { t: { ...noChange, added: ['new.txt'], changed: ['fresh.log'], removed: ['gone.txt'] }, u: { ...noChange, appeared: true, added: ['x'] } },
    baseline: { t: { ...noChange, added: ['churn-added.txt'], changed: ['live.log'] }, u: noChange },
  });
});

// ---- the command the fake API has the agent run ------------------------------------------------------------

/** A real POSIX shell to run the command in, or null: Git Bash on Windows (the shell Claude Code's Bash tool
 * uses there; the bare `bash` on a Windows PATH may be WSL's, which is not), `bash` elsewhere. */
function findBash() {
  const candidates = process.platform === 'win32' ? ['C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Program Files (x86)\\Git\\bin\\bash.exe'] : ['bash'];
  return candidates.find((candidate) => spawnSync(candidate, ['-c', 'printf %s "$BASH_VERSION"'], { encoding: 'utf8' }).stdout?.trim());
}

test('the Bash command writes the environment and the nonce into the workspace and prints the environment', { skip: findBash() ? false : 'no bash on this machine' }, () => {
  const bash = findBash();
  const cwd = tmp('shell');
  const env = { ...Object.fromEntries(PROBE_ENV_VARS.map((name) => [name, `/value/of/${name} with spaces`])), PATH: process.env.PATH, CLAUDE_CODE_OAUTH_TOKEN: 'oauth-sentinel-must-not-print' };
  const result = spawnSync(bash, ['-c', probeCommand(NONCE)], { cwd, env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const parsed = parseEnvLines(result.stdout);
  for (const name of PROBE_ENV_VARS) assert.equal(parsed[name], `/value/of/${name} with spaces`, name);
  assert.equal(parsed.OAUTH_TOKEN_SET, 'yes');
  assert.ok(!result.stdout.includes('oauth-sentinel-must-not-print'), 'the token itself is never printed');
  assert.equal(fs.readFileSync(path.join(cwd, 'probe-env.txt'), 'utf8'), result.stdout);
  assert.equal(fs.readFileSync(path.join(cwd, 'probe-nonce.txt'), 'utf8').trim(), NONCE);
  const without = spawnSync(bash, ['-c', probeCommand(NONCE)], { cwd, env: { PATH: process.env.PATH }, encoding: 'utf8' });
  assert.equal(parseEnvLines(without.stdout).OAUTH_TOKEN_SET, '', 'no token in the env prints nothing');
});

test('parseEnvLines reads NAME=value lines, keeps = inside values and ignores other text', () => {
  assert.deepEqual(parseEnvLines('HOME=C:\\a b\r\nURL=http://x/?a=b\nnot a line\nEMPTY=\n'), { HOME: 'C:\\a b', URL: 'http://x/?a=b', EMPTY: '' });
});

// ---- the probe end to end, against a fake claude ---------------------------------------------------------

const FAKE_NONCE = '0123456789abcdef0123456789abcdef';
const CREDENTIAL_SENTINEL = 'CREDENTIAL-SENTINEL-NEVER-READ';
const OAUTH_SENTINEL = 'oauth-sentinel-from-the-real-env';
const noInit = async () => ({ status: 0, stdout: '', stderr: '' });
const GLOBAL_CLAUDE_MD = [
  '# Global instructions',
  'Always answer in the language the user writes in, and keep every reply as short as the question allows.',
  'Never claim a command was run unless its output was observed in this very session by the agent itself.',
  'Prefer small reversible steps and say what was verified before saying that anything is done at all.',
  '',
].join('\n');

/** A fake machine: a real home holding every tree the probe watches (and a credentials file), the folders
 * LOCALAPPDATA and TEMP would be, all inside the test's scratch directory. The probe reads it for the
 * current arm's template and hashes it; the real home is never touched. */
function fakeMachine() {
  const base = tmp('machine');
  const realHome = path.join(base, 'person');
  const localAppData = path.join(realHome, 'AppData', 'Local');
  const tempDir = path.join(base, 'temp');
  const workRoot = path.join(base, 'work');
  fs.mkdirSync(workRoot);
  const claude = path.join(realHome, '.claude');
  write(path.join(claude, 'settings.json'), '{"model":"opus"}\n');
  write(path.join(claude, 'CLAUDE.md'), GLOBAL_CLAUDE_MD);
  write(path.join(claude, '.credentials.json'), CREDENTIAL_SENTINEL);
  write(path.join(claude, 'projects', 'live', 'session.jsonl'), '{"a":1}\n');
  write(path.join(claude, 'skills', 'demo', 'SKILL.md'), '# demo\n');
  write(path.join(realHome, '.claude.json'), '{"numStartups":1,"mcpServers":{"engram":{"command":"engram","args":["mcp"]}}}\n');
  write(path.join(realHome, '.engram', 'engram.db'), 'real memories');
  write(path.join(realHome, '.gentle-ai', 'state.json'), '{"rdd_mode":"on"}\n');
  write(path.join(realHome, '.codegraph', 'index.db'), 'graph');
  write(path.join(realHome, '.orca', 'o.json'), '{}');
  write(path.join(realHome, '.js-harness', 'doctor.json'), '{}');
  write(path.join(localAppData, 'claude-cli-nodejs', 'Cache', 'log.txt'), 'log');
  write(path.join(realHome, '.local', 'state', 'claude', 'locks', 'l'), 'lock');
  write(path.join(realHome, '.local', 'share', 'claude', 'versions', '2.1.0'), 'a binary');
  write(path.join(tempDir, 'claude', 'scratch.txt'), 'scratch');
  return { realHome, localAppData, tempDir, workRoot };
}

/** `assertWorkRoot` as the probe runs it, except that only the scratch directory is searched for project
 * memory: the scratch directory is under this machine's temp folder, inside the real home, whose own
 * `.claude` the real check rightly finds above it. The probe's default check is exercised separately. */
const scratchOnly = (target) => {
  const relative = path.relative(scratch, target);
  return !relative.startsWith('..') && !path.isAbsolute(relative) && fs.lstatSync(target, { throwIfNoEntry: false }) !== undefined;
};
const checkInScratch = (root, { realHome }) => assertWorkRoot(root, { realHome, exists: scratchOnly });

const wholeHome = (root) => snapshotTrees([{ name: 'home', root, mode: 'content' }]);
/** `claude` replaced by the fake, which runs under node; the config's env, `prepare` and sandbox stay. */
const fakeClaude = (mode, machine, { prepare, pidFile } = {}) => (config) => ({
  ...config,
  command: process.execPath,
  args: () => [FAKE_CLAUDE, mode, machine.realHome, ...(pidFile ? [pidFile] : [])],
  ...(prepare && { prepare: async (context) => { const prepared = await config.prepare(context); await prepare(context); return prepared; } }),
});
const probe = (machine, mode, extra = {}) => runIsolationProbe({
  claude: process.execPath,
  nonce: FAKE_NONCE,
  realHome: machine.realHome,
  localAppData: machine.localAppData,
  tempDir: machine.tempDir,
  workRoot: machine.workRoot,
  checkWorkRoot: checkInScratch,
  runInit: noInit,
  adaptConfig: fakeClaude(mode, machine),
  sweep: () => ({ killed: [] }), // the real sweep costs about a second; the tests that are about it pass `sweep: undefined`
  runProcess: later.runProcess, // recorded, and searched once at the end of the file (see `later`)
  killPort: () => ({ killed: [] }), // likewise the kill by port and the listing of engram processes: the tests about them pass their own
  listEngram: () => [],
  log: () => {},
  timeoutMs: 60_000,
  ...extra,
});
const leftovers = (machine) => (fs.existsSync(machine.workRoot) ? fs.readdirSync(machine.workRoot).filter((name) => name.startsWith('js-harness-iso-')) : []);
async function withOauthToken(fn) {
  const previous = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  process.env.CLAUDE_CODE_OAUTH_TOKEN = OAUTH_SENTINEL;
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    else process.env.CLAUDE_CODE_OAUTH_TOKEN = previous;
  }
}

test('a well-behaved agent passes on both arms: positive controls hold, no leak, the real home is untouched, and everything is cleaned up', async () => {
  const machine = fakeMachine();
  const before = await wholeHome(machine.realHome);
  const report = await withOauthToken(() => probe(machine, 'ok'));
  assert.deepEqual(report.failures, []);
  assert.equal(report.ok, true);
  assert.deepEqual(report.arms.map((arm) => arm.arm), ['current', 'minimal']);
  assert.deepEqual(report.config, { model: 'claude-opus-5-5', effort: 'medium', permissionMode: 'bypassPermissions' });

  for (const arm of report.arms) {
    assert.equal(arm.exitCode, 0, arm.arm);
    assert.equal(arm.timedOut, false);
    assert.equal(arm.agent.isError, false);
    assert.equal(arm.positiveControls.transcript.ok, true);
    assert.match(arm.positiveControls.transcript.path, /^\.claude\/projects\/x\/[0-9a-f-]{36}\.jsonl$/);
    assert.equal(arm.positiveControls.workspaceNonce.ok, true);
    assert.equal(arm.positiveControls.workspaceWrite.ok, true);
    assert.deepEqual(arm.leak.hits, []);
    assert.deepEqual(arm.fakeApi.requests.map((r) => r.reply), arm.arm === 'current' ? ENGRAM_REPLIES : ['tool_use:Bash', 'tool_use:Write', 'text']);
    assert.ok(arm.fakeApi.requests.every((r) => r.method === 'POST' && r.path === '/v1/messages' && r.model === 'claude-opus-5-5'));
    assert.match(arm.fakeApi.envLines.ANTHROPIC_BASE_URL, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.equal(arm.fakeApi.envLines.OAUTH_TOKEN_SET, '', 'the real login token was removed from the agent env');
    for (const name of ['HOME', 'USERPROFILE', 'CLAUDE_CONFIG_DIR', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'ENGRAM_DATA_DIR', 'JS_HARNESS_HOME']) {
      assert.equal(arm.fakeApi.envChecks[name], 'inside', `${arm.arm}: ${name} is inside the sandbox`);
    }
    assert.equal(arm.sandbox.answers.historyJsonl, true);
    assert.equal(arm.sandbox.answers.claudeCliNodejs, false);
    assert.ok(arm.sandbox.created.paths.includes(arm.positiveControls.transcript.path));
    assert.ok(!arm.sandbox.created.paths.includes('.claude/settings.json'), 'what the seed put there is not what the trial created');
    assert.ok(arm.sandbox.top.some((row) => row.path === '.claude' && row.files > 0));
    assert.equal(arm.sandbox.kept, null);
  }
  const [current, minimal] = report.arms;
  assert.equal(current.positiveControls.engramDb.ok, true);
  assert.equal(current.positiveControls.engramDb.applies, true);
  assert.equal(minimal.positiveControls.engramDb.applies, false);
  assert.ok(current.template.files > 0);
  assert.ok(current.sandbox.top.some((row) => row.path === '.claude/skills'), 'the current arm home holds the seeded skills');
  assert.ok(!minimal.sandbox.top.some((row) => row.path === '.claude/skills'));

  assert.ok(report.hashing.length >= 3 && report.hashing.every((entry) => entry.ms >= 0 && entry.files > 0));
  assert.deepEqual(leftovers(machine), [], 'sandbox homes, workspaces and the template are gone');
  const after = await wholeHome(machine.realHome);
  assert.deepEqual(diffSnapshots(before, after).home, noChange, 'the fake real home is byte-identical');
});

test('neither the report nor the printed summary holds the nonce, the dummy key or the real login token', async () => {
  const machine = fakeMachine();
  const report = await withOauthToken(() => probe(machine, 'ok'));
  const serialized = JSON.stringify(report);
  const summary = formatSummary(report);
  for (const secret of [FAKE_NONCE, DUMMY_API_KEY, OAUTH_SENTINEL, CREDENTIAL_SENTINEL]) {
    assert.ok(!serialized.includes(secret) && !summary.includes(secret), `${secret} is nowhere in the output`);
  }
  assert.match(summary, /PASS/);
  assert.match(summary, /current/);
  assert.match(summary, /minimal/);
});

test('a nonce written into the real .claude fails the probe and names the file, not the nonce', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'leak', { arms: ['minimal'] });
  assert.equal(report.ok, false);
  assert.deepEqual(report.arms[0].leak.hits, [{ tree: '.claude', path: 'leaked.txt', found: ['nonce'], via: 'content' }]);
  assert.deepEqual(report.arms[0].leak.diff['.claude'].added.paths, ['leaked.txt']);
  assert.ok(report.failures.some((failure) => /leak/i.test(failure) && failure.includes('leaked.txt')), report.failures.join('\n'));
  assert.ok(!JSON.stringify(report).includes(FAKE_NONCE));
  assert.ok(!formatSummary(report).includes(FAKE_NONCE));
  assert.match(formatSummary(report), /FAIL/);
  assert.match(formatSummary(report), /leaked\.txt/);
});

test('a real project folder named after the sandbox fails the probe even with no nonce in it', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'leak-path', { arms: ['minimal'] });
  assert.equal(report.ok, false);
  const [hit] = report.arms[0].leak.hits;
  assert.equal(hit.tree, '.claude');
  assert.equal(hit.via, 'name');
  assert.deepEqual(hit.found, ['sandbox']);
  assert.match(hit.path, /^projects\/.*js-harness-iso-probe-.*\/session\.json$/);
  assert.ok(hit.path.includes(report.arms[0].sandboxToken));
});

test('a sandbox that writes nothing fails its positive controls, so a vacuous pass is impossible', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'silent');
  assert.equal(report.ok, false);
  for (const arm of report.arms) {
    assert.deepEqual(arm.leak.hits, [], 'there is nothing to leak');
    assert.equal(arm.positiveControls.transcript.ok, false);
    assert.equal(arm.positiveControls.workspaceNonce.ok, false);
    assert.equal(arm.positiveControls.workspaceWrite.ok, false);
    assert.equal(arm.ok, false);
  }
  assert.equal(report.arms[0].positiveControls.engramDb.ok, false);
  assert.ok(report.failures.some((failure) => /transcript/.test(failure)), report.failures.join('\n'));
});

test('what an agent prints to stderr is quoted scrubbed: the key, the nonce and the login token never reach the report', async () => {
  const machine = fakeMachine();
  const report = await withOauthToken(() => probe(machine, 'noisy', { arms: ['minimal'] }));
  const arm = report.arms[0];
  assert.equal(arm.exitCode, 2);
  assert.equal(arm.ok, false);
  assert.match(arm.stderrTail, /boom/);
  for (const secret of [FAKE_NONCE, DUMMY_API_KEY, OAUTH_SENTINEL]) {
    assert.ok(!JSON.stringify(report).includes(secret) && !formatSummary(report).includes(secret), secret);
  }
});

test('a control window measures the churn of live writers, and splits it from what is new in the trial window', async () => {
  const machine = fakeMachine();
  const live = path.join(machine.realHome, '.engram', 'live.log');
  write(live, 'a');
  const report = await probe(machine, 'ok', {
    arms: ['minimal'],
    controlMs: 7,
    wait: async (ms) => {
      assert.equal(ms, 7);
      fs.appendFileSync(live, 'b');
    },
    adaptConfig: fakeClaude('ok', machine, {
      prepare: () => {
        fs.appendFileSync(live, 'c');
        write(path.join(machine.realHome, '.engram', 'surprise.db'), 'x');
      },
    }),
  });
  assert.equal(report.control.ms, 7);
  assert.deepEqual(report.control.diff['.engram'].changed.paths, ['live.log']);
  const { leak } = report.arms[0];
  assert.deepEqual(leak.diff['.engram'].added.paths, ['surprise.db']);
  assert.deepEqual(leak.diff['.engram'].changed.paths, ['live.log']);
  assert.deepEqual(leak.fresh['.engram'].added.paths, ['surprise.db']);
  assert.equal(leak.fresh['.engram'].changed, undefined, 'live.log is baseline churn, not new');
  assert.deepEqual(leak.baseline['.engram'].changed.paths, ['live.log']);
  assert.equal(report.ok, true, 'diff entries alone never fail the run');
  assert.match(formatSummary(report), /surprise\.db/);
});

test('without a control window the report has no baseline split', async () => {
  const report = await probe(fakeMachine(), 'ok', { arms: ['minimal'] });
  assert.equal(report.control, null);
  assert.equal(report.arms[0].leak.fresh, undefined);
});

test('--keep-sandbox keeps the sandbox for inspection; the template is removed either way', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'ok', { arms: ['current'], keepSandbox: true });
  const kept = report.arms[0].sandbox.kept;
  assert.ok(fs.existsSync(path.join(kept, 'workspace', 'probe-nonce.txt')));
  assert.deepEqual(leftovers(machine), [path.basename(kept)], 'only the sandbox is left');
});

test('a failing arm is reported and cleaned up, and the other arm still runs', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'ok', {
    runInit: async () => {
      throw new Error('init exploded');
    },
  });
  assert.equal(report.ok, false);
  const [current, minimal] = report.arms;
  assert.equal(current.ok, false);
  assert.match(current.error, /init exploded/);
  assert.equal(minimal.ok, true);
  assert.deepEqual(leftovers(machine), [], 'the template and both sandboxes are gone');
});

test('an agent that outlives the timeout is killed and reported as timed out', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'hang', { arms: ['minimal'], timeoutMs: 1500 });
  assert.equal(report.arms[0].timedOut, true);
  assert.equal(report.ok, false);
  // It hangs before doing anything, so the timeout is what ends a run that did nothing, not one that
  // finished its work and then lingered.
  assert.equal(report.arms[0].fakeApi.requestCount, 0, 'no request was made');
  assert.equal(report.arms[0].positiveControls.transcript.ok, false, 'and nothing was written: there is no transcript');
  assert.equal(report.arms[0].positiveControls.workspaceWrite.ok, false);
  assert.deepEqual(leftovers(machine), []);
});

test('a variable the agent tools see outside the sandbox is flagged as a warning, an unset one as empty, and neither fails the run', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'wrong-env', { arms: ['minimal'] });
  const arm = report.arms[0];
  assert.equal(arm.fakeApi.envChecks.HOME, 'outside');
  assert.equal(arm.fakeApi.envChecks.TMPDIR, 'empty');
  assert.equal(arm.fakeApi.envChecks.USERPROFILE, 'inside');
  assert.deepEqual(arm.warnings, ["the agent's tools see HOME outside the sandbox"]);
  assert.equal(report.ok, true, 'the leak scan decides, not a shell that rewrites a variable');
  assert.match(formatSummary(report), /!! HOME=\/c\/Users\/someone-real/);
});

test('a claude binary that does not exist is a failed arm, not a crash', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'ok', { arms: ['minimal'], claude: path.join(scratch, 'no-such-claude.exe'), adaptConfig: (config) => config });
  assert.equal(report.ok, false);
  assert.match(report.arms[0].spawnError, /ENOENT/);
  assert.ok(report.failures.some((failure) => /could not be started/.test(failure)));
  assert.deepEqual(leftovers(machine), []);
});

test('the probe refuses a relative claude path and an unknown arm before touching anything', async () => {
  const machine = fakeMachine();
  await assert.rejects(probe(machine, 'ok', { claude: 'claude' }), /absolute path/);
  await assert.rejects(probe(machine, 'ok', { arms: ['both'] }), /unknown arm/);
  assert.deepEqual(leftovers(machine), []);
});

// ---- the watched trees and the command line --------------------------------------------------------------

test('the default trees are the writers of the T2 map, with the credentials file, the binaries and .config stat-only', () => {
  const trees = defaultTrees({ realHome: path.join(scratch, 'h'), localAppData: path.join(scratch, 'h', 'AppData', 'Local'), tempDir: path.join(scratch, 'tmpdir') });
  const home = (...parts) => path.join(scratch, 'h', ...parts);
  assert.deepEqual(trees.map(({ name, root, mode, statOnly, jsonKeys }) => ({ name, root, mode, ...(statOnly && { statOnly }), ...(jsonKeys && { jsonKeys }) })), [
    { name: '.claude', root: home('.claude'), mode: 'content', statOnly: ['.credentials.json'] },
    { name: '.claude.json', root: home('.claude.json'), mode: 'content', jsonKeys: true },
    { name: '.engram', root: home('.engram'), mode: 'content' },
    { name: '.gentle-ai', root: home('.gentle-ai'), mode: 'content' },
    { name: '.codegraph', root: home('.codegraph'), mode: 'content' },
    { name: '.orca', root: home('.orca'), mode: 'content' },
    { name: '.js-harness', root: home('.js-harness'), mode: 'content' },
    { name: 'AppData/Local/claude-cli-nodejs', root: home('AppData', 'Local', 'claude-cli-nodejs'), mode: 'content' },
    { name: '%TEMP%/claude', root: path.join(scratch, 'tmpdir', 'claude'), mode: 'content' },
    { name: '.local/state/claude', root: home('.local', 'state', 'claude'), mode: 'content' },
    { name: '.local/share/claude', root: home('.local', 'share', 'claude'), mode: 'stat' },
    { name: '.config', root: home('.config'), mode: 'stat' },
    { name: '~ (top level)', root: home(), mode: 'names' },
    { name: 'AppData/Local (top level)', root: home('AppData', 'Local'), mode: 'names' },
  ]);
});

/** `main`'s writers, collecting what it prints. */
function capture() {
  const out = { stdout: '', stderr: '' };
  return { out, stdout: { write: (text) => { out.stdout += text; } }, stderr: { write: (text) => { out.stderr += text; } } };
}
const overridesFor = (machine, mode) => ({
  nonce: FAKE_NONCE, realHome: machine.realHome, localAppData: machine.localAppData, tempDir: machine.tempDir, workRoot: machine.workRoot, checkWorkRoot: checkInScratch, runInit: noInit, adaptConfig: fakeClaude(mode, machine), killPort: () => ({ killed: [] }), listEngram: () => [], runProcess: later.runProcess,
});

test('the command writes the JSON report, prints the summary, and exits 0 on a pass and 1 on a failure', async () => {
  const machine = fakeMachine();
  const reportFile = path.join(tmp('out'), 'nested', 'report.json');
  const pass = capture();
  const code = await main(['--claude', process.execPath, '--arm', 'minimal', '--control-ms', '5', '--timeout-ms', '60000', '--report', reportFile], { ...pass, overrides: overridesFor(machine, 'ok') });
  assert.equal(code, 0, pass.out.stderr);
  const written = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  assert.equal(written.ok, true);
  assert.deepEqual(written.arms.map((arm) => arm.arm), ['minimal']);
  assert.equal(written.control.ms, 5);
  assert.match(pass.out.stdout, /isolation probe: PASS/);
  assert.ok(pass.out.stdout.includes(reportFile));
  for (const text of [pass.out.stdout, pass.out.stderr, fs.readFileSync(reportFile, 'utf8')]) assert.ok(!text.includes(FAKE_NONCE) && !text.includes(DUMMY_API_KEY));
  assert.ok(!pass.out.stderr.includes('js-harness-iso-probe'), 'progress lines never name the sandbox');

  const fail = capture();
  const failCode = await main(['--claude', process.execPath, '--arm', 'minimal', '--keep-sandbox', '--report', reportFile], { ...fail, overrides: overridesFor(machine, 'leak') });
  assert.equal(failCode, 1);
  assert.match(fail.out.stdout, /isolation probe: FAIL/);
  assert.ok(JSON.parse(fs.readFileSync(reportFile, 'utf8')).arms[0].sandbox.kept, '--keep-sandbox reached the probe');
});

test('the command rejects bad arguments with exit 2, a message and the usage, and runs nothing', async () => {
  const machine = fakeMachine();
  const cases = [
    [[], /--claude .* is required/],
    [['--claude', 'claude'], /absolute path/],
    [['--claude', process.execPath, '--arm', 'weird'], /--arm must be/],
    [['--claude', process.execPath, '--control-ms', 'abc'], /non-negative integer/],
    [['--claude', process.execPath, '--timeout-ms'], /needs a value/],
    [['--claude', process.execPath, '--bogus'], /unknown argument "--bogus"/],
  ];
  for (const [argv, message] of cases) {
    const io = capture();
    assert.equal(await main(argv, { ...io, overrides: overridesFor(machine, 'ok') }), 2, argv.join(' '));
    assert.match(io.out.stderr, message);
    assert.match(io.out.stderr, /usage: node evals\/isolation-probe\.mjs/);
    assert.equal(io.out.stdout, '');
  }
  assert.deepEqual(leftovers(machine), []);
});

// ---- C6a: an arm of one component holds it not, and its base holds it -----------------------------------

/** The fake machine with a second MCP server, which the fake claude offers a tool of. */
function armMachine() {
  const machine = fakeMachine();
  write(path.join(machine.realHome, '.claude.json'), '{"numStartups":1,"mcpServers":{"engram":{"command":"engram","args":["mcp"]},"context7":{"command":"c7"}}}\n');
  return machine;
}
const componentChecks = (arm) => arm.components.map((check) => [check.id, check.expected, check.ok]);

test('an arm of one component runs beside its base: the base carries the component, the arm carries none of it, and both pass', async () => {
  for (const [arm, id] of [['current-without-mcp-context7', 'mcp-context7'], ['current-without-claude-md', 'claude-md']]) {
    const machine = armMachine();
    const report = await probe(machine, 'ok', { arms: ['current', arm] });
    assert.deepEqual(report.failures, [], arm);
    assert.deepEqual(report.arms.map((entry) => entry.arm), ['current', arm]);
    const [base, cut] = report.arms;
    assert.deepEqual(componentChecks(base), [[id, 'present', true]], arm);
    assert.equal(base.components[0].mainRequestHit, true, arm);
    assert.deepEqual(componentChecks(cut), [[id, 'absent', true]], arm);
    assert.equal(cut.components[0].carried, 0, arm);
    assert.equal(cut.positiveControls.transcript.ok, true, arm);
    assert.equal(cut.positiveControls.engramDb.applies, true, `${arm}: an arm that keeps engram is held to its controls`);
    assert.match(formatSummary(report), new RegExp(`component ${id}: absent, as it should`), arm);
    assert.deepEqual(leftovers(machine), [], arm);
  }
  const [, cut] = (await probe(armMachine(), 'ok', { arms: ['current', 'current-without-claude-md'] })).arms;
  assert.match(cut.contamination.skipped, /takes part of the global CLAUDE\.md out/);
});

test('an arm that still carries its component fails, and so does a base that never carried it', async () => {
  const kept = await probe(armMachine(), 'keeps-servers', { arms: ['current', 'current-without-mcp-context7'] });
  assert.equal(kept.ok, false);
  assert.ok(kept.failures.some((failure) => /^current-without-mcp-context7: mcp-context7 is still carried on \d+ of \d+ requests/.test(failure)), kept.failures.join('\n'));
  const blind = await probe(armMachine(), 'blind', { arms: ['current', 'current-without-claude-md'] });
  assert.ok(blind.failures.some((failure) => /^current: claude-md is not carried on the main-model request/.test(failure)), blind.failures.join('\n'));
});

test('a component a request carries nothing of is reported unseen, as a warning that fails nothing', async () => {
  const report = await probe(armMachine(), 'ok', { arms: ['current', 'current-without-project'] });
  assert.deepEqual(report.failures, []);
  const [base, cut] = report.arms;
  assert.deepEqual(componentChecks(base), [['project', 'present', null]]);
  assert.equal(base.components[0].unseen, true);
  assert.ok(cut.warnings.some((warning) => /project: a request carries nothing of it, so the probe cannot see it/.test(warning)));
});

test('an arm the probe cannot run yet, or without its base, is refused before anything is made', async () => {
  const machine = armMachine();
  await assert.rejects(probe(machine, 'ok', { arms: ['current-without-mcp-context7'] }), /needs its base, current/);
  await assert.rejects(probe(machine, 'ok', { arms: ['minimal', 'minimal-with-mcp-engram'] }), /minimal-with/);
  await assert.rejects(probe(machine, 'ok', { arms: ['current', 'current-without-agents-md'] }), /agents-md is not a component/);
  assert.deepEqual(leftovers(machine), []);
});

test('--arm takes an arm of one component, and runs it beside its base', async () => {
  const machine = armMachine();
  const io = capture();
  const reportFile = path.join(tmp('out'), 'report.json');
  assert.equal(await main(['--claude', process.execPath, '--arm', 'current-without-mcp-context7', '--report', reportFile], { ...io, overrides: overridesFor(machine, 'ok') }), 0, io.out.stdout);
  assert.deepEqual(JSON.parse(fs.readFileSync(reportFile, 'utf8')).arms.map((arm) => arm.arm), ['current', 'current-without-mcp-context7']);
  const bad = capture();
  assert.equal(await main(['--claude', process.execPath, '--arm', 'current-without-nothing'], { ...bad, overrides: overridesFor(machine, 'ok') }), 2);
  assert.match(bad.out.stderr, /nothing is not a component/);
});

// ---- the work root ---------------------------------------------------------------------------------------

test('trials run under the work root and never under the temp folder, and the current arm template is built there too', async () => {
  const machine = fakeMachine();
  const places = [];
  const templateDuring = {};
  const report = await probe(machine, 'ok', {
    adaptConfig: (config, { arm }) => fakeClaude('ok', machine, {
      prepare: ({ home, workspace }) => {
        places.push(home, workspace);
        templateDuring[arm] = fs.readdirSync(machine.workRoot).some((name) => name.startsWith('js-harness-iso-template-'));
      },
    })(config),
  });
  assert.equal(report.ok, true, report.failures.join('\n'));
  assert.equal(places.length, 4);
  for (const place of places) {
    assert.ok(place.startsWith(machine.workRoot + path.sep), `${place} is under the work root`);
    assert.ok(!place.startsWith(machine.tempDir + path.sep), `${place} is not under the temp folder`);
  }
  assert.deepEqual(templateDuring, { current: true, minimal: false });
  assert.equal(report.workRoot, machine.workRoot);
  assert.equal(report.workRootCreated, false);
  assert.ok(fs.existsSync(machine.workRoot), 'a work root that existed before is never removed');
  assert.deepEqual(leftovers(machine), []);
});

test('a work root that is missing is created, and removed again only if the probe made it and left nothing in it', async () => {
  const machine = fakeMachine();
  const made = path.join(machine.workRoot, 'made-by-the-probe');
  const report = await probe(machine, 'ok', { arms: ['minimal'], workRoot: made });
  assert.equal(report.workRootCreated, true);
  assert.equal(fs.existsSync(made), false, 'removed: it was created here and is empty');
  assert.ok(fs.existsSync(machine.workRoot), 'its parent is not the probe to remove');

  const kept = path.join(machine.workRoot, 'kept-by-the-probe');
  await probe(machine, 'ok', { arms: ['minimal'], workRoot: kept, keepSandbox: true });
  assert.equal(fs.readdirSync(kept).length, 1, 'a kept sandbox keeps its root');
});

test('the work root is checked before anything is created: inside the real home, or under project memory, the probe refuses', async () => {
  const machine = fakeMachine();
  const insideHome = path.join(machine.realHome, 'work');
  await assert.rejects(probe(machine, 'ok', { workRoot: insideHome, checkWorkRoot: undefined }), /inside the real home/);
  assert.equal(fs.existsSync(insideHome), false);

  const parent = tmp('memory-above');
  fs.writeFileSync(path.join(parent, 'CLAUDE.md'), 'x\n');
  const under = path.join(parent, 'work');
  await assert.rejects(probe(machine, 'ok', { workRoot: under, checkWorkRoot: undefined }), (error) => error.message.includes(path.join(parent, 'CLAUDE.md')));
  assert.equal(fs.existsSync(under), false);
  assert.deepEqual(fs.readdirSync(machine.tempDir).filter((name) => name.startsWith('js-harness-iso-')), [], 'the temp folder holds no sandbox either');
});

test('without --work-root the probe asks for the default work root of this repository', async () => {
  const machine = fakeMachine();
  let asked = null;
  const stop = new Error('stop here');
  await assert.rejects(probe(machine, 'ok', { workRoot: undefined, checkWorkRoot: (root) => { asked = root; throw stop; } }), /stop here/);
  assert.equal(asked, defaultWorkRoot({ repoRoot: path.resolve(here, '..') }));
});

// ---- the contamination check ------------------------------------------------------------------------------

test('the minimal arm carries no CLAUDE.md and the current arm carries the seeded copy on its main requests: both are checked', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'ok');
  const [current, minimal] = report.arms;
  assert.deepEqual(current.contamination, { expected: 'present', markers: 3, requests: 6, withGlobalClaudeMd: 6, mainRequestHit: true, ok: true }, 'the subagent request is one of the six');
  assert.deepEqual(minimal.contamination, { expected: 'absent', markers: 3, requests: 3, withGlobalClaudeMd: 0, mainRequestHit: false, ok: true });
  assert.deepEqual(report.failures, []);
  const summary = formatSummary(report);
  assert.match(summary, /work root: .*work/);
  assert.match(summary, /contamination: the real global CLAUDE\.md reached 6 of 6 requests, as it should/);
  assert.match(summary, /contamination: the real global CLAUDE\.md reached none of 3 requests, as it should/);
});

test('a minimal arm whose requests carry the real global CLAUDE.md fails the probe', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'loads-real', { arms: ['minimal'] });
  const [minimal] = report.arms;
  assert.equal(report.ok, false);
  assert.equal(minimal.contamination.ok, false);
  assert.equal(minimal.contamination.withGlobalClaudeMd, 3);
  assert.ok(report.failures.some((failure) => /minimal arm loaded the real global CLAUDE\.md/.test(failure)), report.failures.join('\n'));
  assert.match(formatSummary(report), /minimal arm loaded the real global CLAUDE\.md/);
});

test('a current arm that never carries the global CLAUDE.md on a main request fails the probe: the seeded copy was not loaded', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'blind', { arms: ['current'] });
  const [current] = report.arms;
  assert.equal(report.ok, false);
  assert.equal(current.contamination.mainRequestHit, false);
  assert.equal(current.contamination.ok, false);
  assert.ok(report.failures.some((failure) => /current arm never carried the global CLAUDE\.md/.test(failure)), report.failures.join('\n'));
  assert.equal(current.positiveControls.transcript.ok, true, 'the rest of the arm held');
});

test('with no real global CLAUDE.md there is nothing to compare: the check is skipped with a warning, and fails nothing', async () => {
  const machine = fakeMachine();
  fs.rmSync(path.join(machine.realHome, '.claude', 'CLAUDE.md'));
  const report = await probe(machine, 'ok');
  assert.equal(report.ok, true, report.failures.join('\n'));
  for (const arm of report.arms) {
    assert.deepEqual(arm.contamination, { skipped: 'the real ~/.claude/CLAUDE.md is missing or has no line long enough to recognize it by' });
    assert.ok(arm.warnings.some((warning) => /contamination check was skipped/.test(warning)));
  }
});

test('the lines of the real CLAUDE.md are never in the report or the summary, hit or not', async () => {
  const machine = fakeMachine();
  for (const mode of ['ok', 'loads-real']) {
    const report = await probe(machine, mode, { arms: ['minimal'] });
    const text = JSON.stringify(report) + formatSummary(report);
    for (const line of GLOBAL_CLAUDE_MD.split('\n').filter((candidate) => candidate.length > 50)) assert.ok(!text.includes(line), `${mode}: ${line.slice(0, 30)}`);
  }
});

test('--work-root reaches the probe, and a relative one is a usage error', async () => {
  const machine = fakeMachine();
  const { workRoot, ...overrides } = overridesFor(machine, 'ok');
  const reportFile = path.join(tmp('wr-out'), 'report.json');
  const io = capture();
  const code = await main(['--claude', process.execPath, '--arm', 'minimal', '--work-root', workRoot, '--report', reportFile], { ...io, overrides });
  assert.equal(code, 0, io.out.stderr);
  assert.equal(JSON.parse(fs.readFileSync(reportFile, 'utf8')).workRoot, workRoot);
  const bad = capture();
  assert.equal(await main(['--claude', process.execPath, '--work-root', 'relative/dir'], { ...bad, overrides }), 2);
  assert.match(bad.out.stderr, /--work-root must be an absolute path/);
});

test('a small-model side call that carries the global CLAUDE.md does not stand in for the main-model request', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'side-call-only', { arms: ['current'] });
  const [current] = report.arms;
  assert.equal(current.contamination.withGlobalClaudeMd, 1, 'the side call carried it');
  assert.equal(current.contamination.mainRequestHit, false, 'the main requests did not');
  assert.equal(current.contamination.ok, false);
  assert.equal(report.ok, false);
});

// A subagent's requests are scripted and logged as `subagent`, apart from the main agent's `text` and `tool_use`
// replies. They go to the model like any other, so a real global CLAUDE.md in one of them is contamination too.
test('a minimal arm whose subagent request carries the real global CLAUDE.md fails the probe, though every main request is clean', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'subagent-loads-real', { arms: ['minimal'] });
  const [minimal] = report.arms;
  assert.deepEqual(minimal.fakeApi.requests.map((request) => request.reply), ['tool_use:Bash', 'tool_use:Write', 'text', 'subagent']);
  assert.deepEqual(minimal.contamination, { expected: 'absent', markers: 3, requests: 4, withGlobalClaudeMd: 1, mainRequestHit: false, ok: false });
  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => /minimal arm loaded the real global CLAUDE\.md/.test(failure)), report.failures.join('\n'));
});

test('a minimal arm whose subagent request is clean passes the contamination check, and the request is counted', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'subagent', { arms: ['minimal'] });
  const [minimal] = report.arms;
  assert.deepEqual(minimal.contamination, { expected: 'absent', markers: 3, requests: 4, withGlobalClaudeMd: 0, mainRequestHit: false, ok: true });
  assert.deepEqual(report.failures, []);
});

test('a current arm whose only request with the global CLAUDE.md is the subagent\'s still fails: the main model never carried it', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'subagent-only', { arms: ['current'] });
  const [current] = report.arms;
  assert.equal(current.contamination.withGlobalClaudeMd, 1, 'the subagent request carried it');
  assert.equal(current.contamination.mainRequestHit, false);
  assert.equal(current.contamination.ok, false);
  assert.equal(report.ok, false);
});

// ---- processes a trial leaves behind ------------------------------------------------------------------------

const isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const waitUntil = async (predicate, ms = 3000) => {
  const deadline = Date.now() + ms;
  while (!predicate() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
  return predicate();
};
const WINDOWS_ONLY = process.platform === 'win32' ? false : 'a held directory only blocks its removal on Windows';

// What a test that failed may have left running: the pid in `pidFile`, a number the agent wrote, is killed only
// if it still runs and started after `since`, and then by its creation time (see `process-tree.testkit.mjs`).
const reaper = createReaper();
const reapHolder = (pidFile, since) => {
  if (!fs.existsSync(pidFile)) return;
  const pid = Number(fs.readFileSync(pidFile, 'utf8'));
  if (pid > 0 && isAlive(pid)) reaper.reap([pid], { since });
};

test('a process left behind by the agent, whose parent is gone and whose command line names the workspace, is killed before the sandbox is removed', { skip: WINDOWS_ONLY }, async () => {
  const machine = fakeMachine();
  const pidFile = path.join(tmp('pids'), 'holder.txt');
  const startedAt = Date.now();
  let holder;
  try {
    const report = await probe(machine, 'orphan', { arms: ['minimal'], sweep: undefined, adaptConfig: fakeClaude('orphan', machine, { pidFile }) });
    holder = Number(fs.readFileSync(pidFile, 'utf8'));
    assert.ok(holder > 0, 'the fake agent left a holder');
    assert.deepEqual(report.failures, []);
    assert.equal(report.ok, true);
    assert.ok(await waitUntil(() => !isAlive(holder)), `the holder ${holder} is still running`);
    assert.deepEqual(leftovers(machine), [], 'the sandbox was removed');
  } finally {
    reapHolder(pidFile, startedAt);
  }
});

test('a sandbox that will not delete is swept again and its removal retried', { skip: WINDOWS_ONLY }, async () => {
  const machine = fakeMachine();
  const pidFile = path.join(tmp('pids'), 'holder.txt');
  const startedAt = Date.now();
  let calls = 0;
  try {
    const report = await probe(machine, 'orphan', {
      arms: ['minimal'],
      adaptConfig: fakeClaude('orphan', machine, { pidFile }),
      // The first sweep finds nothing (the holder is "started late"); only the one that follows a failed removal kills it.
      sweep: (roots, options) => {
        calls += 1;
        return calls === 1 ? { killed: [] } : killByPath(roots, options);
      },
    });
    assert.deepEqual(report.failures, []);
    assert.equal(calls, 2);
    assert.deepEqual(leftovers(machine), []);
  } finally {
    reapHolder(pidFile, startedAt);
  }
});

test('the probe sweeps only the sandbox and the template, inside the work root, before removing them', async () => {
  const machine = fakeMachine();
  const calls = [];
  const report = await probe(machine, 'ok', {
    sweep: (roots, options) => {
      calls.push({ roots: roots.map((root) => path.basename(root)), within: options.within, existed: roots.map((root) => fs.existsSync(root)) });
      return { killed: [] };
    },
  });
  assert.equal(report.ok, true, report.failures.join('\n'));
  assert.equal(calls.length, 2, 'one sweep per arm');
  assert.ok(calls.every((call) => call.within === machine.workRoot && call.existed.every(Boolean)), 'confined to the work root, and before removal');
  const shapes = calls.map((call) => call.roots.map((name) => name.replace(/[A-Za-z0-9]{6}$/, 'XXXXXX')));
  assert.deepEqual(shapes, [['js-harness-iso-probe-XXXXXX', 'js-harness-iso-template-XXXXXX'], ['js-harness-iso-probe-XXXXXX']], 'the current arm: sandbox and template; the minimal arm: sandbox');
});

test('a sweep that fails is a failure of the arm, and the sandbox is still removed', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'ok', {
    arms: ['minimal'],
    sweep: () => {
      throw new Error('powershell is not here');
    },
  });
  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => /sweep/.test(failure) && /powershell is not here/.test(failure)), report.failures.join('\n'));
  assert.deepEqual(leftovers(machine), []);
});

test('the probe runs its arm agent through the run it is handed, and starts no process of its own', async () => {
  const machine = fakeMachine();
  const calls = [];
  // The arm's agent is the only process the probe starts. The stand-in answers it with nothing: the probe reports
  // what it reads, and the sandbox is removed all the same. Only the call is asserted, not the report.
  const runProcess = async (options) => {
    calls.push(options);
    return { stdout: '', stderr: '', exitCode: 0, timedOut: false };
  };
  await probe(machine, 'ok', { arms: ['minimal'], runProcess });
  assert.equal(calls.length, 1, 'one arm, one agent run');
  assert.equal(calls[0].command, process.execPath);
  assert.equal(calls[0].args[0], FAKE_CLAUDE);
  assert.deepEqual(leftovers(machine), [], 'the sandbox was removed');
});

// ---- key-level diff of a JSON file (~/.claude.json) -----------------------------------------------------------

const VALUE_SENTINEL = 'KEYVALUE-SENTINEL-NEVER-PRINTED';
const claudeJsonText = (overrides = {}) => JSON.stringify({
  numStartups: 1,
  cachedGrowthBookFeatures: { a: 1, b: [1, 2] },
  projects: { 'D:/js-harness': { history: [VALUE_SENTINEL] }, 'C:/other': { allowedTools: [] } },
  ...overrides,
});
const jsonTree = (root, extra = {}) => ({ name: 'cj', root, mode: 'content', jsonKeys: true, ...extra });
const HEX64 = /^[0-9a-f]{64}$/;

test('a jsonKeys tree is hashed per top-level key and per project entry: names and hashes, never values', async () => {
  const file = path.join(tmp('keys'), '.claude.json');
  write(file, claudeJsonText());
  const { trees } = await snapshotTrees([jsonTree(file)]);
  const keys = trees.cj.keys.get('.');
  assert.deepEqual([...keys.keys()].sort(), ['cachedGrowthBookFeatures', 'numStartups', 'projects["C:/other"]', 'projects["D:/js-harness"]']);
  assert.ok([...keys.values()].every((hash) => HEX64.test(hash)));
  assert.ok(!JSON.stringify([...keys]).includes(VALUE_SENTINEL), 'no value is kept');
  // The same content in another key order hashes the same: only a real change counts.
  write(file, JSON.stringify({ projects: { 'C:/other': { allowedTools: [] }, 'D:/js-harness': { history: [VALUE_SENTINEL] } }, cachedGrowthBookFeatures: { b: [1, 2], a: 1 }, numStartups: 1 }));
  const reordered = (await snapshotTrees([jsonTree(file)])).trees.cj.keys.get('.');
  assert.deepEqual([...reordered].sort(), [...keys].sort());
});

test('the diff of a jsonKeys tree names the keys that were added, removed and changed, and omits the unchanged', async () => {
  const dir = tmp('keydiff');
  const file = path.join(dir, '.claude.json');
  write(file, claudeJsonText());
  const before = await snapshotTrees([jsonTree(file)]);
  write(file, claudeJsonText({
    numStartups: 2,
    projects: { 'D:/js-harness': { history: [VALUE_SENTINEL, 'one more'] }, 'C:/new': {} },
  }));
  const after = await snapshotTrees([jsonTree(file)]);
  assert.deepEqual(diffSnapshots(before, after).cj, {
    ...noChange,
    changed: ['.'],
    keys: { '.': { added: ['projects["C:/new"]'], removed: ['projects["C:/other"]'], changed: ['numStartups', 'projects["D:/js-harness"]'] } },
  });
  assert.equal(diffSnapshots(before, before).cj.keys, undefined, 'nothing changed, nothing named');
});

test('a created JSON file is compared by key as all added, and a changed one key by key; a tree without jsonKeys never has keys', async () => {
  const dir = tmp('keyplain');
  const file = path.join(dir, '.claude.json');
  const before = await snapshotTrees([jsonTree(file), { name: 'plain', root: dir, mode: 'content' }]);
  write(file, claudeJsonText());
  const after = await snapshotTrees([jsonTree(file), { name: 'plain', root: dir, mode: 'content' }]);
  const diff = diffSnapshots(before, after);
  assert.deepEqual(diff.cj.keys, { '.': { added: ['cachedGrowthBookFeatures', 'numStartups', 'projects["C:/other"]', 'projects["D:/js-harness"]'], removed: [], changed: [] } }, 'every key of a file that was created is added');
  assert.equal(diff.cj.appeared, true);
  assert.equal(diff.plain.keys, undefined, 'a tree that did not ask for keys has none, created file or not');
  write(file, '{"half"');
  const torn = diffSnapshots(before, await snapshotTrees([jsonTree(file)]));
  assert.deepEqual(torn.cj.keys, { '.': { unparsed: true } }, 'a created file that does not parse is not comparable');
  write(file, claudeJsonText({ numStartups: 5 }));
  const changed = diffSnapshots(after, await snapshotTrees([jsonTree(file), { name: 'plain', root: dir, mode: 'content' }]));
  assert.deepEqual(changed.cj.keys['.'].changed, ['numStartups']);
  assert.equal(changed.plain.keys, undefined, 'the same file in a tree that did not ask for keys');
});

test('a file that does not parse (a write caught half way) is reported as not comparable, never as every key changed', async () => {
  const file = path.join(tmp('torn'), '.claude.json');
  write(file, claudeJsonText());
  const before = await snapshotTrees([jsonTree(file)]);
  write(file, '{"numStartups": 2, "projects": {');
  const torn = await snapshotTrees([jsonTree(file)]);
  assert.equal(torn.trees.cj.keys.get('.'), null);
  assert.deepEqual(diffSnapshots(before, torn).cj.keys, { '.': { unparsed: true } });
  write(file, JSON.stringify([1, 2]));
  assert.equal((await snapshotTrees([jsonTree(file)])).trees.cj.keys.get('.'), null, 'JSON that is not an object has no keys');
});

test('key-level changes split by the control window like paths do: a key that also changed with no agent running is baseline', () => {
  const keyed = (keys) => ({ ...noChange, changed: ['.'], keys: { '.': { added: [], removed: [], changed: [], ...keys } } });
  const trial = { cj: keyed({ added: ['projects["C:/new"]'], changed: ['numStartups', 'cachedGrowthBookFeatures'] }) };
  const control = { cj: keyed({ changed: ['numStartups'] }) };
  const { fresh, baseline } = splitByControl(trial, control);
  assert.deepEqual(fresh.cj.keys, { '.': { added: ['projects["C:/new"]'], removed: [], changed: ['cachedGrowthBookFeatures'] } });
  assert.deepEqual(baseline.cj.keys, { '.': { added: [], removed: [], changed: ['numStartups'] } });
  const quiet = splitByControl({ cj: keyed({ changed: ['numStartups'] }) }, control);
  assert.equal(quiet.fresh.cj.keys, undefined, 'nothing fresh, no keys entry');
});

test('keyLeaks flags an added or changed project key that names the sandbox or the work root, in either slash spelling and any case', () => {
  const sandbox = 'js-harness-iso-probe-AbC123';
  const workRoot = path.join(scratch, 'Work Root');
  const diff = (keys) => ({ cj: { ...noChange, changed: ['.'], keys: { '.': { added: [], removed: [], changed: [], ...keys } } } });
  const leaks = (keys) => keyLeaks(diff(keys), { tokens: [sandbox], workRoot });
  assert.deepEqual(leaks({ added: [`projects["${workRoot}${path.sep}${sandbox}${path.sep}workspace"]`] }), [
    { tree: 'cj', path: `projects["${workRoot}${path.sep}${sandbox}${path.sep}workspace"]`, found: ['sandbox', 'workRoot'], via: 'key' },
  ]);
  assert.deepEqual(leaks({ changed: [`projects["C:/anywhere/${sandbox.toLowerCase()}/x"]`] }).map((hit) => hit.found), [['sandbox']]);
  assert.deepEqual(leaks({ added: [`projects["${workRoot.split(path.sep).join('/').toUpperCase()}/y"]`] }).map((hit) => hit.found), [['workRoot']]);
  assert.deepEqual(leaks({ removed: [`projects["C:/${sandbox}"]`] }), [], 'a removed key is not a leak');
  assert.deepEqual(leaks({ added: [`projects["C:/unrelated"]`, 'numStartups', `${sandbox}Feature`] }), [], 'other projects, and keys that are not project entries, are not');
});

// The probe, end to end: what a run does to the fake real ~/.claude.json.

test('a run that touches unrelated keys of ~/.claude.json is reported by key name and does not fail, and no value is printed', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'touch-json', { arms: ['minimal'] });
  assert.equal(report.ok, true, report.failures.join('\n'));
  const keys = report.arms[0].leak.diff['.claude.json'].keys['.'];
  assert.deepEqual(keys.changed.paths, ['numStartups']);
  assert.deepEqual(keys.added.paths, ['projects["C:/unrelated/project"]']);
  assert.deepEqual(report.arms[0].leak.hits, []);
  const text = JSON.stringify(report) + formatSummary(report);
  assert.ok(fs.readFileSync(path.join(machine.realHome, '.claude.json'), 'utf8').includes(VALUE_SENTINEL), 'the run did write the sentinel into the file, so its absence below means something');
  assert.ok(!text.includes(VALUE_SENTINEL), 'values never appear');
  assert.match(formatSummary(report), /keys changed in \.: numStartups/);
  assert.match(formatSummary(report), /keys added in \.: projects\["C:\/unrelated\/project"\]/);
});

test('a project key for the trial workspace added to the real ~/.claude.json fails the probe, as a key hit that names the key', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'leak-key', { arms: ['minimal'] });
  assert.equal(report.ok, false);
  const keyHit = report.arms[0].leak.hits.find((hit) => hit.via === 'key');
  assert.ok(keyHit, JSON.stringify(report.arms[0].leak.hits));
  assert.equal(keyHit.tree, '.claude.json');
  assert.ok(keyHit.path.startsWith('projects["') && keyHit.path.includes(report.arms[0].sandboxToken));
  assert.deepEqual(keyHit.found, ['sandbox', 'workRoot']);
  assert.ok(report.failures.some((failure) => /LEAK: .*a new or changed key/.test(failure) && failure.includes(report.arms[0].sandboxToken)), report.failures.join('\n'));
  assert.ok(!(JSON.stringify(report) + formatSummary(report)).includes(VALUE_SENTINEL));
});

test('a project key that names only the work root is a leak too, which the content scan alone would miss', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'leak-key-workroot', { arms: ['minimal'] });
  assert.equal(report.ok, false);
  assert.deepEqual(report.arms[0].leak.hits.map((hit) => [hit.via, hit.found]), [['key', ['workRoot']]]);
});

test('with a control window, a key that also changed with no agent running is baseline, and a new one is fresh', async () => {
  const machine = fakeMachine();
  const claudeJson = path.join(machine.realHome, '.claude.json');
  const bump = (n) => write(claudeJson, JSON.stringify({ numStartups: n, mcpServers: {} }));
  bump(1);
  const report = await probe(machine, 'touch-json', {
    arms: ['minimal'],
    controlMs: 5,
    wait: async () => bump(2),
  });
  assert.deepEqual(report.control.diff['.claude.json'].keys['.'].changed.paths, ['numStartups']);
  const { leak } = report.arms[0];
  assert.deepEqual(leak.baseline['.claude.json'].keys['.'].changed.paths, ['numStartups']);
  assert.deepEqual(leak.fresh['.claude.json'].keys['.'].added.paths, ['projects["C:/unrelated/project"]']);
  assert.equal(leak.fresh['.claude.json'].keys['.'].changed, undefined);
  assert.equal(report.ok, true);
});

test('only .json files of a jsonKeys tree are compared by key, and a file that parses as JSON but is not named so is left alone', async () => {
  const dir = tmp('keyjson');
  write(path.join(dir, 'a.json'), '{"k":1}');
  write(path.join(dir, 'b.txt'), '{"k":1}');
  const { trees } = await snapshotTrees([{ name: 'd', root: dir, mode: 'content', jsonKeys: true }]);
  assert.deepEqual([...trees.d.keys.keys()], ['a.json']);
});

test('a project key of the work root that a live writer touched in the control window and the trial window again is baseline, not a leak', async () => {
  const machine = fakeMachine();
  const claudeJson = path.join(machine.realHome, '.claude.json');
  const live = path.join(machine.workRoot, 'live-project');
  const rewrite = (version) => write(claudeJson, JSON.stringify({ numStartups: 1, projects: { [live]: { version } } }));
  rewrite(1);
  const report = await probe(machine, 'ok', {
    arms: ['minimal'],
    controlMs: 5,
    wait: async () => rewrite(2),
    adaptConfig: fakeClaude('ok', machine, { prepare: async () => rewrite(3) }),
  });
  const key = `projects["${live}"]`;
  assert.deepEqual(report.arms[0].leak.baseline['.claude.json'].keys['.'].changed.paths, [key]);
  assert.equal(report.arms[0].leak.fresh['.claude.json'], undefined);
  assert.deepEqual(report.arms[0].leak.hits, []);
  assert.equal(report.ok, true, report.failures.join('\n'));
});

test('a file with a byte order mark still parses, and an unparsed file in the control window is baseline when it is unparsed in the trial window too', async () => {
  const file = path.join(tmp('bom'), '.claude.json');
  write(file, `\uFEFF${claudeJsonText()}`);
  const keys = (await snapshotTrees([jsonTree(file)])).trees.cj.keys.get('.');
  assert.ok(keys instanceof Map && keys.has('numStartups'), 'a UTF-8 file written with a BOM is not "unparsed"');
  const torn = { ...noChange, changed: ['.'], keys: { '.': { unparsed: true } } };
  assert.deepEqual(splitByControl({ cj: torn }, { cj: torn }).baseline.cj.keys, { '.': { unparsed: true } });
  assert.equal(splitByControl({ cj: torn }, { cj: torn }).fresh.cj.keys, undefined);
  assert.deepEqual(splitByControl({ cj: torn }, { cj: noChange }).fresh.cj.keys, { '.': { unparsed: true } });
});

test('keyLeaks given an empty work root or no tokens matches nothing, rather than every project key', () => {
  const diff = { cj: { ...noChange, changed: ['.'], keys: { '.': { added: ['projects["C:/anything"]'], removed: [], changed: [] } } } };
  assert.deepEqual(keyLeaks(diff, { tokens: [''], workRoot: '' }), []);
  assert.deepEqual(keyLeaks(diff), []);
});

// ---- the T2s findings ---------------------------------------------------------------------------------------

const keyDiff = (keys) => ({ cj: { ...noChange, changed: ['.'], keys: { '.': { added: [], removed: [], changed: [], ...keys } } } });

test('keyLeaks matches a project path on a directory boundary: a sibling whose name extends the work root or the sandbox is not a leak', () => {
  const sandbox = 'js-harness-iso-probe-AbC123';
  const workRoot = path.join(scratch, 'Work Root');
  const slash = workRoot.split(path.sep).join('/');
  const found = (name) => keyLeaks(keyDiff({ added: [name] }), { tokens: [sandbox], workRoot }).map((hit) => hit.found);
  assert.deepEqual(found(`projects["${slash}-other/project"]`), [], 'a sibling of the work root');
  assert.deepEqual(found(`projects["${slash}2"]`), []);
  assert.deepEqual(found(`projects["${slash}.bak/x"]`), []);
  assert.deepEqual(found(`projects["C:/w/${sandbox}2/workspace"]`), [], 'a sibling of the sandbox');
  assert.deepEqual(found(`projects["C:/w/x${sandbox}/workspace"]`), []);
  assert.deepEqual(found(`projects["${slash}"]`), [['workRoot']], 'the work root itself');
  assert.deepEqual(found(`projects["${slash}/"]`), [['workRoot']], 'with a trailing separator');
  assert.deepEqual(found(`projects["${workRoot}${path.sep}js-harness-iso-template-x${path.sep}template"]`), [['workRoot']], 'beneath it, either separator');
  assert.deepEqual(found(`projects["${slash.toUpperCase()}/Sub"]`), [['workRoot']], 'in any case');
  assert.deepEqual(found(`projects["C:/w/${sandbox}"]`), [['sandbox']], 'the sandbox itself');
  assert.deepEqual(found(`projects["C:\\w\\${sandbox}\\workspace"]`), [['sandbox']]);
});

test('a real .claude.json that did not exist and was created by the run, with a project of the trial in it, is a leak', async () => {
  const machine = fakeMachine();
  fs.rmSync(path.join(machine.realHome, '.claude.json'));
  const report = await probe(machine, 'leak-key', { arms: ['minimal'] });
  assert.equal(report.ok, false);
  const keyHit = report.arms[0].leak.hits.find((hit) => hit.via === 'key');
  assert.deepEqual(keyHit?.found, ['sandbox', 'workRoot']);
  assert.deepEqual(report.arms[0].leak.diff['.claude.json'].keys['.'].added.paths.sort(), ['numStartups', keyHit.path].sort());
});

test('a directory named after the sandbox with nothing in it is found by the name scan, and does not enter the diff', async () => {
  const dir = tmp('emptydirs');
  const token = 'js-harness-iso-probe-EmPty1';
  fs.mkdirSync(path.join(dir, token));
  fs.mkdirSync(path.join(dir, 'a', 'b', token.toLowerCase()), { recursive: true });
  fs.mkdirSync(path.join(dir, 'plain-empty'));
  write(path.join(dir, 'file.txt'), 'x');
  write(path.join(dir, 'in', token, 'f.txt'), 'x'); // a directory with a file in it is named by that file's path already
  const { trees } = await snapshotTrees([{ name: 't', root: dir, mode: 'content' }], { needles: [{ label: 'sandbox', values: [token, token.toLowerCase()] }] });
  assert.deepEqual(trees.t.hits, [
    { path: `a/b/${token.toLowerCase()}`, found: ['sandbox'], via: 'name' },
    { path: `in/${token}/f.txt`, found: ['sandbox'], via: 'name' },
    { path: token, found: ['sandbox'], via: 'name' },
  ]);
  assert.deepEqual([...trees.t.files.keys()].sort(), ['file.txt', `in/${token}/f.txt`], 'empty directories are not files: the diff does not list them');
  const none = await snapshotTrees([{ name: 't', root: dir, mode: 'content' }], { needles: [{ label: 'sandbox', values: ['no-such-name'] }] });
  assert.deepEqual(none.trees.t.hits, []);
});

test('a read that fails is tried again, so a file that is busy for a moment is hashed and not listed as unreadable', async () => {
  const file = path.join(tmp('busy'), 'a.txt');
  write(file, 'content');
  const failure = (code) => Object.assign(new Error(code), { code });
  let calls = 0;
  const flaky = (target, { chunkSize }) => {
    calls += 1;
    if (calls <= 2) throw failure('EBUSY');
    return fs.createReadStream(target, { highWaterMark: chunkSize });
  };
  const { trees } = await snapshotTrees([{ name: 't', root: file, mode: 'content' }], { openRead: flaky, retryDelayMs: 0 });
  assert.equal(calls, 3);
  assert.match(trees.t.files.get('.'), /^sha256:/);
  assert.deepEqual(trees.t.unreadable, []);

  calls = 0;
  const locked = () => {
    calls += 1;
    throw failure('EACCES');
  };
  const stuck = await snapshotTrees([{ name: 't', root: file, mode: 'content' }], { openRead: locked, retryDelayMs: 0 });
  assert.equal(calls, 4, 'the first try and three more');
  assert.deepEqual(stuck.trees.t.unreadable, [{ path: '.', code: 'EACCES' }]);
  assert.equal(stuck.trees.t.files.get('.'), 'unreadable:EACCES');

  calls = 0;
  const gone = () => {
    calls += 1;
    throw failure('ENOENT');
  };
  const vanished = await snapshotTrees([{ name: 't', root: file, mode: 'content' }], { openRead: gone, retryDelayMs: 0 });
  assert.equal(calls, 1, 'a file that is gone is not worth a retry');
  assert.deepEqual(vanished.trees.t.unreadable, []);
});

test('a real file the probe could not read makes the arm inconclusive and names the file, because a clean scan that skipped it proves nothing', async () => {
  const machine = fakeMachine();
  const stuck = (file, { chunkSize }) => {
    if (path.basename(file) === 'index.db') throw Object.assign(new Error('locked'), { code: 'EACCES' });
    return fs.createReadStream(file, { highWaterMark: chunkSize });
  };
  const report = await probe(machine, 'ok', { arms: ['minimal'], openRead: stuck, retryDelayMs: 0 });
  assert.equal(report.ok, false);
  assert.deepEqual(report.arms[0].leak.hits, [], 'nothing leaked that it could see');
  assert.ok(report.failures.some((failure) => /inconclusive/.test(failure) && failure.includes('.codegraph/index.db') && failure.includes('EACCES')), report.failures.join('\n'));
  assert.match(formatSummary(report), /inconclusive/);

  let first = true;
  const once = (file, { chunkSize }) => {
    if (path.basename(file) === 'index.db' && first) {
      first = false;
      throw Object.assign(new Error('busy'), { code: 'EBUSY' });
    }
    return fs.createReadStream(file, { highWaterMark: chunkSize });
  };
  const fine = await probe(fakeMachine(), 'ok', { arms: ['minimal'], openRead: once, retryDelayMs: 0 });
  assert.equal(fine.ok, true, fine.failures.join('\n'));
});

test('a leak written by the first arm is the first arm\'s failure, once: the second arm, which did not write it, is not failed for it', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'ok', { adaptConfig: (config, { arm }) => fakeClaude(arm === 'current' ? 'leak' : 'ok', machine)(config) });
  const [current, minimal] = report.arms;
  assert.equal(current.ok, false);
  assert.deepEqual(current.leak.hits, [{ tree: '.claude', path: 'leaked.txt', found: ['nonce'], via: 'content' }]);
  assert.equal(minimal.ok, true, minimal.failures.join('\n'));
  assert.deepEqual(minimal.leak.hits, []);
  assert.equal(report.ok, false, 'the probe still fails, on the arm that leaked');
  assert.equal(report.failures.filter((failure) => /LEAK/.test(failure)).length, 1);
  assert.ok(report.failures.find((failure) => /LEAK/.test(failure)).startsWith('current:'));
});

test('an arm that touches a file that already held a leak is failed for it again: attribution is by what changed in its window', async () => {
  const machine = fakeMachine();
  const touching = (config) => ({
    ...fakeClaude('ok', machine)(config),
    prepare: async (context) => {
      const prepared = await config.prepare(context);
      fs.appendFileSync(path.join(machine.realHome, '.claude', 'leaked.txt'), `touched by the second arm ${FAKE_NONCE}\n`);
      return prepared;
    },
  });
  const report = await probe(machine, 'ok', { adaptConfig: (config, { arm }) => (arm === 'current' ? fakeClaude('leak', machine)(config) : touching(config)) });
  assert.equal(report.arms[0].ok, false);
  assert.equal(report.arms[1].ok, false, 'the file changed in the minimal arm\'s window and still holds the nonce');
  assert.deepEqual(report.arms[1].leak.hits.map((hit) => hit.path), ['leaked.txt']);
});

const waitSync = (predicate, ms) => {
  const until = Date.now() + ms;
  while (!predicate() && Date.now() < until) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
};

test('what an orphan writes after the agent exits is found: the arm\'s processes are swept before the final leak scan, not after', { skip: WINDOWS_ONLY }, async () => {
  const machine = fakeMachine();
  const target = path.join(machine.realHome, '.claude', 'late-leak.txt');
  const pidFile = path.join(tmp('late-pid'), 'pid.txt');
  const startedAt = Date.now();
  // The orphan writes 2 s after the agent exits, long after any snapshot taken right away. The sweep is wrapped to wait for that write and then
  // kill the orphan for real, which is what a slow sweep does with a fast writer: the write happens during
  // the sweep, so a scan taken before the sweep misses it.
  const sweep = (roots, options) => {
    waitSync(() => fs.existsSync(target), 10_000);
    return killByPath(roots, options);
  };
  try {
    const report = await probe(machine, 'ok', { arms: ['minimal'], sweep, adaptConfig: fakeClaude('late-leak', machine, { pidFile }) });
    assert.equal(report.ok, false);
    assert.deepEqual(report.arms[0].leak.hits, [{ tree: '.claude', path: 'late-leak.txt', found: ['nonce'], via: 'content' }]);
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    assert.ok(await waitUntil(() => !isAlive(pid)), 'and the orphan is dead');
  } finally {
    reapHolder(pidFile, startedAt);
  }
});

test('the sweep comes before the leak snapshot on a failed arm too, and runs once when it succeeded', async () => {
  const events = [];
  const machine = fakeMachine();
  const report = await probe(machine, 'ok', {
    arms: ['minimal'],
    adaptConfig: () => {
      throw new Error('config exploded');
    },
    sweep: () => {
      events.push('sweep');
      return { killed: [] };
    },
    openRead: (file, { chunkSize }) => {
      events.push('read');
      return fs.createReadStream(file, { highWaterMark: chunkSize });
    },
  });
  assert.match(report.arms[0].error, /config exploded/);
  const first = events.indexOf('sweep');
  assert.ok(first > 0, 'the real trees were read before the arm');
  assert.ok(events.slice(first).includes('read'), 'and read again after the sweep');
  assert.equal(events.filter((event) => event === 'sweep').length, 1, 'one sweep is enough when it succeeded');
});

test('the cleanup of the trial engram port comes after the sweep by path and before the final scan of the real trees, once per arm', async () => {
  const events = [];
  const report = await probe(fakeMachine(), 'ok', {
    arms: ['current'],
    sweep: () => (events.push('sweep'), { killed: [] }),
    killPort: () => (events.push('kill'), { killed: [] }),
    openRead: (file, { chunkSize }) => (events.push('read'), fs.createReadStream(file, { highWaterMark: chunkSize })),
  });
  assert.deepEqual(report.failures, []);
  const kill = events.indexOf('kill');
  assert.equal(events.filter((event) => event === 'kill').length, 1, 'once, not again in the final cleanup');
  assert.ok(events.indexOf('sweep') < kill, 'after the sweep by path');
  assert.ok(events.slice(0, kill).includes('read'), 'the real trees were read before the arm');
  assert.ok(events.slice(kill).includes('read'), 'and read again after the server was stopped: what it wrote late is in that scan');
});

test('more than ten unreadable real files are named ten at a time and then counted, so the verdict stays short and still says how many', async () => {
  const machine = fakeMachine();
  for (let i = 0; i < 12; i += 1) write(path.join(machine.realHome, '.orca', `bad-${String(i).padStart(2, '0')}.txt`), 'x');
  const stuck = (file, { chunkSize }) => {
    if (path.basename(file).startsWith('bad-')) throw Object.assign(new Error('locked'), { code: 'EBUSY' });
    return fs.createReadStream(file, { highWaterMark: chunkSize });
  };
  const report = await probe(machine, 'ok', { arms: ['minimal'], openRead: stuck, retryDelayMs: 0 });
  const inconclusive = report.failures.filter((failure) => /inconclusive/.test(failure));
  assert.equal(inconclusive.length, 11);
  assert.match(inconclusive[10], /2 more real files could not be read/);
  assert.equal(report.arms[0].leak.unreadable.count, 12);
});

test('keys are not compared for a file that could not be read before, nor for one whose bytes did not change, even if it is not JSON', async () => {
  const dir = tmp('keysskip');
  const file = path.join(dir, 'a.json');
  write(file, claudeJsonText());
  const unreadable = () => {
    throw Object.assign(new Error('locked'), { code: 'EBUSY' });
  };
  const before = await snapshotTrees([{ name: 't', root: dir, mode: 'content', jsonKeys: true }], { openRead: unreadable, retryDelayMs: 0, retries: 0 });
  assert.equal(before.trees.t.files.get('a.json'), 'unreadable:EBUSY');
  const after = await snapshotTrees([{ name: 't', root: dir, mode: 'content', jsonKeys: true }]);
  assert.equal(diffSnapshots(before, after).t.keys, undefined, 'a file whose earlier state is unknown has no key diff');

  write(file, 'this is not JSON');
  const garbage = await snapshotTrees([{ name: 't', root: dir, mode: 'content', jsonKeys: true }]);
  const again = await snapshotTrees([{ name: 't', root: dir, mode: 'content', jsonKeys: true }]);
  assert.equal(diffSnapshots(garbage, again).t.keys, undefined, 'identical bytes are not a change, parsed or not');
});

// ---- the engram plugin: a port of its own, its paths exercised, and nothing left behind ----------------------------

const REAL_PORT = 7437;
/** The controls of the current arm that come from the engram plugin; the prompt is not one of them. */
const ENGRAM_CONTROLS = ['engramDb', 'engramHook', 'engramServer', 'engramSession', 'engramMemSave'];
const ENGRAM_REPLIES = ['tool_use:Bash', 'tool_use:Write', `tool_use:${MEM_SAVE}`, 'tool_use:Agent', 'subagent', 'text'];
const CAN_LOOK_UP_LISTENERS = process.platform === 'win32' || !spawnSync('lsof', ['-v'], { stdio: 'ignore' }).error;
const LISTENER_LOOKUP = CAN_LOOK_UP_LISTENERS ? false : 'neither Windows nor lsof: the real listener lookup cannot run here';
const killNode = (port) => killByPort(port, { name: /^node(\.exe)?$/i });

test('the current arm drives the plugin: the engram tool and a subagent are called, the prompt, the memory and the subagent land in the sandbox store', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'ok', { arms: ['current'] });
  const [current] = report.arms;
  assert.deepEqual(report.failures, []);
  assert.deepEqual(current.fakeApi.requests.map((request) => request.reply), ENGRAM_REPLIES);
  assert.equal(current.fakeApi.requests.filter((request) => request.engramToolOffered).length, 5, 'offered on every request that is not the subagent');
  for (const name of ENGRAM_CONTROLS) {
    assert.deepEqual({ applies: current.positiveControls[name].applies, ok: current.positiveControls[name].ok }, { applies: true, ok: true }, name);
  }
  assert.equal(current.positiveControls.engramPrompt, undefined, 'the prompt is information, not a control');
  assert.equal(current.sandbox.answers.engramPrompt, true);
  assert.equal(current.sandbox.answers.engramSubagentStop, true, 'the subagent stop hook stored the last message, as far as the stand-in goes');
});

test('the minimal arm is offered neither the engram tool nor the plugin, so its engram controls do not apply', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'ok', { arms: ['minimal'] });
  const [minimal] = report.arms;
  assert.deepEqual(report.failures, []);
  assert.deepEqual(minimal.fakeApi.requests.map((request) => request.reply), ['tool_use:Bash', 'tool_use:Write', 'text']);
  for (const name of ENGRAM_CONTROLS) assert.equal(minimal.positiveControls[name].applies, false, name);
  assert.equal(minimal.sandbox.answers.engramPrompt, null);
});

test('every arm runs on a port of its own, which its tools see, which is not the real one, and on which nothing listens afterwards', async () => {
  const machine = fakeMachine();
  const asked = [];
  const report = await probe(machine, 'ok', { isListening: async (port) => (asked.push(port), false) });
  assert.deepEqual(report.failures, []);
  const ports = report.arms.map((arm) => arm.engram.port);
  assert.equal(new Set(ports).size, 2, 'two arms, two ports');
  for (const arm of report.arms) {
    assert.ok(Number.isInteger(arm.engram.port) && arm.engram.port >= 1024 && arm.engram.port !== REAL_PORT, arm.arm);
    assert.equal(arm.fakeApi.envLines.ENGRAM_PORT, String(arm.engram.port), 'what the agent tools saw');
    assert.equal(arm.fakeApi.envLines.ENGRAM_URL, '');
    assert.equal(arm.fakeApi.envLines.ENGRAM_SOCKET, '');
    assert.equal(arm.engram.listening, false);
    assert.deepEqual(arm.engram.survivors, []);
  }
  assert.deepEqual([...new Set(asked)].sort(), [...ports].sort(), 'the probe asks about the trial ports and no other, 7437 above all');
});

test('the probe stops what the trial left listening on its engram port, by number, and leaves nothing behind', { skip: LISTENER_LOOKUP }, async () => {
  const machine = fakeMachine();
  const killed = [];
  const report = await probe(machine, 'engram-server', {
    arms: ['current'],
    killPort: (port) => (killed.push([port, findListeners(port).length]), killNode(port)),
  });
  const [current] = report.arms;
  assert.deepEqual(report.failures, []);
  assert.deepEqual(killed, [[current.engram.port, 1]], 'one listener was there to be found, so the pass is not an empty one');
  assert.equal(current.engram.listening, false);
  assert.deepEqual(leftovers(machine), []);
});

test('a listener that is still there after the trial fails the arm and names the port', async () => {
  const machine = fakeMachine();
  let report;
  try {
    report = await probe(machine, 'engram-server', { arms: ['current'] }); // the default killPort of the helper kills nothing
    const [current] = report.arms;
    assert.equal(report.ok, false);
    assert.equal(current.engram.listening, true);
    assert.ok(report.failures.some((failure) => /still listens/.test(failure) && failure.includes(String(current.engram.port))), report.failures.join('\n'));
    assert.match(formatSummary(report), /still listens/);
  } finally {
    if (report) {
      try {
        killNode(report.arms[0].engram.port);
      } catch {
        // it ends by itself after 30 s
      }
    }
  }
});

test('a cleanup that cannot stop the listener is a failure of the arm, with its reason, and the other arm still runs', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'ok', {
    killPort: (port) => {
      throw new Error('port ' + port + ' is held by pid 99 (chrome), which is not engram: left alone');
    },
  });
  assert.equal(report.ok, false);
  assert.deepEqual(report.arms.map((arm) => arm.arm), ['current', 'minimal'], 'both arms ran');
  for (const arm of report.arms) assert.ok(arm.failures.some((failure) => /not engram/.test(failure)), `${arm.arm}: ${arm.failures.join(' | ')}`);
  assert.deepEqual(leftovers(machine), []);
});

test('an engram process that was not there before the trial and is after it fails the arm; one that was there before is the live session', async () => {
  const machine = fakeMachine();
  const live = { pid: 100, command: 'engram.exe mcp' };
  let calls = 0;
  const report = await probe(machine, 'ok', {
    arms: ['current'],
    listEngram: () => (calls++ % 2 === 0 ? [live] : [live, { pid: 4242, command: 'engram.exe serve' }]),
  });
  assert.equal(report.ok, false);
  assert.deepEqual(report.arms[0].engram.survivors, [{ pid: 4242, command: 'engram.exe serve' }]);
  assert.ok(report.failures.some((failure) => /engram process/.test(failure) && failure.includes('4242')), report.failures.join('\n'));

  const quiet = await probe(fakeMachine(), 'ok', { arms: ['current'], listEngram: () => [live] });
  assert.deepEqual(quiet.failures, []);
});

test('a listing of engram processes that cannot run is inconclusive, never a pass', async () => {
  const report = await probe(fakeMachine(), 'ok', {
    arms: ['current'],
    listEngram: () => {
      throw new Error('the process listing failed (ps exit 1)');
    },
  });
  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => /inconclusive/.test(failure) && /process listing/.test(failure)), report.failures.join('\n'));
});

test('tools that see the real port, or an ENGRAM_URL, fail the arm: the hooks would reach another server', async () => {
  const report = await probe(fakeMachine(), 'wrong-engram-env', { arms: ['current'] });
  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => /ENGRAM_PORT/.test(failure)), report.failures.join('\n'));
  assert.ok(report.failures.some((failure) => /ENGRAM_URL/.test(failure)), report.failures.join('\n'));
  assert.ok(!report.failures.join('\n').includes('127.0.0.1:7437'), 'names, not values');
});

test('a prompt or a memory that reaches the real engram store fails the probe, by file, whichever hook wrote it', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'leak-engram', { arms: ['current'] });
  assert.equal(report.ok, false);
  assert.deepEqual(report.arms[0].leak.hits, [{ tree: '.engram', path: 'leak.db', found: ['nonce'], via: 'content' }]);
  assert.ok(report.failures.some((failure) => /LEAK/.test(failure) && /\.engram/.test(failure) && failure.includes('leak.db')), report.failures.join('\n'));
  assert.ok(!JSON.stringify(report).includes(FAKE_NONCE));
});

test('the report says what was scanned of the real engram store, so a missing store is not mistaken for a clean one', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'ok', { arms: ['current'] });
  const store = report.arms[0].realEngram;
  assert.equal(store.status, 'present');
  assert.ok(store.files >= 1 && store.bytes > 0);
  assert.equal(store.hits, 0);
  fs.rmSync(path.join(machine.realHome, '.engram'), { recursive: true });
  const missing = await probe(machine, 'ok', { arms: ['current'] });
  assert.equal(missing.arms[0].realEngram.status, 'missing');
  assert.match(formatSummary(missing), /real engram store.*missing/);
});

test('a current arm that writes nothing fails every engram control: nothing proves the plugin ran', async () => {
  const report = await probe(fakeMachine(), 'silent', { arms: ['current'] });
  const { positiveControls } = report.arms[0];
  for (const name of ENGRAM_CONTROLS) assert.equal(positiveControls[name].ok, false, name);
  for (const name of ['engramHook', 'engramServer', 'engramSession']) {
    assert.ok(report.failures.some((failure) => failure.includes(name)), `${name}: ${report.failures.join('\n')}`);
  }
});

test('the hooks and the MCP tool are told apart: a memory that was never saved fails only its own control, and says so', async () => {
  const report = await probe(fakeMachine(), 'prompt-only', { arms: ['current'] });
  const { positiveControls } = report.arms[0];
  for (const name of ['engramDb', 'engramHook', 'engramServer', 'engramSession']) assert.equal(positiveControls[name].ok, true, name);
  assert.equal(positiveControls.engramMemSave.ok, false);
  const failure = report.failures.find((text) => /engramMemSave/.test(text));
  assert.ok(failure, report.failures.join('\n'));
  assert.match(failure, /engram tool/i, 'it says what the control is about, and that the tool was offered');
});

test('the summary shows the port of each arm, what was found on it, and the real store scan', async () => {
  const report = await probe(fakeMachine(), 'ok');
  const summary = formatSummary(report);
  for (const arm of report.arms) assert.match(summary, new RegExp(`engram: port ${arm.engram.port}, nothing listens on it afterwards`));
  assert.match(summary, /real engram store: \d+ files/);
  assert.ok(!summary.includes(FAKE_NONCE));
});

// ---- the engram controls match what the plugin's hooks really write --------------------------------------------

/** The failures of `report` that name the control `name`. */
const failuresOf = (report, name) => report.failures.filter((failure) => failure.includes(`"${name}"`));
/** The controls of the current arm that failed. */
const failedControls = (report) => Object.entries(report.arms[0].positiveControls).filter(([, control]) => !control.ok).map(([name]) => name);

test('the prompt hook is proved by its state file in the sandbox temp directory, so the Windows safe mode, which never posts the prompt, still passes', async () => {
  const report = await probe(fakeMachine(), 'safe-mode', { arms: ['current'] });
  const [current] = report.arms;
  assert.deepEqual(report.failures, []);
  assert.equal(report.ok, true);
  assert.match(current.positiveControls.engramHook.path, /^tmp\/engram-claude-[0-9a-f-]{36}-tools-loaded$/);
  assert.equal(current.positiveControls.engramPrompt, undefined, 'the prompt is not a control any more');
  assert.equal(current.sandbox.answers.engramPrompt, false, 'and its absence is only reported');
  assert.match(formatSummary(report), /prompt stored in the engram store: false/);
});

test('a prompt hook that left no state file in the sandbox temp directory fails its control alone, and the hint says what that means', async () => {
  const report = await probe(fakeMachine(), 'no-hook-state', { arms: ['current'] });
  assert.deepEqual(failedControls(report), ['engramHook']);
  const [failure] = failuresOf(report, 'engramHook');
  assert.ok(failure, report.failures.join('\n'));
  assert.match(failure, /UserPromptSubmit/);
  assert.match(failure, /TMPDIR/);
});

test('the state file of another session does not stand in for the trial\'s: it is looked for by the trial session id', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, 'no-hook-state', {
    arms: ['current'],
    adaptConfig: fakeClaude('no-hook-state', machine, {
      prepare: ({ home }) => write(path.join(home, 'tmp', 'engram-claude-00000000-0000-4000-8000-000000000000-tools-loaded'), ''),
    }),
  });
  assert.deepEqual(failedControls(report), ['engramHook']);
});

test('a server the hook did not start, or one that listens on another port, fails the server control; the hint names both ports', async () => {
  const missing = await probe(fakeMachine(), 'no-server-log', { arms: ['current'] });
  assert.deepEqual(failedControls(missing), ['engramServer']);
  assert.match(failuresOf(missing, 'engramServer')[0], /SessionStart/);
  const elsewhere = await probe(fakeMachine(), 'other-port-log', { arms: ['current'] });
  assert.deepEqual(failedControls(elsewhere), ['engramServer']);
  const [failure] = failuresOf(elsewhere, 'engramServer');
  assert.ok(failure.includes('7437') && failure.includes(String(elsewhere.arms[0].engram.port)), failure);
});

test('a session that is not in the trial\'s store fails the session control: the hook posted to a server that is not the trial\'s own', async () => {
  const report = await probe(fakeMachine(), 'no-session-store', { arms: ['current'] });
  assert.deepEqual(failedControls(report), ['engramSession']);
  assert.match(failuresOf(report, 'engramSession')[0], /SessionStart/);
});

test('a session id that only the transcript name carries is read from it; one that nothing carries fails the controls that need it, saying so', async () => {
  const named = await probe(fakeMachine(), 'result-without-session-id', { arms: ['current'] });
  assert.deepEqual(named.failures, []);
  assert.equal(named.arms[0].session.source, 'transcript');
  const ok = await probe(fakeMachine(), 'ok', { arms: ['current'] });
  assert.equal(ok.arms[0].session.source, 'result');

  const unknown = await probe(fakeMachine(), 'unknown-session-id', { arms: ['current'] });
  assert.equal(unknown.arms[0].session.source, null);
  assert.deepEqual(failedControls(unknown), ['engramSession']);
  assert.match(failuresOf(unknown, 'engramSession')[0], /session id .*unknown/i);
});

const sessionIdOf = (report, arm = 0) => /([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\.jsonl$/.exec(report.arms[arm].positiveControls.transcript.path)[1];

test('a session row posted to the real engram server is a leak: the trial session id is a needle of the real engram store, though it holds neither the nonce nor the sandbox name', async () => {
  const report = await probe(fakeMachine(), 'leak-session-engram', { arms: ['current'] });
  const [current] = report.arms;
  assert.equal(report.ok, false);
  assert.deepEqual(current.leak.hits, [{ tree: '.engram', path: 'leak-session.db', found: ['session id'], via: 'content' }]);
  assert.equal(current.realEngram.hits, 1);
  const failure = report.failures.find((text) => /LEAK/.test(text) && text.includes('leak-session.db'));
  assert.ok(failure, report.failures.join('\n'));
  assert.ok(!failure.includes(sessionIdOf(report)), 'the path is named, not the id');
});

test('the session id is a needle of every real tree, and of the minimal arm too', async () => {
  const report = await probe(fakeMachine(), 'leak-session-tree', { arms: ['minimal'] });
  assert.equal(report.ok, false);
  assert.deepEqual(report.arms[0].leak.hits, [{ tree: '.claude', path: 'leaked-session.txt', found: ['session id'], via: 'content' }]);
  assert.ok(report.failures.some((failure) => /LEAK/.test(failure) && failure.includes('leaked-session.txt')), report.failures.join('\n'));
});

test('an unknown session id fails the controls that need it and nothing else: the minimal arm has none, so it still passes', async () => {
  const report = await probe(fakeMachine(), 'unknown-session-id', { arms: ['minimal'] });
  assert.equal(report.arms[0].session.source, null);
  assert.deepEqual(report.arms[0].leak.hits, []);
  assert.equal(report.ok, true, 'the minimal arm has no control that needs the id');
});

test('the probe never writes the session id before the scans of the real trees: progress output redirected into a scanned tree stays clean', async () => {
  const machine = fakeMachine();
  const progress = path.join(machine.tempDir, 'claude', 'progress.log');
  const report = await probe(machine, 'ok', { log: (message) => fs.appendFileSync(progress, `${message}\n`) });
  assert.deepEqual(report.failures, []);
  assert.ok(fs.readFileSync(progress, 'utf8').length > 0, 'progress was written into %TEMP%/claude, which is a scanned tree');
  for (const arm of [0, 1]) assert.ok(!fs.readFileSync(progress, 'utf8').includes(sessionIdOf(report, arm)));
  assert.ok(!formatSummary(report).includes(sessionIdOf(report)), 'nor does the printed summary hold it');
});

test('the summary names the new controls, and the report holds no control for the prompt', async () => {
  const report = await probe(fakeMachine(), 'ok', { arms: ['current'] });
  const summary = formatSummary(report);
  assert.match(summary, /positive controls: .*engramHook ok, engramServer ok, engramSession ok, engramMemSave ok/);
  assert.match(summary, /prompt stored in the engram store: true/);
  assert.ok(!/engramPrompt/.test(summary + JSON.stringify(report.arms[0].positiveControls)));
});
