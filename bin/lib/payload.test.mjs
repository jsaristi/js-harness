import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
    assert.equal(source.path, 'C:\\Users\\test\\engram-instructions.md');
    assert.equal(source.tokens, null); // the unescaped path doesn't exist on disk
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

test('hooks are listed in configured order, only for UserPromptSubmit and SessionStart', () => {
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
