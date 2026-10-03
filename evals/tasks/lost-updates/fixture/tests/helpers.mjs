import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** Runs `work` with a fresh temporary directory and removes the directory afterwards. */
export async function withTempDir(work) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cellar-'));
  try {
    return await work(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
