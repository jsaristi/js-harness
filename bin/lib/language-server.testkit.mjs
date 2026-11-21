// A typescript-language-server that can start, for the tests that run doctor over a healthy fixture: the
// typescript-lsp row reads the server on the PATH doctor is given and the TypeScript it would take
// (stack.mjs, `languageServerStart`), so without this a test would see whatever server this machine holds.
// Not a test file, so `node --test` does not run it; bin/doctor.test.mjs and bin/doctor-hook.test.mjs import it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** A folder holding a typescript-language-server shim and package, beside a TypeScript at `version` that ships
 * `lib/tsserver.js` where `tsserver` is set (TypeScript 7 ships none). The caller removes it. */
export function makeLanguageServerPrefix({ version = '5.9.3', tsserver = true } = {}) {
  const prefix = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-lsp-'));
  const write = (relative, text) => {
    const file = path.join(prefix, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  write('node_modules/typescript-language-server/package.json', JSON.stringify({ name: 'typescript-language-server' }));
  for (const name of ['typescript-language-server', 'typescript-language-server.cmd']) write(name, '');
  write('node_modules/typescript/package.json', JSON.stringify({ name: 'typescript', version, main: './lib/typescript.js' }));
  for (const name of tsserver ? ['typescript.js', 'tsserver.js'] : ['typescript.js']) write(`node_modules/typescript/lib/${name}`, '');
  return prefix;
}

/** `env` (the process's without one) with `prefix` first on its PATH. */
export function withLanguageServer(prefix, env) {
  const given = env ?? process.env;
  return { ...given, PATH: [prefix, given.PATH ?? ''].join(path.delimiter) };
}
