// The places a session is kept off (odd/tasks/f8-s10-port.md, T5): the patterns `guard` refuses a file tool on, read
// the way the denies of Claude Code's settings read them, at any depth of the path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUARDED_PLACES, PERMISSIONS_DENY, deniedPlace } from './deny-paths.mjs';

test('every place of a Read deny is guarded, with the login file beside them', () => {
  const reads = PERMISSIONS_DENY.filter((entry) => entry.startsWith('Read(')).map((entry) => entry.slice(5, -1));
  assert.deepEqual(GUARDED_PLACES, [...reads, '.credentials.json']);
  assert.deepEqual(PERMISSIONS_DENY.filter((entry) => entry.startsWith('Edit(')).map((entry) => entry.slice(5, -1)), reads);
});

test('a secret\'s place is found at any depth, on either slash, in any case', () => {
  const cases = [
    ['D:\\project\\.env', '.env'],
    ['/home/u/app/.env.local', '.env.*'],
    ['C:\\Users\\u\\.ssh\\id_ed25519', '.ssh/*'],
    ['/home/u/.credentials/token', '.credentials/*'],
    ['/Users/u/Library/Keychains/login.keychain-db', 'Library/Keychains/*'],
    ['C:/Users/u/.aws/credentials', '.aws/credentials'],
    ['/home/u/.config/gh/hosts.yml', '.config/gh/hosts.yml'],
    ['D:/certs/deep/server.PEM', '**/*.pem'],
    ['/srv/tls/private.key', '**/*.key'],
    ['D:/app/config/secrets/db.json', '**/secrets/*'],
    ['C:\\Users\\u\\.claude\\.credentials.json', '.credentials.json'],
    ['.env', '.env'],
  ];
  for (const [file, place] of cases) assert.equal(deniedPlace(file), place, file);
});

test('a path that only resembles a secret\'s place is not refused', () => {
  for (const file of ['D:/project/bin/lib/settings-key.mjs', 'D:/project/.envrc', 'D:/project/docs/env.md', 'D:/project/.ssh', 'D:/project/keys.md',
    'D:/project/secrets.md', 'D:/project/a.key.md', 'C:/Users/u/.claude/credentials.md', 'D:/project/.aws/config', '', undefined]) {
    assert.equal(deniedPlace(file), null, String(file));
  }
});
