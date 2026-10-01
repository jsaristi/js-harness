import { ResolveError } from './errors.mjs';
import { satisfies } from './range.mjs';
import { compare } from './semver.mjs';

/** The version of `name` to install for `range`: the locked one if it fits, otherwise the highest that does. */
function pick(name, range, registry, lock) {
  const fitting = registry.versions(name).filter((version) => satisfies(version, range));
  const locked = lock?.packages?.[name]?.version;
  if (locked !== undefined && fitting.includes(locked)) return locked;
  return fitting.sort((a, b) => compare(b, a))[0];
}

const dependenciesOf = (manifest) => ({ ...manifest.optionalDependencies, ...manifest.dependencies });

/**
 * Resolves `rootManifest` (`{ dependencies, optionalDependencies }`) against `registry` to
 * `{ packages: { name: { version, dependencies } } }`. The first range a name is met with decides its
 * version, and a name already chosen is never reconsidered.
 * @param {{ lock?: { packages: Record<string, { version: string }> } }} [options] `lock` is what `parseLock` returns.
 */
export function resolve(rootManifest, registry, options = {}) {
  const { lock } = options;
  const chosen = new Map();
  const queue = Object.entries(dependenciesOf(rootManifest)).map(([name, range]) => ({ name, range, requiredBy: '<root>' }));
  for (let index = 0; index < queue.length; index += 1) {
    const { name, range, requiredBy } = queue[index];
    if (chosen.has(name)) {
      if (!satisfies(chosen.get(name), range)) {
        throw new ResolveError('ECONFLICT', `${requiredBy} needs ${name}@${range} but ${chosen.get(name)} is chosen`, { package: name });
      }
      continue;
    }
    const version = pick(name, range, registry, lock);
    if (version === undefined) throw new ResolveError('ENOVERSION', `no version of ${name} satisfies ${range}`, { package: name, range, requiredBy });
    chosen.set(name, version);
    for (const [dependency, dependencyRange] of Object.entries(dependenciesOf(registry.manifest(name, version)))) {
      queue.push({ name: dependency, range: dependencyRange, requiredBy: name });
    }
  }
  const packages = {};
  for (const name of [...chosen.keys()].sort()) {
    const dependencies = Object.keys(dependenciesOf(registry.manifest(name, chosen.get(name)))).sort();
    packages[name] = { version: chosen.get(name), dependencies: Object.fromEntries(dependencies.map((dependency) => [dependency, chosen.get(dependency)])) };
  }
  return { packages };
}
