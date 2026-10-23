// `.atl/` in the clone's exclude file (odd/tasks/quiet-gate.md): `init` adds it once, records it, and `uninstall`
// takes back exactly that. Every test runs a real `git`, isolated from the host's config as project.test.mjs is.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { initProject, syncProject, uninstallProject } from './project.mjs';
import { EXCLUDED, addExclude, undoExclude } from './project-exclude.mjs';

let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-exclude-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
after(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
});

/** An empty repository, whose exclude file holds `exclude` (git's own comments where it is not given). */
function makeRepo(exclude) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-exclude-'));
  assert.equal(spawnSync('git', ['init', '-q'], { cwd: dir }).status, 0);
  if (exclude !== undefined) fs.writeFileSync(excludeOf(dir), exclude);
  return dir;
}

const excludeOf = (dir) => path.join(dir, '.git', 'info', 'exclude');
const read = (file) => fs.readFileSync(file, 'utf8');
const lines = (dir) => read(excludeOf(dir)).split(/\r?\n/).filter((line) => line === EXCLUDED);
const manifestOf = (result) => JSON.parse(read(result.manifestPath));

/** Whether git leaves `.atl/skill-registry.md` out of what is untracked. */
function ignoresAtl(dir) {
  fs.mkdirSync(path.join(dir, '.atl'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.atl', 'skill-registry.md'), 'registry\n');
  const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: dir, encoding: 'utf8' });
  return !status.stdout.includes('.atl/');
}

test('init adds .atl/ to the clone exclude file once, records it, and git then leaves .atl/ out', () => {
  const dir = makeRepo();
  try {
    const result = initProject(dir, '0.1.0');
    assert.equal(result.code, 0);
    assert.deepEqual(lines(dir), [EXCLUDED]);
    assert.ok(ignoresAtl(dir));
    assert.deepEqual(manifestOf(result).exclude, { line: EXCLUDED, separator: false, createdFile: false, createdDir: false });
    assert.equal(manifestOf(result).format, 2);
    assert.ok(result.actions.some((action) => action.kind === 'excluded' && action.path === '.git/info/exclude'));
    // A second init finds the project initialized and writes nothing: the line stays one.
    assert.equal(initProject(dir, '0.1.0').alreadyInitialized, true);
    assert.deepEqual(lines(dir), [EXCLUDED]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('init adds no line beside one that already leaves .atl out, and uninstall leaves that line', () => {
  for (const spelling of ['.atl/', '/.atl', '.atl']) {
    const dir = makeRepo(`# mine\n${spelling}\n`);
    try {
      const result = initProject(dir, '0.1.0');
      assert.equal(read(excludeOf(dir)), `# mine\n${spelling}\n`);
      assert.equal(manifestOf(result).exclude, undefined);
      assert.equal(uninstallProject(dir).code, 0);
      assert.equal(read(excludeOf(dir)), `# mine\n${spelling}\n`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('uninstall takes back exactly what init added, a last line that had no break included', () => {
  for (const before of ['# mine\n*.log\n', '# mine\n*.log', '']) {
    const dir = makeRepo(before);
    try {
      initProject(dir, '0.1.0');
      const result = uninstallProject(dir);
      assert.equal(result.code, 0);
      assert.equal(read(excludeOf(dir)), before);
      assert.ok(result.actions.some((action) => action.kind === 'removed' && action.path === `${EXCLUDED} from .git/info/exclude`));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('uninstall removes an exclude file and its folder that init made, and keeps lines added after init', () => {
  const dir = makeRepo();
  try {
    fs.rmSync(path.dirname(excludeOf(dir)), { recursive: true, force: true });
    initProject(dir, '0.1.0');
    assert.equal(read(excludeOf(dir)), `${EXCLUDED}\n`);
    assert.equal(uninstallProject(dir).code, 0);
    assert.equal(fs.existsSync(path.dirname(excludeOf(dir))), false);

    const other = makeRepo('# mine\n');
    try {
      initProject(other, '0.1.0');
      fs.appendFileSync(excludeOf(other), 'build/\n');
      assert.equal(uninstallProject(other).code, 0);
      assert.equal(read(excludeOf(other)), '# mine\nbuild/\n');
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('sync keeps the record and its format, so uninstall still takes the line back', () => {
  const dir = makeRepo('# mine\n');
  try {
    const result = initProject(dir, '0.1.0');
    // A new pin makes sync record its version, so it writes the manifest again.
    const pin = path.join(dir, 'harness.json');
    fs.writeFileSync(pin, JSON.stringify({ ...JSON.parse(read(pin)), version: '0.2.0' }));
    assert.equal(syncProject(dir, '0.2.0').code, 0);
    const synced = manifestOf(result);
    assert.equal(synced.version, '0.2.0');
    assert.deepEqual([synced.format, synced.exclude?.line], [2, EXCLUDED]);
    assert.equal(uninstallProject(dir).code, 0);
    assert.equal(read(excludeOf(dir)), '# mine\n');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a manifest whose exclude record names another line is malformed, and uninstall touches nothing', () => {
  const dir = makeRepo('# mine\n');
  try {
    const result = initProject(dir, '0.1.0');
    const manifest = manifestOf(result);
    fs.writeFileSync(result.manifestPath, JSON.stringify({ ...manifest, exclude: { ...manifest.exclude, line: '*' } }));
    const refused = uninstallProject(dir);
    assert.equal(refused.malformedManifest, true);
    assert.equal(read(excludeOf(dir)), `# mine\n${EXCLUDED}\n`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('init takes the line back when a later write fails, as it takes back every file it wrote', () => {
  const dir = makeRepo('# mine\n');
  try {
    const writeFile = (target, content, options) => {
      if (target.endsWith('harness.json')) throw new Error('disk full');
      fs.writeFileSync(target, content, options);
    };
    assert.throws(() => initProject(dir, '0.1.0', { writeFile }), /disk full/);
    assert.equal(read(excludeOf(dir)), '# mine\n');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('undoExclude never takes a longer line that ends in .atl/ for its own', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-exclude-unit-'));
  try {
    const file = path.join(dir, 'exclude');
    fs.writeFileSync(file, 'x');
    const record = addExclude(file);
    assert.equal(read(file), `x\n${EXCLUDED}\n`);
    fs.writeFileSync(file, `notes${EXCLUDED}\n`);
    assert.equal(undoExclude(file, { ...record, separator: false }), 'gone');
    assert.equal(read(file), `notes${EXCLUDED}\n`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
