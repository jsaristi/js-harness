import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HOOK_ENTRY_LIMIT, hookEntriesRow, installEntries, liveEntries, ownerOf } from './hook-count.mjs';

function withFixture(fn) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-hook-count-home-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-hook-count-cwd-'));
  try {
    fn(home, cwd);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

const settings = (hooks, extra = {}) => JSON.stringify({ ...extra, hooks });
const command = (line) => ({ hooks: [{ type: 'command', command: line }] });

test('install writes the limit of entries, every one of them js-harness, on the events a session meets', () => {
  const entries = installEntries();
  // Only Claude Code's settings: an entry another host's file holds under the same pointer is not Claude's.
  const codex = { target: (home) => path.join(home, '.codex', 'hooks.json'), pointer: ['hooks', 'Stop'], entry: () => command('x') };
  assert.equal(installEntries([codex]).length, 0);
  assert.equal(entries.length, HOOK_ENTRY_LIMIT);
  assert.deepEqual([...new Set(entries.map(ownerOf))], ['js-harness']);
  const byEvent = Object.fromEntries([...new Set(entries.map((e) => e.event))].map((event) => [event, entries.filter((e) => e.event === event).length]));
  assert.deepEqual(byEvent, { SessionStart: 4, PostToolUse: 2, PostToolUseFailure: 1, PreToolUse: 2, PermissionRequest: 1, Stop: 3, UserPromptSubmit: 1, SubagentStart: 1 });
});

test('the owner of an entry is its plugin, else the name of the program its command starts', () => {
  assert.equal(ownerOf({ command: 'js-harness guard --hook || exit 0' }), 'js-harness');
  assert.equal(ownerOf({ command: 'codegraph.cmd prompt-hook' }), 'codegraph');
  assert.equal(ownerOf({ command: '"C:/Users/x/.orca/agent-hooks/claude-hook.cmd" || echo {}' }), 'claude-hook');
  assert.equal(ownerOf({ command: '"${CLAUDE_PLUGIN_ROOT}/scripts/session-start.sh"', plugin: 'engram@engram' }), 'engram@engram');
  // A script run by node or npm is owned by the script's top folder, not by node.
  assert.equal(ownerOf({ command: 'node workshop/js-harness-workshop.mjs ticks --hook' }), 'workshop');
  assert.equal(ownerOf({ command: 'node ./workshop/js-harness-workshop.mjs ticks --hook' }), 'workshop');
  assert.equal(ownerOf({ command: 'node' }), 'node');
  // The Windows spelling of a relative script, as a hook written by hand on Windows has it.
  assert.equal(ownerOf({ command: 'node .\\workshop\\js-harness-workshop.mjs ticks --hook' }), 'workshop');
  assert.equal(ownerOf({ command: 'node workshop\\js-harness-workshop.mjs' }), 'workshop');
  // An absolute script is owned by its own name: its top folder is a drive or the root, which names no owner.
  assert.equal(ownerOf({ command: 'node "C:\\Users\\x\\.claude\\hooks\\guard-hook.mjs"' }), 'guard-hook');
  assert.equal(ownerOf({ command: 'node /usr/local/lib/tool/run.js' }), 'run');
  // A flag's value is no script: the script is the first word with a script's extension.
  assert.equal(ownerOf({ command: 'node --max-old-space-size 4096 tools/a.mjs' }), 'tools');
  // The package managers' subcommands name no owner; what they run does.
  assert.equal(ownerOf({ command: 'npm run lint' }), 'lint');
  assert.equal(ownerOf({ command: 'pnpm exec foo --bar' }), 'foo');
  assert.equal(ownerOf({ command: 'npx -y some-pkg' }), 'some-pkg');
  assert.equal(ownerOf({ command: '' }), '(empty)');
  assert.equal(ownerOf({ command: '   ' }), '(empty)');
});

test('the live entries are every event of the settings layers and of the enabled plugins, Stop and PermissionRequest included', () => {
  withFixture((home, cwd) => {
    const installPath = path.join(home, '.claude', 'plugins', 'cache', 'engram-engram');
    write(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'engram@engram': [{ scope: 'user', installPath }] } }));
    write(path.join(installPath, 'hooks', 'hooks.json'), JSON.stringify({ hooks: { UserPromptSubmit: [command('"${CLAUDE_PLUGIN_ROOT}/scripts/user-prompt-submit.sh"')], Stop: [command('"${CLAUDE_PLUGIN_ROOT}/scripts/stop.sh"')] } }));
    write(path.join(home, '.claude', 'settings.json'), settings({ Stop: [command('js-harness reply --hook || exit 0')], PermissionRequest: [command('js-harness permit --hook || exit 0')] }, { enabledPlugins: { 'engram@engram': true } }));
    write(path.join(cwd, '.claude', 'settings.json'), settings({ SessionStart: [command('node workshop/js-harness-workshop.mjs ticks --hook')] }));
    const owners = liveEntries(home, cwd).map((entry) => `${entry.event} ${ownerOf(entry)}`).sort();
    assert.deepEqual(owners, ['PermissionRequest js-harness', 'SessionStart workshop', 'Stop engram@engram', 'Stop js-harness', 'UserPromptSubmit engram@engram']);
  });
});

