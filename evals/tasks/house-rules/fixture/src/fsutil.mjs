import fs from 'node:fs';
import path from 'node:path';

export function exists(file) {
  return fs.existsSync(file);
}

/** Writes `data` to `file` through a temporary file in the same directory, so a reader never sees half a file. */
export function writeFileAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temp, data);
    fs.renameSync(temp, file);
  } catch (error) {
    fs.rmSync(temp, { force: true });
    throw error;
  }
}
