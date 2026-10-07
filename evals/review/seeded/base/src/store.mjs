// The state file: one JSON document with every item, read whole and written whole.
import fs from 'node:fs/promises';
import path from 'node:path';

const EMPTY = { items: [] };

/** A store over the state file `file`. `load` gives the state, an empty one when the file is not there
 * yet. `save` writes it to a temporary file and renames that over the state file, so a reader never sees
 * half a document. */
export function openStore(file) {
  return {
    file,
    async load() {
      let text;
      try {
        text = await fs.readFile(file, 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT') return structuredClone(EMPTY);
        throw error;
      }
      return { ...structuredClone(EMPTY), ...JSON.parse(text) };
    },
    async save(state) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      await fs.writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
      await fs.rename(temporary, file);
    },
  };
}