test('in a project the row informs: it counts by owner and warns on an owner the harness does not install, never failing', () => {
  withFixture((home, cwd) => {
    write(path.join(home, '.claude', 'settings.json'), settings({ PreToolUse: [command('orca-hook.cmd || echo {}')], UserPromptSubmit: [command('codegraph.cmd prompt-hook')] }));
    const row = hookEntriesRow(cwd, home, { own: false });
    assert.equal(row.name, 'hook entries');
    assert.equal(row.pass, true);
    assert.equal(row.info, true);
    assert.match(row.detail, /2 entries/);
    assert.match(row.detail, /codegraph 1/);
    assert.ok(row.lines.some((line) => /warning: .*"orca-hook"/.test(line)), row.lines.join('\n'));
    assert.ok(!row.lines.some((line) => /warning: .*codegraph/.test(line)), 'codegraph is installed by stack, so it is known');
  });
});

test('in a project the row warns when the home holds more js-harness entries than the limit, as an install of another version does', () => {
  withFixture((home, cwd) => {
    const many = Array.from({ length: HOOK_ENTRY_LIMIT + 1 }, () => command('js-harness reply --hook || exit 0'));
    write(path.join(home, '.claude', 'settings.json'), settings({ Stop: many }));
    const row = hookEntriesRow(cwd, home, { own: false });
    assert.equal(row.pass, true);
    assert.ok(row.lines.some((line) => /warning: js-harness has 16 entries in this home and project, over the limit of 15/.test(line)), row.lines.join('\n'));
  });
});

test('in the harness repository one more entry than the limit in what install writes turns the row red', () => {
  withFixture((home, cwd) => {
    const installed = [...installEntries(), { event: 'Stop', command: 'js-harness extra --hook || exit 0' }];
    const row = hookEntriesRow(cwd, home, { own: true, installed });
    assert.equal(row.pass, false);
    assert.equal(row.info, false);
    assert.ok(row.lines.some((line) => /install writes 16 entries.*limit 15/.test(line)), row.lines.join('\n'));
  });
});

test('in the harness repository the row is green with what install writes today and the project hook of its workshop', () => {
  withFixture((home, cwd) => {
    write(path.join(cwd, '.claude', 'settings.json'), settings({ SessionStart: [command('node workshop/js-harness-workshop.mjs ticks --hook')] }));
    const row = hookEntriesRow(cwd, home, { own: true });
    assert.equal(row.pass, true, row.lines.join('\n'));
    assert.ok(row.lines.some((line) => /install writes 15 entries \(limit 15\)/.test(line)), row.lines.join('\n'));
  });
});

test('a missing or malformed settings file counts nothing and never throws', () => {
  withFixture((home, cwd) => {
    write(path.join(home, '.claude', 'settings.json'), '{ not json');
    const row = hookEntriesRow(cwd, home, { own: false });
    assert.equal(row.pass, true);
    assert.match(row.detail, /0 entries/);
  });
});

