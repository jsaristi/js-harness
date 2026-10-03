// Hidden grader of `resolver`. Copied into the workspace as `.eval-grader/` after the agent exits, so `..`
// is the workspace. Every test imports the project itself, so a broken module fails tests one by one and
// the score stays fractional. Each test names the section of docs/RESOLUTION.md (RES §n), or the README,
// that it checks. A registry is written as `{ name: { version: manifest } }`, which is what
// `createRegistry` takes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const T = { timeout: 5000 };
const CLI = { timeout: 20000 };
const BIN = fileURLToPath(new URL('../bin/resolve.mjs', import.meta.url));
const loadResolve = () => import('../src/resolve.mjs');
const loadRegistry = () => import('../src/registry.mjs');
const loadLockfile = () => import('../src/lockfile.mjs');

// A manifest with these dependencies, and a package whose listed versions have no dependencies at all.
const v = (dependencies = {}, more = {}) => ({ dependencies, ...more });
/** @param {string[]} versions */
const plain = (...versions) => Object.fromEntries(versions.map((version) => [version, {}]));
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex');

async function solve(data, root, options) {
  const { resolve } = await loadResolve();
  const { createRegistry } = await loadRegistry();
  return resolve(root, createRegistry(data), options);
}

/** The error `resolve` throws; a call that returns is a failure of the test. */
async function failure(data, root, options) {
  const { resolve } = await loadResolve();
  const { createRegistry } = await loadRegistry();
  let result;
  try {
    result = resolve(root, createRegistry(data), options);
  } catch (error) {
    return error;
  }
  return assert.fail(`resolve returned ${JSON.stringify(result)}`);
}

const versions = (result) => Object.fromEntries(Object.entries(result.packages).map(([name, entry]) => [name, entry.version]));
const lockOf = (map) => ({ packages: Object.fromEntries(Object.entries(map).map(([name, version]) => [name, { version, dependencies: {} }])) });
const assertError = (error, expected) => {
  assert.ok(error instanceof Error, 'an Error');
  for (const [key, value] of Object.entries(expected)) assert.equal(error[key], value, key);
};

/** The same data with the keys of every object in the reverse order. */
const reversed = (value) => {
  if (Array.isArray(value)) return value.map(reversed);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).reverse().map(([key, inner]) => [key, reversed(inner)]));
};

function runCli(files, args) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pinpoint-grade-'));
  try {
    for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), typeof content === 'string' ? content : JSON.stringify(content));
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_TEST_CONTEXT'));
    const run = spawnSync(process.execPath, [BIN, ...args], { cwd: dir, env, encoding: 'utf8', timeout: 15000 });
    return { code: run.status, out: run.stdout, err: run.stderr };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Used by several tests. `a` and `b` each have a version that needs `c@^2` and one that needs `c@^1`.
const CROSSED = {
  a: { '2.0.0': v({ c: '^2' }), '1.0.0': v({ c: '^1' }) },
  b: { '2.0.0': v({ c: '^1' }), '1.0.0': v({ c: '^2' }) },
  c: plain('1.0.0', '2.0.0'),
};
const ROOT_AB = { dependencies: { a: '*', b: '*' } };

// ---- RES 1, 3, 9: the flat result of a simple tree -----------------------------------------------------

// RES §3 (highest precedence first), §9 (the shape of the result), §1.2 (the root is not a package)
test('a chain of dependencies resolves to the highest versions that fit, in the documented shape', T, async () => {
  const data = {
    a: { '1.0.0': v({ b: '^1.0.0' }), '1.1.0': v({ b: '^1.0.0' }), '2.0.0': v() },
    b: { '1.0.0': v({ c: '1.x' }), '1.2.0': v({ c: '1.x' }) },
    c: plain('1.0.0', '1.4.0', '2.0.0'),
  };
  assert.deepEqual(await solve(data, { dependencies: { a: '^1.0.0' } }), {
    packages: {
      a: { version: '1.1.0', dependencies: { b: '1.2.0' } },
      b: { version: '1.2.0', dependencies: { c: '1.4.0' } },
      c: { version: '1.4.0', dependencies: {} },
    },
  });
  assert.deepEqual(await solve(data, {}), { packages: {} });
});

