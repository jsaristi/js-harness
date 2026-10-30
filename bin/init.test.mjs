import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { initMain } from './init.mjs';

// T2e item 8 (R3-tests-depend-on-host-git-config): isolate every real `git` call this file makes
// (directly, or through the engine's default `spawnSync`, which inherits `process.env`) from the
// host's own global/system config — see bin/lib/project.test.mjs's identical `before` hook.
let configDir;
before(() => {
  // A git hook runs with GIT_DIR, GIT_INDEX_FILE and friends pointing at the repository being
  // committed; inherited here, they would send every git call below to that repository instead
  // of the test's own (a pre-commit run of this suite broke `git worktree add` that way).
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-init-cli-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
// The empty git config lives outside the repository, so it is removed with the suite.
after(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
});

function makeTmpRepo(prefix = 'js-harness-init-cli-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const result = spawnSync('git', ['init'], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 0, `git init failed: ${result.stderr}`);
  return dir;
}

/** A program in the repository at `dir`, so the code map resolves on and `codegraph init` runs
 * (odd/tasks/on-demand-functions.md: an empty repository holds no code). */
function withProgram(dir) {
  fs.writeFileSync(path.join(dir, 'index.js'), '', 'utf8');
  return dir;
}

function makeTmpDir(prefix = 'js-harness-init-cli-nongit-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function makeTmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-init-cli-home-'));
}

/** Never touches a real `codegraph` binary: pre-creating `.codegraph` in each fixture repo means
 * `initProject` skips the spawn entirely, so most tests here need no fake spawn at all. Tests that
 * do need codegraph to run supply one explicitly. */
function withCodegraphSkipped(root) {
  fs.mkdirSync(path.join(root, '.codegraph'), { recursive: true });
}

