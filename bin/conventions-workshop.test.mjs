// Convention: the product never imports the workshop (odd/tasks/workshop-product-split.md, step 3 of the shape). The
// workshop under `workshop/` keeps this repository and never ships: package.json's "files" names only `bin/`, less its
// tests and testkits. A shipped module that imported a file outside `bin/` would work in this checkout and fail on
// every install, where that file is not there, so every relative import of a shipped module resolves inside `bin/`.
// The workshop may import the product; the other way is what this test refuses.
//
// How to comply: move what the product needs into `bin/` (the workshop then imports it from there), or keep the
// command in the workshop. An `import(` whose argument is not a string literal cannot be read here: give it a literal,
// or put its file on DYNAMIC with why its target stays inside `bin/`.
//
// What is read: every `.mjs` and `.cjs` under `bin/` but the tests and testkits, at any depth
// (bin/lib/source.testkit.mjs); in each, static imports and re-exports, literal `import('...')` and literal
// `require('...')`, outside comment lines. Bare specifiers (`node:fs`, a package) are not paths and are skipped; an
// absolute or `file:` specifier is outside. The dispatcher's two maps are held too: `COMMANDS` by its literal
// imports, `HELP` by the file each entry names. The legacy list is empty and only shrinks (bin/lib/ratchet.testkit.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ratchet } from './lib/ratchet.testkit.mjs';
import { importsOf, sourceModules, withoutComments } from './lib/source.testkit.mjs';

const BIN = import.meta.dirname;

const LEGACY = {};

/** The shipped modules whose `import(` takes a value, not a literal, each with why its target stays inside `bin/`. */
const DYNAMIC = {
  'js-harness.mjs': "`commandHelp` imports the file of a `HELP` entry, and the test below holds every entry's file inside bin/",
  'lib/pages-rendered.mjs': "`loadRecordModule` imports `RECORD_MODULE`, `new URL('./template-record.mjs', import.meta.url)`, a sibling under bin/lib",
};

/** The modules package.json ships from `bin/`: its sources less the tests and testkits, relative to `bin/`. */
function shippedModules() {
  return sourceModules(BIN).filter((name) => !name.endsWith('.testkit.mjs'));
}