// RES §3: the highest version that satisfies every constraint on the name
test('two packages that need the same one share the highest version that fits both', T, async () => {
  const data = {
    a: { '1.0.0': v({ d: '^1.0.0' }) },
    b: { '1.0.0': v({ d: '>=1.1.0 <2.0.0' }) },
    d: plain('1.0.0', '1.1.0', '1.5.0', '2.0.0'),
  };
  assert.deepEqual(versions(await solve(data, ROOT_AB)), { a: '1.0.0', b: '1.0.0', d: '1.5.0' });
});

// RES §1.4: versions are ordered by `compare()` and a prerelease only matches a range that names one
test('a prerelease is chosen only when the range names a prerelease of that version', T, async () => {
  const data = { p: plain('1.0.0', '1.1.0-beta.1', '1.1.0-beta.2', '2.0.0-rc.1') };
  assert.equal((await solve(data, { dependencies: { p: '*' } })).packages.p.version, '1.0.0');
  assert.equal((await solve(data, { dependencies: { p: '^1.1.0-beta.1' } })).packages.p.version, '1.1.0-beta.2');
});

// ---- RES 2, 3, 4, 5: constraints and candidates --------------------------------------------------------

// RES §2 and §3: a name must satisfy every constraint on it, so the later range limits the choice
test('the ranges of two packages on one name are intersected', T, async () => {
  const data = {
    a: { '1.0.0': v({ c: '^1' }) },
    b: { '1.0.0': v({ c: '<1.5.0' }) },
    c: plain('1.0.0', '1.4.0', '1.6.0'),
  };
  assert.deepEqual(versions(await solve(data, ROOT_AB)), { a: '1.0.0', b: '1.0.0', c: '1.4.0' });
});

// RES §4: `a` is decided first and takes 2.0.0, then `b` takes 2.0.0 and `c` has no candidate (RES §10)
test('the search goes alphabetically, takes the highest candidate first and backtracks to the latest decision', T, async () => {
  assert.deepEqual(versions(await solve(CROSSED, ROOT_AB)), { a: '2.0.0', b: '1.0.0', c: '2.0.0' });
});

// RES §4 (next name): `a` becomes eligible when `b` is chosen and is then the alphabetically first, ahead of `c`
test('a name is decided as soon as a chosen package needs it, if it comes first alphabetically', T, async () => {
  const data = {
    b: { '1.0.0': v({ a: '*' }) },
    a: { '2.0.0': v({ c: '^1' }), '1.0.0': v({ c: '^2' }) },
    c: plain('1.0.0', '2.0.0'),
  };
  assert.deepEqual(versions(await solve(data, { dependencies: { b: '*', c: '*' } })), { a: '2.0.0', b: '1.0.0', c: '1.0.0' });
});

// RES §5: a candidate whose constraint a decided package fails is rejected and the next one is tried
test('a candidate that a chosen package does not satisfy is rejected', T, async () => {
  const data = {
    a: plain('1.0.0', '2.0.0'),
    b: { '2.0.0': v({ a: '^1' }), '1.0.0': v() },
  };
  assert.deepEqual(versions(await solve(data, ROOT_AB)), { a: '2.0.0', b: '1.0.0' });
});

// RES §5: a package counts as chosen at its own candidate, so a cycle has to agree with itself
test('a cycle resolves, and a cycle whose ranges disagree with the chosen version is rejected', T, async () => {
  const cycle = { a: { '1.0.0': v({ b: '^1' }) }, b: { '1.0.0': v({ a: '^1' }) } };
  assert.deepEqual(versions(await solve(cycle, { dependencies: { a: '*' } })), { a: '1.0.0', b: '1.0.0' });
  const data = { a: { '2.0.0': v({ b: '^1' }), '1.0.0': v({ b: '^1' }) }, b: { '1.0.0': v({ a: '^1' }) } };
  assert.deepEqual(versions(await solve(data, { dependencies: { a: '*' } })), { a: '1.0.0', b: '1.0.0' });
});

// ---- RES 4: backtracking --------------------------------------------------------------------------------

// RES §4: a dead end at `c` returns the search to the latest decision, `b`, which has another alternative
test('backtracking one level takes the next version of the latest decision', T, async () => {
  const data = {
    a: { '1.0.0': v({ c: '^2' }) },
    b: { '2.0.0': v({ c: '^1' }), '1.0.0': v({ c: '^2' }) },
    c: plain('1.0.0', '2.0.0'),
  };
  assert.deepEqual(versions(await solve(data, ROOT_AB)), { a: '1.0.0', b: '1.0.0', c: '2.0.0' });
});

