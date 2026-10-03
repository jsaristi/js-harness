# Contributing to tk

tk is small on purpose. These are the rules the existing commands already follow; a change that
breaks one is sent back in review. Run `npm test` before you push.

## Adding a command

1. Put the command in `src/commands/<name>.mjs` as the default export
   `{ name, summary, usage, flags, run }`: `name` is the word typed after `tk`, `summary` is the
   line `tk help` shows, `usage` is the synopsis `tk help <name>` shows, `flags` is the spec
   `parseFlags` takes and `run(args, ctx)` does the work.
2. Add it to the registry in `src/commands/index.mjs`. The registry is in alphabetical order of
   command name, and `tk help` lists the commands in registry order.
3. Read arguments only with `parseFlags` from `src/flags.mjs`. A flag that takes one of a fixed set
   of values declares them as `choices`; a command never checks them by hand.
4. Print, fail, read the time and write files as described under Output, Errors and exit codes,
   Time and Files below.
5. Write data in the formats under Data formats.
6. Document the command as described under Docs, in the same change.
7. Cover it with a spec in `tests/` that calls `main` with the fake context from
   `tests/helpers.mjs`.

## Output

Commands never use `console`, `process.stdout` or `process.stderr`. Results go through
`ctx.io.out` and diagnostics through `ctx.io.err`. Both write the text they are given exactly as
given, so the caller ends each line with its own terminator. One call prints one line.

## Errors and exit codes

A command reports a problem by throwing; it never prints its own error and never calls
`process.exit`. `main` prints the error on stderr as `tk <command>: <message>` and returns the exit
code of the error's class:

| Code | Error | Meaning |
| --- | --- | --- |
| 2 | `UsageError` | the command line is wrong: unknown flag, missing or invalid value |
| 3 | `ConflictError` | the request clashes with the current state |
| 4 | `NotFoundError` | something the command was asked for does not exist |
| 5 | `StoreError` | the task store cannot be read |
| 1 | anything else | |

A command checks its arguments before it touches any file, so a command that fails leaves the files
it was about to write as they were.

## Time

Commands never read the current time themselves: no `Date.now()` and no `new Date()` without an
argument. They call `ctx.clock()`, which returns a `Date`, so a test can fix the time. A relative
window such as "within the last 7 days" is measured from `ctx.clock()`. A duration is written
`90m`, `12h` or `7d` and parsed with `parseDuration` from `src/duration.mjs`; anything else is a
usage error.

## Files

Commands write files only with `writeFileAtomic` from `src/fsutil.mjs`, which writes a temporary
file next to the target and renames it over the target, so a crash never leaves half a file and no
temporary file stays behind. A command that writes a file the user named refuses to replace an
existing one unless `--force` is given: it throws `ConflictError` (exit 3) and the file is left as
it was. Check with `exists` from the same module.

## Data formats

- Timestamps are ISO 8601 in UTC with milliseconds, as `Date#toISOString` writes them:
  `2025-03-02T09:30:00.000Z`.
- A task is `{ id, title, status, created, completed }`. `status` is `open` or `done`, and
  `completed` is `null` until the task is done. Ids are integers that only increase: the id of a task
  that was removed is never used again. The store is a JSON object `{ nextId, tasks }`, where `tasks`
  is the array of tasks and `nextId` the id the next task gets; a store that is a bare array of tasks,
  as older versions wrote it, is still read.
- JSON output is pretty-printed with two spaces and ends with a newline. Records are sorted by id,
  ascending, in every output.
- CSV follows RFC 4180. The first row is a header. Rows end with CRLF, the last row included. A
  field that contains a comma, a double quote, a CR or an LF is wrapped in double quotes and every
  double quote inside it is doubled; any other field is written bare. An empty value, such as the
  `completed` of an open task, is an empty field. The columns of a task are
  `id,title,status,created,completed`, in that order.

## Docs

Every command has these three entries, added in the same change as the command:

- a `## tk <name>` section in `docs/COMMANDS.md` with its usage, every flag, its exit codes and an
  example;
- its name in the `commands=` line of `completions/tk.bash`;
- a line naming it under `## Unreleased` in `CHANGELOG.md`.

`tk help` is generated from the command's `summary`, `usage` and `flags`, so never write help text
by hand.
