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
  // R3-install-script-list-incomplete (accepted T1 review follow-up): `prepublish` is a legacy
  // npm lifecycle script (superseded by `prepublishOnly`) but npm still runs it, so it belongs on
  // this list too even though this package declares none of them.
  const installTime = [
    'preinstall',
    'install',
    'postinstall',
    'prepare',
    'preprepare',
    'postprepare',
    'prepack',
    'postpack',
    'prepublish',
  ];
  const found = installTime.filter((name) => pkg.scripts && name in pkg.scripts);
  assert.deepEqual(found, []);
});

// The two ported skills are under Apache-2.0, whose section 4(a) asks that whoever receives them gets a copy of the
// license: the package ships the notices that hold it (odd/tasks/f8-s10-port.md, T3).
test('the package ships THIRD_PARTY_NOTICES.md, which holds the Apache-2.0 text and the MIT notice of what it ports', () => {
  assert.ok(pkg.files.includes('THIRD_PARTY_NOTICES.md'));
  const notices = fs.readFileSync(path.join(path.dirname(pkgPath), 'THIRD_PARTY_NOTICES.md'), 'utf8');
  assert.match(notices, /Apache License\s+Version 2\.0, January 2004/);
  assert.match(notices, /END OF TERMS AND CONDITIONS/);
  assert.match(notices, /MIT License, Copyright \(c\) 2025 Gentleman Programming/);
  for (const ported of ['bin/lib/lens-prompts.mjs', 'bin/lib/ported-skills.mjs']) assert.ok(notices.includes(ported), ported);
});
