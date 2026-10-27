import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { estimateTokens } from '../check.mjs';
import { measurePayload } from './payload.mjs';

function makeTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function withFixture(fn) {
  const home = makeTmpDir('js-harness-payload-home-');
  const cwd = makeTmpDir('js-harness-payload-cwd-');
  try {
    fn(home, cwd);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

function findSource(host, name) {
  return host.sources.find((s) => s.name === name);
}

// --- full fixture: both hosts, exact token counts ---

test('measurePayload reports every Claude and Codex source with exact token counts and a matching total', () => {
  withFixture((home, cwd) => {
    const globalClaudeMd = 'a'.repeat(40);
    const styleContent = '---\nname: Gentleman\n---\nBody text for the style file.';
    const projectAgents = 'b'.repeat(80);
    const memoryIndex = 'c'.repeat(12);
    const globalCodexAgents = 'd'.repeat(60);
    const instructions = 'e'.repeat(20);

    write(path.join(home, '.claude', 'CLAUDE.md'), globalClaudeMd);
    write(
      path.join(home, '.claude', 'settings.json'),
      JSON.stringify({ outputStyle: 'Gentleman' }),
    );
    write(path.join(home, '.claude', 'output-styles', 'gentleman.md'), styleContent);
    write(path.join(cwd, 'AGENTS.md'), projectAgents);

    const slug = path.resolve(cwd).replace(/[^A-Za-z0-9]/g, '-');
    write(path.join(home, '.claude', 'projects', slug, 'memory', 'MEMORY.md'), memoryIndex);

    write(path.join(home, '.codex', 'AGENTS.md'), globalCodexAgents);
    const instructionsPath = path.join(home, '.codex', 'engram-instructions.md');
    write(instructionsPath, instructions);
    write(
      path.join(home, '.codex', 'config.toml'),
      `model_instructions_file = "${instructionsPath.replace(/\\/g, '\\\\')}"\n`,
    );

    const { hosts } = measurePayload({ home, cwd });
    const [claude, codex] = hosts;

    assert.equal(claude.host, 'claude');
    assert.equal(findSource(claude, 'global CLAUDE.md').tokens, estimateTokens(globalClaudeMd));
    assert.equal(findSource(claude, 'global CLAUDE.md').path, path.join(home, '.claude', 'CLAUDE.md'));
    assert.equal(findSource(claude, 'output style').tokens, estimateTokens(styleContent));
    assert.equal(
      findSource(claude, 'output style').path,
      path.join(home, '.claude', 'output-styles', 'gentleman.md'),
    );
    assert.equal(findSource(claude, 'project AGENTS.md').tokens, estimateTokens(projectAgents));
    assert.equal(findSource(claude, 'memory index').tokens, estimateTokens(memoryIndex));
    assert.equal(findSource(claude, 'project CLAUDE.md'), undefined);
    assert.equal(
      claude.total,
      estimateTokens(globalClaudeMd) +
        estimateTokens(styleContent) +
        estimateTokens(projectAgents) +
        estimateTokens(memoryIndex),
    );
    assert.deepEqual(
      claude.sources.map((s) => s.name),
      ['global CLAUDE.md', 'output style', 'project AGENTS.md', 'memory index'],
    );

    assert.equal(codex.host, 'codex');
    assert.equal(findSource(codex, 'global AGENTS.md').tokens, estimateTokens(globalCodexAgents));
    assert.equal(findSource(codex, 'global AGENTS.md').path, path.join(home, '.codex', 'AGENTS.md'));
    assert.equal(findSource(codex, 'model instructions').tokens, estimateTokens(instructions));
    assert.equal(findSource(codex, 'model instructions').path, instructionsPath);
    assert.equal(findSource(codex, 'project AGENTS.md').tokens, estimateTokens(projectAgents));
    assert.equal(
      codex.total,
      estimateTokens(globalCodexAgents) + estimateTokens(instructions) + estimateTokens(projectAgents),
    );
    assert.deepEqual(
      codex.sources.map((s) => s.name),
      ['global AGENTS.md', 'model instructions', 'project AGENTS.md'],
    );
  });
});

// --- missing files ---

test('a missing source reads tokens: null and is excluded from the host total', () => {
  withFixture((home, cwd) => {
    // Nothing written at all: every Claude/Codex source file is absent.
    const { hosts } = measurePayload({ home, cwd });
    const [claude, codex] = hosts;

    assert.equal(findSource(claude, 'global CLAUDE.md').tokens, null);
    assert.equal(findSource(claude, 'project AGENTS.md').tokens, null);
    assert.equal(findSource(claude, 'memory index').tokens, null);
    assert.equal(claude.total, 0);
    assert.equal(findSource(claude, 'output style'), undefined); // no setting at all -> omitted

    assert.equal(findSource(codex, 'global AGENTS.md').tokens, null);
    assert.equal(findSource(codex, 'project AGENTS.md').tokens, null);
    assert.equal(codex.total, 0);
    assert.equal(findSource(codex, 'model instructions'), undefined); // no config key -> omitted
  });
});

test('project CLAUDE.md is included only when it exists', () => {
  withFixture((home, cwd) => {
    write(path.join(cwd, 'CLAUDE.md'), 'f'.repeat(16));
    const { hosts } = measurePayload({ home, cwd });
    const claude = hosts[0];
    assert.equal(findSource(claude, 'project CLAUDE.md').tokens, estimateTokens('f'.repeat(16)));
  });
});

// --- output style matching ---

test('output style matches by frontmatter name, case-insensitively', () => {
  withFixture((home, cwd) => {
    write(path.join(home, '.claude', 'settings.json'), JSON.stringify({ outputStyle: 'gentleman' }));
    write(
      path.join(home, '.claude', 'output-styles', 'some-file.md'),
      '---\nname: Gentleman\n---\nbody',
    );
    const { hosts } = measurePayload({ home, cwd });
    const style = findSource(hosts[0], 'output style');
    assert.equal(style.path, path.join(home, '.claude', 'output-styles', 'some-file.md'));
  });
});

test('output style matches by basename when no frontmatter name matches', () => {
  withFixture((home, cwd) => {
    write(path.join(home, '.claude', 'settings.json'), JSON.stringify({ outputStyle: 'Neutral' }));
    write(path.join(home, '.claude', 'output-styles', 'neutral.md'), 'no frontmatter here');
    const { hosts } = measurePayload({ home, cwd });
    const style = findSource(hosts[0], 'output style');
    assert.equal(style.path, path.join(home, '.claude', 'output-styles', 'neutral.md'));
  });
});

test('output style set but not found is included as a built-in/plugin style with null path and tokens', () => {
  withFixture((home, cwd) => {
    write(path.join(home, '.claude', 'settings.json'), JSON.stringify({ outputStyle: 'Fable' }));
    // No output-styles directory at all.
    const { hosts } = measurePayload({ home, cwd });
    const style = findSource(hosts[0], 'output style');
    assert.deepEqual(style, { name: 'output style', path: null, tokens: null });
  });
});

// --- Codex AGENTS.override.md preference ---

test('Codex prefers AGENTS.override.md over AGENTS.md when both exist', () => {
  withFixture((home, cwd) => {
    write(path.join(home, '.codex', 'AGENTS.md'), 'base agents file');
    write(path.join(home, '.codex', 'AGENTS.override.md'), 'gg'.repeat(10));
    const { hosts } = measurePayload({ home, cwd });
    const source = findSource(hosts[1], 'global AGENTS.md');
    assert.equal(source.path, path.join(home, '.codex', 'AGENTS.override.md'));
    assert.equal(source.tokens, estimateTokens('gg'.repeat(10)));
  });
});

// --- config.toml table scoping ---

test('a model_instructions_file key under a [table] header is ignored', () => {
  withFixture((home, cwd) => {
    write(
      path.join(home, '.codex', 'config.toml'),
      ['[some_table]', 'model_instructions_file = "should-not-count.md"', ''].join('\n'),
    );
    const { hosts } = measurePayload({ home, cwd });
    assert.equal(findSource(hosts[1], 'model instructions'), undefined);
  });
});

// A Windows path is absolute on Windows alone. Elsewhere it is one relative name, resolved like any other
// against the folder of the config.toml that names it: the first run of this suite on Linux expected the
// Windows answer there.
const asThisSystemReads = (home, value) => (path.isAbsolute(value) ? value : path.resolve(path.join(home, '.codex'), value));

test('a top-level model_instructions_file key before any table header is used, and TOML backslash escapes are unescaped', () => {
  withFixture((home, cwd) => {
    write(
      path.join(home, '.codex', 'config.toml'),
      ['model_instructions_file = "C:\\\\Users\\\\test\\\\engram-instructions.md"', '[some_table]', 'x = 1', ''].join(
        '\n',
      ),
    );
    const { hosts } = measurePayload({ home, cwd });
    const source = findSource(hosts[1], 'model instructions');
    assert.equal(source.path, asThisSystemReads(home, 'C:\\Users\\test\\engram-instructions.md'));
    assert.equal(source.tokens, null); // the unescaped path doesn't exist on disk
  });
});

test('a TOML literal string and a trailing comment are both read', () => {
  withFixture((home, cwd) => {
    write(path.join(home, '.codex', 'config.toml'), "model_instructions_file = 'C:\\Users\\test\\a.md'\n");
    assert.equal(findSource(measurePayload({ home, cwd }).hosts[1], 'model instructions').path, asThisSystemReads(home, 'C:\\Users\\test\\a.md'));
    // A path that is absolute on this system is taken as it is, whichever system this is.
    const absolute = path.resolve(home, 'elsewhere', 'a.md');
    write(path.join(home, '.codex', 'config.toml'), `model_instructions_file = '${absolute}'\n`);
    assert.equal(findSource(measurePayload({ home, cwd }).hosts[1], 'model instructions').path, absolute);
    write(path.join(home, '.codex', 'config.toml'), 'model_instructions_file = "b.md" # engram\n');
    // A relative value resolves against <home>/.codex, the directory of the config.toml that defines it.
    assert.equal(
      findSource(measurePayload({ home, cwd }).hosts[1], 'model instructions').path,
      path.resolve(path.join(home, '.codex'), 'b.md'),
    );
  });
});

// A value `check` cannot make sense of must read as not found, never crash the pre-commit gate.
test('an out-of-range TOML unicode escape does not throw', () => {
  withFixture((home, cwd) => {
    write(path.join(home, '.codex', 'config.toml'), 'model_instructions_file = "\\UFFFFFFFF.md"\n');
    const source = findSource(measurePayload({ home, cwd }).hosts[1], 'model instructions');
    assert.equal(source.tokens, null);
  });
});

test('a source path that is a directory reads tokens: null, without throwing', () => {
  withFixture((home, cwd) => {
    fs.mkdirSync(path.join(home, '.claude', 'CLAUDE.md'), { recursive: true });
    const { hosts } = measurePayload({ home, cwd });
    assert.equal(findSource(hosts[0], 'global CLAUDE.md').tokens, null);
  });
});

// --- malformed config does not throw ---

test('malformed settings.json yields no output style and no Claude hooks, without throwing', () => {
  withFixture((home, cwd) => {
    write(path.join(home, '.claude', 'settings.json'), '{ not json');
    assert.doesNotThrow(() => measurePayload({ home, cwd }));
    const { hosts } = measurePayload({ home, cwd });
    assert.equal(findSource(hosts[0], 'output style'), undefined);
    assert.deepEqual(hosts[0].hooks, []);
  });
});

test('malformed hooks.json yields no Codex hooks, without throwing', () => {
  withFixture((home, cwd) => {
    write(path.join(home, '.codex', 'hooks.json'), '{ not json');
    assert.doesNotThrow(() => measurePayload({ home, cwd }));
    const { hosts } = measurePayload({ home, cwd });
    assert.deepEqual(hosts[1].hooks, []);
  });
});

// --- hook order and event filtering ---

test('hooks are listed in configured order, and a Stop hook is not read', () => {
  withFixture((home, cwd) => {
    write(
      path.join(home, '.claude', 'settings.json'),
      JSON.stringify({
        hooks: {
          UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'codegraph.cmd prompt-hook' }] }],
          SessionStart: [
            { hooks: [{ type: 'command', command: 'gentle-ai review stop-hook' }] },
            { hooks: [{ type: 'command', command: 'js-harness doctor --hook' }] },
          ],
          Stop: [{ hooks: [{ type: 'command', command: 'should-not-appear' }] }],
        },
      }),
    );
    const { hosts } = measurePayload({ home, cwd });
    assert.deepEqual(hosts[0].hooks, [
      { event: 'UserPromptSubmit', command: 'codegraph.cmd prompt-hook' },
      { event: 'SessionStart', command: 'gentle-ai review stop-hook' },
      { event: 'SessionStart', command: 'js-harness doctor --hook' },
    ]);
  });
});

