import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ResolveError } from '../src/errors.mjs';
import { parseLock, serializeLock } from '../src/lockfile.mjs';
import { createRegistry } from '../src/registry.mjs';

test('a registry lists the versions of a package and fills in the missing manifest fields', () => {
  const registry = createRegistry({ left: { '1.0.0': { dependencies: { right: '^1.0.0' } }, '1.1.0': { yanked: true } } });
  assert.deepEqual(registry.versions('left'), ['1.0.0', '1.1.0']);
  assert.deepEqual(registry.versions('constructor'), []);
  assert.deepEqual(registry.manifest('left', '1.0.0'), {
    dependencies: { right: '^1.0.0' },
    optionalDependencies: {},
    peerDependencies: {},
    peerDependenciesMeta: {},
    yanked: false,
  });
  assert.equal(registry.manifest('left', '1.1.0').yanked, true);
  assert.throws(() => registry.manifest('left', '9.9.9'), RangeError);
});

test('serializeLock sorts the packages and their dependencies and ends with a newline', () => {
  const text = serializeLock({
    packages: {
      zed: { version: '2.0.0', dependencies: {} },
      alpha: { version: '1.0.0', dependencies: { zed: '2.0.0', beta: '1.1.0' } },
    },
  });
  assert.equal(
    text,
    [
      '{',
      '  "lockfileVersion": 1,',
      '  "packages": {',
      '    "alpha": {',
      '      "version": "1.0.0",',
      '      "dependencies": {',
      '        "beta": "1.1.0",',
      '        "zed": "2.0.0"',
      '      }',
      '    },',
      '    "zed": {',
      '      "version": "2.0.0",',
      '      "dependencies": {}',
      '    }',
      '  }',
      '}',
      '',
    ].join('\n'),
  );
});

test('parseLock reads what serializeLock wrote and rejects anything else with ELOCK', () => {
  const result = { packages: { alpha: { version: '1.0.0', dependencies: {} } } };
  assert.deepEqual(parseLock(serializeLock(result)), result);
  for (const text of ['not json', '{}', '{"lockfileVersion":2,"packages":{}}']) {
    assert.throws(() => parseLock(text), (error) => error instanceof ResolveError && error.code === 'ELOCK', text);
  }
});
