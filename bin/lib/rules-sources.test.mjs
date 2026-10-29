import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { components } from './manifest.mjs';
import { initProject } from './project.mjs';
import { MESSAGE_SOURCES, REPOSITORY_FILES, textSources } from './rules-sources.mjs';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const readRepo = (file) => {
  try {
    return fs.readFileSync(path.join(REPO, file), 'utf8');
  } catch {
    return null;
  }
};
// What a hook answers with: a message to the session or the model, or a decision with its reason.
const HOOK_OUTPUT = /\bsystemMessage\b|\badditionalContext\b|\bpermissionDecisionReason\b|decision: 'block'|"decision"/;
// What builds a prompt an agent is sent: a function named for it, and the pause notice.
const PROMPT_BUILDER = /export function (?:\w+Prompt|cutRule)\(/;
// This list and the coverage code name those keys without building a message, and runPrompt reads which prompt a
// review run was asked with, a word.
const NOT_PRODUCERS = new Set(['bin/lib/rules-sources.mjs', 'bin/lib/rules-coverage.mjs', 'bin/lib/codex-review-runs.mjs']);

/** Every module under `dir` of the repository, tests and test kits left out, as repository paths. */
function modulesUnder(dir) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(REPO, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...modulesUnder(rel));
    else if (/\.mjs$/.test(entry.name) && !/\.test(?:kit)?\.mjs$/.test(entry.name)) out.push(rel);
  }
  return out;
}

test("every file install writes whole is a source, one for both hosts, and so are the repository's own files", () => {
  const sources = textSources('0.0.0', readRepo);
  const ids = sources.map((source) => source.id);
  assert.equal(new Set(ids).size, ids.length, 'one source an id');
  for (const component of components) {
    const id = component.id.replace(/^(?:claude|codex)-/, '');
    const source = sources.find((item) => item.id === id);
    assert.ok(source, `the component ${component.id} is the source ${id}`);
    assert.equal(source.text, String(component.content('0.0.0')));
  }
  for (const file of REPOSITORY_FILES) assert.ok(ids.includes(file), `${file} is a source`);
  for (const source of sources) assert.ok(source.text.trim().length > 0, `${source.id} has text`);
});

test('every module that answers a hook with a message or builds a prompt is a source of messages', () => {
  const builds = (text) => HOOK_OUTPUT.test(text) || PROMPT_BUILDER.test(text);
  const found = modulesUnder('bin').filter((rel) => !NOT_PRODUCERS.has(rel) && builds(fs.readFileSync(path.join(REPO, rel), 'utf8'))).sort();
  assert.deepEqual([...MESSAGE_SOURCES].sort(), found, 'add a new producer of hook messages or prompts to MESSAGE_SOURCES, and remove one that no longer is');
});

test('every Markdown file init writes into a new project is the text of a source', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-sources-'));
  try {
    assert.equal(spawnSync('git', ['init', '-q'], { cwd: dir }).status, 0);
    const written = [];
    const writeFile = (target, content, encoding) => {
      if (/\.md$/i.test(String(target))) written.push({ target: String(target), content: String(content) });
      return fs.writeFileSync(target, content, encoding);
    };
    // Every command but git is answered as a success with nothing done, so no codegraph runs.
    const spawn = (command, args, options) => (command === 'git' ? spawnSync('git', args, options) : { status: 0, stdout: '', stderr: '' });
    initProject(dir, '0.0.0', { spawn, platform: 'linux', writeFile });
    assert.ok(written.length >= 3, `init wrote ${written.length} Markdown files`);
    const texts = new Set(textSources('0.0.0', () => null).map((source) => source.text.replace(/^# project$/m, `# ${path.basename(dir)}`)));
    for (const { target, content } of written) assert.ok(texts.has(content), `${path.relative(dir, target)} is the text of a source`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
