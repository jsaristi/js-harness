import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { TRIM_AT_BYTES, trimSessionEnv, trimmedEnvText } from './session-env.mjs';

const SESSION = '0f71b2c6-cbce-43ca-a031-276a4b2c381f';
// The three lines the codex plugin appends at every start, as `session-lifecycle-hook.mjs` writes them.
const START = [
  `export CODEX_COMPANION_SESSION_ID='${SESSION}'`,
  `export CODEX_COMPANION_TRANSCRIPT_PATH='C:\\Users\\Oficina\\.claude\\projects\\D--js-harness\\${SESSION}.jsonl'`,
  "export CLAUDE_PLUGIN_DATA='C:/Users/Oficina/.claude/plugins/data/codex-openai-codex'",
].join('\n');
const starts = (count) => `${Array.from({ length: count }, () => START).join('\n')}\n`;

/** A home and a session's env folder in a scratch directory, with the codex file holding `text`. */
function scratch(t, text) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'session-env-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const folder = path.join(root, '.claude', 'session-env', SESSION);
  fs.mkdirSync(folder, { recursive: true });
  const codex = path.join(folder, 'sessionstart-hook-6.sh');
  fs.writeFileSync(codex, text);
  return { home: root, folder, codex, envFile: path.join(folder, 'sessionstart-hook-3.sh') };
}

/** What sourcing `lines` leaves set: each variable's last assigned value. */
const finalValues = (lines) => new Map(lines.map((line) => /^export ([^=]+)=(.*)$/.exec(line).slice(1)));

const NOW = Date.parse('2026-11-04T07:00:00.000Z');

test('the text keeps the last occurrence of each line, in order, so every variable keeps its final value', () => {
  assert.equal(trimmedEnvText(starts(35)), `${START}\n`);
  // A value that changed: the transcript path moved with the session's folder, and the last one counts.
  const moved = "export CODEX_COMPANION_TRANSCRIPT_PATH='C:\\elsewhere\\x.jsonl'";
  const text = `${START}\n${moved}\n${START}\n${moved}\n`;
  const kept = trimmedEnvText(text).trimEnd().split('\n');
  assert.deepEqual(kept, [...START.split('\n'), moved]);
  assert.deepEqual(finalValues(kept), finalValues(text.trimEnd().split('\n')));
  assert.equal(finalValues(kept).get('CODEX_COMPANION_TRANSCRIPT_PATH'), "'C:\\elsewhere\\x.jsonl'");
  // Moved back: the first occurrences would leave the moved path set, the last ones leave the path it came back to.
  const back = `${START}\n${moved}\n${START}\n`;
  assert.deepEqual(finalValues(trimmedEnvText(back).trimEnd().split('\n')), finalValues(back.trimEnd().split('\n')));
  // The plugin's escape of a quote inside a value is the same shape.
  const quoted = "export NAME='it'\"'\"'s'";
  assert.equal(trimmedEnvText(`${quoted}\n${quoted}\n`), `${quoted}\n`);
});

test('the text is left alone when nothing repeats or a line is not a plain export assignment', () => {
  assert.equal(trimmedEnvText(starts(1)), null);
  assert.equal(trimmedEnvText(''), null);
  // A line that reads another variable depends on order: the file is not rewritten at all.
  for (const line of ['export PATH="$PATH:/x"', 'PATH=/x', 'export A=$(id)', 'echo hi', "export A='open"]) {
    assert.equal(trimmedEnvText(`${starts(3)}${line}\n`), null, line);
  }
});

