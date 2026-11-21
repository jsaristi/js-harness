#!/usr/bin/env node
// The load probe of the folder instruction files (odd/tasks/folder-instructions.md, spec 1): for each of the four, a
// fresh git fixture outside every worktree and scratchpad holds a copy of the file and one neighbour, a `claude -p` on
// claude-haiku-5-5 reads the neighbour, and the run's transcript must hold the host's `nested_memory` attachment for
// that file. Evidence is the transcript, never the model's say-so. It spends tokens, so it runs only by hand:
//   node evals/folder-load-probe.mjs [--claude <path>] [--root <dir>]
// Only `nestedLoads`, its reader, runs under `node --test`.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOLDER_INSTRUCTIONS } from '../bin/lib/claude-md-budget.mjs';

/** The folder files the host loaded in a transcript, as paths relative to `root` with forward slashes: one per
 * `nested_memory` attachment, in transcript order. `entries` are the parsed lines; a line that is no object is skipped. */
export function nestedLoads(entries, root) {
  return entries
    .filter((entry) => entry && typeof entry === 'object' && entry.attachment?.type === 'nested_memory' && typeof entry.attachment.path === 'string')
    .map((entry) => path.relative(root, entry.attachment.path).split(path.sep).join('/'));
}

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function probe(file, { claude, root }) {
  const dir = fs.mkdtempSync(path.join(root, 'folder-load-'));
  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  try {
    git('init', '-q', '-b', 'main');
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# fixture\n');
    const folder = path.join(dir, ...path.dirname(file).split('/'));
    fs.mkdirSync(folder, { recursive: true });
    fs.copyFileSync(path.join(REPO, ...file.split('/')), path.join(folder, 'CLAUDE.md'));
    fs.writeFileSync(path.join(folder, 'neighbour.txt'), 'a neighbour\n');
    const target = `${path.dirname(file)}/neighbour.txt`;
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (/^(CLAUDECODE|CLAUDE_CODE_ENTRYPOINT|CLAUDE_CODE_SESSION|CLAUDE_AGENT_SDK)/i.test(key)) delete env[key];
    const run = spawnSync(claude, ['-p', `Read the file ${target} with the Read tool, then answer done.`, '--model', 'claude-haiku-5-5',
      '--setting-sources', 'project', '--output-format', 'stream-json', '--verbose', '--allowedTools', 'Read', '--max-turns', '4'],
    { cwd: dir, env, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
    let session = null;
    for (const line of (run.stdout ?? '').split('\n')) {
      try {
        const event = JSON.parse(line);
        if (event.type === 'system' && event.subtype === 'init') session = event.session_id;
      } catch { /* not a JSON line */ }
    }
    const projects = path.join(os.homedir(), '.claude', 'projects', dir.replace(/[^A-Za-z0-9]/g, '-'));
    const transcript = session === null ? null : path.join(projects, `${session}.jsonl`);
    const entries = transcript && fs.existsSync(transcript)
      ? fs.readFileSync(transcript, 'utf8').split('\n').filter(Boolean).map((line) => { try { return JSON.parse(line); } catch { return null; } })
      : [];
    fs.rmSync(projects, { recursive: true, force: true });
    const loads = nestedLoads(entries, dir);
    return { file, exit: run.status, transcript: entries.length > 0, loaded: loads.includes(file), loads };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flag = (name, fallback) => { const at = process.argv.indexOf(name); return at === -1 ? fallback : process.argv[at + 1]; };
  const claude = flag('--claude', 'claude');
  const root = flag('--root', path.join(os.homedir(), 'jh268-folder-probe'));
  fs.mkdirSync(root, { recursive: true });
  const rows = FOLDER_INSTRUCTIONS.map((file) => probe(file, { claude, root }));
  for (const row of rows) console.log(`${row.loaded ? 'LOADED' : 'NOT LOADED'}  ${row.file}  exit ${row.exit}  transcript ${row.transcript ? 'read' : 'missing'}  nested_memory: ${row.loads.join(', ') || 'none'}`);
  if (fs.readdirSync(root).length === 0) fs.rmSync(root, { recursive: true, force: true });
  process.exitCode = rows.every((row) => row.loaded) ? 0 : 1;
}