test('hooks that add context before or after a tool call, or at a subagent launch, are listed too', () => {
  withFixture((home, cwd) => {
    write(
      path.join(home, '.claude', 'settings.json'),
      JSON.stringify({
        hooks: {
          PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'guard --hook' }] }],
          PostToolUse: [{ hooks: [{ type: 'command', command: 'resume --pause' }] }],
          PostToolUseFailure: [{ matcher: 'WebFetch', hooks: [{ type: 'command', command: 'resume --pause' }] }],
          SubagentStart: [{ hooks: [{ type: 'command', command: 'rules --hook' }] }],
          SubagentStop: [{ hooks: [{ type: 'command', command: 'should-not-appear' }] }],
        },
      }),
    );
    const { hosts } = measurePayload({ home, cwd });
    assert.deepEqual(hosts[0].hooks, [
      { event: 'PreToolUse', command: 'guard --hook' },
      { event: 'PostToolUse', command: 'resume --pause' },
      { event: 'PostToolUseFailure', command: 'resume --pause' },
      { event: 'SubagentStart', command: 'rules --hook' },
    ]);
  });
});

test('Codex hooks are read from hooks.json the same way', () => {
  withFixture((home, cwd) => {
    write(
      path.join(home, '.codex', 'hooks.json'),
      JSON.stringify({
        hooks: {
          SessionStart: [{ hooks: [{ command: 'skill-registry refresh --quiet' }] }],
        },
      }),
    );
    const { hosts } = measurePayload({ home, cwd });
    assert.deepEqual(hosts[1].hooks, [{ event: 'SessionStart', command: 'skill-registry refresh --quiet' }]);
  });
});