// RES §4: `b` has no other alternative, so the turn of `b` fails and the search returns to `a`
test('backtracking skips a decision that has no alternative left', T, async () => {
  const data = {
    a: { '2.0.0': v({ b: '*' }), '1.0.0': v() },
    b: { '1.0.0': v({ c: '^9' }) },
    c: plain('1.0.0'),
  };
  assert.deepEqual(await solve(data, { dependencies: { a: '*' } }), { packages: { a: { version: '1.0.0', dependencies: {} } } });
});

// RES §4: the same, three decisions deep
test('backtracking can undo a chain of decisions', T, async () => {
  const data = {
    a: { '2.0.0': v({ b: '*' }), '1.0.0': v() },
    b: { '1.0.0': v({ c: '*' }) },
    c: { '1.0.0': v({ d: '^9' }) },
    d: plain('1.0.0'),
  };
  assert.deepEqual(versions(await solve(data, { dependencies: { a: '*' } })), { a: '1.0.0' });
});

// ---- RES 8: errors ---------------------------------------------------------------------------------------

// RES §8 ECONFLICT, §10: every dead end is on `c`
test('a tree nobody can satisfy is an ECONFLICT', T, async () => {
  const data = { a: { '1.0.0': v({ c: '1' }) }, b: { '1.0.0': v({ c: '2' }) }, c: plain('1.0.0', '2.0.0') };
  assertError(await failure(data, ROOT_AB), { code: 'ECONFLICT', package: 'c' });
});

// RES §8: ENOVERSION is only for the root's dependencies; below the root the same situation is a dead end
test('a dependency of a package that is not in the registry is an ECONFLICT, not an ENOVERSION', T, async () => {
  const data = { a: { '1.0.0': v({ zzz: '*' }) } };
  assertError(await failure(data, { dependencies: { a: '*' } }), { code: 'ECONFLICT', package: 'zzz' });
});

// RES §3 (yanked), §8: the only version of `b` is yanked, so `b` has no candidate
test('a dependency whose only version is yanked is an ECONFLICT', T, async () => {
  const data = { a: { '1.0.0': v({ b: '*' }) }, b: { '1.0.0': v({}, { yanked: true }) } };
  assertError(await failure(data, { dependencies: { a: '*' } }), { code: 'ECONFLICT', package: 'b' });
});

// RES §8 ENOVERSION: `package`, `range` and `requiredBy: '<root>'`
test('a root dependency no version satisfies is an ENOVERSION with its details', T, async () => {
  const error = await failure({ x: plain('1.0.0', '2.0.0') }, { dependencies: { x: '^3.0.0' } });
  assertError(error, { code: 'ENOVERSION', package: 'x', range: '^3.0.0', requiredBy: '<root>' });
});

// RES §8 ENOVERSION: the root's dependencies are checked in ascending order of name
test('with several unsatisfiable root dependencies the alphabetically first is reported', T, async () => {
  const data = { zeta: plain('1.0.0'), alpha: plain('1.0.0') };
  assertError(await failure(data, { dependencies: { zeta: '^9', alpha: '^9' } }), { code: 'ENOVERSION', package: 'alpha' });
});

// RES §8 ENOVERSION: candidates exclude yanked versions
test('a root dependency whose only matching version is yanked is an ENOVERSION', T, async () => {
  const data = { a: { '1.0.0': v({}, { yanked: true }), '2.0.0': v() } };
  assertError(await failure(data, { dependencies: { a: '^1' } }), { code: 'ENOVERSION', package: 'a', range: '^1' });
});

// ---- RES 3: yanked versions ------------------------------------------------------------------------------

// RES §3: candidates are not yanked
test('a yanked version is never chosen unless it is locked', T, async () => {
  const data = {
    a: { '1.0.0': v(), '1.1.0': v(), '1.2.0': v({}, { yanked: true }) },
    b: { '1.0.0': v({ a: '^1' }) },
  };
  assert.deepEqual(versions(await solve(data, { dependencies: { b: '*' } })), { a: '1.1.0', b: '1.0.0' });
});

// ---- RES 7: the lock -------------------------------------------------------------------------------------

