import fs from 'node:fs';
import { emptyInventory, readInventory, writeInventory } from './format.mjs';

/** The inventory in `file`; an empty one when the file does not exist yet. */
export function loadInventory(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return emptyInventory();
    throw error;
  }
  return readInventory(text);
}

/** Writes `state` to `file`, replacing what is there. */
export function saveInventory(file, state) {
  fs.writeFileSync(file, writeInventory(state));
}
