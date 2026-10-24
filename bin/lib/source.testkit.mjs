// What the convention tests read of this repository's source (odd/tasks/reorganization.md, S11): the modules under a
// folder at any depth, a module's code without its comment lines, and what a module imports. Shared, so every
// convention reads one set and one parse, and a module in a new subfolder is checked by all of them at once. It
// reads the folder it is handed and nothing else.
import fs from 'node:fs';
import path from 'node:path';

/** The source modules under `dir`, at any depth: each `.mjs` and `.cjs` but the tests, as its path relative to `dir`
 * with `/` between folders, sorted. */
export function sourceModules(dir) {
  return fs
    .readdirSync(dir, { recursive: true })
    .map((name) => name.split(path.sep).join('/'))
    .filter((name) => /\.(?:mjs|cjs)$/.test(name) && !name.endsWith('.test.mjs'))
    .sort();
}

/** `text` without its comment lines, so a comment that names a call or a variable is not code. */
export function withoutComments(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n');
}

/** The specifiers `text` imports or re-exports statically, without the `node:` prefix. */
export function importsOf(text) {
  // `[^;'"`]` keeps a match inside one statement's names: it cannot run on past a quote to pair an `export` line
  // with a later string that happens to follow a `from`.
  const found = [...text.matchAll(/^\s*(?:import|export)\s[^;'"`]*?\sfrom\s+['"]([^'"]+)['"]/gm), ...text.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)];
  return found.map((match) => match[1].replace(/^node:/, ''));
}