// RES §3 and §7: the locked version comes first, though it is not the highest; one that fails a constraint
// or is not in the registry is not a candidate; names the search does not decide are not in the result
test('a locked version is preferred when it fits, ignored when it does not, and dropped when unused', T, async () => {
  const data = { a: plain('1.0.0', '1.1.0', '2.0.0') };
  const root = { dependencies: { a: '^1' } };
  assert.deepEqual(versions(await solve(data, root, { lock: lockOf({ a: '1.0.0', zzz: '9.9.9' }) })), { a: '1.0.0' });
  assert.equal((await solve(data, root, { lock: lockOf({ a: '2.0.0' }) })).packages.a.version, '1.1.0');
  assert.equal((await solve(data, root, { lock: lockOf({ a: '1.5.0' }) })).packages.a.version, '1.1.0');
});

// RES §3 and §7: a locked version is exempt from the yanked rule, also for the ENOVERSION check (§8)
test('a yanked version that is locked is kept', T, async () => {
  const data = { a: { '1.0.0': v(), '1.1.0': v({}, { yanked: true }), '1.2.0': v() } };
  assert.equal((await solve(data, { dependencies: { a: '^1' } }, { lock: lockOf({ a: '1.1.0' }) })).packages.a.version, '1.1.0');
  const only = { a: { '1.0.0': v({}, { yanked: true }) } };
  assert.equal((await solve(only, { dependencies: { a: '^1' } }, { lock: lockOf({ a: '1.0.0' }) })).packages.a.version, '1.0.0');
});

// RES §7: the lock is preferred, never forced: another package's constraint can rule the locked version out
test('a locked version gives way to the constraints of other packages', T, async () => {
  const data = { a: plain('1.0.0', '1.1.0', '1.2.0'), b: { '1.0.0': v({ a: '<1.2.0' }) } };
  const result = await solve(data, { dependencies: { a: '^1', b: '*' } }, { lock: lockOf({ a: '1.2.0' }) });
  assert.deepEqual(versions(result), { a: '1.1.0', b: '1.0.0' });
});

// ---- optional dependencies (RES §2, §4, §5, §8) ---------------------------------------------------------

// RES §2 and §4: an optional dependency that can be resolved is installed
test('an optional dependency that resolves is in the result', T, async () => {
  const result = await solve({ o: plain('1.0.0', '2.0.0') }, { optionalDependencies: { o: '^1' } });
  assert.deepEqual(versions(result), { o: '1.0.0' });
});

// RES §4 (absent): an optional dependency with no candidate is left out without an error, and the
// optional dependencies of the root are not checked for ENOVERSION (§8)
test('an optional root dependency nobody can satisfy is skipped', T, async () => {
  const data = { a: plain('1.0.0'), o: plain('1.0.0') };
  const result = await solve(data, { dependencies: { a: '1' }, optionalDependencies: { o: '^9' } });
  assert.deepEqual(result, { packages: { a: { version: '1.0.0', dependencies: {} } } });
});

// RES §4 (absent) and §9: a skipped optional dependency is not listed under its package
test('an optional dependency of a package that cannot be resolved is skipped and not listed', T, async () => {
  const data = {
    a: { '1.0.0': v({ b: '1' }, { optionalDependencies: { o: '^9' } }) },
    b: plain('1.0.0'),
    o: plain('1.0.0'),
  };
  const result = await solve(data, { dependencies: { a: '1' } });
  assert.deepEqual(result.packages.a, { version: '1.0.0', dependencies: { b: '1.0.0' } });
  assert.deepEqual(Object.keys(result.packages), ['a', 'b']);
});

// RES §2 and §4: a name that any package requires is required, so it is never skipped
test('an optional dependency that another package requires is not skipped', T, async () => {
  const data = {
    a: { '1.0.0': v({}, { optionalDependencies: { o: '^9' } }) },
    b: { '1.0.0': v({ o: '^9' }) },
    o: plain('1.0.0'),
  };
  assertError(await failure(data, ROOT_AB), { code: 'ECONFLICT', package: 'o' });
});

// RES §4: after every candidate of an optional name has failed, the name is absent, and RES §10 example 2
test('an optional dependency whose own dependencies cannot be resolved is left out', T, async () => {
  const data = {
    a: { '1.0.0': v({}, { optionalDependencies: { o: '1' } }) },
    o: { '1.0.0': v({ x: '1' }) },
  };
  assert.deepEqual(await solve(data, { dependencies: { a: '1' } }), { packages: { a: { version: '1.0.0', dependencies: {} } } });
});

