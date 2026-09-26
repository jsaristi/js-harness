#!/usr/bin/env node
// CLI surface over the manifest engine: `install`, `sync`, `uninstall`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { install, sync, uninstall } from './lib/manifest.mjs';

function parseHome(argv, env) {
  const i = argv.indexOf('--home');
  return i !== -1 ? argv[i + 1] : (env.JS_HARNESS_HOME ?? os.homedir());
}

/** This package's own version, read from its package.json (never the installed target's). */
export function currentVersion() {
  const pkgPath = path.join(import.meta.dirname, '..', 'package.json');
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
}

function logEntries(entries) {
  for (const entry of entries ?? []) {
    if (entry.skipped) console.log(`skipped (malformed JSON) ${entry.path}`);
    else console.log(`registered hook entry in ${entry.path}`);
  }
}

export async function installMain(argv, env = process.env) {
  const home = parseHome(argv, env);
  const version = currentVersion();
  const manifest = install(home, version);
  console.log(`installed js-harness ${version} (${manifest.files.length} files) into ${home}`);
  logEntries(manifest.entries);
  return 0;
}

export async function syncMain(argv, env = process.env) {
  const home = parseHome(argv, env);
  const version = currentVersion();
  const manifest = sync(home, version);
  console.log(`synced js-harness ${version} (${manifest.files.length} files) into ${home}`);
  logEntries(manifest.entries);
  return 0;
}

export async function uninstallMain(argv, env = process.env) {
  const home = parseHome(argv, env);
  const result = uninstall(home);
  for (const p of result.removed) console.log(`removed ${p}`);
  for (const p of result.kept) console.log(`kept (modified by you) ${p}`);
  for (const p of result.entriesRemoved) console.log(`removed hook entry from ${p}`);
  for (const p of result.entriesKept) console.log(`kept hook entry in ${p} (modified by you)`);
  if (
    result.removed.length === 0 &&
    result.kept.length === 0 &&
    result.entriesRemoved.length === 0 &&
    result.entriesKept.length === 0
  ) {
    console.log(`nothing installed under ${home}`);
  }
  return 0;
}
