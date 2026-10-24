#!/usr/bin/env node
// Finds the exports of the shipped modules that no file imports (launch-audit S5c):
//
//   node scripts/audit-exports.mjs [--allow <file>] [--json] [--cwd <repo>]
//
// The modules checked are the tracked `bin/**/*.mjs` and `bin/**/*.cjs` that are not `*.test.*` or `*.testkit.*`.
// Their exports are `export function`, `async function`, `function*`, `class`, `const`, `let` and `var` (each name of a
// destructuring or comma list), `export default`, `export { a, b as c }` (the exported names) and `export ... from`
// re-exports. A `.cjs` module's exports are the keys of `module.exports = { a, b: c }` and each `exports.x =` or
// `module.exports.x =`; a `require('<spec>')` or `createRequire(<url>)('<spec>')` uses the names of the destructuring
// declaration in front of it (`{ a: b }` reads `a`; a rest element reads every export), the members read through a
// binding (`const t = require(...)` reads `t.x`), and every export when the binding is used whole. A table of `.cjs` names is not read: only `.mjs` modules are listed in one.
// The importers are every tracked `.mjs` and `.cjs` file of the repository (bin, scripts, evals). `export * from`
// and `export * as ns from` use every export of their source, as does a namespace import (`import * as ns`).
// Named imports use the exported names (`{ a as b }` uses `a`, `import x from` uses `default`, except from a `.cjs`
// module, where `x` reads its members as a require bound to a name does); a bare
// `import '<spec>'` uses nothing; `import('<literal>')` uses every export of its module.
//
// This is a regex scan of the text, not a parser, and the header says what it assumes. Comments are blanked
// first, and the contents of strings are blanked before the keywords are matched, so an import in a comment or
// in a string is not counted. A name used inside its own module is a word count in that module, after its export
// lists are blanked; a word written as an object key or as a ternary branch (`a :`) is left out of that count, so
// such a use can be missed and the finding then reads "no file imports it" instead. Relative specifiers
// are resolved against the importing file; `node:` and bare specifiers are ignored.
//
// A dynamic `import()` whose specifier is not a string literal marks modules as fully used, in one of two ways.
// A template such as `./${name}.mjs` marks the checked modules its pattern matches in the importer's folder: each
// `${...}` stands for any name, so a dispatcher loading `./${name}.mjs` from `bin/` marks every module directly in
// `bin/` and none under `bin/lib/`. Any other expression (`import(HELP[name])`, `import(file)`) marks every module
// whose relative `.mjs` specifier is a string literal in the same file: the table it loads from. In this repository
// that is the usage table of `bin/js-harness.mjs` (`import(file)` in its `commandHelp`), whose `./x.mjs` strings name
// the modules its help reads. The dispatcher's command table is literal `import('./x.mjs')` calls, not a template,
// so each command module it names counts as used whole, and a dead export in one of them is not reported.
//
// Kinds: `unused-export` (no file but its own module uses the name; the detail says so when the module does, and
// then only the export keyword is unused), `test-only-export` (only `*.test.*` or `*.testkit.*` files import
// it; they are named in the detail), and `stale-allow` (an allow-list entry that matches no finding). The
// allow-list is `--allow <file>`, a JSON array of `{ kind, location, why }`; the default is
// `odd/tasks/launch-audit/allow/exports.json`, and a missing default is an empty list. A finding whose kind and
// location match an entry is counted as allowed and not printed. Each finding prints as `<kind>  <location>
// <detail>` (two spaces between the fields), then `<n> findings, <k> allowed`, and `, <s> test-only (info)` when
// there are any; `--json` prints one object, `{ "findings": [...], "allowed": <k> }`, instead.
//
// A `test-only-export` is a seam, not a failure: the launch audit's areas judged each one so (its M4), so it is
// printed and counted as info, and `<n>` counts only the other kinds.
//
// Exits: 0 no finding beyond the allow-list but test-only ones; 1 findings; 2 a usage error (an unknown argument
// prints `unknown argument: <token>` and then the usage) or a repository or allow-list it cannot read.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const USAGE = 'usage: node scripts/audit-exports.mjs [--allow <file>] [--json] [--cwd <repo>]';
const DEFAULT_ALLOW = 'odd/tasks/launch-audit/allow/exports.json';
// The kind that is printed and counted as info, never as a failure.
const INFO_KIND = 'test-only-export';
const NO_IMPORTER = 'no file imports it';
const OWN_USE = 'used only inside its own module, so the export keyword is what is unused';
const TEST_FILE = /\.(?:test|testkit)\.(?:mjs|cjs)$/;
const IDENTIFIER = /^[\w$]+$/;

