import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ArmError } from './arms.mjs';
import { applyWithout, checkWithout } from './without.mjs';

// C3a of G2 (`odd/tasks/future-model-protocol.md`): an arm of one component is the current arm's home with that
// component's files and keys taken out, and nothing else changed.

const tmp = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jh-without-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};

const put = (root, rel, content) => {
  const file = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
};

/** Every file below `root` as `{ rel: content }`. */
const snapshot = (root) => {
  const out = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out[path.relative(root, full).split(path.sep).join('/')] = fs.readFileSync(full, 'utf8');
    }
  };
  walk(root);
  return out;
};

const hook = (command) => ({ matcher: 'startup', hooks: [{ type: 'command', command }] });
const JSH_DOCTOR = hook('js-harness doctor --hook');
const JSH_GUARD = hook('js-harness guard --hook || exit 0');
const OTHER_START = hook('gentle-ai review stop-hook --agent claude-code');
const OTHER_PROMPT = hook('codegraph prompt-hook');

function claudeHome(root) {
  put(root, '.claude/CLAUDE.md', '# global\n');
  put(root, '.claude/skills/review/SKILL.md', 'review\n');
  put(root, '.claude/skills/js-harness/SKILL.md', 'jsh\n');
  put(root, '.claude/skills/js-harness-orchestrator/SKILL.md', 'jsh orch\n');
  put(root, '.claude/agents/judge.md', 'judge\n');
  put(root, '.claude/output-styles/gentleman.md', 'style\n');
  put(root, '.claude/hooks/state.ps1', 'ps\n');
  put(root, '.claude/settings.json', {
    model: 'opus',
    outputStyle: 'Gentleman',
    hooks: { SessionStart: [JSH_DOCTOR, OTHER_START], PreToolUse: [JSH_GUARD], UserPromptSubmit: [OTHER_PROMPT] },
    enabledPlugins: { 'engram@engram': true, 'codex@openai-codex': true },
  });
  put(root, '.claude/.claude.json', { userID: 'x', mcpServers: { engram: { command: 'engram' }, context7: { command: 'c7' } } });
  put(root, '.gentle-ai/state.json', { persona: 'gentleman' });
  return root;
}

