# Commands

Every command prints its result on stdout and its errors on stderr as `tk <command>: <message>`.
The exit code is 0 on success, 2 for a usage error, 3 for a conflict, 4 when something is not found,
5 when the store cannot be read and 1 for anything else.

## tk add

Adds an open task.

```text
tk add <title>
```

Flags: none.

Exit codes: 0 on success, 2 when no title is given, 5 when the store cannot be read.

```text
$ tk add "Buy milk"
Added task 1
```

## tk done

Marks a task as done and records when.

```text
tk done <id>
```

Flags: none.

Exit codes: 0 on success, 2 when the id is not a task id, 3 when the task is already done, 4 when
there is no such task, 5 when the store cannot be read.

```text
$ tk done 1
Finished task 1
```

## tk export

Writes the tasks, sorted by id, as JSON or CSV. The output goes to stdout unless `--output` names a
file.

```text
tk export [--format json|csv] [--output <path>] [--force] [--status open|done] [--since <duration>]
```

Flags:

- `--format json|csv`: the output format, `json` by default.
- `--output <path>`: write to this file instead of stdout; nothing is printed.
- `--force`: replace the file named by `--output` if it exists.
- `--status open|done`: keep only the tasks with this status.
- `--since <duration>`: keep only the tasks created within this window of now, like `90m`, `12h` or
  `7d`.

Exit codes: 0 on success, 2 for an unknown flag or a missing or invalid value, 3 when the output
file exists and `--force` is not given, 5 when the store cannot be read.

```text
$ tk export --format csv --status open --output open.csv
```

## tk list

Lists the open tasks, oldest first.

```text
tk list [--all]
```

Flags:

- `--all`: include the tasks that are done.

Exit codes: 0 on success, 2 for an unknown flag, 5 when the store cannot be read.

```text
$ tk list
ID  TITLE     STATUS  CREATED
2   Buy milk  open    2025-03-02T09:30:00.000Z
```

## tk remove

Deletes a task.

```text
tk remove <id>
```

Flags: none.

Exit codes: 0 on success, 2 when the id is not a task id, 4 when there is no such task, 5 when the
store cannot be read.

```text
$ tk remove 2
Removed task 2
```
