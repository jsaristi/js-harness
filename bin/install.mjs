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

export async function installMain(argv, env = process.env) {
  const home = parseHome(argv, env);
  const version = currentVersion();
  const manifest = install(home, version);
  console.log(`installed js-harness ${version} (${manifest.files.length} files) into ${home}`);
  return 0;
}

export async function syncMain(argv, env = process.env) {
  const home = parseHome(argv, env);
  const version = currentVersion();
  const manifest = sync(home, version);
  console.log(`synced js-harness ${version} (${manifest.files.length} files) into ${home}`);
  return 0;
}

export async function uninstallMain(argv, env = process.env) {
  const home = parseHome(argv, env);
  const result = uninstall(home);
  for (const p of result.removed) console.log(`removed ${p}`);
  for (const p of result.kept) console.log(`kept (modified by you) ${p}`);
  if (result.removed.length === 0 && result.kept.length === 0) {
    console.log(`nothing installed under ${home}`);
  }
  return 0;
}
