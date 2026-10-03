import fs from 'node:fs/promises';

/** The storage adapter of docs/ADAPTER.md over the real disk. */
export const nodeAdapter = {
  readFile: (path) => fs.readFile(path, 'utf8'),
  writeFile: (path, data) => fs.writeFile(path, data, 'utf8'),
  rename: (from, to) => fs.rename(from, to),
  unlink: (path) => fs.unlink(path),
};
