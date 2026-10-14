// The functions a project can turn off and on: the code map, the language server and the Codex review,
// declared under `harness.json` `"functions"`. This module only reads what is declared and says what each
// switch resolves to; it spawns nothing and reads no file, so the rules are all testable as data. The
// commands that act on a switch (check, init, sync, doctor, codex-review) ask it. See
// odd/tasks/on-demand-functions.md.

/** What the Codex review is where a project says nothing. One constant, because it is Sebastián's to
 * choose (odd/tasks/on-demand-functions.md, "What is his to decide", question 2). */
export const CODEX_REVIEW_DEFAULT = 'auto';

/** Each switch: the values it takes, the one it has when the project declares none (`fallback`), and the
 * one it is read as when what is declared cannot be read (`strict`): on, since a switch that cannot be
 * read must never turn a check off. */
export const SWITCHES = {
  codeMap: { values: ['auto', 'on-demand', 'always', 'off'], fallback: 'auto', strict: 'on-demand' },
  languageServer: { values: ['auto', 'on', 'off'], fallback: 'auto', strict: 'on' },
  codexReview: { values: ['auto', 'on', 'off'], fallback: CODEX_REVIEW_DEFAULT, strict: 'on' },
};

const quoted = (names) => names.map((name) => `"${name}"`).join(', ');

/** The switches of a parsed `harness.json` (or `null` for none), as `{ values, declared, errors }`:
 * `values` holds every switch, `declared` only the ones the project wrote with a value the switch takes,
 * and `errors` one sentence per thing that cannot be read. A missing `functions`, or a missing switch in
 * it, is the fallback and no error; a value a switch does not take is an error and is read as `strict`. A
 * name that is no switch is an error too: a misspelt switch would otherwise be a silent default. */
export function readFunctions(harness) {
  const values = Object.fromEntries(Object.entries(SWITCHES).map(([name, { fallback }]) => [name, fallback]));
  const declared = {};
  const errors = [];
  if (!harness || !('functions' in harness)) return { values, declared, errors };

  const { functions } = harness;
  if (functions === null || typeof functions !== 'object' || Array.isArray(functions)) {
    errors.push(`harness.json "functions" must be an object; it is ${JSON.stringify(functions)}`);
    for (const [name, { strict }] of Object.entries(SWITCHES)) values[name] = strict;
    return { values, declared, errors };
  }

  for (const [name, value] of Object.entries(functions)) {
    // Own names only: `constructor` or `__proto__` written as a switch is a name like any other that is
    // no switch, not the property every object inherits.
    const known = Object.hasOwn(SWITCHES, name) ? SWITCHES[name] : undefined;
    if (!known) {
      errors.push(
        `harness.json "functions" holds "${name}", which is no switch; the switches are ${quoted(Object.keys(SWITCHES))}`,
      );
    } else if (!known.values.includes(value)) {
      errors.push(
        `harness.json "functions"."${name}" must be one of ${quoted(known.values)}; it is ${JSON.stringify(value)}`,
      );
      values[name] = known.strict;
    } else {
      values[name] = value;
      declared[name] = value;
    }
  }
  return { values, declared, errors };
}

/** The extensions that make a file a program. A closed, positive list on purpose: the question it answers
 * is whether a project has code at all, and by a negative rule (all that is not text) a research project's
 * data, figures and papers would be code. It decides which functions a project has, never which commits a
 * review must read: that stays the review's own rule (bin/lib/codex-review-scope.mjs). */
const PROGRAM_EXTENSIONS = new Set([
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'py', 'ipynb', 'r', 'jl', 'go', 'rs', 'java', 'kt', 'cs', 'c', 'h',
  'cpp', 'rb', 'php', 'swift', 'sh', 'ps1', 'sql',
]);

/** The files that say a project is built, whatever language it is in, by their whole name. */
const BUILD_FILES = new Set([
  'package.json', 'pyproject.toml', 'requirements.txt', 'go.mod', 'cargo.toml', 'pom.xml', 'makefile',
  'dockerfile',
]);

const TYPESCRIPT_EXTENSIONS = new Set(['ts', 'tsx']);

/** A path's last segment, lowercased, for either slash: git prints `/`, a Windows caller may hand `\`. */
const baseName = (file) => file.slice(Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\')) + 1).toLowerCase();

/** The text after a name's last dot, or `''` for a name with no dot (`py` is no Python file). */
const extensionOf = (name) => (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '');

/** The first of `paths` whose name is a program's, or `null`. The first, in the order given, so the reason
 * a switch resolved as it did names the same file each time for the same list. */
export function programFile(paths) {
  return (
    paths.find((file) => {
      const name = baseName(file);
      return BUILD_FILES.has(name) || PROGRAM_EXTENSIONS.has(extensionOf(name));
    }) ?? null
  );
}

/** The first of `paths` that says the project is TypeScript (`tsconfig.json`, `.ts`, `.tsx`), or `null`. */
export function typeScriptFile(paths) {
  return (
    paths.find((file) => {
      const name = baseName(file);
      return name === 'tsconfig.json' || TYPESCRIPT_EXTENSIONS.has(extensionOf(name));
    }) ?? null
  );
}

/** What each switch resolves to, as `{ value, declared, because }` per switch. `values` is `readFunctions`'s;
 * `tree` is `{ paths }`, the names of the project's files, or `{ unknown: <reason> }` when they could not be
 * read. A declared value is the answer whatever the files are. `auto` goes by the files: the code map and the
 * Codex review by any program, the language server by TypeScript alone. `auto` over files that could not be
 * read is on, and says so: nothing is turned off because nobody could look. */
export function resolveFunctions(values, tree) {
  const unread =
    'unknown' in tree ? `the files of the project could not be read (${tree.unknown}), so it is read as on` : null;
  const program = unread ? null : programFile(tree.paths);
  const typed = unread ? null : typeScriptFile(tree.paths);

  const byProgram = (on) => {
    if (unread) return { value: on, because: unread };
    if (program) return { value: on, because: `${program} is a program` };
    return { value: 'off', because: 'no file of the project is a program' };
  };
  const byTypeScript = () => {
    if (unread) return { value: 'on', because: unread };
    if (typed) return { value: 'on', because: `${typed} is TypeScript` };
    return { value: 'off', because: 'no file of the project is TypeScript' };
  };
  const auto = {
    codeMap: () => byProgram('on-demand'),
    languageServer: byTypeScript,
    codexReview: () => byProgram('on'),
  };

  return Object.fromEntries(
    Object.keys(SWITCHES).map((name) => {
      const declared = values[name];
      if (declared !== 'auto') return [name, { value: declared, declared, because: 'declared in harness.json' }];
      return [name, { ...auto[name](), declared }];
    }),
  );
}
