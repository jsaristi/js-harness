// The install/sync/uninstall engine: components are data, so adding one never
// touches the fs-walking logic below, and uninstall can undo exactly what install wrote.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function skillContent(version) {
  return `---
name: js-harness
description: Install, update, and check js-harness (v${version}) status and commands.
---

js-harness commands:
- \`js-harness status\` — installed version, manifest version, and latest available.
- \`js-harness install\` — write this skill and record a manifest under the home.
- \`js-harness sync\` — re-write installed files for the running version.
- \`js-harness update\` — check whether a newer release exists.
- \`js-harness upgrade\` — install the newer release, then sync.
- \`js-harness uninstall\` — remove exactly what install wrote.
`;
}

/** Components are data: where each one lives under a home, and what it contains at a version. */
export const components = [
  {
    id: 'claude-skill',
    target: (home) => path.join(home, '.claude', 'skills', 'js-harness', 'SKILL.md'),
    content: skillContent,
  },
  {
    id: 'codex-skill',
    target: (home) => path.join(home, '.codex', 'skills', 'js-harness', 'SKILL.md'),
    content: skillContent,
  },
];

export function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function manifestPath(home) {
  return path.join(home, '.js-harness', 'manifest.json');
}

export function readManifest(home) {
  const file = manifestPath(home);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeManifest(home, manifest) {
  const file = manifestPath(home);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2), 'utf8');
}

/** Removes `dir` and any now-empty parent up to (but not including) `home`. */
function removeEmptyDirsUpTo(dir, home) {
  let current = path.resolve(dir);
  const stop = path.resolve(home);
  while (current !== stop && current.startsWith(stop)) {
    if (!fs.existsSync(current) || fs.readdirSync(current).length > 0) break;
    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}

/** Writes every component for `version` and records the resulting manifest. */
export function install(home, version) {
  const files = components.map((component) => {
    const target = component.target(home);
    const content = component.content(version);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
    return { path: target, sha256: sha256(content) };
  });
  const manifest = { version, files };
  writeManifest(home, manifest);
  return manifest;
}

/** Re-writes components for `version` and drops files the current release no longer ships. */
export function sync(home, version) {
  const previous = readManifest(home);
  const manifest = install(home, version);

  if (previous) {
    const keep = new Set(manifest.files.map((f) => f.path));
    for (const file of previous.files) {
      if (keep.has(file.path)) continue;
      if (fs.existsSync(file.path)) {
        fs.rmSync(file.path);
        removeEmptyDirsUpTo(path.dirname(file.path), home);
      }
    }
  }

  return manifest;
}

/** Deletes manifest files whose content is untouched; keeps and reports edited ones. */
export function uninstall(home) {
  const manifest = readManifest(home);
  if (!manifest) return { removed: [], kept: [] };

  const removed = [];
  const kept = [];
  for (const file of manifest.files) {
    if (!fs.existsSync(file.path)) continue;
    const current = fs.readFileSync(file.path, 'utf8');
    if (sha256(current) === file.sha256) {
      fs.rmSync(file.path);
      removeEmptyDirsUpTo(path.dirname(file.path), home);
      removed.push(file.path);
    } else {
      kept.push(file.path);
    }
  }

  fs.rmSync(manifestPath(home), { force: true });
  removeEmptyDirsUpTo(path.dirname(manifestPath(home)), home);

  return { removed, kept };
}
