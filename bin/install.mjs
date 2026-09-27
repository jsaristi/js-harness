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

// R3-001 (accepted final review follow-up, lineage review-cef5637e2884c12a): a skipped component or
// entry (a write that failed this run — see manifest.mjs's `install`/`sync`) is surfaced to the
// user, not silently dropped, one line per item on stderr so it never pollutes the normal stdout
// report a script might parse.
function logSkip(item) {
  console.error(`skipped ${item.path}: ${item.reason ?? 'unknown reason'}`);
}

function logFiles(files) {
  for (const file of files ?? []) {
    if (file.skipped) logSkip(file);
  }
}

function logEntries(entries) {
  for (const entry of entries ?? []) {
    if (entry.skipped) logSkip(entry);
    else console.log(`registered hook entry in ${entry.path}`);
  }
}

/** Files this run actually wrote: a record carried forward after a failed write is still in the
 * manifest (so uninstall can undo it) but was not written now. */
function writtenCount(manifest) {
  return manifest.files.filter((file) => !file.skipped).length;
}

export async function installMain(argv, env = process.env, deps = {}) {
  const home = parseHome(argv, env);
  const version = currentVersion();
  const manifest = install(home, version, deps);
  console.log(`installed js-harness ${version} (${writtenCount(manifest)} files) into ${home}`);
  logFiles(manifest.files);
  logEntries(manifest.entries);
  return 0;
}

export async function syncMain(argv, env = process.env, deps = {}) {
  const home = parseHome(argv, env);
  const version = currentVersion();
  const manifest = sync(home, version, deps);
  console.log(`synced js-harness ${version} (${writtenCount(manifest)} files) into ${home}`);
  logFiles(manifest.files);
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
