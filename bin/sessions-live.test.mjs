import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendNotice, newNotice } from './lib/channel.mjs';
import { projectSlug } from './lib/sessions.mjs';
import { liveCursorPath, sessionsLiveMain } from './sessions-live.mjs';
import { sessionsMain } from './sessions.mjs';

// odd/tasks/live-board.md, S3: `js-harness sessions live` turns the channel record into the live board's batches and
// moves its cursor once a batch was sent. Every test has a home, a project folder and an output folder of its own in
// the temp folder; git is never run (the fake answers nothing, so the folder is the project).

const NOW = Date.parse('2026-10-27T06:00:00.000Z');
const FROM = { host: 'claude-code', id: 'aaaaaaaa-1111-4111-8111-111111111111', source: 'environment', title: 'JH 58 · live board' };
const noGit = () => ({ status: 1, stdout: '', stderr: '' });

function withFolders(body) {
  return async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-live-'));
    const home = path.join(root, 'home');
    const project = path.join(root, 'project');
    const out = path.join(root, 'out');
    fs.mkdirSync(project, { recursive: true });
    try {
      await body({ home, project, out, slug: projectSlug(project) });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
}

const note = (home, slug, at, text, kind = 'note') => appendNotice(home, slug, newNotice({ at, from: FROM, to: 'orchestrator', kind, text }));

async function live(args, { home, project }) {
  const out = [];
  const err = [];
  const code = await sessionsLiveMain(args, { cwd: project, stdout: (text) => out.push(text), stderr: (text) => err.push(text), now: () => NOW, run: noGit, env: { JS_HARNESS_HOME: home } });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('with no --out it says how many rows wait, from the last --hours when nothing was sent', withFolders(async (dirs) => {
  note(dirs.home, dirs.slug, '2026-10-26T01:00:00.000Z', 'too old for 24 hours');
  note(dirs.home, dirs.slug, '2026-10-27T05:00:00.000Z', 'step 2 done');
  note(dirs.home, dirs.slug, '2026-10-27T05:30:00.000Z', 'PR opened');
  const counted = await live([], dirs);
  assert.equal(counted.code, 0, counted.err);
  assert.match(counted.out, /^2 rows wait for the live board/m);
  assert.match((await live(['--hours', '48'], dirs)).out, /^3 rows wait/m);
  assert.equal(fs.existsSync(liveCursorPath(dirs.home, dirs.slug)), false, 'counting writes nothing');
}));

test('--out writes one batch file a document, prints the ArtifactData call and --sent moves the cursor', withFolders(async (dirs) => {
  note(dirs.home, dirs.slug, '2026-10-27T05:00:00.000Z', 'step 2 done');
  note(dirs.home, dirs.slug, '2026-10-27T05:30:00.000Z', 'waiting on the gate', 'waiting');
  const url = 'https://claude.ai/artifact/LAMAVwx92GosturPiuKbTD';
  const written = await live(['--out', dirs.out, '--url', url], dirs);
  assert.equal(written.code, 0, written.err);
  const files = fs.readdirSync(dirs.out);
  assert.equal(files.length, 1);
  assert.doesNotMatch(files[0], /:/, 'a file name Windows takes');
  const file = path.join(dirs.out, files[0]);
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(doc.time, '2026-10-27T05:30:00.000Z');
  assert.deepEqual(doc.rows.map((row) => [row.text, row.state, row.session]), [['step 2 done', 'working', 'JH 58 · live board'], ['waiting on the gate', 'waiting', 'JH 58 · live board']]);
  assert.ok(written.out.includes(`ArtifactData set: url ${url}, collection events, doc_id 2026-10-27T05:30:00.000Z-aaaaaaaa, file_path ${file}`), written.out);
  assert.ok(written.out.includes(`js-harness sessions live --sent ${file}`), written.out);

  assert.match((await live([], dirs)).out, /^2 rows wait/m, 'nothing moves until the batch is said sent');
  const sent = await live(['--sent', file], dirs);
  assert.equal(sent.code, 0, sent.err);
  assert.match(sent.out, /every notice before number 3 of the record$/m);
  const after = await live([], dirs);
  assert.match(after.out, /^0 rows wait/m);
  assert.ok(after.out.includes(`board: ${url}`), 'the recorded url is printed back');

  note(dirs.home, dirs.slug, '2026-10-27T05:45:00.000Z', 'closed', 'closed');
  assert.match((await live([], dirs)).out, /^1 row waits/m);
}));

test('a cursor of the form before is placed in the record once, and a notice that lands late still waits', withFolders(async (dirs) => {
  note(dirs.home, dirs.slug, '2026-10-27T05:00:00.000Z', 'step 2 done');
  note(dirs.home, dirs.slug, '2026-10-27T05:30:00.000Z', 'PR opened');
  fs.mkdirSync(path.dirname(liveCursorPath(dirs.home, dirs.slug)), { recursive: true });
  fs.writeFileSync(liveCursorPath(dirs.home, dirs.slug), JSON.stringify({ schema: 'js-harness.live-cursor/v1', url: 'u', through: '2026-10-27T05:30:00.000Z', ids: ['2026-10-27T05:30:00.000Z-aaaaaaaa'] }));
  assert.match((await live([], dirs)).out, /^0 rows wait/m);
  assert.deepEqual(JSON.parse(fs.readFileSync(liveCursorPath(dirs.home, dirs.slug), 'utf8')), { schema: 'js-harness.live-cursor/v1', url: 'u', upto: 2, sent: [] }, 'placed once, on the first run');
  note(dirs.home, dirs.slug, '2026-10-27T04:00:00.000Z', 'stamped before, appended after');
  assert.match((await live([], dirs)).out, /^1 row waits/m, 'an older time appended later is not lost');
  const written = await live(['--out', dirs.out], dirs);
  const file = path.join(dirs.out, fs.readdirSync(dirs.out)[0]);
  assert.equal(written.code, 0, written.err);
  assert.equal((await live(['--sent', file], dirs)).code, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(liveCursorPath(dirs.home, dirs.slug), 'utf8')), { schema: 'js-harness.live-cursor/v1', url: 'u', upto: 3, sent: [] });
  assert.match((await live([], dirs)).out, /^0 rows wait/m);
}));

test('it refuses an unknown argument, a missing value and a file that is no batch', withFolders(async (dirs) => {
  const unknown = await live(['--nope'], dirs);
  assert.equal(unknown.code, 2);
  assert.match(unknown.err, /unknown argument: --nope/);
  assert.equal((await live(['--out'], dirs)).code, 2);
  assert.equal((await live(['--hours', 'x'], dirs)).code, 2);
  assert.equal((await live(['--sent', 'a', '--out', 'b'], dirs)).code, 2);
  fs.mkdirSync(dirs.out, { recursive: true });
  const bad = path.join(dirs.out, 'bad.json');
  fs.writeFileSync(bad, '{"rows":"no"}');
  const refused = await live(['--sent', bad], dirs);
  assert.equal(refused.code, 1);
  assert.match(refused.err, /no batch/);
  assert.equal(fs.existsSync(liveCursorPath(dirs.home, dirs.slug)), false);
}));

test('sessions live --help prints its usage and exits 0, through the sessions command', withFolders(async (dirs) => {
  const out = [];
  const code = await sessionsMain(['live', '--help'], { cwd: dirs.project, stdout: (text) => out.push(text), stderr: () => {}, run: noGit, env: { JS_HARNESS_HOME: dirs.home } });
  assert.equal(code, 0);
  assert.match(out.join('\n'), /Usage: js-harness sessions live/);
}));

// Codex, f074443..4c71f21: the first send started the cursor at the record's first notice, so the notices older than
// the --hours window came back pending on the next run.
test('the notices before the --hours window stay out once the first batch was sent', withFolders(async (dirs) => {
  note(dirs.home, dirs.slug, '2026-10-25T01:00:00.000Z', 'too old for 24 hours');
  note(dirs.home, dirs.slug, '2026-10-27T05:00:00.000Z', 'step 2 done');
  assert.equal((await live(['--out', dirs.out], dirs)).code, 0);
  const files = fs.readdirSync(dirs.out);
  assert.equal(files.length, 1);
  assert.equal((await live(['--sent', path.join(dirs.out, files[0])], dirs)).code, 0);
  assert.match((await live([], dirs)).out, /^0 rows wait/m);
  fs.rmSync(dirs.out, { recursive: true });
  assert.equal((await live(['--out', dirs.out], dirs)).code, 0);
  assert.deepEqual(fs.readdirSync(dirs.out), [], 'a second run exports nothing');
}));

// Codex, f074443..4c71f21: the route's section held the progress too, so hiding it for an empty route hid the progress.
test('the board page hides the route section only when it has no steps and no valid progress', () => {
  const page = fs.readFileSync(new URL('../docs/live-board.html', import.meta.url), 'utf8');
  const source = page.match(/function routeShown\([\s\S]*?\n}\n/)?.[0];
  assert.ok(source, 'the page defines routeShown');
  const routeShown = new Function(`${source}; return routeShown;`)();
  assert.equal(routeShown({ route: [], progress: { done: 3, total: 10 } }), true);
  assert.equal(routeShown({ progress: { done: 0, total: 4 } }), true);
  assert.equal(routeShown({ route: [{ step: 'F1', state: 'now', label: 'x' }] }), true);
  assert.equal(routeShown({ route: [], progress: { total: 0 } }), false);
  assert.equal(routeShown({ route: [] }), false);
  assert.equal(routeShown(null), false);
});