// A static import: `import x from`, `import { a as b } from`, `import * as ns from`, `import 'spec'`, or the
// default with either, read in the masked text so a string is never matched. Group 4 is the quote that opens
// the specifier, the last character of the match.
const IMPORT = /(?<![\w$.])import\s*(?:([\w$]+)\s*(?:,\s*)?)?(?:\{([^}]*)\}|\*\s*as\s+([\w$]+))?\s*(?:from\s*)?(['"])/g;
const DYNAMIC = /(?<![\w$.])import\s*\(\s*/g;
// A CommonJS module (`.cjs`): its export object, its `exports.name =` assignments, and a load with `require` or with
// `createRequire(<url>)`, bare or through its module object (`nodeModule.createRequire`). A destructuring declaration
// in front of a load names the exports it reads (`const { a } = `).
const CJS_LIST = /(?<![\w$.])module\.exports\s*=\s*\{/g;
const CJS_DOTTED = /(?<![\w$.])(?:module\.)?exports\.([A-Za-z_$][\w$]*)\s*=(?!=)/g;
const CJS_REQUIRE = /(?<![\w$.])(?:require|(?:[A-Za-z_$][\w$]*\.)?createRequire\s*\([^()]*\)\s*)\(\s*(['"])/g;
const CJS_DESTRUCTURE = /\{([^{}]*)\}\s*=\s*$/;
const CJS_BINDING = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*$/;
const EXPORT = /(?<![\w$.])export\s+/g;
const RELATIVE_LITERAL = /(['"`])(\.{1,2}\/[^'"`\n]*\.mjs)\1/g;
// The forms that follow `export`, each read from the position after it with a sticky regex.
const DEFAULT_EXPORT = /default\b/y;
const STAR_EXPORT = /\*\s*(?:as\s+([\w$]+)\s*)?from\s*(['"])/y;
const LIST_EXPORT = /\{/y;
const FROM_CLAUSE = /\s*from\s*(['"])/y;
const FUNCTION_EXPORT = /(?:async\s+)?function\s*\*?\s*([\w$]+)/y;
const CLASS_EXPORT = /class\s+([\w$]+)/y;
const DECLARATION_EXPORT = /(?:const|let|var)\s+/y;
// Characters at the end of a line that mean the declaration goes on to the next line.
const CONTINUES = /[,=+*%&|?:.!<>([{/-]/;

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isCandidate = (file) => /^bin\/(?:.+\/)?[^/]+\.(?:mjs|cjs)$/.test(file) && !TEST_FILE.test(file);
// A relative specifier resolved against the importing file; `node:` and bare specifiers are null.
const resolveSpec = (file, spec) => (/^\.\.?\//.test(spec) ? path.posix.join(path.posix.dirname(file), spec) : null);
// A template's pattern as a regex: each `*` stands for one folder entry's name, which never has a slash.
const globOf = (pattern) => new RegExp(`^${pattern.split('*').map(escapeRegex).join('[^/]*')}$`);
const quoteOf = (match) => match.index + match[0].length - 1;
// The index of the `}` that closes the `{` at `open`, counting only braces.
const closeOf = (masked, open) => {
  let depth = 0;
  for (let at = open; at < masked.length; at += 1) {
    if (masked[at] === '{') depth += 1;
    else if (masked[at] === '}' && (depth -= 1) === 0) return at;
  }
  return masked.length;
};

/** `code` is the source with its comments blanked, and `masked` is that with the contents of its strings blanked
 * too (the quotes stay). Both are as long as the source, and every line break stays, so one offset reads the same
 * place in each. */
function maskSource(source) {
  const code = source.split('');
  const masked = source.split('');
  const blank = (from, to, text) => {
    for (let at = from; at < to; at += 1) if (source[at] !== '\n') text[at] = ' ';
  };
  let at = 0;
  while (at < source.length) {
    const char = source[at];
    if (char === '/' && source[at + 1] === '/') {
      const newline = source.indexOf('\n', at);
      const end = newline === -1 ? source.length : newline;
      blank(at, end, code);
      blank(at, end, masked);
      at = end;
    } else if (char === '/' && source[at + 1] === '*') {
      const close = source.indexOf('*/', at + 2);
      const end = close === -1 ? source.length : close + 2;
      blank(at, end, code);
      blank(at, end, masked);
      at = end;
    } else if (char === "'" || char === '"' || char === '`') {
      const { close, end } = stringEnd(source, at);
      blank(at + 1, close, masked);
      at = end;
    } else if (char === '/' && opensRegex(code, at)) {
      // A regex literal: a quote or a backtick in it opens no string, which would mask the code after it.
      const close = regexEnd(source, at);
      blank(at + 1, close, masked);
      at = close + 1;
    } else {
      at += 1;
    }
  }
  return { code: code.join(''), masked: masked.join('') };
}

// Whether the `/` at `at` opens a regex literal rather than divides: it does where an operand is expected, after
// an operator, an opening bracket, a comma or the start, or after a keyword such as `return`. `code` has the
// comments already blanked, so the token before it is read from code.
function opensRegex(code, at) {
  let before = at - 1;
  while (before >= 0 && /\s/.test(code[before])) before -= 1;
  if (before < 0) return true;
  if ('(,=:[!&|?{};+-*%<>~^'.includes(code[before])) return true;
  const word = /[A-Za-z_$][\w$]*$/.exec(code.slice(Math.max(0, before - 11), before + 1))?.[0];
  return ['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw', 'new', 'yield', 'await'].includes(word);
}

// Where the regex literal opened at `start` closes: its next `/` that is neither escaped nor in a character class,
// or its line's end when it is not closed.
function regexEnd(source, start) {
  let inClass = false;
  for (let at = start + 1; at < source.length; at += 1) {
    const char = source[at];
    if (char === '\\') at += 1;
    else if (char === '\n') return at;
    else if (char === '[') inClass = true;
    else if (char === ']') inClass = false;
    else if (char === '/' && !inClass) return at;
  }
  return source.length;
}

// Where the string opened at `start` closes, and where scanning goes on from. A quote string ends at its line's
// end when it is not closed; a template may run over lines.
function stringEnd(source, start) {
  const quote = source[start];
  let at = start + 1;
  while (at < source.length) {
    const char = source[at];
    if (char === '\\') at += 2;
    else if (char === quote) return { close: at, end: at + 1 };
    else if (char === '\n' && quote !== '`') return { close: at, end: at };
    else at += 1;
  }
  return { close: source.length, end: source.length };
}

// The text of one declaration, from `start` to the `;` or the line break that ends it: a line break ends it
// unless the line so far ends in an operator or a comma, and a bracket keeps it open.
function declaratorChunk(masked, start) {
  let depth = 0;
  let last = '';
  let at = start;
  for (; at < masked.length; at += 1) {
    const char = masked[at];
    if ('([{'.includes(char)) depth += 1;
    else if (')]}'.includes(char)) {
      if (depth === 0) break;
      depth -= 1;
    } else if (depth === 0 && char === ';') break;
    else if (depth === 0 && char === '\n' && !CONTINUES.test(last)) break;
    if (char.trim() !== '') last = char;
  }
  return masked.slice(start, at);
}

// The parts of `text` split at `separator` where no bracket is open.
function splitTop(text, separator) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if ('([{'.includes(char)) depth += 1;
    else if (')]}'.includes(char)) depth -= 1;
    if (char === separator && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
}

// The names a declaration binds: `const a = 1, b = 2`, `const { p, q: r } = x` (the local `r`), `const [s] = y`.
// A nested pattern is not read; its names are left out.
function bindingNames(masked, start) {
  const names = [];
  for (const declarator of splitTop(declaratorChunk(masked, start), ',')) {
    const binding = splitTop(declarator, '=')[0].trim();
    if (binding.startsWith('{') || binding.startsWith('[')) {
      for (const item of splitTop(binding.slice(1, -1), ',')) {
        const piece = splitTop(item, '=')[0].trim();
        let local = piece;
        if (piece.startsWith('...')) local = piece.slice(3);
        else if (piece.includes(':')) local = piece.slice(piece.indexOf(':') + 1);
        if (IDENTIFIER.test(local.trim())) names.push(local.trim());
      }
    } else if (IDENTIFIER.test(binding)) {
      names.push(binding);
    }
  }
  return names;
}

// The names a static import reads from its module: `default` for a default import, then each name of the braces.
function importedNames(defaultName, list) {
  const names = defaultName === undefined ? [] : ['default'];
  for (const item of (list ?? '').split(',')) {
    const name = item.trim().split(/\s+as\s+/)[0].trim();
    if (name !== '') names.push(name);
  }
  return names;
}

// The names a CommonJS destructuring declaration reads: the key of each property, so `{ a: b }` reads `a`; a rest
// element reads every export, so null.
function cjsDestructureNames(text) {
  const names = [];
  for (const item of splitTop(text, ',')) {
    const piece = splitTop(item, '=')[0].trim();
    if (piece === '') continue;
    if (piece.startsWith('...')) return null;
    const key = splitTop(piece, ':')[0].trim();
    if (IDENTIFIER.test(key)) names.push(key);
  }
  return names;
}

// The names a module reads through a binding of its whole exports: `tracer.name` reads `name`. The binding's own
// declaration is its one bare use; any other bare use (passed on, spread, or listed) reads every export, so null.
function memberNames(masked, binding) {
  const names = [];
  let bare = 0;
  const pattern = new RegExp(`(?<![\\w$.])${escapeRegex(binding)}(?![\\w$])(?:\\s*\\.\\s*([A-Za-z_$][\\w$]*))?`, 'g');
  for (const match of masked.matchAll(pattern)) {
    if (match[1] === undefined) bare += 1;
    else names.push(match[1]);
  }
  return bare > 1 ? null : names;
}

// Each word count in `text` where `word` is a name and not a property or an object key.
function countWord(text, word) {
  const pattern = new RegExp(`(?<![\\w$.])${escapeRegex(word)}(?![\\w$])(?!\\s*:(?!:))`, 'g');
  return [...text.matchAll(pattern)].length;
}

// The text with the given ranges blanked, line breaks kept.
function blankRanges(text, ranges) {
  const cleaned = text.split('');
  for (const [from, to] of ranges) {
    for (let at = from; at < to; at += 1) if (cleaned[at] !== '\n') cleaned[at] = ' ';
  }
  return cleaned.join('');
}

/** One module's exports and uses. `exports` lists `{ name, line, local, ownUse }` in source order: `local` is the
 * name the module binds (null for a default export and a re-export), and `ownUse` says the module uses that
 * binding itself. `uses` lists `{ target, names }`, where `target` is a resolved path or a RegExp over the
 * checked paths (a template), and `names` is the list of names read, or null for every export. */
function scanModule(file, source) {
  const { code, masked } = maskSource(source);
  const declared = [];
  const uses = [];
  const listRanges = [];
  let dynamicVariable = false;
  const lineAt = (index) => code.slice(0, index).split('\n').length;
  const specAt = (quoteIndex) => code.slice(quoteIndex + 1, masked.indexOf(masked[quoteIndex], quoteIndex + 1));
  const addUse = (target, names) => {
    if (target !== null) uses.push({ target, names });
  };
  const stickyAt = (pattern, index) => {
    pattern.lastIndex = index;
    return pattern.exec(masked);
  };

  for (const match of masked.matchAll(IMPORT)) {
    const target = resolveSpec(file, specAt(quoteOf(match)));
    if (match[3] !== undefined) {
      addUse(target, null);
    } else if (match[1] !== undefined && target !== null && target.endsWith('.cjs')) {
      // A default import of a CommonJS module is its module.exports object, so its members are read as through a require.
      const members = memberNames(masked, match[1]);
      addUse(target, members === null ? null : [...members, ...importedNames(undefined, match[2])]);
    } else {
      addUse(target, importedNames(match[1], match[2]));
    }
  }

  for (const match of masked.matchAll(CJS_REQUIRE)) {
    const target = resolveSpec(file, specAt(quoteOf(match)));
    const before = masked.slice(Math.max(0, match.index - 300), match.index);
    const destructured = CJS_DESTRUCTURE.exec(before);
    const bound = CJS_BINDING.exec(before);
    addUse(target, destructured ? cjsDestructureNames(destructured[1]) : bound ? memberNames(masked, bound[1]) : null);
  }

  for (const match of masked.matchAll(DYNAMIC)) {
    const at = match.index + match[0].length;
    const open = masked[at];
    if (open !== "'" && open !== '"' && open !== '`') {
      dynamicVariable = true;
      continue;
    }
    const raw = code.slice(at + 1, masked.indexOf(open, at + 1));
    const template = open === '`' && raw.includes('${');
    if (!template) {
      addUse(resolveSpec(file, raw), null);
      continue;
    }
    const target = resolveSpec(file, raw.replace(/\$\{[^}]*\}/g, '*'));
    if (target === null) dynamicVariable = true;
    else uses.push({ target: globOf(target), names: null });
  }

  // A table of names in the same file: each relative `.mjs` string is a module the variable import may load.
  if (dynamicVariable) {
    for (const match of code.matchAll(RELATIVE_LITERAL)) addUse(resolveSpec(file, match[2]), null);
  }

  for (const match of masked.matchAll(EXPORT)) {
    const at = match.index + match[0].length;
    const line = lineAt(match.index);
    let found;
    if (stickyAt(DEFAULT_EXPORT, at)) {
      declared.push({ name: 'default', line, local: null });
    } else if ((found = stickyAt(STAR_EXPORT, at))) {
      if (found[1] !== undefined) declared.push({ name: found[1], line, local: null });
      addUse(resolveSpec(file, specAt(quoteOf(found))), null);
    } else if (stickyAt(LIST_EXPORT, at)) {
      const close = masked.indexOf('}', at);
      listRanges.push([at, close + 1]);
      const reexport = stickyAt(FROM_CLAUSE, close + 1);
      const source = reexport ? resolveSpec(file, specAt(quoteOf(reexport))) : null;
      for (const item of masked.slice(at + 1, close).split(',')) {
        const [local, exported = local] = item.trim().split(/\s+as\s+/).map((part) => part.trim());
        if (local === undefined || local === '') continue;
        if (reexport) {
          addUse(source, [local]);
          declared.push({ name: exported, line, local: null });
        } else {
          declared.push({ name: exported, line, local });
        }
      }
    } else if ((found = stickyAt(FUNCTION_EXPORT, at)) || (found = stickyAt(CLASS_EXPORT, at))) {
      declared.push({ name: found[1], line, local: found[1] });
    } else if (stickyAt(DECLARATION_EXPORT, at)) {
      for (const name of bindingNames(masked, DECLARATION_EXPORT.lastIndex)) declared.push({ name, line, local: name });
    }
  }

  if (file.endsWith('.cjs')) {
    for (const match of masked.matchAll(CJS_LIST)) {
      const open = match.index + match[0].length - 1;
      const close = closeOf(masked, open);
      listRanges.push([open, close + 1]);
      let at = open + 1;
      for (const part of splitTop(masked.slice(open + 1, close), ',')) {
        const start = at;
        at += part.length + 1;
        const [key, ...value] = part.trim().split(':');
        const name = key.trim();
        if (!IDENTIFIER.test(name)) continue;
        // `a` binds its own name; `a: b` binds `b`; `a: 3` binds nothing.
        const bound = value.length === 0 ? name : value.join(':').trim();
        declared.push({ name, line: lineAt(start + part.indexOf(name)), local: IDENTIFIER.test(bound) ? bound : null });
      }
    }
    for (const match of masked.matchAll(CJS_DOTTED)) {
      declared.push({ name: match[1], line: lineAt(match.index), local: match[1] });
    }
  }

  const blanked = blankRanges(masked, listRanges);
  const exports = declared.map((exported) => ({
    ...exported,
    ownUse: exported.local !== null && countWord(blanked, exported.local) > 1,
  }));
  return { exports, uses };
}

/** The findings of a set of modules: `sources` maps every tracked `.mjs` path to its text, and `allow` is the
 * allow-list. Returns `{ findings, allowed }`: the findings not allowed (stale entries included, last), and how
 * many findings the allow-list covers. */
function auditSources(sources, allow = [], allowLabel = DEFAULT_ALLOW) {
  const scans = new Map(Object.entries(sources).map(([file, source]) => [file, scanModule(file, source)]));
  const usedBy = new Map();
  const record = (target, importer, names) => {
    if (!usedBy.has(target)) usedBy.set(target, { names: new Map(), whole: new Set() });
    const entry = usedBy.get(target);
    if (names === null) {
      entry.whole.add(importer);
      return;
    }
    for (const name of names) {
      if (!entry.names.has(name)) entry.names.set(name, new Set());
      entry.names.get(name).add(importer);
    }
  };
  for (const [importer, { uses }] of scans) {
    for (const { target, names } of uses) {
      const targets = typeof target === 'string' ? [target] : [...scans.keys()].filter((file) => target.test(file));
      for (const file of targets) if (file !== importer) record(file, importer, names);
    }
  }

  const found = [];
  for (const file of [...scans.keys()].filter(isCandidate).sort()) {
    const use = usedBy.get(file);
    for (const exported of scans.get(file).exports) {
      const importers = new Set([...(use?.whole ?? []), ...(use?.names.get(exported.name) ?? [])]);
      const tests = [...importers].filter((importer) => TEST_FILE.test(importer)).sort();
      if (importers.size > tests.length) continue;
      const location = `${file}:${exported.line}`;
      if (tests.length > 0) {
        found.push({ kind: 'test-only-export', location, detail: `${exported.name}: imported only by test files: ${tests.join(', ')}` });
      } else {
        found.push({ kind: 'unused-export', location, detail: `${exported.name}: ${exported.ownUse ? OWN_USE : NO_IMPORTER}` });
      }
    }
  }

  const allowed = new Set();
  const stale = [];
  allow.forEach((entry, index) => {
    const hits = found.filter((finding) => finding.kind === entry.kind && finding.location === entry.location);
    if (hits.length === 0) {
      stale.push({ kind: 'stale-allow', location: `${allowLabel}#${index + 1}`, detail: `${entry.kind} ${entry.location} matches no finding` });
    }
    for (const hit of hits) allowed.add(hit);
  });
  return { findings: [...found.filter((finding) => !allowed.has(finding)), ...stale], allowed: allowed.size };
}

/** The options of the command line, or `{ error }` for one it does not know. */
function parseArgs(argv) {
  const options = { allow: null, json: false, cwd: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--allow' || arg === '--cwd') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) return { error: `${arg} takes a value` };
      options[arg.slice(2)] = value;
      index += 1;
    } else {
      return { error: `unknown argument: ${arg}` };
    }
  }
  return options;
}

/** The allow-list of a JSON text, every entry an object of three strings, or an error naming the file. */
function parseAllow(text, label) {
  let entries;
  try {
    entries = JSON.parse(text);
  } catch {
    throw new Error(`${label} is not JSON`);
  }
  const valid = (entry) => entry !== null && typeof entry === 'object' && ['kind', 'location', 'why'].every((key) => typeof entry[key] === 'string');
  if (!Array.isArray(entries) || !entries.every(valid)) throw new Error(`${label} must be a JSON array of { "kind", "location", "why" } strings`);
  return entries;
}

// The tracked `.mjs` files of the repository at `cwd`, each with its text.
function readSources(cwd) {
  const git = spawnSync('git', ['-C', cwd, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (git.error || git.status !== 0) throw new Error(`not a git repository: ${cwd}`);
  const sources = {};
  for (const file of git.stdout.split('\0')) {
    if (file.endsWith('.mjs') || file.endsWith('.cjs')) sources[file] = fs.readFileSync(path.join(cwd, file), 'utf8');
  }
  return sources;
}

// The allow-list file as the findings name it: relative to the repository when it is inside it.
function labelOf(cwd, file) {
  const relative = path.relative(cwd, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return file;
  return relative.split(path.sep).join('/');
}

function main(argv) {
  const options = parseArgs(argv);
  if (options.error) {
    console.error(`${options.error}\n${USAGE}`);
    return 2;
  }
  try {
    const cwd = path.resolve(options.cwd);
    const sources = readSources(cwd);
    const allowPath = path.resolve(cwd, options.allow ?? DEFAULT_ALLOW);
    const allow = options.allow === null && !fs.existsSync(allowPath)
      ? []
      : parseAllow(fs.readFileSync(allowPath, 'utf8'), labelOf(cwd, allowPath));
    const { findings, allowed } = auditSources(sources, allow, labelOf(cwd, allowPath));
    const seams = findings.filter((finding) => finding.kind === INFO_KIND).length;
    const failing = findings.length - seams;
    if (options.json) {
      console.log(JSON.stringify({ findings, allowed }, null, 2));
    } else {
      for (const finding of findings) console.log(`${finding.kind}  ${finding.location}  ${finding.detail}`);
      console.log(`${failing} findings, ${allowed} allowed${seams > 0 ? `, ${seams} test-only (info)` : ''}`);
    }
    return failing > 0 ? 1 : 0;
  } catch (error) {
    console.error(`error: ${error.message}`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
