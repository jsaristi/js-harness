import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SWITCHES, programFile, readFunctions, resolveFunctions, typeScriptFile } from './functions.mjs';

const DEFAULTS = { codeMap: 'auto', languageServer: 'auto', codexReview: 'auto', pushUnasked: 'auto', lensReview: 'auto' };

test('a harness.json with no "functions" is every switch at its default, with no error', () => {
  assert.deepEqual(readFunctions({ version: '0.1.0' }), { values: DEFAULTS, declared: {}, errors: [] });
});

test('no harness.json at all is every switch at its default too', () => {
  assert.deepEqual(readFunctions(null), { values: DEFAULTS, declared: {}, errors: [] });
});

test('a declared switch is read, and the ones beside it keep their defaults', () => {
  const read = readFunctions({ functions: { codexReview: 'off' } });
  assert.deepEqual(read.values, { ...DEFAULTS, codexReview: 'off' });
  assert.deepEqual(read.declared, { codexReview: 'off' });
  assert.deepEqual(read.errors, []);
});

test('every value a switch takes is read as it is written', () => {
  for (const [name, { values }] of Object.entries(SWITCHES)) {
    for (const value of values) {
      const read = readFunctions({ functions: { [name]: value } });
      assert.equal(read.values[name], value, `${name}: ${value}`);
      assert.deepEqual(read.errors, []);
    }
  }
});

test('a value a switch does not take is an error that names the switch, the value and what it takes', () => {
  const read = readFunctions({ functions: { codexReview: 'no' } });
  assert.deepEqual(read.errors, [
    'harness.json "functions"."codexReview" must be one of "auto", "on", "off"; it is "no"',
  ]);
});

test('a switch with a value it does not take is read as on, never as off', () => {
  assert.equal(readFunctions({ functions: { codexReview: false } }).values.codexReview, 'on');
  assert.equal(readFunctions({ functions: { codeMap: 'none' } }).values.codeMap, 'on-demand');
  assert.equal(readFunctions({ functions: { languageServer: 0 } }).values.languageServer, 'on');
  // Pushing unasked is the one switch read as off: a value it cannot read asks the person, never pushes.
  assert.equal(readFunctions({ functions: { pushUnasked: 'yes' } }).values.pushUnasked, 'off');
});

test('pushing unasked is off where the project says nothing: the session asks before it pushes', () => {
  const because = 'the project asks until its owner turns it on';
  for (const paths of [['README.md'], ['src/fetch.py']]) {
    assert.deepEqual(resolveFunctions(DEFAULTS, { paths }).pushUnasked, { value: 'off', declared: 'auto', because });
  }
  assert.deepEqual(resolveFunctions(DEFAULTS, { unknown: 'git failed' }).pushUnasked, { value: 'off', declared: 'auto', because });
});

test('pushing unasked is on only where the project declares it on, whatever its files are', () => {
  const resolved = resolveFunctions({ ...DEFAULTS, pushUnasked: 'on' }, { paths: [] });
  assert.deepEqual(resolved.pushUnasked, { value: 'on', declared: 'on', because: 'declared in harness.json' });
});

test('the Claude lens review is off where the project says nothing, and on only where it declares it (odd/tasks/f8-s1-reviews.md, L9)', () => {
  const because = 'a commit asks for a lens record only where the project turns the lens review on';
  for (const tree of [{ paths: ['src/fetch.py'] }, { unknown: 'git failed' }]) {
    assert.deepEqual(resolveFunctions(DEFAULTS, tree).lensReview, { value: 'off', declared: 'auto', because });
  }
  assert.deepEqual(resolveFunctions({ ...DEFAULTS, lensReview: 'on' }, { paths: [] }).lensReview, { value: 'on', declared: 'on', because: 'declared in harness.json' });
  // A value that cannot be read is on, as every check is: nothing is turned off by a file nobody could read.
  assert.equal(readFunctions({ functions: { lensReview: 'yes' } }).values.lensReview, 'on');
});

test('a name that is no switch is an error, so a misspelt switch is never a silent default', () => {
  const read = readFunctions({ functions: { codexreview: 'off' } });
  assert.deepEqual(read.errors, [
    'harness.json "functions" holds "codexreview", which is no switch; the switches are "codeMap", "languageServer", "codexReview", "pushUnasked", "lensReview"',
  ]);
  assert.deepEqual(read.values, DEFAULTS);
});

test('a "functions" that is not an object is an error and every switch is read as on', () => {
  for (const functions of ['off', ['codexReview'], null, 3]) {
    const read = readFunctions({ functions });
    assert.deepEqual(read.errors, [`harness.json "functions" must be an object; it is ${JSON.stringify(functions)}`]);
    assert.deepEqual(read.values, { codeMap: 'on-demand', languageServer: 'on', codexReview: 'on', pushUnasked: 'off', lensReview: 'on' });
  }
});

test('a program is told by its name: an extension of the list, in any case', () => {
  assert.equal(programFile(['notes.md', 'src/fetch.py']), 'src/fetch.py');
  assert.equal(programFile(['analysis/Model.R']), 'analysis/Model.R');
  assert.equal(programFile(['bin\\check.mjs']), 'bin\\check.mjs');
});

