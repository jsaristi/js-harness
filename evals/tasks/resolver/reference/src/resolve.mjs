import { ResolveError } from './errors.mjs';
import { satisfies } from './range.mjs';
import { compare } from './semver.mjs';

/** What a name is marked with when the search leaves it out of the result. */
const ABSENT = Symbol('absent');

/** The constraints a manifest brings, as `{ name, range, kind }` with `kind` required, optional or peer. */
function constraintsOf({ dependencies = {}, optionalDependencies = {}, peerDependencies = {} }) {
  const of = (entries, kind) => Object.entries(entries).map(([name, range]) => ({ name, range, kind }));
  return [...of(dependencies, 'required'), ...of(optionalDependencies, 'optional'), ...of(peerDependencies, 'peer')];
}

/**
 * Resolves `rootManifest` (`{ dependencies, optionalDependencies }`) against `registry` to
 * `{ packages: { name: { version, dependencies } } }`, as docs/RESOLUTION.md describes: a depth-first search
 * that tries the candidates of one name at a time and backtracks over the choices that lead nowhere.
 * @param {{ lock?: { packages: Record<string, { version: string }> } }} [options] `lock` is what `parseLock` returns.
 */
export function resolve(rootManifest, registry, options = {}) {
  const { lock } = options;
  const rootConstraints = constraintsOf(rootManifest);
  const lockedVersion = (name) => lock?.packages?.[name]?.version;

  /** The versions of `name` that satisfy `constraints`, the locked one first, then the highest first. */
  const candidatesOf = (name, constraints) => {
    const locked = lockedVersion(name);
    const fitting = registry
      .versions(name)
      .filter((version) => constraints.every(({ range }) => satisfies(version, range)))
      .filter((version) => version === locked || !registry.manifest(name, version).yanked)
      .sort((a, b) => compare(b, a));
    return fitting.includes(locked) ? [locked, ...fitting.filter((version) => version !== locked)] : fitting;
  };

  const rootDependencies = rootManifest.dependencies ?? {};
  for (const name of Object.keys(rootDependencies).sort()) {
    const range = rootDependencies[name];
    if (candidatesOf(name, [{ range }]).length === 0) {
      throw new ResolveError('ENOVERSION', `no version of ${name} satisfies ${range}`, { package: name, range, requiredBy: '<root>' });
    }
  }

  const decided = new Map();
  const active = new Map();
  let deadEnd = null;

  const add = (constraints) => {
    for (const constraint of constraints) active.set(constraint.name, [...(active.get(constraint.name) ?? []), constraint]);
  };
  const withdraw = (constraints) => {
    for (const constraint of constraints) active.set(constraint.name, active.get(constraint.name).slice(0, -1));
  };
  const holds = ({ name, range, kind }) => {
    if (!decided.has(name)) return true;
    const version = decided.get(name);
    return version === ABSENT ? kind !== 'required' : satisfies(version, range);
  };
  const nextName = () => {
    let next = null;
    for (const [name, constraints] of active) {
      if (!decided.has(name) && constraints.some(({ kind }) => kind !== 'peer') && (next === null || name < next)) next = name;
    }
    return next;
  };

  /** Decides the names one after another; true when every name is decided, false when none of the choices works. */
  function search() {
    const name = nextName();
    if (name === null) return true;
    const constraints = active.get(name);
    const required = constraints.some(({ kind }) => kind === 'required');
    let accepted = false;
    for (const version of candidatesOf(name, constraints)) {
      const own = constraintsOf(registry.manifest(name, version));
      decided.set(name, version);
      if (own.every(holds)) {
        accepted = true;
        add(own);
        if (search()) return true;
        withdraw(own);
      }
      decided.delete(name);
    }
    if (!required) {
      decided.set(name, ABSENT);
      if (search()) return true;
      decided.delete(name);
    } else if (!accepted) {
      deadEnd = name;
    }
    return false;
  }

  add(rootConstraints);
  if (!search()) throw new ResolveError('ECONFLICT', `no assignment satisfies every constraint, the last dead end is ${deadEnd}`, { package: deadEnd });

  const chosen = new Map([...decided].filter(([, version]) => version !== ABSENT));
  const names = [...chosen.keys()].sort();
  for (const name of names) {
    const { peerDependencies, peerDependenciesMeta } = registry.manifest(name, chosen.get(name));
    const missing = Object.keys(peerDependencies).sort().find((peer) => !chosen.has(peer) && peerDependenciesMeta[peer]?.optional !== true);
    if (missing !== undefined) throw new ResolveError('EPEER', `${name} needs ${missing}, which is not in the result`, { package: name, peer: missing });
  }
  const entryOf = (name) => {
    const { dependencies, optionalDependencies } = registry.manifest(name, chosen.get(name));
    const listed = Object.keys({ ...dependencies, ...optionalDependencies }).filter((dependency) => chosen.has(dependency)).sort();
    return [name, { version: chosen.get(name), dependencies: Object.fromEntries(listed.map((dependency) => [dependency, chosen.get(dependency)])) }];
  };
  const packages = Object.fromEntries(names.map(entryOf));
  return { packages };
}
