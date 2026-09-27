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
    assert.equal(record.reason, 'malformed JSON');
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

// --- T4 native review follow-ups (lineage review-41e6050d1d54018f) ---

// R3-001: never overwrite a user value of an unexpected shape along the pointer path.

test('R3-001: install leaves the file untouched and reports skipped when an intermediate key is not an object', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const original = JSON.stringify({ hooks: 'not-an-object' });
    fs.writeFileSync(target, original, 'utf8');

    const manifest = install(home, '0.1.0');

    assert.equal(fs.readFileSync(target, 'utf8'), original, 'expected the file to be byte-for-byte untouched');
    const record = manifest.entries.find((e) => e.path === target);
    assert.equal(record.skipped, true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('R3-001: install leaves the file untouched and reports skipped when the leaf is not an array', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const original = JSON.stringify({ hooks: { SessionStart: 'oops' } });
    fs.writeFileSync(target, original, 'utf8');

    const manifest = install(home, '0.1.0');

    assert.equal(fs.readFileSync(target, 'utf8'), original, 'expected the file to be byte-for-byte untouched');
    const record = manifest.entries.find((e) => e.path === target);
    assert.equal(record.skipped, true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// R3-002: an fs failure on an entry target must not throw out of install/sync; the manifest must
// still be written for whatever was actually written, and createdFile survives a re-install.

test('R3-002: install reports an entry skipped without throwing when the target path is itself a directory', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(target, { recursive: true }); // a directory sits where the file should be

    let manifest;
    assert.doesNotThrow(() => {
      manifest = install(home, '0.1.0');
    });

    const record = manifest.entries.find((e) => e.path === target);
    assert.equal(record.skipped, true);
    // The other entry component (codex-hook) must still be written normally.
    const codexRecord = manifest.entries.find((e) => e.path === codexHook.target(home));
    assert.equal(codexRecord.skipped, false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('R3-002: install reports an entry skipped without throwing when the host directory is itself a plain file', () => {
  const home = makeTmpHome();
  try {
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.rmSync(path.join(home, '.claude'), { recursive: true, force: true });
    fs.writeFileSync(path.join(home, '.claude'), 'this is a file, not a directory', 'utf8');

    let manifest;
    assert.doesNotThrow(() => {
      manifest = install(home, '0.1.0');
    });

    const target = claudeHook.target(home);
    const record = manifest.entries.find((e) => e.path === target);
    assert.equal(record.skipped, true);
    assert.equal(fs.readFileSync(path.join(home, '.claude'), 'utf8'), 'this is a file, not a directory');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('R3-002: createdFile from a previous manifest survives a re-install where the entry target fails', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const target = claudeHook.target(home);
    assert.ok(fs.existsSync(target));
    // Simulate the target becoming unreachable between installs (e.g. replaced by a directory).
    fs.rmSync(target, { force: true });
    fs.mkdirSync(target, { recursive: true });

    const manifest = install(home, '0.1.0');

    const record = manifest.entries.find((e) => e.path === target);
    assert.equal(record.skipped, true, 'this install call could not reach the target');
    assert.equal(record.createdFile, true, 'createdFile must be carried forward from the previous manifest');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// R3-003: uninstall deletes a file it created only when nothing but empty containers along our own
// pointer path remain; any other key, even an empty-valued one, keeps the file.

test('R3-003: uninstall keeps a hook file js-harness created when an unrelated key is left in the document', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const target = claudeHook.target(home);
    const data = readJson(target);
    data.unrelated = {}; // any other key, even an empty-valued one, must keep the file
    fs.writeFileSync(target, JSON.stringify(data, null, 2), 'utf8');

    const result = uninstall(home);

    assert.ok(fs.existsSync(target), 'expected the file to survive because of the unrelated key');
    assert.deepEqual(readJson(target), { hooks: { SessionStart: [] }, unrelated: {} });
    // R3-002 (accepted final review follow-up, lineage review-cef5637e2884c12a): the previous
    // assertion here (`!result.entriesRemoved.includes(target) || fs.existsSync(target)`) was
    // tautological — `fs.existsSync(target)` was already proven true above, so the whole expression
    // was true no matter what `entriesRemoved` held. The real, currently-true behavior it should
    // have proven is that removing our entry is still reported even though the file itself survives
    // (only the unrelated key keeps it on disk).
    assert.ok(
      result.entriesRemoved.includes(target),
      'expected the entry removal to be reported even though the file survives',
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// R3-005: preserve the original file's indentation (and its trailing-newline/CRLF handling) when
// rewriting, rather than always reformatting to 2 spaces.

test('R3-005: install preserves 4-space indentation when appending to an existing hook file', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const seeded = { hooks: { SessionStart: [] } };
    fs.writeFileSync(target, `${JSON.stringify(seeded, null, 4)}\n`, 'utf8');

    install(home, '0.1.0');

    const raw = fs.readFileSync(target, 'utf8');
    assert.equal(raw, `${JSON.stringify({ hooks: { SessionStart: [claudeHook.entry()] } }, null, 4)}\n`);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('R3-005: install preserves tab indentation when appending to an existing hook file', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const seeded = { hooks: { SessionStart: [] } };
    fs.writeFileSync(target, `${JSON.stringify(seeded, null, '\t')}\n`, 'utf8');

    install(home, '0.1.0');

    const raw = fs.readFileSync(target, 'utf8');
    assert.equal(raw, `${JSON.stringify({ hooks: { SessionStart: [claudeHook.entry()] } }, null, '\t')}\n`);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('R3-005: install keeps compact single-line JSON compact when appending', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify({ hooks: { SessionStart: [] } }), 'utf8');

    install(home, '0.1.0');

    const raw = fs.readFileSync(target, 'utf8');
    assert.equal(raw, JSON.stringify({ hooks: { SessionStart: [claudeHook.entry()] } }));
    assert.ok(!raw.includes('\n'), 'expected the rewritten file to stay on one line');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- Final review follow-ups (lineage review-cef5637e2884c12a) ---

// R3-001: a write failure on a component that was already installed must not let the manifest
// forget it — the previous `{ path, sha256 }` record is carried forward (marked `skipped`, with a
// `reason`) so uninstall can still find and remove the real file, and `sync` never treats a
// component that is still declared as "no longer shipped" just because this run could not
// (re)write it. The failure is injected through `deps.writeFile` (a seam) rather than real file
// permissions, since chmod is unreliable on Windows.

test('R3-001: install carries the previous file record forward when writing it fails, and reports it skipped', () => {
  const home = makeTmpHome();
  try {
    const manifest = install(home, '0.1.0');
    const [claudeComponent] = components;
    const target = claudeComponent.target(home);
    const previousRecord = manifest.files.find((f) => f.path === target);

    const failingWriteFile = (writeTarget, ...rest) => {
      if (writeTarget === target) throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      fs.writeFileSync(writeTarget, ...rest);
    };
    const next = install(home, '0.2.0', { writeFile: failingWriteFile });

    const record = next.files.find((f) => f.path === target);
    assert.deepEqual(record, {
      path: target,
      sha256: previousRecord.sha256,
      skipped: true,
      reason: 'EACCES: permission denied',
    });
    assert.equal(
      fs.readFileSync(target, 'utf8'),
      claudeComponent.content('0.1.0'),
      'the real file must be untouched by the failed write',
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('R3-001: sync does not delete a still-declared component whose write failed this run', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const [claudeComponent] = components;
    const target = claudeComponent.target(home);

    const failingWriteFile = (writeTarget, ...rest) => {
      if (writeTarget === target) throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      fs.writeFileSync(writeTarget, ...rest);
    };
    sync(home, '0.2.0', { writeFile: failingWriteFile });

    assert.ok(fs.existsSync(target), 'a component that is still declared must survive a failed rewrite');
    assert.equal(fs.readFileSync(target, 'utf8'), claudeComponent.content('0.1.0'));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('R3-001: install reports no record for a component that has never been written and just failed again', () => {
  const home = makeTmpHome();
  try {
    const [claudeComponent] = components;
    const target = claudeComponent.target(home);
    const failingWriteFile = (writeTarget, ...rest) => {
      if (writeTarget === target) throw new Error('EACCES: permission denied');
      fs.writeFileSync(writeTarget, ...rest);
    };

    const manifest = install(home, '0.1.0', { writeFile: failingWriteFile });

    assert.equal(
      manifest.files.some((f) => f.path === target),
      false,
      'nothing to carry forward on a first-ever failure',
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('R3-005: uninstall preserves 4-space indentation when it rewrites (rather than deletes) the file', () => {
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
    fs.writeFileSync(target, `${JSON.stringify(seeded, null, 4)}\n`, 'utf8');

    install(home, '0.1.0');
    uninstall(home);

    const raw = fs.readFileSync(target, 'utf8');
    assert.equal(raw, `${JSON.stringify(seeded, null, 4)}\n`);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