// RES §2: an optional constraint restricts its name like any other, whatever order the manifests list it in
test('an optional constraint limits the version of a name another package requires', T, async () => {
  const data = {
    b: { '1.0.0': v({ o: '*' }) },
    a: { '1.0.0': v({}, { optionalDependencies: { o: '^1' } }) },
    o: plain('1.0.0', '2.0.0'),
  };
  const result = await solve(data, { dependencies: { b: '*', a: '*' } });
  assert.deepEqual(versions(result), { a: '1.0.0', b: '1.0.0', o: '1.0.0' });
  assert.deepEqual(result.packages.a.dependencies, { o: '1.0.0' });
});

// RES §5: the constraints of a candidate are checked against the chosen packages, optional ones included
test('a candidate whose optional dependency disagrees with a chosen package is rejected', T, async () => {
  const data = {
    x: { '2.0.0': v({}, { optionalDependencies: { lib: '^2' } }), '1.0.0': v() },
    lib: plain('1.0.0', '2.0.0'),
  };
  const result = await solve(data, { dependencies: { x: '*', lib: '^1' } });
  assert.deepEqual(result.packages, { lib: { version: '1.0.0', dependencies: {} }, x: { version: '1.0.0', dependencies: {} } });
});

// RES §5: a name marked absent does not satisfy a required constraint, but does satisfy an optional one
test('a candidate that requires a name left out of the result is rejected, one that only prefers it is not', T, async () => {
  const data = {
    a: { '1.0.0': v({}, { optionalDependencies: { o: '^9' } }) },
    o: plain('1.0.0'),
    y: { '1.0.0': v({}, { optionalDependencies: { o: '*' } }) },
    z: { '2.0.0': v({ o: '*' }), '1.0.0': v() },
  };
  const result = await solve(data, { dependencies: { a: '*', y: '*', z: '*' } });
  assert.deepEqual(versions(result), { a: '1.0.0', y: '1.0.0', z: '1.0.0' });
  assert.deepEqual(result.packages.y.dependencies, {});
});

// ---- RES 6: peer dependencies ----------------------------------------------------------------------------

// RES §6, §8 EPEER: `package` declares the peer and `peer` is the name that is missing
test('a peer dependency that is not in the result is an EPEER', T, async () => {
  const data = { host: plain('1.0.0'), plugin: { '1.0.0': v({}, { peerDependencies: { host: '^1' } }) } };
  assertError(await failure(data, { dependencies: { plugin: '*' } }), { code: 'EPEER', package: 'plugin', peer: 'host' });
});

// RES §6: an optional peer may be missing, and a peer never adds a package
test('a missing optional peer dependency is fine and adds nothing', T, async () => {
  const data = {
    host: plain('1.0.0'),
    plugin: { '1.0.0': v({}, { peerDependencies: { host: '^1' }, peerDependenciesMeta: { host: { optional: true } } }) },
  };
  const result = await solve(data, { dependencies: { plugin: '*' } });
  assert.deepEqual(result, { packages: { plugin: { version: '1.0.0', dependencies: {} } } });
});

// RES §2, §3: a peer constraint restricts its name; `addon` is decided before `host`
test('a peer constraint limits the version of a name that is required elsewhere', T, async () => {
  const data = {
    addon: { '1.0.0': v({}, { peerDependencies: { host: '^1' } }) },
    host: plain('1.0.0', '1.5.0', '2.0.0'),
  };
  assert.deepEqual(versions(await solve(data, { dependencies: { addon: '*', host: '*' } })), { addon: '1.0.0', host: '1.5.0' });
});

// RES §5: peer constraints are checked against the chosen packages like any other
test('a candidate whose peer dependency disagrees with a chosen package is rejected', T, async () => {
  const data = {
    host: plain('1.0.0', '2.0.0'),
    zplugin: {
      '2.0.0': v({}, { peerDependencies: { host: '^3' } }),
      '1.0.0': v({}, { peerDependencies: { host: '^2' } }),
    },
  };
  assert.deepEqual(versions(await solve(data, { dependencies: { host: '*', zplugin: '*' } })), { host: '2.0.0', zplugin: '1.0.0' });
});

