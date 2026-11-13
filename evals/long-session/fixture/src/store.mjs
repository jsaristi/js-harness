// tk's store: tasks are an array of { id, title, status, due, completed } in tasks.json.
import fs from 'node:fs';

export function loadTasks(file = 'tasks.json') {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
}

export function saveTasks(tasks, file = 'tasks.json') {
  fs.writeFileSync(file, `${JSON.stringify(tasks, null, 2)}\n`);
}

// Earliest due date first; a task with no due date goes last.
export function sortByDue(tasks) {
  return [...tasks].sort((a, b) => {
    if (!a.due) return 1;
    if (!b.due) return -1;
    return b.due.localeCompare(a.due);
  });
}
