# Changelog

## Unreleased

- `tk list --all` also shows the tasks that are done.
- The id of a removed task is no longer given to a new one: the store keeps `nextId`.
- `tk list` shows the tasks by ascending id.
- `tk export` writes the tasks as JSON or CSV, to stdout or to a file, and can filter them by status
  and age.

## 0.2.0 - 2025-02-11

- `tk remove` deletes a task.
- The task store is written atomically.

## 0.1.0 - 2025-01-20

- First release: `tk add`, `tk list` and `tk done`.