/** What `text` imports by a literal: static imports and re-exports, `import('...')` and `require('...')`. */
function literalImports(text) {
  const code = withoutComments(text);
  const dynamic = [...code.matchAll(/\b(?:import|require)\(\s*(['"])([^'"]+)\1\s*\)/g)].map((match) => match[2]);
  return [...importsOf(code), ...dynamic];
}

/** Whether `text` holds an `import(` whose argument is not a single string literal. */
function hasValueImport(text) {
  return /\bimport\((?!\s*(['"])[^'"]+\1\s*\))/.test(withoutComments(text));
}

/** Whether `specifier`, imported by the module at `file` (relative to `bin/`), names a file outside `bin/`. Bare
 * specifiers name a built-in or a package, not a path, and are not outside. */
function outside(file, specifier) {
  if (/^(?:file:|\/|[A-Za-z]:[\\/])/.test(specifier)) return true;
  if (!specifier.startsWith('.')) return false;
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
  return resolved === '..' || resolved.startsWith('../');
}

/** The files the `HELP` map of the dispatcher's `text` names, each its entry's first string. */
function helpFiles(text) {
  const block = /\nconst HELP = \{\n([\s\S]*?)\n\};/.exec(text);
  assert.ok(block, 'bin/js-harness.mjs holds no `const HELP = {` map');
  return [...block[1].matchAll(/^\s*[\w'-]+:\s*\[\s*'([^']+)'/gm)].map((match) => match[1]);
}

test('every shipped module under bin/ imports nothing outside bin/, so no workshop file reaches an install', () => {
  const modules = shippedModules();
  assert.ok(modules.length >= 150, `only ${modules.length} shipped modules were read under bin/`);
  const broken = [];
  const found = [];
  for (const file of modules) {
    const reaching = literalImports(fs.readFileSync(path.join(BIN, file), 'utf8')).filter((specifier) => outside(file, specifier));
    if (reaching.length > 0) {
      broken.push(file);
      found.push(`${file} imports ${reaching.join(', ')}`);
    }
  }
  const problems = ratchet({ checked: modules, broken, legacy: LEGACY });
  assert.deepEqual(problems, [], `${problems.join('\n')}\n${found.join('\n')}\n\nmove what the product needs into bin/, or keep the command in the workshop`);
});

test('an import( that takes a value is in a file on DYNAMIC, and every file on DYNAMIC still has one', () => {
  const modules = shippedModules();
  const broken = modules.filter((file) => hasValueImport(fs.readFileSync(path.join(BIN, file), 'utf8')));
  const problems = ratchet({ checked: modules, broken, legacy: DYNAMIC });
  assert.deepEqual(problems, [], `${problems.join('\n')}\n\ngive the import a string literal, or list its file on DYNAMIC with why its target stays inside bin/`);
});

test("the dispatcher's HELP map names only files inside bin/", () => {
  const files = helpFiles(fs.readFileSync(path.join(BIN, 'js-harness.mjs'), 'utf8'));
  assert.ok(files.length >= 30, `only ${files.length} entries were read in HELP`);
  assert.deepEqual(files.filter((file) => outside('js-harness.mjs', file)), []);
});

test('the reading finds an import of the workshop in each form, and leaves comments, bare specifiers and siblings', () => {
  const text = [
    "import { plan } from '../workshop/lib/docs-plan.mjs';",
    "export { tick } from '../../workshop/bin/throughput.mjs';",
    "const late = await import('../workshop/bin/audit.mjs');",
    'const old = require("../workshop/lib/audit.mjs");',
    "// import('../workshop/bin/docs.mjs') in a comment is not code",
    "import fs from 'node:fs';",
    "import { ratchet } from './lib/ratchet.testkit.mjs';",
  ].join('\n');
  const specifiers = literalImports(text);
  assert.deepEqual(specifiers, ['../workshop/lib/docs-plan.mjs', '../../workshop/bin/throughput.mjs', 'fs','./lib/ratchet.testkit.mjs', '../workshop/bin/audit.mjs', '../workshop/lib/audit.mjs']);
  assert.deepEqual(specifiers.filter((specifier) => outside('js-harness.mjs', specifier)), ['../workshop/lib/docs-plan.mjs', '../../workshop/bin/throughput.mjs', '../workshop/bin/audit.mjs', '../workshop/lib/audit.mjs']);
  assert.equal(outside('lib/a.mjs', '../check.mjs'), false);
  assert.equal(outside('lib/a.mjs', '../../workshop/x.mjs'), true);
  assert.equal(outside('lib/a.mjs', '../../bin/check.mjs'), true, 'a path that leaves bin/ and comes back is still read as leaving: it would not resolve the same in an install under another folder name');
  assert.equal(outside('a.mjs', 'file:///D:/js-harness/workshop/x.mjs'), true);
  assert.equal(outside('a.mjs', '/abs/workshop/x.mjs'), true);
  assert.equal(outside('a.mjs', 'C:\\js-harness\\workshop\\x.mjs'), true);
  assert.ok(hasValueImport('const m = await import(file);'));
  assert.ok(hasValueImport('const m = await import(`./${name}.mjs`);'));
  assert.ok(!hasValueImport("const m = await import('./check.mjs');"));
  assert.ok(!hasValueImport('// await import(file) in a comment'));
  assert.deepEqual(helpFiles("x\nconst HELP = {\n  check: ['./check.mjs', 'USAGE'],\n  'merge-queue': ['../workshop/m.mjs', 'USAGE'],\n};\n"), ['./check.mjs', '../workshop/m.mjs']);
});