test('initMain outside a git repository prints to stderr and exits 1', async () => {
  const dir = makeTmpDir();
  const home = makeTmpHome();
  try {
    let stderr = '';
    const origError = console.error;
    console.error = (msg) => {
      stderr += `${msg}\n`;
    };
    let code;
    try {
      code = await initMain(['--cwd', dir, '--home', home], process.env, {});
    } finally {
      console.error = origError;
    }
    assert.equal(code, 1);
    assert.match(stderr, /not a git repository: run git init first/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('initMain on a fresh repo writes the four actions and exits 0', async () => {
  const root = makeTmpRepo();
  const home = makeTmpHome();
  withCodegraphSkipped(root);
  try {
    let stdout = '';
    const origLog = console.log;
    console.log = (msg) => {
      stdout += `${msg}\n`;
    };
    let code;
    try {
      code = await initMain(['--cwd', root, '--home', home], process.env, {});
    } finally {
      console.log = origLog;
    }
    assert.equal(code, 0);
    assert.match(stdout, /wrote harness\.json/);
    assert.match(stdout, /wrote AGENTS\.md/);
    assert.match(stdout, /wrote .*pre-commit/);
    assert.match(stdout, /^excluded \.atl\/ in \.git\/info\/exclude$/m);
    assert.match(stdout, /manifest: /);
    assert.ok(stdout.endsWith('next: in a Claude Code or Codex session, run js-harness onboard\n'), stdout);
    assert.ok(fs.existsSync(path.join(root, 'harness.json')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('initMain says the import it added to a committed CLAUDE.md of the project\'s, and how git takes it back', async () => {
  const root = makeTmpRepo();
  const home = makeTmpHome();
  withCodegraphSkipped(root);
  const git = (...args) => assert.equal(spawnSync('git', args, { cwd: root, encoding: 'utf8' }).status, 0);
  try {
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# ours\n', 'utf8');
    git('add', 'CLAUDE.md');
    git('-c', 'user.email=js-harness-test@example.invalid', '-c', 'user.name=js-harness test', 'commit', '-q', '-m', 'ours');
    let stdout = '';
    const origLog = console.log;
    console.log = (msg) => {
      stdout += `${msg}\n`;
    };
    let code;
    try {
      code = await initMain(['--cwd', root, '--home', home], process.env, {});
    } finally {
      console.log = origLog;
    }
    assert.equal(code, 0);
    assert.match(stdout, /^added @AGENTS\.md at the top of CLAUDE\.md; git checkout -- CLAUDE\.md takes it back$/m);
    assert.equal(fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n\n# ours\n');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('initMain does not point at onboard in a project that has a roadmap already', async () => {
  const root = makeTmpRepo();
  const home = makeTmpHome();
  withCodegraphSkipped(root);
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'docs', 'ROADMAP.md'), '# Roadmap\n');
  try {
    let stdout = '';
    const origLog = console.log;
    console.log = (msg) => {
      stdout += `${msg}\n`;
    };
    let code;
    try {
      code = await initMain(['--cwd', root, '--home', home], process.env, {});
    } finally {
      console.log = origLog;
    }
    assert.equal(code, 0);
    assert.match(stdout, /manifest: /);
    assert.doesNotMatch(stdout, /onboard/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('initMain reports already initialized and exits 0 without writing anything', async () => {
  const root = makeTmpRepo();
  const home = makeTmpHome();
  fs.writeFileSync(path.join(root, 'harness.json'), JSON.stringify({ version: '0.0.1' }, null, 2) + '\n', 'utf8');
  try {
    let stdout = '';
    const origLog = console.log;
    console.log = (msg) => {
      stdout += `${msg}\n`;
    };
    let code;
    try {
      code = await initMain(['--cwd', root, '--home', home], process.env, {});
    } finally {
      console.log = origLog;
    }
    assert.equal(code, 0);
    assert.match(stdout, /already initialized at 0\.0\.1/);
    assert.match(stdout, /js-harness sync/);
    assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('initMain rejects an unknown flag with a usage error and exits 2', async () => {
  const root = makeTmpRepo();
  withCodegraphSkipped(root);
  try {
    let stderr = '';
    const origError = console.error;
    console.error = (msg) => {
      stderr += `${msg}\n`;
    };
    let code;
    try {
      code = await initMain(['--cwd', root, '--bogus'], process.env, {});
    } finally {
      console.error = origError;
    }
    assert.equal(code, 2);
    assert.match(stderr, /Usage: js-harness init/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initMain rejects --cwd with a missing value and exits 2', async () => {
  let stderr = '';
  const origError = console.error;
  console.error = (msg) => {
    stderr += `${msg}\n`;
  };
  let code;
  try {
    code = await initMain(['--cwd'], process.env, {});
  } finally {
    console.error = origError;
  }
  assert.equal(code, 2);
  assert.match(stderr, /--cwd requires a value/);
});

// T2c Codex P1 + R3-rollback-deletes-preexisting-manifest
test('initMain reports a stale manifest without harness.json on stderr and exits 1', async () => {
  const root = makeTmpRepo();
  try {
    const manifestDir = path.join(root, '.git', 'js-harness');
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(path.join(manifestDir, 'manifest.json'), '{}', 'utf8');

    let stderr = '';
    const origError = console.error;
    console.error = (msg) => {
      stderr += `${msg}\n`;
    };
    // Never rely on the guard alone to keep this hermetic: inject a spawn that only ever answers
    // `git` for real and never a real `codegraph`, in case a future/older code path reaches it.
    const spawn = (cmd, args, opts) => (cmd === 'git' ? spawnSync('git', args, opts) : { status: 0, stdout: '', stderr: '' });
    let code;
    try {
      code = await initMain(['--cwd', root], process.env, { spawn, platform: 'linux' });
    } finally {
      console.error = origError;
    }
    assert.equal(code, 1);
    assert.match(stderr, /this clone was initialized before/);
    assert.match(stderr, /harness\.json is missing/);
    assert.match(stderr, /js-harness uninstall/);
    assert.equal(fs.existsSync(path.join(root, 'harness.json')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initMain reports no such directory on stderr and exits 1 when --cwd does not exist', async () => {
  const parent = makeTmpDir();
  const missing = path.join(parent, 'nope');
  try {
    let stderr = '';
    const origError = console.error;
    console.error = (msg) => {
      stderr += `${msg}\n`;
    };
    let code;
    try {
      code = await initMain(['--cwd', missing], process.env, {});
    } finally {
      console.error = origError;
    }
    assert.equal(code, 1);
    assert.match(stderr, /no such directory/);
    assert.ok(stderr.includes(missing));
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// T2b Codex P1 + R3-init-partial-failure-unrecoverable
test('initMain reports a rolled-back write failure on stderr and exits 1', async () => {
  const root = makeTmpRepo();
  try {
    const writeFile = (target, content, enc) => {
      if (target.endsWith('AGENTS.md')) throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      fs.writeFileSync(target, content, enc);
    };
    let stderr = '';
    const origError = console.error;
    console.error = (msg) => {
      stderr += `${msg}\n`;
    };
    let code;
    try {
      code = await initMain(['--cwd', root], process.env, { writeFile });
    } finally {
      console.error = origError;
    }
    assert.equal(code, 1);
    assert.match(stderr, /init failed:/);
    assert.match(stderr, /nothing was left behind/);
    assert.equal(fs.existsSync(path.join(root, 'harness.json')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// T2c R3-retry-manifest-write-unguarded; T2e item 2 (.codegraph/ removal is now attempted, and
// this scenario's directory did not exist before the retry, so it succeeds — "nothing was left
// behind" is the truthful message now, not "removed everything it wrote except .codegraph/").
test('initMain reports a codegraph-retry manifest write failure on stderr and exits 1', async () => {
  const root = withProgram(makeTmpRepo());
  try {
    const failSpawn = (cmd, args, opts) => (cmd === 'git' ? spawnSync('git', args, opts) : { status: 1, stdout: '', stderr: 'boom' });
    await initMain(['--cwd', root], process.env, { spawn: failSpawn, platform: 'linux' });

    const okSpawn = (cmd, args, opts) => {
      if (cmd === 'git') return spawnSync('git', args, opts);
      fs.mkdirSync(path.join(opts.cwd, '.codegraph'), { recursive: true });
      return { status: 0, stdout: '', stderr: '' };
    };
    // T2e item 3: the manifest's temp file now has a unique name, not a fixed `<target>.tmp`.
    // T2g R3-001: the manifest's own exclusive-create write is injected separately from the general
    // `writeFile` (see `writeManifestAtomic` in bin/lib/project.mjs) — faulting it here means
    // failing the `open` step, not `writeFile`.
    const open = (tmp) => {
      throw new Error('EACCES: permission denied');
    };
    let stderr = '';
    const origError = console.error;
    console.error = (msg) => {
      stderr += `${msg}\n`;
    };
    let code;
    try {
      code = await initMain(['--cwd', root], process.env, { spawn: okSpawn, platform: 'linux', open });
    } finally {
      console.error = origError;
    }
    assert.equal(code, 1);
    assert.match(stderr, /init failed:/);
    assert.match(stderr, /manifest could not be updated/);
    assert.match(stderr, /nothing was left behind/);
    assert.equal(fs.existsSync(path.join(root, '.codegraph')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// T2b item 2: codegraph retry on a re-run
test('initMain retries codegraph on a re-run after a prior failure and reports the outcome', async () => {
  const root = withProgram(makeTmpRepo());
  const home = makeTmpHome();
  try {
    const failSpawn = (cmd, args, opts) => (cmd === 'git' ? spawnSync('git', args, opts) : { status: 1, stdout: '', stderr: 'boom' });
    await initMain(['--cwd', root, '--home', home], process.env, { spawn: failSpawn, platform: 'linux' });

    const okSpawn = (cmd, args, opts) => {
      if (cmd === 'git') return spawnSync('git', args, opts);
      fs.mkdirSync(path.join(opts.cwd, '.codegraph'), { recursive: true });
      return { status: 0, stdout: '', stderr: '' };
    };
    let stdout = '';
    const origLog = console.log;
    console.log = (msg) => {
      stdout += `${msg}\n`;
    };
    let code;
    try {
      code = await initMain(['--cwd', root, '--home', home], process.env, { spawn: okSpawn, platform: 'linux' });
    } finally {
      console.log = origLog;
    }
    assert.equal(code, 0);
    assert.match(stdout, /retrying codegraph init/);
    assert.match(stdout, /ran codegraph init/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('initMain reports a codegraph failure on stderr and still exits 0', async () => {
  const root = withProgram(makeTmpRepo());
  const home = makeTmpHome();
  try {
    const spawn = (cmd, args, opts) => {
      if (cmd === 'git') return spawnSync('git', args, opts);
      return { status: 1, stdout: '', stderr: 'boom' };
    };
    let stderr = '';
    const origError = console.error;
    console.error = (msg) => {
      stderr += `${msg}\n`;
    };
    let code;
    try {
      code = await initMain(['--cwd', root, '--home', home], process.env, { spawn, platform: 'linux' });
    } finally {
      console.error = origError;
    }
    assert.equal(code, 0);
    assert.match(stderr, /codegraph/);
    assert.match(stderr, /boom/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

/** `initMain` with `args` in a fresh repository holding a program, its console captured, with git real and every
 * other command recorded and never run, and `userHome` the home whose `.claude.json` it reads (F8 S11, L9). */
async function initWithPreset(t, args, { claudeJson } = {}) {
  const root = withProgram(makeTmpRepo('js-harness-init-preset-'));
  const userHome = makeTmpHome();
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(userHome, { recursive: true, force: true });
  });
  if (claudeJson) fs.writeFileSync(path.join(userHome, '.claude.json'), JSON.stringify(claudeJson));
  const ran = [];
  const spawn = (cmd, words, opts) => {
    if (cmd === 'git') return spawnSync('git', words, opts);
    ran.push([cmd, ...words].join(' '));
    // A codegraph init that ran writes its index, as the real one does.
    fs.mkdirSync(path.join(root, '.codegraph'), { recursive: true });
    return { status: 0, stdout: '', stderr: '' };
  };
  const out = [];
  const err = [];
  const { log, error } = console;
  console.log = (line) => out.push(line);
  console.error = (line) => err.push(line);
  let code;
  try {
    code = await initMain(['--cwd', root, ...args], process.env, { spawn, platform: 'linux', userHome });
  } finally {
    Object.assign(console, { log, error });
  }
  const manifestPath = out.find((line) => line.startsWith('manifest: ')).slice('manifest: '.length);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  // The text files init wrote, by its manifest: the settings key a switch writes is a clone's own and no file here.
  const texts = manifest.files.map((entry) => fs.readFileSync(entry.gitDir ? entry.path : path.join(root, entry.path), 'utf8'));
  const harness = JSON.parse(fs.readFileSync(path.join(root, 'harness.json'), 'utf8'));
  return { code, out, err, ran, texts, harness };
}

/** The lines of `texts` that name a tool `pattern` matches. */
const naming = (texts, pattern) => texts.flatMap((text) => text.split('\n')).filter((line) => pattern.test(line));
const CODEGRAPH = /codegraph/i;
const ENGRAM_PLUGIN = /engram@engram|engram plugin|engram-plugin/i;

test('init --preset complete declares both reviews, runs codegraph init and leaves the rest to its defaults', async (t) => {
  const { code, ran, harness } = await initWithPreset(t, ['--preset', 'complete'], { claudeJson: { mcpServers: { context7: { type: 'http' } } } });
  assert.equal(code, 0);
  assert.deepEqual(harness.functions, { codexReview: 'on', lensReview: 'on' });
  assert.deepEqual(ran, ['codegraph init --yes .']);
});

test('init --preset lean writes no line naming codegraph and never runs it (row 17)', async (t) => {
  const { code, ran, texts, harness } = await initWithPreset(t, ['--preset', 'lean']);
  assert.equal(code, 0);
  assert.deepEqual(harness.functions, { codexReview: 'on', lensReview: 'on', codeMap: 'off' });
  assert.deepEqual(ran, []);
  assert.deepEqual(naming(texts, CODEGRAPH), []);
});

test('init --preset custom that drops codegraph and the engram plugin writes no line naming either (row 17)', async (t) => {
  const { code, ran, texts, harness } = await initWithPreset(t, ['--preset', 'custom', '--codegraph', 'off', '--engram-plugin', 'off']);
  assert.equal(code, 0);
  assert.deepEqual(harness.functions, { codexReview: 'on', lensReview: 'on', codeMap: 'off', engramPlugin: 'off' });
  assert.deepEqual(ran, []);
  assert.deepEqual(naming(texts, CODEGRAPH), []);
  assert.deepEqual(naming(texts, ENGRAM_PLUGIN), []);
});

test('init with no preset writes the harness.json it always wrote, with no "functions"', async (t) => {
  const { code, harness } = await initWithPreset(t, []);
  assert.equal(code, 0);
  assert.equal('functions' in harness, false);
});

test('init with a preset names context7 as required where Claude Code has it nowhere, and is silent where it has it', async (t) => {
  const required = 'context7 is required by every preset and Claude Code has it nowhere: js-harness stack install registers it';
  assert.ok((await initWithPreset(t, ['--preset', 'lean'])).out.includes(required));
  const registered = await initWithPreset(t, ['--preset', 'lean'], { claudeJson: { mcpServers: { context7: { type: 'http' } } } });
  assert.equal(registered.out.includes(required), false);
});

test('init refuses a preset that is none, or a choice of codegraph without the custom preset, and writes nothing', async (t) => {
  for (const [args, message] of [
    [['--preset', 'full'], 'no preset "full"; the presets are complete, lean, custom'],
    [['--preset', 'lean', '--codegraph', 'on'], 'only the custom preset chooses codegraph or the engram plugin; lean is fixed'],
    [['--codegraph', 'off'], 'only the custom preset chooses codegraph or the engram plugin; give --preset custom'],
    [['--preset', 'custom', '--engram-plugin', 'maybe'], 'engramPlugin must be on or off; it is "maybe"'],
  ]) {
    const root = makeTmpRepo();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const err = [];
    const { error } = console;
    console.error = (line) => err.push(line);
    let code;
    try {
      code = await initMain(['--cwd', root, ...args], process.env, {});
    } finally {
      console.error = error;
    }
    assert.equal(code, 2, args.join(' '));
    assert.equal(err.join('\n'), `${message}\n\nUsage: js-harness init [--cwd <path>] [--home <path>] [--preset complete|lean|custom [--codegraph on|off] [--engram-plugin on|off]]`);
    assert.equal(fs.existsSync(path.join(root, 'harness.json')), false);
  }
});

// Not a RED test: init never reads its home (initProject takes none), so an empty JS_HARNESS_HOME was never
// able to move a file. This pins that the empty value still sets a project up, so the shared home reads keep it so.
test('init takes an empty JS_HARNESS_HOME as unset and still sets the project up', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jh-home-init-'));
  try {
    assert.equal(spawnSync('git', ['init', '-q'], { cwd: root }).status, 0);
    const spawn = (cmd, args, opts) => (cmd === 'git' ? spawnSync('git', args, opts) : { status: 0, stdout: '', stderr: '' });

    const code = await initMain(['--cwd', root], { JS_HARNESS_HOME: '' }, { spawn, platform: 'linux' });

    assert.equal(code, 0);
    assert.equal(fs.existsSync(path.join(root, 'harness.json')), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
