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

test('the components cut by marker lines or TOML tables are refused until they are built', (t) => {
  const root = claudeHome(tmp(t));
  for (const [id, agent] of [['claude-md-own', 'claude'], ['gentle-ai-persona', 'claude'], ['gentle-ai-orchestrator', 'codex'], ['mcp-engram', 'codex'], ['plugin-gentle-ai', 'codex']]) {
    assert.throws(() => checkWithout(root, [id], agent), (err) => err instanceof ArmError && /not built yet/.test(err.message), `${agent} ${id}`);
  }
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
