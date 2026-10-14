// The README's list of commands is held to the dispatcher's, so that a command added, renamed or removed
// without its section fails here and the page cannot go stale silently. The dispatcher is asked the way a
// person asks it, `js-harness --help`, and the README is read from the tree; nothing is written.
//
// What the README promises of each command: a section `### js-harness <name>` under `## Commands`, in the
// order of `--help`, with at least one fenced block, which is its example taken from a real run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '..');
const README = path.join(REPO, 'README.md');

/** The commands `js-harness --help` lists, in its order: the first word of each line under "Commands:". */
function dispatched() {
  const help = spawnSync(process.execPath, [path.join(REPO, 'bin', 'js-harness.mjs'), '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  const lines = help.stdout.split('\n');
  const from = lines.indexOf('Commands:');
  assert.notEqual(from, -1, 'the usage has a "Commands:" line');
  const names = [];
  for (const line of lines.slice(from + 1)) {
    const named = /^ {2}(\S+) /.exec(line);
    if (!named) break;
    names.push(named[1]);
  }
  return names;
}

/** The README's lines, each with whether it stands inside a fenced block, so that a heading shown in an
 * example (the contract template opens with `## Goal`) is not read as a heading of the page. */
function linesOf(text) {
  let fence = null;
  return text.split('\n').map((line) => {
    const marker = /^(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence === null && marker) {
      fence = marker;
      return { line, fenced: true };
    }
    if (fence !== null) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker) fence = null;
      return { line, fenced: true };
    }
    return { line, fenced: false };
  });
}

/** The sections of the README under `## Commands`, as `[{ heading, body }]` in the order they stand. */
function documented() {
  const lines = linesOf(fs.readFileSync(README, 'utf8').replace(/\r\n/g, '\n'));
  const start = lines.findIndex(({ line, fenced }) => !fenced && line === '## Commands');
  assert.notEqual(start, -1, 'the README has a "## Commands" section');
  const sections = [];
  for (const { line, fenced } of lines.slice(start + 1)) {
    if (!fenced && line.startsWith('## ')) break;
    if (!fenced && line.startsWith('### ')) sections.push({ heading: line.slice(4), body: [] });
    else sections.at(-1)?.body.push(line);
  }
  return sections.map(({ heading, body }) => ({ heading, body: body.join('\n') }));
}

test('the dispatcher lists its commands, and more than a few', () => {
  const names = dispatched();
  assert.ok(names.length >= 10, `only ${names.length} commands were read from --help: ${names.join(', ')}`);
  assert.equal(new Set(names).size, names.length, 'no command is listed twice');
});

test('the README has one section for each command of the dispatcher, in the same order, and no other', () => {
  assert.deepEqual(documented().map((section) => section.heading), dispatched().map((name) => `js-harness ${name}`));
});

test('each command of the README shows an example in a fenced block', () => {
  for (const { heading, body } of documented()) {
    assert.match(body, /^```[a-z]*\n[\s\S]+?\n```$/m, `${heading} has no fenced example`);
  }
});

test('a heading shown inside a fenced example is not read as a heading of the page', () => {
  const lines = linesOf('## Commands\n### js-harness a\n```md\n## Goal\n### not a command\n```\n### js-harness b\n');
  assert.deepEqual(lines.filter(({ fenced }) => !fenced).map(({ line }) => line), ['## Commands', '### js-harness a', '### js-harness b', '']);
});

test('the README says how to install the harness and how to remove it, before its commands', () => {
  const lines = linesOf(fs.readFileSync(README, 'utf8').replace(/\r\n/g, '\n'));
  const at = (heading) => lines.findIndex(({ line, fenced }) => !fenced && line === `## ${heading}`);
  assert.ok(at('Install') !== -1 && at('Remove') !== -1, 'the README has "## Install" and "## Remove"');
  assert.ok(at('Install') < at('Remove') && at('Remove') < at('Commands'), 'Install, then Remove, then Commands');
});
