// The claude-import row's check (bin/lib/claude-import.mjs; the reverse-engineering document, 13.3 row 16): a project's
// root CLAUDE.md imports AGENTS.md, and no CLAUDE.md above the project loads beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { importHealth, mainCheckoutOf, importsAgents, oneFile, withImport } from './claude-import.mjs';

/** A folder `outer` holding a project `outer/work/project` with `files`, removed after the test. */
function tree(t, files) {
  const outer = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-import-'));
  t.after(() => fs.rmSync(outer, { recursive: true, force: true }));
  const project = path.join(outer, 'work', 'project');
  fs.mkdirSync(project, { recursive: true });
  for (const [file, text] of Object.entries(files)) fs.writeFileSync(path.join(project, file), text);
  return { outer, project };
}

const INITIALIZED = { 'harness.json': '{ "version": "0.97.0" }\n', 'AGENTS.md': '# AGENTS.md\n' };
const IMPORTING = '<!-- Written by `js-harness init`. -->\n@AGENTS.md\n\n- a kept line\n';

test('importsAgents reads an import line of AGENTS.md, and no mention of it in prose', () => {
  assert.equal(importsAgents(IMPORTING), true);
  assert.equal(importsAgents('@./AGENTS.md\r\n'), true);
  assert.equal(importsAgents('Read AGENTS.md first, and @AGENTS.md in a sentence.\n'), false);
  assert.equal(importsAgents('```\n@AGENTS.md\n```\n'), false);
  // A fence closes only on its own character, at least as long (Codex P2 on 541464c).
  assert.equal(importsAgents('````md\n```\n@AGENTS.md\n```\n````\n'), false);
  assert.equal(importsAgents('~~~\n```\n~~~\n@AGENTS.md\n'), true);
});

test('withImport puts the import first, in the file\'s own line ends, after a UTF-8 byte order mark, and no line in UTF-16', () => {
  assert.equal(withImport(Buffer.from('# ours\n')).toString('utf8'), '@AGENTS.md\n\n# ours\n');
  assert.equal(withImport(Buffer.from('# ours\r\n')).toString('utf8'), '@AGENTS.md\r\n\r\n# ours\r\n');
  assert.equal(withImport(Buffer.from('')).toString('utf8'), '@AGENTS.md\n\n');
  const bom = withImport(Buffer.from('﻿# ours\n'));
  assert.equal(bom.toString('utf8'), '﻿@AGENTS.md\n\n# ours\n');
  assert.equal(importsAgents(bom.toString('utf8')), true);
  // Bytes outside UTF-8, such as a Latin-1 é, are kept as they are.
  assert.deepEqual(withImport(Buffer.from([0x23, 0xe9, 0x0a])), Buffer.concat([Buffer.from('@AGENTS.md\n\n'), Buffer.from([0x23, 0xe9, 0x0a])]));
  assert.equal(withImport(Buffer.from([0xff, 0xfe, 0x23, 0x00])), null);
  assert.equal(withImport(Buffer.from([0xfe, 0xff, 0x00, 0x23])), null);
});

test('importHealth is ok for a root CLAUDE.md that imports AGENTS.md with nothing above it', (t) => {
  const { project } = tree(t, { ...INITIALIZED, 'CLAUDE.md': IMPORTING });
  assert.deepEqual(importHealth(project), { state: 'ok', fix: [] });
});

test('importHealth turns the row red for a CLAUDE.md or CLAUDE.local.md planted in any folder above the project', (t) => {
  const { outer, project } = tree(t, { ...INITIALIZED, 'CLAUDE.md': IMPORTING });
  fs.writeFileSync(path.join(outer, 'CLAUDE.md'), '# planted\n');
  fs.writeFileSync(path.join(outer, 'work', 'CLAUDE.local.md'), '# planted\n');
  const health = importHealth(project);
  assert.equal(health.state, 'mismatch');
  assert.deepEqual(health.fix, [
    'claude-import: 2 files above the project load into every session in it, beside its CLAUDE.md: move them or remove them',
    path.join(outer, 'work', 'CLAUDE.local.md'),
    path.join(outer, 'CLAUDE.md'),
  ]);
});

test('importHealth names a project with no root CLAUDE.md, or one that does not import AGENTS.md', (t) => {
  const none = tree(t, INITIALIZED);
  assert.deepEqual(importHealth(none.project), {
    state: 'missing',
    fix: ['claude-import: the project has no root CLAUDE.md, so Claude may not load AGENTS.md: write one whose first line is @AGENTS.md'],
  });
  const prose = tree(t, { ...INITIALIZED, 'CLAUDE.md': 'Read AGENTS.md.\n' });
  assert.deepEqual(importHealth(prose.project), {
    state: 'missing',
    fix: ['claude-import: CLAUDE.md does not import AGENTS.md, so Claude may not load it: add the line @AGENTS.md'],
  });
});