// RES §6: a missing peer is an error after the search, not a reason to go back and choose another version
test('a missing peer dependency does not send the search back to an older version', T, async () => {
  const data = {
    plugin: { '2.0.0': v({}, { peerDependencies: { host: '*' } }), '1.0.0': v() },
    host: plain('1.0.0'),
  };
  assertError(await failure(data, { dependencies: { plugin: '*' } }), { code: 'EPEER', package: 'plugin', peer: 'host' });
});

// RES §6: the alphabetically first package is reported, and among its peers the first name
test('with several missing peers the first package and its first peer are reported', T, async () => {
  const data = {
    p1: { '1.0.0': v({}, { peerDependencies: { h2: '*', h1: '*' } }) },
    p2: { '1.0.0': v({}, { peerDependencies: { h0: '*' } }) },
    h0: plain('1.0.0'),
    h1: plain('1.0.0'),
    h2: plain('1.0.0'),
  };
  assertError(await failure(data, { dependencies: { p2: '*', p1: '*' } }), { code: 'EPEER', package: 'p1', peer: 'h1' });
});

// ---- RES 9: the result -----------------------------------------------------------------------------------

// RES §9: `dependencies` maps the dependencies and optional dependencies that are in the result, not the peers
test('the dependencies of an entry list dependencies and present optional ones, not peers', T, async () => {
  const data = {
    a: { '1.0.0': v({ b: '1' }, { optionalDependencies: { o: '1' }, peerDependencies: { h: '1' } }) },
    b: plain('1.0.0'),
    o: plain('1.0.0'),
    h: plain('1.0.0'),
  };
  const result = await solve(data, { dependencies: { a: '*', h: '*' } });
  assert.deepEqual(result.packages.a, { version: '1.0.0', dependencies: { b: '1.0.0', o: '1.0.0' } });
});

// RES §9: the result and the lockfile do not depend on the order of any object's keys
test('the same input in another key order gives the same lockfile', T, async () => {
  const { serializeLock } = await loadLockfile();
  const data = {
    ...CROSSED,
    d: { '1.0.0': v({}, { optionalDependencies: { gone: '1' } }), '1.1.0': v({ c: '*' }) },
    e: { '1.0.0': v({ d: '1.x' }) },
  };
  const root = { dependencies: { a: '*', b: '*', e: '1' }, optionalDependencies: { gone: '1' } };
  const lock = lockOf({ d: '1.0.0' });
  const first = serializeLock(await solve(data, root, { lock }));
  const second = serializeLock(await solve(reversed(data), reversed(root), { lock: reversed(lock) }));
  assert.equal(second, first);
  assert.deepEqual(versions(JSON.parse(first)), { a: '2.0.0', b: '1.0.0', c: '2.0.0', d: '1.0.0', e: '1.0.0' });
});

// RES §3 to §9 together: yanked versions, a peer dependency that sends the search back, a rejected
// candidate, and optional dependencies that fail or disagree
test('a larger tree combines backtracking, peers, optional dependencies and yanked versions', T, async () => {
  const data = {
    logger: { '1.0.0': v(), '1.1.0': v(), '2.0.0': v({}, { yanked: true }) },
    metrics: { '1.0.0': v({}, { peerDependencies: { logger: '^2' } }) },
    server: {
      '2.2.0': v({ router: '^3', logger: '^1' }, { optionalDependencies: { compression: '^1' } }),
      '2.1.0': v({ router: '^2', logger: '^1' }),
    },
    compression: { '1.0.0': v({ 'zlib-native': '^9' }) },
    router: { '3.0.0': v({ 'path-utils': '^2' }), '2.5.0': v({ 'path-utils': '^1' }) },
    'path-utils': plain('1.0.0', '2.0.0'),
    ui: {
      '1.4.0': v({ router: '^2.0.0' }, { peerDependencies: { theme: '^1' } }),
      '1.3.0': v({ router: '^3.0.0' }, { peerDependencies: { theme: '^1' } }),
    },
    theme: plain('1.0.0', '1.1.0', '2.0.0'),
  };
  const root = { dependencies: { server: '^2', ui: '^1', theme: '*', logger: '*' }, optionalDependencies: { metrics: '^1' } };
  const result = await solve(data, root);
  assert.deepEqual(versions(result), { logger: '1.1.0', 'path-utils': '2.0.0', router: '3.0.0', server: '2.2.0', theme: '1.1.0', ui: '1.3.0' });
  assert.deepEqual(result.packages.server.dependencies, { logger: '1.1.0', router: '3.0.0' });
});

