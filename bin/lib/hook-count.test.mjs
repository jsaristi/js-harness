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
    assert.ok(row.lines.some((line) => /warning: .*js-harness.*16.*15/.test(line)), row.lines.join('\n'));
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