// The machine's entries on 2026-11-06 beyond js-harness's own (odd/tasks/f8-s4a-hook-count.md, L3): codegraph's prompt
// hook and the hooks of the two plugins the stack installs.
const STACK_ENTRIES = [
  { event: 'UserPromptSubmit', command: 'codegraph.cmd prompt-hook' },
  ...['PreToolUse', 'SessionStart', 'SessionStart', 'SessionStart', 'UserPromptSubmit', 'SubagentStop', 'SessionEnd'].map((event) => ({ event, command: '"${CLAUDE_PLUGIN_ROOT}/scripts/x.sh"', plugin: 'engram@engram' })),
  ...['SessionStart', 'SessionEnd', 'Stop'].map((event) => ({ event, command: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/x.mjs"', plugin: 'codex@openai-codex' })),
];
const counted = { declared: { hookCount: true } };

test('with "hookCount": true the row holds the machine to its ceilings and is green at the count of 2026-11-06', () => {
  const row = hookEntriesRow('.', '.', { ...counted, own: false, live: [...installEntries(), ...STACK_ENTRIES] });
  assert.equal(row.pass, true, row.lines.join('\n'));
  assert.equal(row.info, false, 'a project that turns the count on is held to it');
  assert.match(row.detail, /26 entries/);
  assert.ok(row.lines.some((line) => line === 'engram@engram: PreToolUse 1/1, SessionStart 3/3, UserPromptSubmit 1/1, SubagentStop 1/1, SessionEnd 1/1'), row.lines.join('\n'));
});

test('with "hookCount": true one extra Stop entry of js-harness turns the row red: its ceiling is what install writes', () => {
  const live = [...installEntries(), ...STACK_ENTRIES, { event: 'Stop', command: 'js-harness extra --hook || exit 0' }];
  const row = hookEntriesRow('.', '.', { ...counted, own: false, live });
  assert.equal(row.pass, false);
  assert.equal(row.info, false);
  assert.ok(row.lines.some((line) => line === 'js-harness Stop: 4 entries, over its ceiling of 3'), row.lines.join('\n'));
  assert.ok(row.lines.some((line) => /raise its ceiling in HOOK_CEILINGS \(bin\/lib\/hook-count\.mjs\)/.test(line)), row.lines.join('\n'));
});

test('with "hookCount": true a new owner and a plugin cell over its ceiling turn the row red, each named once', () => {
  const live = [...installEntries(), ...STACK_ENTRIES, { event: 'PreToolUse', command: 'orca-hook.cmd || echo {}' }, { event: 'UserPromptSubmit', command: 'x', plugin: 'engram@engram' }];
  const row = hookEntriesRow('.', '.', { ...counted, own: false, live });
  assert.equal(row.pass, false);
  assert.ok(row.lines.some((line) => line === 'orca-hook: a new owner, not in the table: PreToolUse 1'), row.lines.join('\n'));
  assert.ok(row.lines.some((line) => line === 'engram@engram UserPromptSubmit: 2 entries, over its ceiling of 1'), row.lines.join('\n'));
  assert.equal(row.lines.filter((line) => line.includes('orca-hook')).length, 1, 'the failure names the owner; no warning repeats it');
  assert.match(row.detail, /2 over the table/);
});

test('"hookCount" set to anything but true fails the row, and the harness repository keeps its install limit with it', () => {
  const wrong = hookEntriesRow('.', '.', { declared: { hookCount: 'yes' }, own: false, live: [] });
  assert.equal(wrong.pass, false);
  assert.ok(wrong.lines.some((line) => line === 'harness.json "hookCount" must be true; it is "yes"'), wrong.lines.join('\n'));
  const own = hookEntriesRow('.', '.', { ...counted, own: true, live: [...installEntries(), ...STACK_ENTRIES], installed: [...installEntries(), { event: 'Stop', command: 'js-harness x' }] });
  assert.equal(own.pass, false);
  assert.ok(own.lines.some((line) => /install writes 16 entries.*limit 15/.test(line)), own.lines.join('\n'));
});

test('the owner of a command whose program is a single-quoted path with a space is that program', () => {
  assert.equal(ownerOf({ command: "'/opt/my tools/guard-hook.sh' --hook" }), 'guard-hook');
});