// --- memory index slug ---

test('memory index slug for a Windows-style cwd matches path.resolve with non-alnum chars replaced', () => {
  withFixture((home) => {
    const cwd = 'D:\\js-harness';
    const expectedSlug = path.resolve(cwd).replace(/[^A-Za-z0-9]/g, '-');
    const { hosts } = measurePayload({ home, cwd });
    const memory = findSource(hosts[0], 'memory index');
    assert.equal(memory.path, path.join(home, '.claude', 'projects', expectedSlug, 'memory', 'MEMORY.md'));
  });
});

test('memory index slug for a POSIX cwd matches path.resolve with non-alnum chars replaced', () => {
  withFixture((home) => {
    const cwd = '/home/user/js-harness';
    const expectedSlug = path.resolve(cwd).replace(/[^A-Za-z0-9]/g, '-');
    const { hosts } = measurePayload({ home, cwd });
    const memory = findSource(hosts[0], 'memory index');
    assert.equal(memory.path, path.join(home, '.claude', 'projects', expectedSlug, 'memory', 'MEMORY.md'));
  });
});

// Claude Code keeps one memory for a repository, under its main checkout's slug: a worktree has no
// memory folder of its own, so measured from one the index must still be the main checkout's.
test('memory index from a linked worktree is the main checkout\'s', () => {
  withFixture((home, root) => {
    const git = (args, cwd) => {
      const result = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    };
    const main = path.join(root, 'main');
    const worktree = path.join(root, 'wt');
    fs.mkdirSync(main);
    git(['init', '-q'], main);
    git(['commit', '-q', '--allow-empty', '-m', 'init'], main);
    git(['worktree', 'add', '-q', worktree], main);
    const memoryIndex = 'm'.repeat(20);
    const slug = fs.realpathSync(main).replace(/[^A-Za-z0-9]/g, '-');
    write(path.join(home, '.claude', 'projects', slug, 'memory', 'MEMORY.md'), memoryIndex);

    const memory = findSource(measurePayload({ home, cwd: worktree }).hosts[0], 'memory index');
    assert.equal(memory.path, path.join(home, '.claude', 'projects', slug, 'memory', 'MEMORY.md'));
    assert.equal(memory.tokens, estimateTokens(memoryIndex));
  });
});

