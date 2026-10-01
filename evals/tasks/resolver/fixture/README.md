# pinpoint

Resolves the dependency tree of a project to one exact version per package and writes the result as a
lockfile. It reads a plain JSON registry, so it needs no network and gives the same answer everywhere.
pinpoint needs Node 22 or newer and has no other dependencies.

## Use

```sh
node bin/resolve.mjs app.json --registry registry.json            # prints the lockfile
node bin/resolve.mjs app.json --registry registry.json --lock pinpoint.lock
```

`app.json` is the root manifest, `{ "dependencies": { "name": "range" }, "optionalDependencies": { ... } }`.
`registry.json` is `{ "name": { "version": manifest } }`, where a manifest may hold `dependencies`,
`optionalDependencies`, `peerDependencies`, `peerDependenciesMeta` and `yanked`. With `--lock`, the
versions of an earlier lockfile are preferred when they still fit.

Exit codes: 0 when the lockfile was written to stdout; 1 when the tree cannot be resolved, with
`error <CODE>: <message>` on stderr; 2 for a usage problem, such as a missing argument or a file that
cannot be read.

From code:

```js
import { createRegistry } from './src/registry.mjs';
import { resolve } from './src/resolve.mjs';
import { serializeLock } from './src/lockfile.mjs';

const result = resolve(root, createRegistry(data), { lock });
process.stdout.write(serializeLock(result));
```

## Ranges

`src/range.mjs` reads npm's syntax: exact versions, `^`, `~`, `>=`, `>`, `<=`, `<`, x-ranges such as
`1.x` or `*`, hyphen ranges and `||`. A prerelease only matches a range that names a prerelease of the
same `major.minor.patch`. Versions are `major.minor.patch` with an optional prerelease.

## Lockfile

JSON with two-space indentation and a final newline: `lockfileVersion` (1), then `packages`, sorted by
name. Each package is `{ "version": "1.2.0", "dependencies": { "other": "2.0.0" } }`, its dependencies
sorted by name too.

## Resolution

How versions are chosen is specified in [docs/RESOLUTION.md](docs/RESOLUTION.md). The tests run with
`npm test`.
