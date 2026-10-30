// The terminal layer of the TUI (odd/tasks/tui-gentle-level.md, S1-S3): the key parser, the frame layout and
// the guard, each driven with inline values and fake streams.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  splitKeys,
  createKeyReader,
  wrapLine,
  cellWidth,
  layoutFrame,
  paint,
  splitOutput,
  cleanLine,
  createTerminalGuard,
  ENTER_SCREEN,
  LEAVE_SCREEN,
} from './terminal.mjs';

// --- S3: the key parser ---

test('splitKeys reads every key of a chunk, not only a chunk that is one key', () => {
  assert.deepEqual(splitKeys('jjk').keys, ['down', 'down', 'up']);
  assert.deepEqual(splitKeys('\u001b[A\u001b[B\u001b[B').keys, ['up', 'down', 'down']);
  assert.deepEqual(splitKeys('\u001b[B\r').keys, ['down', 'enter']);
});

test('splitKeys reads CSI and SS3 arrows, PgUp/PgDn, Home/End, Space, Tab and shift+Tab', () => {
  const cases = {
    '\u001bOA': 'up', '\u001bOB': 'down', '\u001b[C': 'right', '\u001bOD': 'left',
    '\u001b[5~': 'pgup', '\u001b[6~': 'pgdn',
    '\u001b[H': 'home', '\u001b[1~': 'home', '\u001b[7~': 'home', '\u001bOH': 'home',
    '\u001b[F': 'end', '\u001b[4~': 'end', '\u001b[8~': 'end', '\u001bOF': 'end',
    ' ': 'space', '\t': 'tab', '\u001b[Z': 'shift-tab',
    '\u001b[1;5A': 'up',
  };
  for (const [chunk, key] of Object.entries(cases)) assert.deepEqual(splitKeys(chunk).keys, [key], JSON.stringify(chunk));
});

test('splitKeys maps the letters the menu answers, keeps ctrl+c apart from q, and passes other text through', () => {
  assert.deepEqual(splitKeys('qQyYnNx').keys, ['quit', 'quit', 'y', 'y', 'n', 'n', 'x']);
  assert.deepEqual(splitKeys('\u0003').keys, ['ctrl-c']);
  assert.deepEqual(splitKeys('\r\n\n').keys, ['enter', 'enter'], 'CRLF is one Enter');
  assert.deepEqual(splitKeys('\u007f').keys, ['backspace']);
  assert.deepEqual(splitKeys('\u0001\u001b[99~').keys, [], 'an unknown control or sequence is dropped');
});

test('splitKeys keeps an escape it cannot finish yet for the next chunk', () => {
  assert.deepEqual(splitKeys('j\u001b'), { keys: ['down'], rest: '\u001b' });
  assert.deepEqual(splitKeys('\u001b['), { keys: [], rest: '\u001b[' });
  assert.deepEqual(splitKeys('\u001bO'), { keys: [], rest: '\u001bO' });
  assert.deepEqual(splitKeys('\u001b\u001b[A'), { keys: ['escape', 'up'], rest: '' });
});