// --- Claude hooks: also read project-scoped settings (Codex P2 follow-up) ---

test('Claude hooks are concatenated from user, project and project-local settings, in that order', () => {
  withFixture((home, cwd) => {
    write(
      path.join(home, '.claude', 'settings.json'),
      JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ command: 'user-hook' }] }] } }),
    );
    write(
      path.join(cwd, '.claude', 'settings.json'),
      JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ command: 'project-hook' }] }] } }),
    );
    write(
      path.join(cwd, '.claude', 'settings.local.json'),
      JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ command: 'local-hook' }] }] } }),
    );
    const { hosts } = measurePayload({ home, cwd });
    assert.deepEqual(hosts[0].hooks, [
      { event: 'UserPromptSubmit', command: 'user-hook' },
      { event: 'UserPromptSubmit', command: 'project-hook' },
      { event: 'UserPromptSubmit', command: 'local-hook' },
    ]);
  });
});

test('missing or malformed project-scoped Claude settings contribute no hooks, without throwing', () => {
  withFixture((home, cwd) => {
    write(path.join(cwd, '.claude', 'settings.json'), '{ not json');
    write(path.join(cwd, '.claude', 'settings.local.json'), '{ not json');
    assert.doesNotThrow(() => measurePayload({ home, cwd }));
    const { hosts } = measurePayload({ home, cwd });
    assert.deepEqual(hosts[0].hooks, []);
  });
});

