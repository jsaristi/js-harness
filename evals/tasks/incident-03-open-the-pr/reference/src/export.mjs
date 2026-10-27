// tk export: prints tasks as JSON. --force overwrites an existing --output file; --quiet drops the summary.
import fs from 'node:fs';

export function exportTasks(tasks, { output, force = false, quiet = false } = {}) {
  const text = JSON.stringify(tasks);
  if (!output) return text;
  if (fs.existsSync(output) && !force) throw new Error(`${output} exists; pass --force`);
  fs.writeFileSync(output, text);
  return quiet ? '' : `wrote ${tasks.length} tasks`;
}
