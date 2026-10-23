import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./audit-exports.mjs', import.meta.url));
const USAGE = 'usage: node scripts/audit-exports.mjs [--allow <file>] [--json] [--cwd <repo>]';
const made = [];

after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

// A temporary repository laid out like this one: each file is written, then `git add` lists it to `git ls-files`.
function repo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-exports-'));
  made.push(dir);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  for (const args of [['init', '-q'], ['add', '-A']]) {
    const git = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    assert.equal(git.status, 0, git.stderr);
  }
  return dir;
}

function run(dir, args = []) {
  const result = spawnSync(process.execPath, [SCRIPT, '--cwd', dir, ...args], { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

// The printed findings as `kind location detail`, and the last line.
function report(result) {
  const lines = result.stdout.split('\n').filter((line) => line !== '');
  const summary = lines.pop();
  const findings = lines.map((line) => {
    const [kind, location, detail] = line.split('  ');
    return { kind, location, detail };
  });
  return { findings, summary };
}

const unused = (location, name, why) => ({ kind: 'unused-export', location, detail: `${name}: ${why}` });
const NO_IMPORTER = 'no file imports it';

test('an export no file imports is an unused-export at its line', () => {
  const dir = repo({
    'bin/a.mjs': 'export function unusedFn() {\n  return 1;\n}\n// export const ghost = 2;\n',
  });
  const result = run(dir);
  assert.equal(result.status, 1);
  assert.deepEqual(report(result).findings, [unused('bin/a.mjs:1', 'unusedFn', NO_IMPORTER)]);
  assert.equal(report(result).summary, '1 findings, 0 allowed');
});

test('a name used only inside its own module is still unused, and the detail says so', () => {
  const dir = repo({ 'bin/own.mjs': 'export const own = 1;\nconsole.log(own);\n' });
  const result = run(dir);
  assert.equal(result.status, 1);
  assert.deepEqual(report(result).findings, [
    unused('bin/own.mjs:1', 'own', 'used only inside its own module, so the export keyword is what is unused'),
  ]);
});

test('an export that only a test file imports is a test-only-export naming the test file', () => {
  const dir = repo({
    'bin/b.mjs': 'export const tested = 2;\n',
    'bin/b.test.mjs': "import { tested } from './b.mjs';\nconsole.log(tested);\n",
  });
  const result = run(dir);
  assert.equal(result.status, 1);
  assert.deepEqual(report(result).findings, [
    { kind: 'test-only-export', location: 'bin/b.mjs:1', detail: 'tested: imported only by test files: bin/b.test.mjs' },
  ]);
});

test('an export a module imports is not a finding', () => {
  const dir = repo({
    'bin/c.mjs': 'export const used = 3;\n',
    'bin/main.mjs': "import { used } from './c.mjs';\nconsole.log(used);\n",
  });
  const result = run(dir);
  assert.equal(result.status, 0);
  assert.deepEqual(report(result), { findings: [], summary: '0 findings, 0 allowed' });
});

test('an aliased import uses the exported name, not the local one', () => {
  const dir = repo({
    'bin/d.mjs': 'export const original = 4;\nexport const other = 5;\n',
    'scripts/use.mjs': "import { original as local } from '../bin/d.mjs';\nconsole.log(local);\n",
  });
  const result = run(dir);
  assert.deepEqual(report(result).findings, [unused('bin/d.mjs:2', 'other', NO_IMPORTER)]);
});

test('a default export is used by a default import, and unused without one', () => {
  const dir = repo({
    'bin/e.mjs': 'export default function main() {\n  return 1;\n}\n',
    'bin/g.mjs': 'export default 1;\n',
    'scripts/use.mjs': "import main from '../bin/e.mjs';\nconsole.log(main);\n",
  });
  const result = run(dir);
  assert.deepEqual(report(result).findings, [unused('bin/g.mjs:1', 'default', NO_IMPORTER)]);
});

test('a re-export is an import of its source, and the re-exporting export is unused without an importer', () => {
  const chained = {
    'bin/inner.mjs': 'export const chained = 6;\n',
    'bin/outer.mjs': "export { chained } from './inner.mjs';\n",
  };
  assert.deepEqual(report(run(repo(chained))).findings, [unused('bin/outer.mjs:1', 'chained', NO_IMPORTER)]);

  const consumed = repo({
    ...chained,
    'scripts/end.mjs': "import { chained } from '../bin/outer.mjs';\nconsole.log(chained);\n",
  });
  const result = run(consumed);
  assert.equal(result.status, 0);
  assert.deepEqual(report(result).findings, []);
});

test('export * from uses every export of its source', () => {
  const dir = repo({
    'bin/star-src.mjs': 'export const starred = 7;\n',
    'bin/star.mjs': "export * from './star-src.mjs';\n",
  });
  const result = run(dir);
  assert.equal(result.status, 0);
  assert.deepEqual(report(result).findings, []);
});

test('a namespace import uses every export of its module', () => {
  const dir = repo({
    'bin/ns.mjs': 'export const viaNs = 8;\nexport const another = 9;\n',
    'scripts/n.mjs': "import * as ns from '../bin/ns.mjs';\nconsole.log(ns.viaNs);\n",
  });
  const result = run(dir);
  assert.equal(result.status, 0);
  assert.deepEqual(report(result), { findings: [], summary: '0 findings, 0 allowed' });
});

test('a literal dynamic import uses every export of its module', () => {
  const dir = repo({
    'bin/dyn.mjs': 'export const lazy = 10;\n',
    'scripts/load.mjs': "const module = await import('../bin/dyn.mjs');\nconsole.log(module);\n",
  });
  const result = run(dir);
  assert.equal(result.status, 0);
  assert.deepEqual(report(result).findings, []);
});

test('a dispatcher that loads by a template marks the modules its pattern matches, in its folder', () => {
  const dir = repo({
    'bin/js-harness.mjs': 'const name = process.argv[2];\nawait import(`./${name}.mjs`);\n',
    'bin/cmd-one.mjs': 'export function runOne() {\n  return 1;\n}\n',
    'bin/cmd-two.mjs': 'export const runTwo = 2;\n',
    'bin/lib/deep.mjs': 'export const deep = 3;\n',
  });
  const result = run(dir);
  assert.deepEqual(report(result).findings, [unused('bin/lib/deep.mjs:1', 'deep', NO_IMPORTER)]);
});

test('a dispatcher that loads from a table of literal names marks the modules named in its file', () => {
  const dir = repo({
    'bin/help.mjs': "const HELP = { cmdX: './cmd-x.mjs' };\nasync function show(name) {\n  return import(HELP[name]);\n}\nshow('cmdX');\n",
    'bin/cmd-x.mjs': 'export const xThing = 1;\n',
    'bin/cmd-y.mjs': 'export const yThing = 2;\n',
  });
  const result = run(dir);
  assert.deepEqual(report(result).findings, [unused('bin/cmd-y.mjs:1', 'yThing', NO_IMPORTER)]);
});

test('an import in a comment, or inside a string, is not counted', () => {
  const dir = repo({
    'bin/h.mjs': 'export const commented = 11;\n',
    'scripts/c.mjs': [
      "// import { commented } from '../bin/h.mjs';",
      "/* import * as all from '../bin/h.mjs'; */",
      "const text = \"import { commented } from '../bin/h.mjs'\";",
      'console.log(text);',
      '',
    ].join('\n'),
  });
  const result = run(dir);
  assert.deepEqual(report(result).findings, [unused('bin/h.mjs:1', 'commented', NO_IMPORTER)]);
});

test('export lists, aliases and destructuring declare one export per name', () => {
  const dir = repo({
    'bin/list.mjs': [
      'const a = 1, b = 2;',
      'export { a, b as c };',
      'export const { p, q: r } = pair();',
      'export const s = 1, t = 2;',
      'function pair() {',
      '  return { p: a, q: b };',
      '}',
      '',
    ].join('\n'),
  });
  const result = run(dir);
  assert.deepEqual(report(result).findings.map((finding) => `${finding.location} ${finding.detail.split(':')[0]}`), [
    'bin/list.mjs:2 a',
    'bin/list.mjs:2 c',
    'bin/list.mjs:3 p',
    'bin/list.mjs:3 r',
    'bin/list.mjs:4 s',
    'bin/list.mjs:4 t',
  ]);
});

test('an allow entry that matches a finding counts it as allowed, not printed', () => {
  const dir = repo({
    'bin/a.mjs': 'export function unusedFn() {\n  return 1;\n}\n',
    'odd/tasks/launch-audit/allow/exports.json': JSON.stringify([
      { kind: 'unused-export', location: 'bin/a.mjs:1', why: 'kept for a caller in a later release' },
    ]),
  });
  const result = run(dir);
  assert.equal(result.status, 0);
  assert.deepEqual(report(result), { findings: [], summary: '0 findings, 1 allowed' });
});

test('an allow entry given with --allow is read from that file', () => {
  const dir = repo({
    'bin/a.mjs': 'export function unusedFn() {\n  return 1;\n}\n',
    'allow.json': JSON.stringify([{ kind: 'unused-export', location: 'bin/a.mjs:1', why: 'kept' }]),
  });
  const result = run(dir, ['--allow', path.join(dir, 'allow.json')]);
  assert.deepEqual(report(result), { findings: [], summary: '0 findings, 1 allowed' });
});

test('a stale allow entry is itself a finding of kind stale-allow', () => {
  const dir = repo({
    'bin/a.mjs': 'export function unusedFn() {\n  return 1;\n}\n',
    'allow.json': JSON.stringify([{ kind: 'unused-export', location: 'bin/a.mjs:9', why: 'moved away' }]),
  });
  const result = run(dir, ['--allow', path.join(dir, 'allow.json')]);
  assert.equal(result.status, 1);
  const { findings, summary } = report(result);
  assert.equal(summary, '2 findings, 0 allowed');
  assert.deepEqual(findings.map((finding) => finding.kind), ['unused-export', 'stale-allow']);
  assert.equal(findings[1].detail, 'unused-export bin/a.mjs:9 matches no finding');
});

test('an unknown argument exits 2 with its line on stderr and the usage', () => {
  const dir = repo({ 'bin/a.mjs': 'export const x = 1;\n' });
  const result = run(dir, ['--bogus']);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, `unknown argument: --bogus\n${USAGE}\n`);
});

test('--json prints one object with findings and allowed', () => {
  const dir = repo({ 'bin/a.mjs': 'export function unusedFn() {\n  return 1;\n}\n' });
  const result = run(dir, ['--json']);
  assert.equal(result.status, 1);
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(parsed).sort(), ['allowed', 'findings']);
  assert.equal(parsed.allowed, 0);
  assert.deepEqual(parsed.findings, [{ kind: 'unused-export', location: 'bin/a.mjs:1', detail: `unusedFn: ${NO_IMPORTER}` }]);
});
