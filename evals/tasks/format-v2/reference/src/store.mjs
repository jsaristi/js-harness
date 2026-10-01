import fs from 'node:fs';
import { emptyInventory, readInventory, VERSION, versionOf, writeInventory } from './format.mjs';

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

/** Copies a file that is in an older version to `<file>.v<version>.bak`, unless that backup is there already. */
function backUp(file) {
  if (!fs.existsSync(file)) return;
  const version = versionOf(fs.readFileSync(file, 'utf8'));
  if (version >= VERSION) return;
  try {
    fs.copyFileSync(file, `${file}.v${version}.bak`, fs.constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

/** Writes `state` to `file`, replacing what is there; a file in an older version is backed up first. */
export function saveInventory(file, state) {
  backUp(file);
  fs.writeFileSync(file, writeInventory(state));
}
