# Dependency resolution

This document is normative: `resolve()` in `src/resolve.mjs` must behave exactly as it says. For every
input it covers there is one correct result, and anything it does not say is left open. "Must" is a
requirement.

## 1. Model

1. The result is flat: it holds at most one version of each package name.
2. The root manifest is not a package of the result. It only contributes constraints (section 2).
3. Names are compared as strings with `<`, so "alphabetically first" means the smallest in that order.
4. The precedence of versions is `compare()` of `src/semver.mjs`. A version satisfies a range when
   `satisfies()` of `src/range.mjs` says so, prerelease rule included.
5. A manifest lists a name in at most one of `dependencies`, `optionalDependencies` and
   `peerDependencies`. The root manifest only has the first two. Missing fields are empty.
6. A package version is *yanked* when its manifest says `yanked: true`.

## 2. Constraints

A constraint is a name, a range and a kind: `required` (from `dependencies`), `optional` (from
`optionalDependencies`) or `peer` (from `peerDependencies`). The root contributes its constraints before
the search starts. A package contributes its constraints when it is chosen, and they are withdrawn when
that choice is undone (section 4).

A name is *required* when at least one of its current constraints is `required`.

Every constraint, whatever its kind, restricts the versions its name may take (section 3). The kind
decides only whether a constraint makes a name eligible for a decision and whether the name may end up
absent (section 4). An optional dependency is optional to install, not optional to agree with.

## 3. Candidates

The *candidates* of a name are the registry versions of that name that

- satisfy every current constraint on the name, and
- are not yanked, unless the version is the locked version of the name (section 7),

in this order: the locked version first, if it is a candidate, then the others by descending precedence.

## 4. Search

The search is depth-first and keeps a list of decisions. A decision is a name with a chosen version, or a
name marked *absent*. A name marked absent is not in the result and contributes no constraint.

**Next name.** The next name to decide is the alphabetically first name that has no decision and has at
least one `required` or `optional` constraint from the root or from a chosen package. A `peer`
constraint never makes a name eligible. When there is no such name, the search is complete and its
decisions are the result.

**Turn.** At the turn of a name, the alternatives are its candidates in the order of section 3 and, only
if the name is not required, one more at the end: *absent*. The alternatives are tried in order.

- *Absent* is always accepted. A candidate is accepted when the check of section 5 passes, and rejected
  when it fails.
- An accepted alternative becomes a decision and the search goes on with the next name. If the search
  from there fails, that decision and every decision after it are undone, and the next alternative is
  tried.
- A turn *fails* when it has no alternative left. The search then returns to the previous decision, which
  tries its next alternative. When the first turn fails, the search has failed.

A turn at which no alternative is accepted at all, because the name is required and has no candidate or
because every candidate is rejected, is a *dead end*. A name that is not required is never a dead end.

The result is the first complete assignment this order finds, so it is unique.

## 5. The check of a candidate

When a candidate `c` of name `n` is tried, each constraint `c` brings, on a name `m`, is checked against
the decisions made so far, counting `n` as chosen at `c`:

- `m` is chosen at a version `w`: the constraint holds when `w` satisfies its range, whatever its kind.
- `m` is absent: the constraint holds when it is `optional` or `peer`, and fails when it is `required`.
- `m` has no decision yet: there is nothing to check. The constraint stays, and restricts the candidates
  of `m` when its turn comes.

A candidate is rejected when one of its constraints fails. The constraints of a peer dependency are
checked like the others.

## 6. Peer dependencies

A peer dependency never adds a package: it only restricts a name through the check above and section 3.
After the search completes, every peer dependency of every chosen package must be satisfied by a package
in the result, unless its entry in `peerDependenciesMeta` has `optional: true`. If one is missing,
`resolve()` throws `EPEER`; it does not go back into the search. When several are missing, the one
reported is that of the alphabetically first package, and among its peers the alphabetically first name.
A peer that is in the result always satisfies its range, because of the check.

## 7. The lock

The `lock` option is what `parseLock()` returns, or nothing. The *locked version* of a name is
`lock.packages[name].version`, when the entry exists. The lock only reorders candidates and exempts its
version from the yanked rule (section 3). It never adds a name, never forces a version that is not a
candidate, and its recorded `dependencies` are never read. A locked version that is not in the registry,
or that fails a constraint, is not a candidate. A name of the lock that the search does not decide is not
in the result.

## 8. Errors

Each error is an `Error` with a string `code` and the properties listed here. `resolve()` throws only
these, and checks in this order.

1. **`ENOVERSION`**, before the search. For each name in the root's `dependencies`, in ascending order,
   compute its candidates (section 3, so the lock counts) with the root's own constraint on it as the only
   constraint. The first name with no candidate gives `ENOVERSION` with `package`, `range` and `requiredBy: '<root>'`. Names in
   `optionalDependencies` are never checked.
2. **`ECONFLICT`**, when the search fails. `package` is the name of the last dead end, the one that
   happened latest in the search. It is only meaningful as defined here: it does not point at a cause in
   any other sense.
3. **`EPEER`**, when the search completes and section 6 finds a missing peer. It has `package`, the one
   that declares the peer, and `peer`, the name that is missing.

## 9. The result

`resolve()` returns `{ packages }`. `packages` has an entry for every name with a chosen version, as
`{ version, dependencies }`. `dependencies` maps each name in the chosen manifest's `dependencies` or
`optionalDependencies` that is in the result to its chosen version. A name that is absent is not listed,
and neither are peer dependencies.

The result depends only on the content of the root manifest, the registry and the lock. It does not
depend on the order of the keys of any of them, nor on the order in which the registry lists versions.
Nothing in it is random or depends on the time. Build `packages` and every `dependencies` with their
names in ascending order.

## 10. Examples

**Backtracking.** The root needs `a` and `b`, both `*`. `a@2` needs `c@^2`, `a@1` needs `c@^1`, `b@2`
needs `c@^1` and `b@1` needs `c@^2`; `c` has 1.0.0 and 2.0.0. `a` is decided first and takes 2.0.0, which
puts `c@^2` on `c`. `b` takes 2.0.0, adding `c@^1`. Now `c` is required and has no candidate: a dead end,
so the turn of `c` fails and the search returns to `b`. It undoes `b@2` and tries `b@1`, which puts `c@^2`
on `c`, and then `c` takes 2.0.0. The result is `a@2.0.0`, `b@1.0.0` and `c@2.0.0`.

**An optional dependency that fails.** The root needs `a@1`, whose only version has an optional dependency
`o@1`. The only `o` needs `x@1`, and the registry has no `x`. Turn of `o`: its candidate `o@1.0.0` is
accepted, and `x` becomes eligible. `x` is required and has no candidate, a dead end, so the turn of `o`
moves on to its last alternative, absent, and the search completes. The result holds only `a`, with
`dependencies: {}`.

**Peers.** `plugin@1` has the peer dependency `host@1`. With a root that needs only `plugin`, nothing
adds `host`: `EPEER` with `package: 'plugin'` and `peer: 'host'`. With a root that needs `host@^1` too,
`host` is decided first, and both are in the result.

**Where a conflict ends.** The root needs `a@1` and `b@1`; `a@1.0.0` needs `c@1`, `b@1.0.0` needs `c@2`
and `c` has 1.0.0 and 2.0.0. Every dead end is on `c`, so `ECONFLICT` has `package: 'c'`.
