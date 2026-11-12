import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMANDS, TICKS, ideas, run } from './js-harness-workshop.mjs';
import * as product from '../bin/js-harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// odd/tasks/workshop-product-split.md, slice 1+2: the seven commands that read only this repository's records.
const MOVED = ['audit', 'docs', 'host-watch', 'idea-watch', 'subagents', 'throughput', 'windows-daily'];

test('the table of loaders names exactly the commands of the usage text, and each loader resolves to a command function', async (t) => {
  const printed = [];
  t.mock.method(console, 'log', (text) => printed.push(text));
  assert.equal(await run(['--help']), 0);
  const named = printed.join('\n').split('\n').map((line) => line.match(/^ {2}(\S+)\s/)).filter(Boolean).map((match) => match[1]);
  assert.deepEqual(Object.keys(COMMANDS).sort(), named.sort());
  for (const name of named) assert.equal(typeof (await COMMANDS[name]()), 'function', `the loader of ${name} resolves to its command function`);
});

test('the seven workshop commands are the workshop dispatcher\'s and none is the product\'s', () => {
  for (const name of MOVED) {
    assert.ok(Object.hasOwn(COMMANDS, name), `${name} is a workshop command`);
    assert.equal(Object.hasOwn(product.COMMANDS, name), false, `${name} left the product dispatcher`);
  }
});

test('an unknown command is a usage error and loads no command', async (t) => {
  t.mock.method(console, 'error', () => {});
  const loaded = [];
  const commands = Object.fromEntries(Object.keys(COMMANDS).map((name) => [name, async () => { loaded.push(name); return () => 0; }]));
  assert.equal(await run(['no-such-command'], { commands }), 2);
  assert.equal(await run(['toString'], { commands }), 2);
  assert.deepEqual(loaded, []);
});

test('the workshop runs the product\'s loop with its three heartbeat ticks', () => {
  assert.deepEqual(Object.keys(TICKS).sort(), ['hostWatch', 'throughputTick', 'windowsDaily']);
  for (const tick of Object.values(TICKS)) assert.equal(typeof tick, 'function');
});

test('the idea-watch reading gives no fix where the project keeps no record', async () => {
  const empty = fs.mkdtempSync(path.join(ROOT, '..', 'js-harness-workshop-ideas-'));
  try {
    assert.equal(await ideas(empty), null);
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});

// The docs row left check's static rows with the docs command, so this repository's gate runs it as a sensor:
// on a code commit through `sensors`, on a commit of documents alone through `documentSensors`, which run only there.
test('this repository\'s gate runs the suite, the docs row and the workshop\'s spec on every commit', () => {
  const declared = JSON.parse(fs.readFileSync(path.join(ROOT, 'harness.json'), 'utf8'));
  assert.equal(declared.sensors.tests, 'node --test');
  assert.equal(declared.sensors.docs, 'node workshop/js-harness-workshop.mjs docs check');
  assert.equal(declared.sensors['workshop spec'], 'node workshop/js-harness-workshop.mjs spec');
  assert.equal(declared.documentSensors.docs, declared.sensors.docs);
});

test('this repository\'s gate runs the workshop\'s document checks on a commit of documents alone too', () => {
  // A commit that changes only documents runs harness.json's "documentSensors" in place of its "sensors", so a check of
  // the workshop that reads documents (docs/SPEC.md's workshop claims, the docs plan) has to be in both, or an edit of
  // the very text it checks passes the gate unread (the Codex review of 6c1bc8e..f78479a, P2).
  const { sensors, documentSensors } = JSON.parse(fs.readFileSync(path.join(ROOT, 'harness.json'), 'utf8'));
  const workshop = Object.entries(sensors).filter(([, command]) => command.startsWith('node workshop/js-harness-workshop.mjs '));
  assert.ok(workshop.length > 0, 'the gate runs a check of the workshop');
  for (const [name, command] of workshop) assert.equal(documentSensors[name], command, `${name} runs on a commit of documents alone`);
});

// The host-update row of doctor and the heartbeat's usage sent a host watch to `js-harness host-watch brief`, which the
// installed CLI answers "Unknown command: host-watch": the command is the workshop's since workshop-product-split (JH 188,
// 2026-11-12). Each command they name is one that runs: `js-harness <name>` the product's, `node
// workshop/js-harness-workshop.mjs <name>` the workshop's.
test('every command the host-update row and the heartbeat\'s usage name is one its dispatcher runs', async () => {
  const { hostUnreadableRow, hostUpdateRow } = await import('../bin/lib/host-update.mjs');
  const { USAGE } = await import('../bin/loop.mjs');
  const versions = { found: true, desktop: '2.42304.0', code: '2.1.299' };
  const stale = hostUpdateRow(versions, { desktop: '2.37337.1', code: '2.1.295' }).row;
  const texts = [...stale.fix.claude, ...hostUnreadableRow(versions).fix.claude, ...USAGE].join('\n');
  const named = (pattern) => [...texts.matchAll(pattern)].map((match) => match[1]);
  const workshop = named(/node workshop\/js-harness-workshop\.mjs ([a-z][\w-]*)/g);
  const productNames = named(/(?<![\w./-])js-harness ([a-z][\w-]*)/g);
  assert.ok(workshop.includes('host-watch'), `the row names the workshop's host-watch: ${texts}`);
  for (const name of workshop) assert.ok(Object.hasOwn(COMMANDS, name), `node workshop/js-harness-workshop.mjs ${name} is no workshop command`);
  for (const name of productNames) assert.ok(Object.hasOwn(product.COMMANDS, name), `js-harness ${name} is no command of the product`);
});