test('importHealth is ok for a CLAUDE.md that is AGENTS.md under a second name, which Claude loads as it is', (t) => {
  // A hard link needs no privilege, so this runs on every machine; a link is the same file to `stat` (D1).
  const { project } = tree(t, INITIALIZED);
  fs.linkSync(path.join(project, 'AGENTS.md'), path.join(project, 'CLAUDE.md'));
  assert.equal(oneFile(project), true);
  assert.deepEqual(importHealth(project, { mainCheckout: null }), { state: 'ok', fix: [] });
  fs.rmSync(path.join(project, 'CLAUDE.md'));
  fs.writeFileSync(path.join(project, 'CLAUDE.md'), INITIALIZED['AGENTS.md']);
  assert.equal(oneFile(project), false);
});

test('importHealth reads a root CLAUDE.md a claudeMdExcludes glob drops as not loaded, and leaves out a dropped file above', (t) => {
  // Claude skips a CLAUDE.md any settings layer's glob matches, and AGENTS.md goes with it (Codex P2 on 541464c).
  const { outer, project } = tree(t, { ...INITIALIZED, 'CLAUDE.md': IMPORTING });
  fs.mkdirSync(path.join(project, '.claude'));
  fs.writeFileSync(path.join(project, '.claude', 'settings.local.json'), JSON.stringify({ claudeMdExcludes: ['**/project/CLAUDE.md'] }));
  assert.deepEqual(importHealth(project), {
    state: 'missing',
    fix: ['claude-import: the claudeMdExcludes glob **/project/CLAUDE.md drops CLAUDE.md, so Claude does not load AGENTS.md: take CLAUDE.md out of it'],
  });
  fs.rmSync(path.join(project, '.claude', 'settings.local.json'));
  const home = path.join(outer, 'home');
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({ claudeMdExcludes: [`${outer.replace(/\\/g, '/')}/CLAUDE.md`] }));
  fs.writeFileSync(path.join(outer, 'CLAUDE.md'), '# dropped by his settings\n');
  assert.deepEqual(importHealth(project, { home }), { state: 'ok', fix: [] });
  assert.equal(importHealth(project).state, 'mismatch');
});

test('importHealth is n/a outside an initialized project, or in one with no AGENTS.md', (t) => {
  assert.deepEqual(importHealth(null), { state: 'n/a', fix: [] });
  assert.deepEqual(importHealth(tree(t, { 'CLAUDE.md': IMPORTING }).project), { state: 'n/a', fix: [] });
  assert.deepEqual(importHealth(tree(t, { 'harness.json': '{}\n', 'CLAUDE.md': IMPORTING }).project), { state: 'n/a', fix: [] });
});

test('importHealth leaves out the folders of the main checkout above a linked worktree, which no worktree session loads', (t) => {
  const { outer, project } = tree(t, { ...INITIALIZED, 'CLAUDE.md': IMPORTING });
  fs.writeFileSync(path.join(outer, 'work', 'CLAUDE.md'), '# the main checkout\'s own\n');
  assert.deepEqual(importHealth(project, { mainCheckout: path.join(outer, 'work') }), { state: 'ok', fix: [] });
  fs.writeFileSync(path.join(outer, 'CLAUDE.md'), '# planted above the main checkout\n');
  assert.equal(importHealth(project, { mainCheckout: path.join(outer, 'work') }).fix[1], path.join(outer, 'CLAUDE.md'));
});

test('mainCheckoutOf names the main checkout of a linked worktree, and none for the main checkout itself', (t) => {
  const { outer } = tree(t, {});
  const main = path.join(outer, 'main');
  fs.mkdirSync(main);
  const git = (...args) => spawnSync('git', args, { cwd: main, encoding: 'utf8' });
  git('init', '-q');
  git('-c', 'user.email=a@b', '-c', 'user.name=a', 'commit', '-q', '--allow-empty', '-m', 'first');
  const linked = path.join(outer, 'linked');
  git('worktree', 'add', '-q', linked);
  assert.equal(mainCheckoutOf(main), null);
  assert.equal(fs.realpathSync(mainCheckoutOf(linked)), fs.realpathSync(main));
  assert.equal(mainCheckoutOf(path.join(outer, 'none')), null);
});
