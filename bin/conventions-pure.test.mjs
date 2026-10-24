// Convention: a module under `bin/lib` whose header comment says it is pure imports none of `node:fs`,
// `node:child_process`, `node:net` or `node:os` (odd/tasks/conventions.md, S4). That is what "pure" means in this
// repository: the module reads no file, spawns nothing, opens no socket and asks nothing of the machine, so its
// tests hand it inline values and a hook that calls it keeps its deadline. The header is what the next writer
// reads first, so a claim there that the code does not keep misleads exactly the person about to change it.
//
// How to comply: take the I/O out (the command reads, the module is handed what was read, or it takes `deps`), or
// say in the header what the module does read instead of calling it pure. "Pure-ish" is no claim.
//
// Only direct static imports are read (`import ... from`, `import '...'`, `export ... from`), with or without the
// `node:` prefix. LEGACY lists the modules whose header claims more than their imports keep, each with why; it
// only shrinks (bin/lib/ratchet.testkit.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ratchet } from './lib/ratchet.testkit.mjs';

const LIB = path.join(import.meta.dirname, 'lib');
const IMPURE = new Set(['fs', 'fs/promises', 'child_process', 'net', 'os']);
const CLAIM = /\bpure\b(?!-)/i;

const LEGACY = {
  'process-tree.mjs': 'says `selectDescendants` is pure, and the module imports node:child_process and node:fs',
  'version.mjs': 'says "Pure version-comparison" and imports node:fs for its one directory listing',
};

/** The comment lines that open `text`, after a shebang: the header a writer reads first. */
function headerOf(text) {
  const header = [];
  for (const line of text.split(/\r?\n/)) {
    if (header.length === 0 && line.startsWith('#!')) continue;
    if (!/^\s*(\/\/|\/\*|\*)/.test(line)) break;
    header.push(line);
  }
  return header.join('\n');
}

/** The specifiers `text` imports or re-exports statically, without the `node:` prefix. */
function importsOf(text) {
  // `[^;'"`]` keeps a match inside one statement's names: it cannot run on past a quote to pair an `export` line
  // with a later string that happens to follow a `from`.
  const found = [...text.matchAll(/^\s*(?:import|export)\s[^;'"`]*?\sfrom\s+['"]([^'"]+)['"]/gm), ...text.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)];
  return found.map((match) => match[1].replace(/^node:/, ''));
}

test('every bin/lib module whose header says it is pure imports no fs, child_process, net or os, but the legacy ones', () => {
  const modules = fs.readdirSync(LIB).filter((name) => name.endsWith('.mjs') && !name.endsWith('.test.mjs'));
  const claiming = modules.filter((name) => CLAIM.test(headerOf(fs.readFileSync(path.join(LIB, name), 'utf8'))));
  assert.ok(claiming.length >= 5, `only ${claiming.length} modules claim to be pure: ${claiming.join(', ')}`);
  const broken = claiming.filter((name) => importsOf(fs.readFileSync(path.join(LIB, name), 'utf8')).some((spec) => IMPURE.has(spec)));
  const problems = ratchet({ checked: claiming, broken, legacy: LEGACY });
  assert.deepEqual(problems, [], `${problems.join('\n')}\n\na pure module is handed what was read; or its header says what it reads`);
});

test('the header is the opening comment, an import of node:fs is impure with or without its prefix, and pure-ish is no claim', () => {
  const text = "#!/usr/bin/env node\n// Pure: it is handed the rows.\nimport fs from 'fs';\nimport {\n  spawnSync,\n} from 'node:child_process';\nexport { x } from './x.mjs';\nimport './side.mjs';\n// not the header\n";
  assert.equal(headerOf(text), '// Pure: it is handed the rows.');
  assert.deepEqual(importsOf(text), ['fs', 'child_process', './x.mjs', './side.mjs']);
  assert.deepEqual(importsOf("export const NAME = 'x'\nconst note = `read from 'node:fs'`\n"), []);
  assert.ok(!CLAIM.test('stays pure-ish over injectable deps'));
  assert.ok(CLAIM.test('The pure part of `js-harness rules applied`'));
});