function fakeTimers() {
  const timers = [];
  return {
    setTimeout: (fn, ms) => {
      const timer = { fn, ms, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeout: (timer) => {
      if (timer) timer.cleared = true;
    },
    fire: () => timers.filter((t) => !t.cleared).splice(0).forEach((t) => {
      t.cleared = true;
      t.fn();
    }),
    timers,
  };
}

test('a lone Esc is a key only once the timeout passes with nothing after it', () => {
  const timers = fakeTimers();
  const keys = [];
  const reader = createKeyReader({ onKey: (key) => keys.push(key), timeoutMs: 40, ...timers });
  reader.feed('\u001b');
  assert.deepEqual(keys, []);
  assert.equal(timers.timers[0].ms, 40);
  timers.fire();
  assert.deepEqual(keys, ['escape']);
});

test('an escape sequence split across chunks is one key, never an Esc', () => {
  const timers = fakeTimers();
  const keys = [];
  const reader = createKeyReader({ onKey: (key) => keys.push(key), ...timers });
  reader.feed('\u001b');
  reader.feed('[');
  reader.feed('B');
  timers.fire();
  assert.deepEqual(keys, ['down']);
});

// --- S2: the frame ---

test('wrapLine wraps at spaces, splits a word longer than the width, and indents the rows after the first', () => {
  assert.deepEqual(wrapLine('one two three', 7), ['one two', 'three']);
  assert.deepEqual(wrapLine('abcdefghij', 4), ['abcd', 'efgh', 'ij']);
  assert.deepEqual(wrapLine('  a long item label', 10), ['  a long', '  item', '  label']);
  assert.deepEqual(wrapLine('', 10), ['']);
});

const LONG_PROMPT = "Remove everything js-harness keeps on this machine: the whole .js-harness folder of this home (the lead's notes, the backups, the memory snapshots) and the js-harness program itself? It keeps the projects' files. This cannot be undone. (y/N)";

test('no laid-out row is wider than the width, and no frame is taller than the height', () => {
  const sections = {
    top: ['js-harness 0.97.0  (update available: 0.98.0)', '  engram          4.2.0     missing codex'],
    body: Array.from({ length: 40 }, (_, i) => `${i === 30 ? '>' : ' '} Item number ${i} with a label long enough to wrap`),
    focus: 30,
    bottom: ['', LONG_PROMPT],
  };
  for (const columns of [20, 40, 80, 200]) {
    for (const rows of [6, 12, 24, 60]) {
      const frame = layoutFrame(sections, { columns, rows });
      assert.ok(frame.length <= rows, `${columns}x${rows}: ${frame.length} rows`);
      for (const row of frame) assert.ok(row.length < columns, `${columns}x${rows}: ${JSON.stringify(row)}`);
    }
  }
});

test('a confirm prompt wraps whole below the menu, never clipped', () => {
  const frame = layoutFrame({ top: ['js-harness 1.0.0'], body: ['  Machine', '> Everything', '  Back'], focus: 1, bottom: ['', LONG_PROMPT] }, { columns: 60, rows: 24 });
  assert.equal(frame.slice(frame.indexOf('') + 1).join(' ').replace(/\s+/g, ' '), LONG_PROMPT.replace(/\s+/g, ' '));
});

test('a menu taller than the window keeps the selected line on screen, and the prompt below it', () => {
  const body = Array.from({ length: 30 }, (_, i) => `${i === 25 ? '>' : ' '} Item ${i}`);
  const frame = layoutFrame({ top: ['header'], body, focus: 25, bottom: ['', 'Sure? (y/N)'] }, { columns: 40, rows: 10 });
  assert.equal(frame.length, 10);
  assert.ok(frame.includes('> Item 25'));
  assert.deepEqual(frame.slice(-2), ['', 'Sure? (y/N)']);
  assert.equal(frame[0], 'header');
});

test('a header gives way to the menu, keeping its first row and naming how many rows it hid', () => {
  const top = ['js-harness 1.0.0', ...Array.from({ length: 9 }, (_, i) => `  tool ${i}`)];
  const body = Array.from({ length: 10 }, (_, i) => `${i === 0 ? '>' : ' '} Item ${i}`);
  const frame = layoutFrame({ top, body, focus: 0, bottom: ['', 'keys'] }, { columns: 60, rows: 15 });
  assert.equal(frame.length, 15);
  assert.deepEqual(frame.slice(0, 3), ['js-harness 1.0.0', '  tool 0', '  ... 8 more rows: a taller window shows them']);
  assert.deepEqual(frame.slice(3, 13), body, 'the whole menu shows');
  const tall = layoutFrame({ top, body, focus: 0, bottom: ['', 'keys'] }, { columns: 60, rows: 40 });
  assert.deepEqual(tall, [...top, ...body, '', 'keys'], 'a window tall enough shows everything');
});

test('a log follows its tail, and a scroll offset moves the window up from it', () => {
  const body = Array.from({ length: 50 }, (_, i) => `line ${i}`);
  const tail = layoutFrame({ top: ['t'], body, scroll: 0, bottom: ['b'] }, { columns: 40, rows: 7 });
  assert.deepEqual(tail, ['t', 'line 45', 'line 46', 'line 47', 'line 48', 'line 49', 'b']);
  const up = layoutFrame({ top: ['t'], body, scroll: 10, bottom: ['b'] }, { columns: 40, rows: 7 });
  assert.deepEqual(up.slice(1, -1), ['line 35', 'line 36', 'line 37', 'line 38', 'line 39']);
  const far = layoutFrame({ top: ['t'], body, scroll: 1e9, bottom: ['b'] }, { columns: 40, rows: 7 });
  assert.equal(far[1], 'line 0', 'a scroll past the top stops on the first line');
});

test('paint repaints the whole frame from the top-left, clearing each row and what is below', () => {
  assert.equal(paint(['a', 'b']), '\u001b[H\u001b[?25la\u001b[K\r\nb\u001b[K\u001b[J');
});

// --- the log: a child's output, made safe to draw ---

test('splitOutput keeps a partial line for the next chunk', () => {
  const first = splitOutput('', 'one\ntw');
  assert.deepEqual(first, { lines: ['one'], partial: 'tw' });
  assert.deepEqual(splitOutput(first.partial, 'o\r\nthree\n'), { lines: ['two', 'three'], partial: '' });
});

test('cleanLine drops colors, cursor moves and control characters, keeps what a carriage return left, and expands tabs', () => {
  assert.equal(cleanLine('\u001b[31mred\u001b[0m plain'), 'red plain');
  assert.equal(cleanLine('50%\r100% done'), '100% done');
  assert.equal(cleanLine('a\tb'), 'a       b');
  assert.equal(cleanLine('x\u009b2Jy\u0007\u001b]0;title\u0007z'), 'xyz');
});

// --- S1: the guard ---

function fakeTerminal() {
  const stdin = { raw: false, setRawMode(on) { this.raw = on; } };
  const out = [];
  const stdout = { write: (s) => out.push(s) };
  const proc = new EventEmitter();
  return { stdin, stdout, out, proc };
}

test('the guard enters the alternate screen with a hidden cursor and raw keys, and restores all three once', () => {
  const { stdin, stdout, out, proc } = fakeTerminal();
  const guard = createTerminalGuard({ stdin, stdout, proc });
  guard.enter();
  assert.equal(stdin.raw, true);
  assert.deepEqual(out, [ENTER_SCREEN]);
  guard.restore();
  guard.restore();
  assert.equal(stdin.raw, false);
  assert.deepEqual(out, [ENTER_SCREEN, LEAVE_SCREEN], 'restored exactly once');
  assert.equal(proc.listenerCount('exit'), 0, 'its handlers leave with it');
});

test('the guard restores the terminal when the process exits, an error included', () => {
  const { stdin, stdout, out, proc } = fakeTerminal();
  createTerminalGuard({ stdin, stdout, proc }).enter();
  proc.emit('exit', 1);
  assert.equal(stdin.raw, false);
  assert.equal(out.at(-1), LEAVE_SCREEN);
});

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  test(`the guard restores the terminal on ${signal}, then hands the signal on`, () => {
    const { stdin, stdout, out, proc } = fakeTerminal();
    const got = [];
    createTerminalGuard({ stdin, stdout, proc, onSignal: (sig) => got.push([sig, stdin.raw, out.at(-1)]) }).enter();
    proc.emit(signal);
    assert.deepEqual(got, [[signal, false, LEAVE_SCREEN]]);
  });
}

test('rows are measured in terminal cells: a wide character takes two, a combining mark none, and a pair is never split', () => {
  assert.equal(cellWidth('abc'), 3);
  assert.equal(cellWidth('文件'), 4);
  assert.equal(cellWidth('é'), 1);
  assert.equal(cellWidth('😀'), 2);
  assert.equal(cellWidth('🚀🪐'), 4);
  for (const width of [3, 5, 9]) {
    for (const row of wrapLine('文件名 '.repeat(6) + '😀'.repeat(5), width)) {
      assert.ok(cellWidth(row) <= width, `${JSON.stringify(row)} is ${cellWidth(row)} cells, wider than ${width}`);
      assert.ok(!/[�-�](?![�-�])|(?<![�-�])[�-�]/.test(row), `${JSON.stringify(row)} splits a pair`);
    }
  }
  for (const row of layoutFrame({ body: ['日本語のファイル名 '.repeat(8)] }, { columns: 20, rows: 30 })) assert.ok(cellWidth(row) <= 19);
});

test('while suspended, a termination or a hangup still ends the menu: only ctrl+c goes to the command', () => {
  for (const signal of ['SIGTERM', 'SIGHUP']) {
    const { stdin, stdout, out, proc } = fakeTerminal();
    const got = [];
    const guard = createTerminalGuard({ stdin, stdout, proc, onSignal: (sig) => got.push(sig) });
    guard.enter();
    guard.suspend();
    const writes = out.length;
    proc.emit(signal);
    assert.deepEqual(got, [signal]);
    assert.equal(out.length, writes, 'the main screen is already back: nothing more is written');
    assert.equal(stdin.raw, false);
  }
});

test('while suspended for a command that owns the terminal, the guard is on the main screen and ignores ctrl+c', () => {
  const { stdin, stdout, out, proc } = fakeTerminal();
  const got = [];
  const guard = createTerminalGuard({ stdin, stdout, proc, onSignal: (sig) => got.push(sig) });
  guard.enter();
  guard.suspend();
  assert.equal(stdin.raw, false);
  assert.equal(out.at(-1), LEAVE_SCREEN);
  proc.emit('SIGINT');
  assert.deepEqual(got, [], 'the command gets ctrl+c, the menu stays');
  guard.resume();
  assert.equal(stdin.raw, true);
  assert.equal(out.at(-1), ENTER_SCREEN);
  guard.restore();
});
