import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { main } from '../src/cli.mjs';

/** Runs `work` with a fresh temporary folder and the path of a state file in it, and removes the folder
 * afterwards. */
export async function withStateFile(work) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stockroom-'));
  try {
    return await work(path.join(dir, 'stockroom.json'), dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/** Runs the command with `argv` on `stateFile` and gives its exit code and what it printed. `deps` is
 * passed on to the command. */
export async function run(stateFile, argv, deps = {}) {
  const out = [];
  const err = [];
  const code = await main(argv, { stateFile, out: (line) => out.push(line), err: (line) => err.push(line), ...deps });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