// ---- the command line (README "Use") ---------------------------------------------------------------------

const APP = { dependencies: { a: '^1' } };
const REGISTRY = { a: { '1.0.0': { dependencies: { b: '^2' } } }, b: { '2.0.0': {}, '2.1.0': {} } };

// README "Use" and "Lockfile": the lockfile on stdout, exit code 0
test('the command prints the lockfile on stdout and exits 0', CLI, () => {
  const run = runCli({ 'app.json': APP, 'registry.json': REGISTRY }, ['app.json', '--registry', 'registry.json']);
  assert.equal(run.code, 0, run.err);
  assert.equal(
    run.out,
    [
      '{',
      '  "lockfileVersion": 1,',
      '  "packages": {',
      '    "a": {',
      '      "version": "1.0.0",',
      '      "dependencies": {',
      '        "b": "2.1.0"',
      '      }',
      '    },',
      '    "b": {',
      '      "version": "2.1.0",',
      '      "dependencies": {}',
      '    }',
      '  }',
      '}',
      '',
    ].join('\n'),
  );
});

// README "Use": `--lock` passes the earlier lockfile; RES §7: a locked version that no constraint rules out wins
test('the command honours a lockfile given with --lock', CLI, () => {
  const lock = JSON.stringify({ lockfileVersion: 1, packages: { b: { version: '2.0.0', dependencies: {} } } });
  const run = runCli({ 'app.json': APP, 'registry.json': REGISTRY, 'pinpoint.lock': lock }, ['app.json', '--registry', 'registry.json', '--lock', 'pinpoint.lock']);
  assert.equal(run.code, 0, run.err);
  assert.equal(JSON.parse(run.out).packages.b.version, '2.0.0');
  assert.equal(JSON.parse(run.out).packages.a.dependencies.b, '2.0.0');
});

// README "Use": exit 1 and `error <CODE>: <message>` on stderr; RES §8 gives the code (ENOVERSION for a root
// dependency nothing satisfies, ECONFLICT below the root)
test('the command reports an error as `error <CODE>: <message>` with exit code 1', CLI, () => {
  const args = ['app.json', '--registry', 'registry.json'];
  const missing = { a: { '1.0.0': { dependencies: { zzz: '*' } } } };
  const conflict = runCli({ 'app.json': { dependencies: { a: '*' } }, 'registry.json': missing }, args);
  assert.equal(conflict.code, 1);
  assert.match(conflict.err, /^error ECONFLICT: /);
  assert.equal(conflict.out, '');
  const unmet = runCli({ 'app.json': { dependencies: { a: '^7' } }, 'registry.json': REGISTRY }, args);
  assert.equal(unmet.code, 1);
  assert.match(unmet.err, /^error ENOVERSION: /);
});

// README "Use" and RES §4: the command resolves with backtracking too
test('the command resolves a tree that needs backtracking', CLI, () => {
  const run = runCli({ 'app.json': ROOT_AB, 'registry.json': CROSSED }, ['app.json', '--registry', 'registry.json']);
  assert.equal(run.code, 0, run.err);
  assert.deepEqual(versions(JSON.parse(run.out)), { a: '2.0.0', b: '1.0.0', c: '2.0.0' });
});

// README "Use": exit 2 for a usage problem
test('the command exits 2 when its arguments are missing', CLI, () => {
  const files = { 'app.json': APP, 'registry.json': REGISTRY };
  assert.equal(runCli(files, []).code, 2);
  assert.equal(runCli(files, ['app.json']).code, 2);
  assert.equal(runCli(files, ['--registry', 'registry.json']).code, 2);
  assert.equal(runCli(files, ['app.json', '--registry', 'missing.json']).code, 2);
});

// ---- guards ------------------------------------------------------------------------------------------------

// The contract is not part of the work.
test('guard: docs/RESOLUTION.md is unchanged', T, () => {
  assert.equal(sha256('../docs/RESOLUTION.md'), '04fa4642628aaa8d93aed6b4b2d325371831fd5a300b484273e39e2058d709e9');
});

// Definition of done: the project's own tests are green when the work ends.
test("the project's own test suite passes", { timeout: 30000 }, () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_TEST_CONTEXT'));
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/**/*.spec.mjs'], {
    cwd: new URL('..', import.meta.url),
    env,
    encoding: 'utf8',
    timeout: 25000,
  });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /^# tests [1-9]\d*$/m);
});
