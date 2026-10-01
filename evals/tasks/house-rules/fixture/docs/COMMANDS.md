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