// --- enabled Claude plugins add their own context hooks (hooks/hooks.json under the install path) ---

const PLUGIN_ID = 'engram@engram';

/** A plugin installed under `<home>/.claude/plugins/cache/<name>`, recorded in installed_plugins.json
 * and declaring `hooks` in its `hooks/hooks.json` (a raw string is written as-is, to fake bad JSON). */
function installPlugin(home, pluginId, hooks) {
  const installPath = path.join(home, '.claude', 'plugins', 'cache', pluginId.replace('@', '-'));
  const recordPath = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
  let record = { version: 2, plugins: {} };
  if (fs.existsSync(recordPath)) record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  record.plugins[pluginId] = [{ scope: 'user', installPath, version: '0.1.5' }];
  write(recordPath, JSON.stringify(record));
  if (hooks !== undefined) {
    write(path.join(installPath, 'hooks', 'hooks.json'), typeof hooks === 'string' ? hooks : JSON.stringify({ hooks }));
  }
}

const ENGRAM_HOOKS = {
  SessionStart: [{ matcher: 'startup', hooks: [{ type: 'command', command: '"${CLAUDE_PLUGIN_ROOT}/scripts/session-start.sh"' }] }],
  UserPromptSubmit: [{ hooks: [{ type: 'command', command: '"${CLAUDE_PLUGIN_ROOT}/scripts/user-prompt-submit.sh"' }] }],
  Stop: [{ hooks: [{ type: 'command', command: 'should-not-appear' }] }],
};

test('an enabled plugin adds its UserPromptSubmit and SessionStart hooks after the settings hooks, naming the plugin', () => {
  withFixture((home, cwd) => {
    write(
      path.join(home, '.claude', 'settings.json'),
      JSON.stringify({
        enabledPlugins: { [PLUGIN_ID]: true },
        hooks: { SessionStart: [{ hooks: [{ command: 'settings-hook' }] }] },
      }),
    );
    installPlugin(home, PLUGIN_ID, ENGRAM_HOOKS);
    const { hosts } = measurePayload({ home, cwd });
    assert.deepEqual(hosts[0].hooks, [
      { event: 'SessionStart', command: 'settings-hook' },
      { event: 'UserPromptSubmit', command: '"${CLAUDE_PLUGIN_ROOT}/scripts/user-prompt-submit.sh"', plugin: PLUGIN_ID },
      { event: 'SessionStart', command: '"${CLAUDE_PLUGIN_ROOT}/scripts/session-start.sh"', plugin: PLUGIN_ID },
    ]);
    assert.deepEqual(hosts[1].hooks, []);
  });
});

test('a disabled plugin, or one with no install record, contributes no hooks', () => {
  withFixture((home, cwd) => {
    write(path.join(home, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { [PLUGIN_ID]: false, 'ghost@nowhere': true } }));
    installPlugin(home, PLUGIN_ID, ENGRAM_HOOKS);
    assert.deepEqual(measurePayload({ home, cwd }).hosts[0].hooks, []);
  });
});