test('a start trims a file past the threshold, after a backup and a record that undo it exactly', (t) => {
  const before = starts(35);
  assert.ok(Buffer.byteLength(before) > TRIM_AT_BYTES);
  const { home, codex, envFile } = scratch(t, before);
  const trims = trimSessionEnv({ envFile, home, now: NOW });

  assert.equal(fs.readFileSync(codex, 'utf8'), `${START}\n`);
  assert.equal(trims.length, 1);
  const [trim] = trims;
  assert.equal(trim.file, codex);
  assert.equal(fs.readFileSync(trim.backup, 'utf8'), before);
  assert.ok(trim.backup.startsWith(path.join(home, '.js-harness', 'session-env-trims', SESSION)));
  const ledger = fs.readFileSync(path.join(home, '.js-harness', 'session-env-trims', 'trims.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].at, '2026-11-04T07:00:00.000Z');
  assert.equal(ledger[0].file, codex);
  assert.equal(ledger[0].backup, trim.backup);
  assert.equal(ledger[0].sha256Before, createHash('sha256').update(before).digest('hex'));
  assert.deepEqual([ledger[0].bytesBefore, ledger[0].bytesAfter], [Buffer.byteLength(before), Buffer.byteLength(`${START}\n`)]);
  assert.match(ledger[0].undo, /^cp -p '.+' '.+'$/);

  // The undo is the backup copied back: the file is again what it was, byte for byte.
  fs.copyFileSync(ledger[0].backup, ledger[0].file);
  assert.equal(fs.readFileSync(codex, 'utf8'), before);
  // A second start in the same millisecond keeps its own backup: none is overwritten.
  const again = trimSessionEnv({ envFile, home, now: NOW });
  assert.equal(again.length, 1);
  assert.notEqual(again[0].backup, trim.backup);
  assert.equal(fs.readFileSync(trim.backup, 'utf8'), before);
});

test('a file under the threshold, another kind of file or no CLAUDE_ENV_FILE is not touched', (t) => {
  const small = starts(6);
  assert.ok(Buffer.byteLength(small) <= TRIM_AT_BYTES);
  const { home, folder, codex, envFile } = scratch(t, small);
  const other = path.join(folder, 'cwdchanged-hook-1.sh');
  fs.writeFileSync(other, starts(35));
  assert.deepEqual(trimSessionEnv({ envFile, home, now: NOW }), []);
  assert.equal(fs.readFileSync(codex, 'utf8'), small);
  assert.equal(fs.readFileSync(other, 'utf8'), starts(35));
  assert.deepEqual(trimSessionEnv({ envFile: undefined, home, now: NOW }), []);
  assert.deepEqual(trimSessionEnv({ envFile: path.join(home, 'gone', 'sessionstart-hook-1.sh'), home, now: NOW }), []);
  assert.equal(fs.existsSync(path.join(home, '.js-harness', 'session-env-trims')), false);
});

test('a record that cannot be written puts the file back as it was, with no backup left', (t) => {
  const before = starts(35);
  const { home, codex, envFile } = scratch(t, before);
  const trims = path.join(home, '.js-harness', 'session-env-trims');
  // A folder where the record's file goes: the append fails after the file was replaced.
  fs.mkdirSync(path.join(trims, 'trims.jsonl'), { recursive: true });
  assert.deepEqual(trimSessionEnv({ envFile, home, now: NOW }), []);
  assert.equal(fs.readFileSync(codex, 'utf8'), before);
  assert.deepEqual(fs.readdirSync(path.join(trims, SESSION)), []);
  assert.deepEqual(fs.readdirSync(path.dirname(codex)), ['sessionstart-hook-6.sh']);

  // The codex hook appends after the replace and before the file is put back: its lines stay, after the old text.
  let reads = 0;
  const io = {
    readFile: (file) => {
      reads += 1;
      if (reads === 3) fs.appendFileSync(file, `${START}\n`);
      return fs.readFileSync(file, 'utf8');
    },
  };
  assert.deepEqual(trimSessionEnv({ envFile, home, now: NOW }, io), []);
  assert.equal(fs.readFileSync(codex, 'utf8'), `${before}${START}\n`);
  assert.deepEqual(fs.readdirSync(path.join(trims, SESSION)), []);

  // Something else rewrote the file meanwhile: it is left as that writer left it, and the backup stays.
  fs.writeFileSync(codex, before);
  reads = 0;
  io.readFile = (file) => {
    reads += 1;
    if (reads === 3) fs.writeFileSync(file, 'export OTHER=\'x\'\n');
    return fs.readFileSync(file, 'utf8');
  };
  assert.throws(() => trimSessionEnv({ envFile, home, now: NOW }, io));
  assert.equal(fs.readFileSync(codex, 'utf8'), "export OTHER='x'\n");
  const [kept] = fs.readdirSync(path.join(trims, SESSION));
  assert.equal(fs.readFileSync(path.join(trims, SESSION, kept), 'utf8'), before);
});

test('a file that changed between the read and the replace is left as the other writer left it, with no record', (t) => {
  const before = starts(35);
  const { home, codex, envFile } = scratch(t, before);
  const appended = `${before}${START}\n`;
  let reads = 0;
  const io = {
    readFile: (file) => {
      reads += 1;
      // The codex hook appends between the trim's first read and its check just before the replace.
      if (file === codex && reads === 2) fs.writeFileSync(codex, appended);
      return fs.readFileSync(file, 'utf8');
    },
  };
  assert.deepEqual(trimSessionEnv({ envFile, home, now: NOW }, io), []);
  assert.equal(fs.readFileSync(codex, 'utf8'), appended);
  const trims = path.join(home, '.js-harness', 'session-env-trims');
  assert.equal(fs.existsSync(path.join(trims, 'trims.jsonl')), false);
  assert.deepEqual(fs.existsSync(path.join(trims, SESSION)) ? fs.readdirSync(path.join(trims, SESSION)) : [], []);
});
