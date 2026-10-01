// Every candidate eval task under `evals/tasks/` must pass `proveTask`: a candidate that does not is a
// failing test, not a task that quietly scores every config alike. With no candidate there is nothing
// to prove, which passes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { proveTask } from './task-proof.mjs';

const tasksDir = fileURLToPath(new URL('./tasks/', import.meta.url));
const candidates = fs.existsSync(tasksDir) ? fs.readdirSync(tasksDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()) : [];

for (const { name } of candidates) {
  // A proof runs several node processes (three graders, two visible suites), each with its own cleanup.
  test(`task ${name} is proven`, { timeout: 5 * 60 * 1000 }, async () => {
    assert.deepEqual((await proveTask(path.join(tasksDir, name))).problems, []);
  });
}