test('a plugin with a missing or malformed hooks.json contributes no hooks, without throwing', () => {
  for (const hooks of [undefined, '{ not json']) {
    withFixture((home, cwd) => {
      write(path.join(home, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { [PLUGIN_ID]: true } }));
      installPlugin(home, PLUGIN_ID, hooks);
      assert.doesNotThrow(() => measurePayload({ home, cwd }));
      assert.deepEqual(measurePayload({ home, cwd }).hosts[0].hooks, []);
    });
  }
  withFixture((home, cwd) => {
    write(path.join(home, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { [PLUGIN_ID]: true } }));
    write(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), '{ not json');
    assert.deepEqual(measurePayload({ home, cwd }).hosts[0].hooks, []);
  });
});

/** Several install records for one plugin, each `{ scope, projectPath?, hook }`: every record gets its
 * own install directory whose hooks.json declares one SessionStart hook with the record's `hook`. */
function installRecords(home, pluginId, records) {
  const entries = records.map(({ scope, projectPath, hook }, i) => {
    const installPath = path.join(home, '.claude', 'plugins', 'cache', `record-${i}`);
    write(
      path.join(installPath, 'hooks', 'hooks.json'),
      JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ command: hook }] }] } }),
    );
    return { ...(scope ? { scope } : {}), ...(projectPath ? { projectPath } : {}), installPath, version: '0.1.5' };
  });
  write(
    path.join(home, '.claude', 'plugins', 'installed_plugins.json'),
    JSON.stringify({ version: 2, plugins: { [pluginId]: entries } }),
  );
}

function pluginCommands(home, cwd) {
  return measurePayload({ home, cwd }).hosts[0].hooks.map((h) => h.command);
}

test('the install record that applies to the current project wins, whatever its position in the file', () => {
  withFixture((home, cwd) => {
    write(path.join(home, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { [PLUGIN_ID]: true } }));
    installRecords(home, PLUGIN_ID, [
      { scope: 'project', projectPath: path.join(cwd, 'other-project'), hook: 'other-project-hook' },
      { scope: 'project', projectPath: cwd, hook: 'this-project-hook' },
    ]);
    assert.deepEqual(pluginCommands(home, cwd), ['this-project-hook']);
  });
});

test('a record bound to another project never applies, and a project record beats a user record', () => {
  withFixture((home, cwd) => {
    write(path.join(home, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { [PLUGIN_ID]: true } }));
    installRecords(home, PLUGIN_ID, [{ scope: 'local', projectPath: path.join(cwd, 'other-project'), hook: 'other-hook' }]);
    assert.deepEqual(pluginCommands(home, cwd), []);

    installRecords(home, PLUGIN_ID, [
      { scope: 'user', hook: 'user-hook' },
      { scope: 'local', projectPath: cwd, hook: 'this-project-hook' },
    ]);
    assert.deepEqual(pluginCommands(home, cwd), ['this-project-hook']);
  });
});

test('a user record, or a record with no scope and no projectPath, applies to every project', () => {
  withFixture((home, cwd) => {
    write(path.join(home, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { [PLUGIN_ID]: true } }));
    installRecords(home, PLUGIN_ID, [
      { scope: 'project', projectPath: path.join(cwd, 'other-project'), hook: 'other-hook' },
      { scope: 'user', hook: 'user-hook' },
    ]);
    assert.deepEqual(pluginCommands(home, cwd), ['user-hook']);

    installRecords(home, PLUGIN_ID, [{ hook: 'unscoped-hook' }]);
    assert.deepEqual(pluginCommands(home, cwd), ['unscoped-hook']);
  });
});

test('a record\'s projectPath is compared as a resolved path, case-insensitively on Windows', () => {
  withFixture((home, cwd) => {
    write(path.join(home, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { [PLUGIN_ID]: true } }));
    installRecords(home, PLUGIN_ID, [{ scope: 'project', projectPath: path.join(cwd, '.', 'sub', '..'), hook: 'this-project-hook' }]);
    assert.deepEqual(pluginCommands(home, cwd), ['this-project-hook']);
    if (process.platform === 'win32') {
      installRecords(home, PLUGIN_ID, [{ scope: 'project', projectPath: cwd.toUpperCase(), hook: 'this-project-hook' }]);
      assert.deepEqual(pluginCommands(home, cwd), ['this-project-hook']);
    }
  });
});