const json = (root, rel) => JSON.parse(fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8'));

/** Applies `components` to a fresh Claude home and returns what changed: the files gone, and the rest. */
function cut(t, components, agent = 'claude', make = claudeHome) {
  const root = make(tmp(t));
  const before = snapshot(root);
  applyWithout(root, components, agent);
  const after = snapshot(root);
  const gone = Object.keys(before).filter((rel) => !(rel in after)).sort();
  const changed = Object.keys(after).filter((rel) => before[rel] !== after[rel]).sort();
  return { root, gone, changed };
}

test('claude-md, agents and skills take out their files only, and skills leaves js-harness\'s own', (t) => {
  const md = cut(t, ['claude-md']);
  assert.deepEqual([md.gone, md.changed], [['.claude/CLAUDE.md'], []]);
  const agents = cut(t, ['agents']);
  assert.deepEqual([agents.gone, agents.changed], [['.claude/agents/judge.md'], []]);
  const skills = cut(t, ['skills']);
  assert.deepEqual([skills.gone, skills.changed], [['.claude/skills/review/SKILL.md'], []]);
});

test('js-harness takes out its skills and its hook entries, and keeps every other entry and key', (t) => {
  const { root, gone, changed } = cut(t, ['js-harness']);
  assert.deepEqual(gone, ['.claude/skills/js-harness-orchestrator/SKILL.md', '.claude/skills/js-harness/SKILL.md']);
  assert.deepEqual(changed, ['.claude/settings.json']);
  const settings = json(root, '.claude/settings.json');
  assert.deepEqual(settings.hooks, { SessionStart: [OTHER_START], UserPromptSubmit: [OTHER_PROMPT] });
  assert.equal(settings.outputStyle, 'Gentleman');
  assert.deepEqual(settings.enabledPlugins, { 'engram@engram': true, 'codex@openai-codex': true });
});

test('hooks takes out every entry but js-harness\'s, and the hooks folder', (t) => {
  const { root, gone, changed } = cut(t, ['hooks']);
  assert.deepEqual(gone, ['.claude/hooks/state.ps1']);
  assert.deepEqual(changed, ['.claude/settings.json']);
  assert.deepEqual(json(root, '.claude/settings.json').hooks, { SessionStart: [JSH_DOCTOR], PreToolUse: [JSH_GUARD] });
});

test('the pair hooks and js-harness leaves no hooks key', (t) => {
  const { root } = cut(t, ['hooks', 'js-harness']);
  assert.equal('hooks' in json(root, '.claude/settings.json'), false);
});

test('output-style takes out the folder and the setting that names it', (t) => {
  const { root, gone, changed } = cut(t, ['output-style']);
  assert.deepEqual([gone, changed], [['.claude/output-styles/gentleman.md'], ['.claude/settings.json']]);
  const settings = json(root, '.claude/settings.json');
  assert.equal('outputStyle' in settings, false);
  assert.equal(settings.model, 'opus');
});

test('plugin-<name> switches that plugin off and keeps its files; mcp-<name> takes its server out', (t) => {
  const plugin = cut(t, ['plugin-engram']);
  assert.deepEqual([plugin.gone, plugin.changed], [[], ['.claude/settings.json']]);
  assert.deepEqual(json(plugin.root, '.claude/settings.json').enabledPlugins, { 'engram@engram': false, 'codex@openai-codex': true });
  const mcp = cut(t, ['mcp-context7']);
  assert.deepEqual([mcp.gone, mcp.changed], [[], ['.claude/.claude.json']]);
  assert.deepEqual(json(mcp.root, '.claude/.claude.json'), { userID: 'x', mcpServers: { engram: { command: 'engram' } } });
});

test('project takes nothing out of the home', (t) => {
  const { gone, changed } = cut(t, ['project']);
  assert.deepEqual([gone, changed], [[], []]);
});

test('a component the home does not hold is refused before anything is touched', (t) => {
  const root = claudeHome(tmp(t));
  fs.rmSync(path.join(root, '.claude', 'agents'), { recursive: true });
  const before = snapshot(root);
  for (const id of ['agents', 'plugin-nothing', 'mcp-nothing']) {
    assert.throws(() => checkWithout(root, [id], 'claude'), (err) => err instanceof ArmError && err.message.includes(id) && /current arm under another name/.test(err.message), id);
  }
  assert.throws(() => applyWithout(root, ['claude-md', 'agents'], 'claude'), ArmError);
  assert.deepEqual(snapshot(root), before);
});

test('a plugin already switched off is not in the home', (t) => {
  const root = claudeHome(tmp(t));
  put(root, '.claude/settings.json', { enabledPlugins: { 'engram@engram': false } });
  assert.throws(() => checkWithout(root, ['plugin-engram'], 'claude'), ArmError);
});

// ---- C3c: Codex's config.toml ---------------------------------------------------------------------------

const CONFIG = String.raw`model = "gpt"
model_instructions_file = 'C:\h\.codex\engram-instructions.md'
experimental_compact_prompt_file = 'C:\h\.codex\engram-compact-prompt.md'

[plugins."engram@engram"]
enabled = true

[plugins."docs@openai-primary-runtime"]
enabled = true

[mcp_servers.engram]
command = "engram"

[mcp_servers.engram.env]
ENGRAM_PORT = "45678"

[mcp_servers.context7]
url = "https://example.invalid/mcp"

[hooks.state.'C:\h\.codex\hooks.json:session_start:0:0']
trusted_hash = "hash-of-gentle-ai"

[hooks.state.'C:\h\.codex\hooks.json:session_start:1:0']
trusted_hash = "hash-of-js-harness"

[hooks.state.'C:\h\.codex\hooks.json:stop:0:0']
trusted_hash = "hash-of-stop"
`.replaceAll('\n', '\r\n');

/** A Codex home with a config.toml of plugins, MCP servers and hook trust, and hooks.json to match. */
function codexConfigHome(root) {
  codexHome(root);
  put(root, '.codex/config.toml', CONFIG);
  put(root, '.codex/engram-compact-prompt.md', 'compact\n');
  put(root, '.codex/hooks.json', { hooks: { SessionStart: [OTHER_START, JSH_DOCTOR], Stop: [OTHER_PROMPT] } });
  return root;
}

const config = (root) => fs.readFileSync(path.join(root, '.codex', 'config.toml'), 'utf8');
/** CONFIG without the table whose header line is `header` (to the blank line after it). */
const withoutTable = (text, header) => text.replace(new RegExp(`${header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r\\n(?:[^\\[\\r][^\\r]*\\r\\n)*\\r\\n`), '');

test('Codex mcp-<name> takes its server\'s tables out of config.toml, sub-tables too', (t) => {
  const { root, gone, changed } = cut(t, ['mcp-context7'], 'codex', codexConfigHome);
  assert.deepEqual([gone, changed], [[], ['.codex/config.toml']]);
  assert.equal(config(root), withoutTable(CONFIG, '[mcp_servers.context7]'));
});

test('Codex mcp-engram takes its two instruction files and the keys that name them with its server', (t) => {
  const { root, gone, changed } = cut(t, ['mcp-engram'], 'codex', codexConfigHome);
  assert.deepEqual([gone, changed], [['.codex/engram-compact-prompt.md', '.codex/engram-instructions.md'], ['.codex/config.toml']]);
  const text = config(root);
  assert.equal(/engram-instructions|engram-compact-prompt|mcp_servers\.engram/.test(text), false);
  assert.ok(text.includes('[plugins."engram@engram"]'), 'the plugin is a component of its own');
  assert.ok(text.includes('[mcp_servers.context7]'));
});

test('Codex plugin-<name> switches the plugin off in its table and keeps the rest', (t) => {
  const { root, gone, changed } = cut(t, ['plugin-engram'], 'codex', codexConfigHome);
  assert.deepEqual([gone, changed], [[], ['.codex/config.toml']]);
  assert.equal(config(root), CONFIG.replace('[plugins."engram@engram"]\r\nenabled = true', '[plugins."engram@engram"]\r\nenabled = false'));
  assert.throws(() => checkWithout(root, ['plugin-engram'], 'codex'), (err) => err instanceof ArmError && /plugin-engram is not in/.test(err.message));
});

test('a Codex hook taken out takes its trust with it, and the hooks after it keep theirs at their new places', (t) => {
  const hooks = cut(t, ['hooks'], 'codex', codexConfigHome);
  assert.deepEqual(hooks.changed, ['.codex/config.toml', '.codex/hooks.json']);
  const text = config(hooks.root);
  assert.equal(/hash-of-gentle-ai|hash-of-stop|:stop:/.test(text), false);
  assert.ok(text.includes(String.raw`[hooks.state.'C:\h\.codex\hooks.json:session_start:0:0']` + '\r\ntrusted_hash = "hash-of-js-harness"'));
  assert.equal(text.includes(':session_start:1:0'), false);
  const jsh = cut(t, ['js-harness'], 'codex', codexConfigHome);
  assert.equal(config(jsh.root), withoutTable(CONFIG, String.raw`[hooks.state.'C:\h\.codex\hooks.json:session_start:1:0']`));
});

test('a Codex server or plugin config.toml does not hold is refused', (t) => {
  const root = codexConfigHome(tmp(t));
  for (const id of ['mcp-nothing', 'plugin-nothing']) {
    assert.throws(() => checkWithout(root, [id], 'codex'), (err) => err instanceof ArmError && err.message.includes(`${id} is not in`), id);
  }
});

test('a Codex piece config.toml spells so that a cut could miss it, or a line the scan cannot read, is refused', (t) => {
  for (const [id, toml] of [
    ['mcp-context7', '[mcp_servers]\ncontext7 = { url = "x" }\n'],
    ['mcp-context7', 'mcp_servers.context7.url = "x"\n'],
    ['mcp-context7', 'mcp_servers = { context7 = { url = "x" } }\n'],
    ['plugin-engram', '[plugins]\n"engram@engram" = { enabled = true }\n'],
    ['plugin-engram', 'plugins."engram@engram".enabled = true\n'],
    ['hooks', `[hooks.state]\n"C:\\\\h\\\\.codex\\\\hooks.json:stop:0:0" = { trusted_hash = "h" }\n`],
    ['hooks', 'x = """\nmulti\n"""\n'],
  ]) {
    const root = codexConfigHome(tmp(t));
    put(root, '.codex/config.toml', toml);
    const before = snapshot(root);
    assert.throws(() => applyWithout(root, [id], 'codex'), ArmError, `${id}: ${toml}`);
    assert.deepEqual(snapshot(root), before, `${id}: ${toml}`);
  }
});

test('trust of a plugin\'s own hooks.json, or of a place hooks.json does not hold, is left as it is', (t) => {
  const root = codexConfigHome(tmp(t));
  const extra = String.raw`[hooks.state.'C:\h\.codex\plugins\cache\x\hooks\hooks.json:session_start:0:0']` + '\r\ntrusted_hash = "plugin"\r\n\r\n'
    + String.raw`[hooks.state.'C:\h\.codex\hooks.json:session_start:7:0']` + '\r\ntrusted_hash = "stale"\r\n';
  put(root, '.codex/config.toml', CONFIG + extra);
  applyWithout(root, ['hooks'], 'codex');
  assert.ok(config(root).endsWith(extra));
});

function codexHome(root) {
  put(root, '.codex/AGENTS.md', '# global\n');
  put(root, '.codex/config.toml', 'model = "gpt"\n');
  put(root, '.codex/engram-instructions.md', 'engram\n');
  put(root, '.codex/herdr-agent-state.ps1', 'ps\n');
  put(root, '.codex/skills/review/SKILL.md', 'review\n');
  put(root, '.codex/skills/js-harness/SKILL.md', 'jsh\n');
  put(root, '.codex/hooks.json', { hooks: { SessionStart: [OTHER_START, JSH_DOCTOR] } });
  return root;
}

test('Codex: agents-md, skills, hooks and js-harness take out their own pieces', (t) => {
  const agents = cut(t, ['agents-md'], 'codex', codexHome);
  assert.deepEqual([agents.gone, agents.changed], [['.codex/AGENTS.md'], []]);
  const skills = cut(t, ['skills'], 'codex', codexHome);
  assert.deepEqual([skills.gone, skills.changed], [['.codex/skills/review/SKILL.md'], []]);
  const hooks = cut(t, ['hooks'], 'codex', codexHome);
  assert.deepEqual([hooks.gone, hooks.changed], [['.codex/herdr-agent-state.ps1'], ['.codex/hooks.json']]);
  assert.deepEqual(json(hooks.root, '.codex/hooks.json'), { hooks: { SessionStart: [JSH_DOCTOR] } });
  const jsh = cut(t, ['js-harness'], 'codex', codexHome);
  assert.deepEqual([jsh.gone, jsh.changed], [['.codex/skills/js-harness/SKILL.md'], ['.codex/hooks.json']]);
  assert.deepEqual(json(jsh.root, '.codex/hooks.json'), { hooks: { SessionStart: [OTHER_START] } });
});

// ---- C3b: the blocks of the global instruction file, cut by their marker lines ------------------------

const open = (name) => `<!-- gentle-ai:${name} -->`;
const close = (name) => `<!-- /gentle-ai:${name} -->`;
const CLAUDE_MD = [
  open('codegraph-guidance'), 'codegraph text', close('codegraph-guidance'), '',
  open('persona'), 'persona text', close('persona'), '',
  open('orchestrator'), 'orch text', '<!-- authority-first-terminal-procedure:start -->', 'proc', '<!-- authority-first-terminal-procedure:end -->', close('orchestrator'), '',
  open('agent-routing'), 'routing', open('remote-authorization'), 'remote', close('remote-authorization'), close('agent-routing'), '',
  '# his own', 'his line', '',
].join('\r\n');

/** A Claude home whose CLAUDE.md is `text`. */
const withClaudeMd = (text) => (root) => {
  claudeHome(root);
  put(root, '.claude/CLAUDE.md', text);
  return root;
};

test('gentle-ai-<name> takes out its whole block, nested blocks and other markers with it, and keeps the line endings', (t) => {
  const { root, gone, changed } = cut(t, ['gentle-ai-agent-routing'], 'claude', withClaudeMd(CLAUDE_MD));
  assert.deepEqual([gone, changed], [[], ['.claude/CLAUDE.md']]);
  const text = fs.readFileSync(path.join(root, '.claude', 'CLAUDE.md'), 'utf8');
  assert.equal(text, CLAUDE_MD.replace(`${[open('agent-routing'), 'routing', open('remote-authorization'), 'remote', close('remote-authorization'), close('agent-routing')].join('\r\n')}\r\n`, ''));
  const orchestrator = cut(t, ['gentle-ai-orchestrator'], 'claude', withClaudeMd(CLAUDE_MD));
  const left = fs.readFileSync(path.join(orchestrator.root, '.claude', 'CLAUDE.md'), 'utf8');
  assert.equal(left.includes('authority-first'), false);
  assert.equal(left.includes('orch text'), false);
  assert.ok(left.includes('persona text') && left.includes('his line'));
});

test('claude-md-own keeps the blocks only, and the blocks leave his own lines', (t) => {
  const own = cut(t, ['claude-md-own'], 'claude', withClaudeMd(CLAUDE_MD));
  const text = fs.readFileSync(path.join(own.root, '.claude', 'CLAUDE.md'), 'utf8');
  assert.equal(text.includes('his'), false);
  for (const name of ['codegraph-guidance', 'persona', 'orchestrator', 'agent-routing']) assert.ok(text.includes(open(name)) && text.includes(close(name)), name);
  const allBlocks = cut(t, ['gentle-ai-persona'], 'claude', withClaudeMd(CLAUDE_MD));
  assert.ok(fs.readFileSync(path.join(allBlocks.root, '.claude', 'CLAUDE.md'), 'utf8').includes('his line'));
});

test('a block the file does not hold, and own lines a file of blocks only does not have, are refused', (t) => {
  const root = withClaudeMd(CLAUDE_MD)(tmp(t));
  assert.throws(() => checkWithout(root, ['gentle-ai-engram-protocol'], 'claude'), (err) => err instanceof ArmError && /gentle-ai-engram-protocol is not in/.test(err.message));
  put(root, '.claude/CLAUDE.md', [open('persona'), 'p', close('persona'), ''].join('\n'));
  assert.throws(() => checkWithout(root, ['claude-md-own'], 'claude'), (err) => err instanceof ArmError && /claude-md-own is not in/.test(err.message));
});

test('a marker out of balance, a block twice or a block left open is refused, naming the line', (t) => {
  const root = claudeHome(tmp(t));
  const cases = [
    [[open('persona'), close('orchestrator')], /line 2/],
    [[open('persona'), close('persona'), open('persona'), close('persona')], /persona.*twice|twice.*persona/],
    [[open('persona'), 'text'], /persona.*not closed|not closed.*persona/],
    [[close('persona')], /line 1/],
  ];
  for (const [lines, pattern] of cases) {
    put(root, '.claude/CLAUDE.md', `${lines.join('\n')}\n`);
    assert.throws(() => checkWithout(root, ['gentle-ai-persona'], 'claude'), (err) => err instanceof ArmError && pattern.test(err.message), lines.join(' '));
  }
});

test('Codex: the blocks of AGENTS.md come out the same way', (t) => {
  const make = (root) => {
    codexHome(root);
    put(root, '.codex/AGENTS.md', [open('persona'), 'p', close('persona'), '', open('engram-protocol'), 'e', close('engram-protocol'), ''].join('\n'));
    return root;
  };
  const { root, changed } = cut(t, ['gentle-ai-persona'], 'codex', make);
  assert.deepEqual(changed, ['.codex/AGENTS.md']);
  assert.equal(fs.readFileSync(path.join(root, '.codex', 'AGENTS.md'), 'utf8'), ['', open('engram-protocol'), 'e', close('engram-protocol'), ''].join('\n'));
});
