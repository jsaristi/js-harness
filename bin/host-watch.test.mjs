import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hostWatchMain } from './host-watch.mjs';

// `js-harness host-watch` (odd/tasks/f8-s9-host-watch.md) through its main: `draft` over changelog files, `check` over
// a review file and the excerpts beside it, `tools` against the list recorded in a project. Everything lives in a
// temp folder; the host versions and the reviewed record are handed in, never read from this machine.

const DESKTOP = ['**v4.5000.0**', '', '2026-11-05', '', '**Code**', '', '* Added a PreToolUse hook field.', '* Fixed the tray icon.', '', '**v4.4212.0**', '', '**General**', '', '* Older entry.', ''].join('\n');
const CODE = ['# Changelog', '', '## 2.1.320', '', '- Added mods that draw a pane', '- Fixed Bedrock sessions failing', '', '## 2.1.318', '', '- Older', ''].join('\n');

function world() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-host-watch-'));
  const project = path.join(dir, 'project');
  fs.mkdirSync(path.join(project, 'docs', 'host-updates'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'desktop.md'), DESKTOP);
  fs.writeFileSync(path.join(dir, 'code.md'), CODE);
  return { dir, project, remove: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

async function run(argv, deps = {}) {
  const out = [];
  const err = [];
  const code = await hostWatchMain(argv, {
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    host: () => ({ found: true, desktop: '4.5000.0', staged: null, code: '2.1.320' }),
    reviewed: () => ({ desktop: '4.4212.0', code: '2.1.318' }),
    now: () => new Date('2026-11-06T10:00:00Z'),
    ...deps,
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('draft spans the update from the reviewed record to the versions read now, and saves the excerpts it read', async () => {
  const w = world();
  try {
    const sources = path.join(w.dir, 'sources');
    const { code, out } = await run(['draft', '--desktop', path.join(w.dir, 'desktop.md'), '--code', path.join(w.dir, 'code.md'), '--sources', sources]);
    assert.equal(code, 0);
    assert.match(out, /^# Claude Desktop 4\.5000\.0$/m);
    assert.match(out, /\| desktop 4\.5000\.0 #1 \|/);
    assert.match(out, /\| code 2\.1\.320 #2 \|/);
    assert.match(out, /- desktop 4\.5000\.0 #2: Fixed the tray icon\./);
    assert.match(fs.readFileSync(path.join(sources, 'claude-desktop-4.5000.0.desktop.md'), 'utf8'), /Added a PreToolUse hook field/);
    assert.doesNotMatch(fs.readFileSync(path.join(sources, 'claude-desktop-4.5000.0.code.md'), 'utf8'), /Older/);
  } finally {
    w.remove();
  }
});

test('draft takes a frozen span over the record, and refuses a changelog older than the version it reviews', async () => {
  const w = world();
  try {
    const frozen = await run(['draft', '--desktop', path.join(w.dir, 'desktop.md'), '--code', path.join(w.dir, 'code.md'), '--from-code', '2.1.319', '--to-code', '2.1.320', '--from-desktop', '4.4212.0', '--to-desktop', '4.5000.0']);
    assert.equal(frozen.code, 0);
    assert.match(frozen.out, /code\.claude\.com\/docs\/en\/changelog \(2\.1\.319 to 2\.1\.320\)/);
    const old = await run(['draft', '--desktop', path.join(w.dir, 'desktop.md'), '--code', path.join(w.dir, 'code.md'), '--to-code', '2.1.330']);
    assert.equal(old.code, 1);
    assert.match(old.err, /stops at 2\.1\.320, below 2\.1\.330/);
  } finally {
    w.remove();
  }
});

test('check reads the spans from the review file and its excerpts: a draft left undecided fails, a decided one passes', async () => {
  const w = world();
  try {
    const sources = path.join(w.project, 'docs', 'host-updates', 'sources');
    const drafted = await run(['draft', '--desktop', path.join(w.dir, 'desktop.md'), '--code', path.join(w.dir, 'code.md'), '--sources', sources]);
    const file = path.join(w.project, 'docs', 'host-updates', 'claude-desktop-4.5000.0.md');
    fs.writeFileSync(file, drafted.out);
    const undecided = await run(['check', file]);
    assert.equal(undecided.code, 1);
    assert.match(undecided.err, /desktop 4\.5000\.0 #1: a Decision/);
    fs.writeFileSync(file, drafted.out.replace(/\| \? \|/g, '| adapt |').replace(/(## To classify by hand\n)[\s\S]*?(\n## Sources)/, '$1$2'));
    const done = await run(['check', file]);
    assert.equal(done.err, '');
    assert.equal(done.code, 0);
    assert.match(done.out, /holds the review of Claude Desktop 4\.5000\.0: 4 rows for 4 entries/);
    fs.rmSync(path.join(sources, 'claude-desktop-4.5000.0.code.md'));
    const noExcerpt = await run(['check', file]);
    assert.equal(noExcerpt.code, 1);
    assert.match(noExcerpt.err, /no excerpt .*claude-desktop-4\.5000\.0\.code\.md/);
  } finally {
    w.remove();
  }
});

test('tools refuses a list the surface could not give, records a first capture as a baseline, then says what changed', async () => {
  const w = world();
  try {
    const list = path.join(w.dir, 'tools.txt');
    fs.writeFileSync(list, 'Read\nBash\nmcp__engram__mem_save\n');
    const wrong = await run(['tools', '--surface', 'desktop', '--list', list, '--project', w.project]);
    assert.equal(wrong.code, 1);
    assert.match(wrong.err, /start_session/);
    const first = await run(['tools', '--surface', 'background', '--list', list, '--project', w.project, '--record']);
    assert.equal(first.code, 0);
    assert.match(first.out, /baseline: 2 host tools/);
    assert.match(first.out, /other MCP servers left out: engram \(1\)/);
    const recorded = fs.readFileSync(path.join(w.project, 'docs', 'host-updates', 'tools-background.txt'), 'utf8');
    assert.match(recorded, /^# recorded: 2026-11-06$/m);
    assert.match(recorded, /^# Claude Desktop 4\.5000\.0, Code tab CLI 2\.1\.320$/m);
    fs.writeFileSync(list, 'Read\nMonitor\n');
    const next = await run(['tools', '--surface', 'background', '--list', list, '--project', w.project]);
    assert.equal(next.code, 0);
    assert.match(next.out, /added: Monitor/);
    assert.match(next.out, /removed: Bash \(confirm each with ToolSearch select:<name> before a review claims it\)/);
    assert.match(fs.readFileSync(path.join(w.project, 'docs', 'host-updates', 'tools-background.txt'), 'utf8'), /^Bash$/m, 'without --record nothing is written');
  } finally {
    w.remove();
  }
});

test('an argument it does not know is refused with exit 2', async () => {
  const { code, err } = await run(['draft', '--nope']);
  assert.equal(code, 2);
  assert.match(err, /^unknown argument: --nope/);
});

test('check refuses a span that ends below the version the review names, and a declared source whose span cannot be read', async () => {
  const w = world();
  try {
    const sources = path.join(w.project, 'docs', 'host-updates', 'sources');
    const drafted = await run(['draft', '--desktop', path.join(w.dir, 'desktop.md'), '--code', path.join(w.dir, 'code.md'), '--sources', sources]);
    const file = path.join(w.project, 'docs', 'host-updates', 'claude-desktop-4.5000.0.md');
    const done = drafted.out.replace(/\| \? \|/g, '| adapt |').replace(/(## To classify by hand\n)[\s\S]*?(\n## Sources)/, '$1$2');
    fs.writeFileSync(file, done.replace('Code tab CLI: 2.1.320', 'Code tab CLI: 2.1.330'));
    const stale = await run(['check', file]);
    assert.equal(stale.code, 1);
    assert.match(stale.err, /code changelog span ends at 2\.1\.320, and the review names 2\.1\.330/);
    fs.writeFileSync(file, done.replace('(2.1.318 to 2.1.320)', '(2.1.318 -> 2.1.320)'));
    const malformed = await run(['check', file]);
    assert.equal(malformed.code, 1);
    assert.match(malformed.err, /names https:\/\/code\.claude\.com\/docs\/en\/changelog with no span/);
  } finally {
    w.remove();
  }
});

// gentle-ai review-4991b18b1d344d43, R3-001 to R3-004.
test('draft and check hold a desktop update that keeps its bundled CLI: no CLI rows, its span named and checked', async () => {
  const w = world();
  try {
    const sources = path.join(w.project, 'docs', 'host-updates', 'sources');
    const reviewed = () => ({ desktop: '4.4212.0', code: '2.1.320' });
    const drafted = await run(['draft', '--desktop', path.join(w.dir, 'desktop.md'), '--code', path.join(w.dir, 'code.md'), '--sources', sources], { reviewed });
    assert.equal(drafted.code, 0);
    assert.doesNotMatch(drafted.out, /\| code /);
    assert.equal(fs.existsSync(path.join(sources, 'claude-desktop-4.5000.0.code.md')), false, 'no excerpt for a span of nothing');
    const file = path.join(w.project, 'docs', 'host-updates', 'claude-desktop-4.5000.0.md');
    fs.writeFileSync(file, drafted.out.replace(/\| \? \|/g, '| adapt |').replace(/(## To classify by hand\n)[\s\S]*?(\n## Sources)/, '$1$2'));
    const done = await run(['check', file]);
    assert.equal(done.err, '');
    assert.match(done.out, /2 rows for 2 entries/);
  } finally {
    w.remove();
  }
});

test('draft with no reviewed record or no CLI version read says which flag gives it', async () => {
  const w = world();
  try {
    const args = ['draft', '--desktop', path.join(w.dir, 'desktop.md'), '--code', path.join(w.dir, 'code.md')];
    const none = await run(args, { reviewed: () => null });
    assert.equal(none.code, 1);
    assert.match(none.err, /no reviewed record .*--from-desktop/);
    const noCli = await run(args, { host: () => ({ found: true, desktop: '4.5000.0', staged: null, code: null }) });
    assert.equal(noCli.code, 1);
    assert.match(noCli.err, /Code tab CLI .*--to-code/);
  } finally {
    w.remove();
  }
});

test('check refuses a review that names a Code tab CLI and drops its changelog span', async () => {
  const w = world();
  try {
    const sources = path.join(w.project, 'docs', 'host-updates', 'sources');
    const drafted = await run(['draft', '--desktop', path.join(w.dir, 'desktop.md'), '--code', path.join(w.dir, 'code.md'), '--sources', sources]);
    const file = path.join(w.project, 'docs', 'host-updates', 'claude-desktop-4.5000.0.md');
    const done = drafted.out.replace(/\| \? \|/g, '| adapt |').replace(/(## To classify by hand\n)[\s\S]*?(\n## Sources)/, '$1$2');
    fs.writeFileSync(file, done.split('\n').filter((line) => !line.includes('code.claude.com') && !line.includes('| code ')).join('\n'));
    const dropped = await run(['check', file]);
    assert.equal(dropped.code, 1);
    assert.match(dropped.err, /names Code tab CLI 2\.1\.320 and no span of https:\/\/code\.claude\.com\/docs\/en\/changelog/);
  } finally {
    w.remove();
  }
});

test('tools refuses a recorded list it cannot read, and never takes it for a first capture', async () => {
  const w = world();
  try {
    const list = path.join(w.dir, 'tools.txt');
    fs.writeFileSync(list, 'Read\nBash\n');
    fs.mkdirSync(path.join(w.project, 'docs', 'host-updates', 'tools-background.txt'));
    const result = await run(['tools', '--surface', 'background', '--list', list, '--project', w.project, '--record']);
    assert.equal(result.code, 1);
    assert.match(result.err, /tools-background\.txt could not be read \(EISDIR\)/);
  } finally {
    w.remove();
  }
});
