import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  components,
  entryComponents,
  sha256,
  manifestPath,
  readManifest,
  install,
  sync,
  uninstall,
} from './manifest.mjs';
import { cachePath, writeCache } from './cache.mjs';

function makeTmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-home-'));
}

function readJson(target) {
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

const [claudeHook, codexHook] = entryComponents;

test('sha256 is deterministic', () => {
  assert.equal(sha256('abc'), sha256('abc'));
  assert.notEqual(sha256('abc'), sha256('abd'));
});

test('install writes every component and records a manifest', () => {
  const home = makeTmpHome();
  try {
    const manifest = install(home, '0.1.0');
    assert.equal(manifest.version, '0.1.0');
    assert.equal(manifest.files.length, components.length);

    for (const component of components) {
      const target = component.target(home);
      assert.ok(fs.existsSync(target), `expected ${target} to exist`);
      const content = fs.readFileSync(target, 'utf8');
      assert.equal(content, component.content('0.1.0'));
      assert.match(content, /^---\nname: js-harness\ndescription: .+\n---/);
    }

    const onDisk = readManifest(home);
    assert.deepEqual(onDisk, manifest);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('install writes the Claude and Codex skill files at the documented paths', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    assert.ok(fs.existsSync(path.join(home, '.claude', 'skills', 'js-harness', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(home, '.codex', 'skills', 'js-harness', 'SKILL.md')));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('sync rewrites components for the current version and updates the manifest', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const manifest = sync(home, '0.2.0');
    assert.equal(manifest.version, '0.2.0');
    for (const component of components) {
      const content = fs.readFileSync(component.target(home), 'utf8');
      assert.equal(content, component.content('0.2.0'));
    }
    assert.deepEqual(readManifest(home), manifest);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('sync removes a file that the current components no longer ship', () => {
  const home = makeTmpHome();
  try {
    const manifest = install(home, '0.1.0');
    // Simulate an older release that shipped one extra file no longer in `components`.
    const orphanPath = path.join(home, '.claude', 'skills', 'js-harness-old', 'SKILL.md');
    fs.mkdirSync(path.dirname(orphanPath), { recursive: true });
    fs.writeFileSync(orphanPath, 'stale content', 'utf8');
    const staleManifest = {
      version: '0.1.0',
      files: [...manifest.files, { path: orphanPath, sha256: sha256('stale content') }],
    };
    fs.writeFileSync(manifestPath(home), JSON.stringify(staleManifest, null, 2));

    sync(home, '0.2.0');

    assert.equal(fs.existsSync(orphanPath), false);
    assert.equal(fs.existsSync(path.dirname(orphanPath)), false, 'now-empty directory should be removed');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall removes unmodified files, keeps modified ones, and deletes the manifest', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const [claudeComponent, codexComponent] = components;
    // The user edited the codex copy; uninstall must keep it.
    fs.writeFileSync(codexComponent.target(home), 'user was here', 'utf8');

    const result = uninstall(home);

    assert.equal(fs.existsSync(claudeComponent.target(home)), false);
    assert.equal(fs.existsSync(codexComponent.target(home)), true);
    assert.deepEqual(result.removed, [claudeComponent.target(home)]);
    assert.deepEqual(result.kept, [codexComponent.target(home)]);
    assert.equal(fs.existsSync(manifestPath(home)), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall removes now-empty directories it created', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    uninstall(home);
    assert.equal(fs.existsSync(path.join(home, '.claude', 'skills', 'js-harness')), false);
    assert.equal(fs.existsSync(path.join(home, '.codex', 'skills', 'js-harness')), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall on a home with no manifest is a no-op', () => {
  const home = makeTmpHome();
  try {
    const result = uninstall(home);
    assert.deepEqual(result, { removed: [], kept: [], entriesRemoved: [], entriesKept: [] });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- T4: entry-level manifest records (install registers one hook entry per host) ---

test('entryComponents declare the SessionStart hook for Claude and Codex', () => {
  assert.equal(claudeHook.id, 'claude-hook');
  assert.deepEqual(claudeHook.pointer, ['hooks', 'SessionStart']);
  assert.deepEqual(claudeHook.target('/h'), path.join('/h', '.claude', 'settings.json'));
  assert.equal(codexHook.id, 'codex-hook');
  assert.deepEqual(codexHook.pointer, ['hooks', 'SessionStart']);
  assert.deepEqual(codexHook.target('/h'), path.join('/h', '.codex', 'hooks.json'));

  const entry = claudeHook.entry();
  assert.deepEqual(entry, {
    matcher: 'startup|resume',
    hooks: [{ type: 'command', command: 'js-harness doctor --hook', timeout: 10 }],
  });
  assert.deepEqual(codexHook.entry(), entry);
});

test('install creates a missing hook file from {} and records createdFile: true', () => {
  const home = makeTmpHome();
  try {
    const manifest = install(home, '0.1.0');
    assert.equal(manifest.entries.length, entryComponents.length);

    const claudeTarget = claudeHook.target(home);
    const data = readJson(claudeTarget);
    assert.deepEqual(data, { hooks: { SessionStart: [claudeHook.entry()] } });

    const record = manifest.entries.find((e) => e.path === claudeTarget);
    assert.equal(record.createdFile, true);
    assert.deepEqual(record.pointer, ['hooks', 'SessionStart']);
    assert.deepEqual(record.entry, claudeHook.entry());
    assert.equal(record.sha256, sha256(JSON.stringify(claudeHook.entry())));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('install appends the hook entry to an existing file without disturbing other entries', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const seeded = {
      hooks: {
        SessionStart: [
          { matcher: 'startup|resume|clear|compact', hooks: [{ type: 'command', command: 'echo unrelated', timeout: 5 }] },
        ],
        Stop: [{ hooks: [{ type: 'command', command: 'echo stop', timeout: 5 }] }],
      },
    };
    fs.writeFileSync(target, `${JSON.stringify(seeded, null, 2)}\n`, 'utf8');

    const manifest = install(home, '0.1.0');

    const data = readJson(target);
    assert.equal(data.hooks.SessionStart.length, 2);
    assert.deepEqual(data.hooks.SessionStart[0], seeded.hooks.SessionStart[0]);
    assert.deepEqual(data.hooks.SessionStart[1], claudeHook.entry());
    assert.deepEqual(data.hooks.Stop, seeded.hooks.Stop);

    const record = manifest.entries.find((e) => e.path === target);
    assert.equal(record.createdFile, false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('install preserves 2-space indent, trailing newline and CRLF line endings', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const seeded = { hooks: { SessionStart: [] } };
    const crlfText = `${JSON.stringify(seeded, null, 2)}\n`.replace(/\n/g, '\r\n');
    fs.writeFileSync(target, crlfText, 'utf8');

    install(home, '0.1.0');

    const raw = fs.readFileSync(target, 'utf8');
    assert.ok(raw.includes('\r\n'), 'expected CRLF line endings to be preserved');
    assert.ok(!/[^\r]\n/.test(raw), 'expected every newline to be preceded by \\r');
    assert.ok(raw.endsWith('\r\n'), 'expected the trailing newline to be preserved');
    assert.deepEqual(JSON.parse(raw), { hooks: { SessionStart: [claudeHook.entry()] } });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('install does not preserve a trailing newline when the original file had none', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify({ hooks: { SessionStart: [] } }, null, 2), 'utf8');

    install(home, '0.1.0');

    const raw = fs.readFileSync(target, 'utf8');
    assert.ok(!raw.endsWith('\n'), 'expected no trailing newline to be added');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('install is idempotent: a second install adds no duplicate hook entry', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const target = claudeHook.target(home);
    const before = fs.readFileSync(target, 'utf8');

    const manifest = install(home, '0.1.0');

    const after = fs.readFileSync(target, 'utf8');
    assert.equal(after, before, 'a repeat install must not rewrite an already-correct file');
    const data = readJson(target);
    assert.equal(data.hooks.SessionStart.length, 1);
    const record = manifest.entries.find((e) => e.path === target);
    assert.equal(record.createdFile, true, 'createdFile must still be true on the second install');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('install skips a malformed JSON hook file and reports it, without overwriting it', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'not json', 'utf8');

    const manifest = install(home, '0.1.0');

    assert.equal(fs.readFileSync(target, 'utf8'), 'not json', 'malformed file must be left untouched');
    const record = manifest.entries.find((e) => e.path === target);
    assert.equal(record.skipped, true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall removes exactly the deep-equal entry and leaves the rest of the file untouched', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const seeded = {
      hooks: {
        SessionStart: [
          { matcher: 'startup|resume|clear|compact', hooks: [{ type: 'command', command: 'echo unrelated', timeout: 5 }] },
        ],
      },
    };
    fs.writeFileSync(target, `${JSON.stringify(seeded, null, 2)}\n`, 'utf8');

    install(home, '0.1.0');
    const result = uninstall(home);

    assert.ok(result.entriesRemoved.includes(target));
    const data = readJson(target);
    assert.deepEqual(data, seeded);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall deletes a hook file it created once removing our entry leaves it empty', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const target = claudeHook.target(home);
    assert.ok(fs.existsSync(target));

    uninstall(home);

    assert.equal(fs.existsSync(target), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall keeps a hook file untouched and reports it kept when the user removed our entry', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const target = claudeHook.target(home);
    const userEdited = { hooks: { SessionStart: [{ matcher: 'startup', hooks: [{ type: 'command', command: 'user command', timeout: 1 }] }] } };
    fs.writeFileSync(target, JSON.stringify(userEdited, null, 2), 'utf8');

    const result = uninstall(home);

    assert.ok(result.entriesKept.includes(target));
    assert.deepEqual(readJson(target), userEdited);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('sync removes an entry a previous manifest had but the current components no longer declare', () => {
  const home = makeTmpHome();
  try {
    const manifest = install(home, '0.1.0');
    const orphanTarget = path.join(home, '.some-other-host', 'config.json');
    fs.mkdirSync(path.dirname(orphanTarget), { recursive: true });
    const orphanEntry = { matcher: 'x', hooks: [] };
    fs.writeFileSync(orphanTarget, JSON.stringify({ hooks: { SessionStart: [orphanEntry] } }, null, 2), 'utf8');
    const staleManifest = {
      ...manifest,
      entries: [
        ...manifest.entries,
        {
          path: orphanTarget,
          pointer: ['hooks', 'SessionStart'],
          entry: orphanEntry,
          sha256: sha256(JSON.stringify(orphanEntry)),
          createdFile: false,
        },
      ],
    };
    fs.writeFileSync(manifestPath(home), JSON.stringify(staleManifest, null, 2));

    sync(home, '0.2.0');

    assert.deepEqual(readJson(orphanTarget), { hooks: { SessionStart: [] } });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('an old manifest without an entries field still loads for sync and uninstall', () => {
  const home = makeTmpHome();
  try {
    const manifest = install(home, '0.1.0');
    const { entries, ...withoutEntries } = manifest;
    fs.writeFileSync(manifestPath(home), JSON.stringify(withoutEntries, null, 2));

    assert.doesNotThrow(() => sync(home, '0.2.0'));
    assert.doesNotThrow(() => uninstall(home));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall also removes the doctor cache and the now-empty .js-harness directory', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    writeCache(home, { latest: { checkedAt: null, versions: {} }, notified: null });
    assert.ok(fs.existsSync(cachePath(home)));

    uninstall(home);

    assert.equal(fs.existsSync(cachePath(home)), false);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
