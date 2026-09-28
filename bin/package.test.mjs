import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

// pnpm refuses to install a git-hosted package that runs build scripts unless it is allowlisted
// by its full git URL and commit (ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED), and npm clones and runs
// them on every git-spec install. js-harness has nothing to build, so it declares none.
test('the package declares no script that runs when it is installed', () => {
  const installTime = ['preinstall', 'install', 'postinstall', 'prepare', 'preprepare', 'postprepare', 'prepack', 'postpack'];
  const found = installTime.filter((name) => pkg.scripts && name in pkg.scripts);
  assert.deepEqual(found, []);
});
