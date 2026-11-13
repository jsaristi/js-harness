// tk export: prints tasks as JSON. --force overwrites an existing --output file.
import fs from 'node:fs';

export function exportTasks(tasks, { output, force = false } = {}) {
  const text = JSON.stringify(tasks);
  if (!output) return text;
  if (fs.existsSync(output) && !force) throw new Error(`${output} exists; pass --force`);
  fs.writeFileSync(output, text);
  return `wrote ${tasks.length} tasks`;
}