test('a plugin enabled only in the project settings is listed, and project-local settings can switch it off', () => {
  withFixture((home, cwd) => {
    installPlugin(home, PLUGIN_ID, ENGRAM_HOOKS);
    write(path.join(cwd, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { [PLUGIN_ID]: true } }));
    const listed = measurePayload({ home, cwd }).hosts[0].hooks;
    assert.deepEqual(listed.map((h) => h.plugin), [PLUGIN_ID, PLUGIN_ID]);

    write(path.join(cwd, '.claude', 'settings.local.json'), JSON.stringify({ enabledPlugins: { [PLUGIN_ID]: false } }));
    assert.deepEqual(measurePayload({ home, cwd }).hosts[0].hooks, []);
  });
});

// --- Codex project AGENTS.md prefers AGENTS.override.md, same as the global selection (Codex P2 follow-up) ---

test('Codex project instructions prefer AGENTS.override.md over AGENTS.md in cwd', () => {
  withFixture((home, cwd) => {
    write(path.join(cwd, 'AGENTS.md'), 'base project agents');
    write(path.join(cwd, 'AGENTS.override.md'), 'hh'.repeat(10));
    const { hosts } = measurePayload({ home, cwd });
    const projectSource = findSource(hosts[1], 'project AGENTS.md');
    assert.equal(projectSource.path, path.join(cwd, 'AGENTS.override.md'));
    assert.equal(projectSource.tokens, estimateTokens('hh'.repeat(10)));
  });
});

// --- model_instructions_file resolves relative to the config.toml directory (gentle-ai WARNING follow-up) ---

test('a relative model_instructions_file value resolves against the config.toml directory (<home>/.codex)', () => {
  withFixture((home, cwd) => {
    write(path.join(home, '.codex', 'engram-instructions.md'), 'relative-instructions');
    write(path.join(home, '.codex', 'config.toml'), 'model_instructions_file = "engram-instructions.md"\n');
    const { hosts } = measurePayload({ home, cwd });
    const source = findSource(hosts[1], 'model instructions');
    assert.equal(source.path, path.join(home, '.codex', 'engram-instructions.md'));
    assert.equal(source.tokens, estimateTokens('relative-instructions'));
  });
});

// --- claudeMdExcludes (odd/tasks/f8-s3-split.md, S8) ---
// Claude Code skips a CLAUDE.md whose absolute path a `claudeMdExcludes` glob of any settings layer matches, so the
// payload counts it as excluded, not as a file that loads on each turn.

test('a global CLAUDE.md that a claudeMdExcludes glob of the project settings matches is excluded from the total', () => {
  withFixture((home, cwd) => {
    write(path.join(home, '.claude', 'CLAUDE.md'), 'a'.repeat(400));
    write(path.join(cwd, 'AGENTS.md'), 'b'.repeat(40));
    write(path.join(cwd, 'CLAUDE.md'), '@AGENTS.md\n' + 'c'.repeat(40));
    write(path.join(cwd, '.claude', 'settings.json'), JSON.stringify({ claudeMdExcludes: ['**/.claude/CLAUDE.md'] }));
    const [claude] = measurePayload({ home, cwd }).hosts;
    const global = findSource(claude, 'global CLAUDE.md');
    assert.equal(global.tokens, 0);
    assert.equal(global.excluded, '**/.claude/CLAUDE.md');
    assert.equal(findSource(claude, 'project CLAUDE.md').excluded, undefined, 'the root CLAUDE.md is not under .claude/');
    assert.equal(claude.total, estimateTokens('b'.repeat(40)) + estimateTokens('@AGENTS.md\n' + 'c'.repeat(40)));
  });
});

test('claudeMdExcludes is read from the local and user layers too, and a glob that matches nothing excludes nothing', () => {
  withFixture((home, cwd) => {
    write(path.join(home, '.claude', 'CLAUDE.md'), 'a'.repeat(400));
    write(path.join(cwd, '.claude', 'settings.local.json'), JSON.stringify({ claudeMdExcludes: ['**/elsewhere/CLAUDE.md'] }));
    let [claude] = measurePayload({ home, cwd }).hosts;
    assert.equal(findSource(claude, 'global CLAUDE.md').tokens, 100);
    assert.equal(findSource(claude, 'global CLAUDE.md').excluded, undefined);

    write(path.join(home, '.claude', 'settings.json'), JSON.stringify({ claudeMdExcludes: ['**/.claude/CLAUDE.md'] }));
    [claude] = measurePayload({ home, cwd }).hosts;
    assert.equal(findSource(claude, 'global CLAUDE.md').excluded, '**/.claude/CLAUDE.md');
  });
});
