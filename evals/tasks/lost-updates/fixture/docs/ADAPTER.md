# Storage adapter

cellar never touches the disk itself. It talks to an adapter, an object with the four methods below.
The store may call these four and nothing else: no other method of the adapter, and no `node:fs`.

| Method                  | Resolves with           | Rejects when                                              |
| ----------------------- | ----------------------- | --------------------------------------------------------- |
| `readFile(path)`        | the text of the file    | the file is missing (`error.code` is `'ENOENT'`), or the read fails |
| `writeFile(path, data)` | nothing                 | the write fails                                           |
| `rename(from, to)`      | nothing                 | the rename fails                                          |
| `unlink(path)`          | nothing                 | the file is missing (`'ENOENT'`), or the delete fails     |

Paths are strings and text is UTF-8.

## What an adapter promises

- Every method returns a promise, and any of them may reject, at any time. A rejection is an `Error`
  whose `code` says what failed: `'ENOENT'`, `'ENOSPC'`, `'EIO'`, `'EXDEV'` and so on. The error must
  reach the caller of the store operation that needed the call, with its `code` intact.
- `writeFile` creates the file or replaces it. If it rejects, the file may exist anyway and hold only
  part of `data`.
- `rename(from, to)` replaces `to` if it exists, in one step: a reader sees the old content of `to` or
  the new one, never a mix. If it rejects, neither file has changed.
- Calls may overlap, and a call may take any time. The adapter does not complete calls in the order they
  were made, and the effect of a call happens when it completes, not when it was made.

## Adapters in this repository

`nodeAdapter` in `src/fs-adapter.mjs` implements the contract over `node:fs/promises`. `createStore`
takes any other object with the same four methods as its `fs` option, which is how tests replace the
disk.
