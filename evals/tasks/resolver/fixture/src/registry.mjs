const defaults = () => ({ dependencies: {}, optionalDependencies: {}, peerDependencies: {}, peerDependenciesMeta: {}, yanked: false });

/**
 * A read-only view of `data`, an object shaped `{ name: { version: manifest } }`. `versions(name)` lists
 * the versions of a package in no particular order, and none for a name the registry does not know.
 * `manifest(name, version)` returns the manifest with every missing field filled in.
 */
export function createRegistry(data) {
  const releases = (name) => (Object.hasOwn(data, name) ? data[name] : {});
  return {
    versions: (name) => Object.keys(releases(name)),
    manifest(name, version) {
      if (!Object.hasOwn(releases(name), version)) throw new RangeError(`${name}@${version} is not in the registry`);
      return { ...defaults(), ...releases(name)[version] };
    },
  };
}