test('a build file is a program by its whole name, in any folder', () => {
  for (const name of ['package.json', 'tools/Makefile', 'api/Dockerfile', 'pyproject.toml', 'go.mod']) {
    assert.equal(programFile([name]), name);
  }
});

test('what research holds is no program: text, data, figures, papers', () => {
  const paths = ['README.md', 'data/survey.csv', 'figures/fig1.png', 'papers/smith2020.pdf', 'refs.bib', 'notes.txt'];
  assert.equal(programFile(paths), null);
});

test('the files the harness itself writes are no program', () => {
  assert.equal(programFile(['harness.json', 'AGENTS.md', '.gitignore', '.gitattributes', '.claude/settings.json']), null);
});

test('a name that only ends like a build file or holds an extension inside is no program', () => {
  assert.equal(programFile(['notpackage.json', 'data/my.py.csv', 'Makefile.md', 'py']), null);
});

test('the first program in the order given is the one named, so the reason is stable', () => {
  assert.equal(programFile(['a.md', 'b.go', 'c.py']), 'b.go');
});

test('TypeScript is told by a tsconfig.json, a .ts or a .tsx file, and by nothing else', () => {
  assert.equal(typeScriptFile(['src/app.tsx']), 'src/app.tsx');
  assert.equal(typeScriptFile(['web/tsconfig.json']), 'web/tsconfig.json');
  assert.equal(typeScriptFile(['types/index.d.ts']), 'types/index.d.ts');
  assert.equal(typeScriptFile(['bin/check.mjs', 'src/app.js', 'package.json', 'ts', 'notes.ts.md']), null);
});

test('auto in a project that holds a program: the map on demand and the Codex review on', () => {
  const resolved = resolveFunctions(DEFAULTS, { paths: ['README.md', 'src/fetch.py'] });
  assert.deepEqual(resolved.codeMap, { value: 'on-demand', declared: 'auto', because: 'src/fetch.py is a program' });
  assert.deepEqual(resolved.codexReview, { value: 'on', declared: 'auto', because: 'src/fetch.py is a program' });
});

test('auto in a project that holds no program: the map, the language server and the Codex review off', () => {
  const resolved = resolveFunctions(DEFAULTS, { paths: ['README.md', 'data/survey.csv'] });
  const because = 'no file of the project is a program';
  assert.deepEqual(resolved.codeMap, { value: 'off', declared: 'auto', because });
  assert.deepEqual(resolved.codexReview, { value: 'off', declared: 'auto', because });
  assert.deepEqual(resolved.languageServer, { value: 'off', declared: 'auto', because: 'no file of the project is TypeScript' });
});

test('auto for the language server goes by TypeScript, not by any program', () => {
  const python = resolveFunctions(DEFAULTS, { paths: ['src/fetch.py'] });
  assert.equal(python.languageServer.value, 'off');
  const typed = resolveFunctions(DEFAULTS, { paths: ['src/fetch.py', 'web/app.ts'] });
  assert.deepEqual(typed.languageServer, { value: 'on', declared: 'auto', because: 'web/app.ts is TypeScript' });
});

test('a declared value is the answer whatever the files are', () => {
  const values = { codeMap: 'always', languageServer: 'on', codexReview: 'off', pushUnasked: 'on', lensReview: 'on' };
  for (const paths of [[], ['src/fetch.py', 'web/app.ts']]) {
    assert.deepEqual(resolveFunctions(values, { paths }), {
      codeMap: { value: 'always', declared: 'always', because: 'declared in harness.json' },
      languageServer: { value: 'on', declared: 'on', because: 'declared in harness.json' },
      codexReview: { value: 'off', declared: 'off', because: 'declared in harness.json' },
      pushUnasked: { value: 'on', declared: 'on', because: 'declared in harness.json' },
      lensReview: { value: 'on', declared: 'on', because: 'declared in harness.json' },
    });
  }
});

test('auto with files that could not be read is on, and says why: nothing is turned off unseen', () => {
  const resolved = resolveFunctions(DEFAULTS, { unknown: 'not a git repository' });
  const because = 'the files of the project could not be read (not a git repository), so it is read as on';
  assert.deepEqual(resolved.codeMap, { value: 'on-demand', declared: 'auto', because });
  assert.deepEqual(resolved.languageServer, { value: 'on', declared: 'auto', because });
  assert.deepEqual(resolved.codexReview, { value: 'on', declared: 'auto', because });
});

test('a declared off holds even when the files could not be read', () => {
  const resolved = resolveFunctions({ ...DEFAULTS, codexReview: 'off' }, { unknown: 'git failed' });
  assert.deepEqual(resolved.codexReview, { value: 'off', declared: 'off', because: 'declared in harness.json' });
});

test('a name every object inherits is no switch either: an error, never a crash', () => {
  for (const name of ['constructor', 'toString', '__proto__']) {
    const read = readFunctions(JSON.parse(`{ "functions": { "${name}": "off" } }`));
    assert.deepEqual(read.errors, [
      `harness.json "functions" holds "${name}", which is no switch; the switches are "codeMap", "languageServer", "codexReview", "pushUnasked", "lensReview"`,
    ]);
    assert.deepEqual(read.values, DEFAULTS);
  }
});
