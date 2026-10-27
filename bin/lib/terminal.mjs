// The terminal layer of the TUI (odd/tasks/tui-gentle-level.md, S1-S3), after gentle-ai's Bubble Tea design and
// with no dependency: a key parser that reads every key of a chunk, a frame laid out to the window and repainted
// whole, and a guard that always gives the terminal back. Only the guard touches a stream; the rest takes strings.

// The alternate screen, cleared, with the cursor hidden; and the way back: cursor shown, main screen as it was.
export const ENTER_SCREEN = '\u001b[?1049h\u001b[H\u001b[2J\u001b[?25l';
export const LEAVE_SCREEN = '\u001b[?25h\u001b[?1049l';

const LETTERS = { j: 'down', J: 'down', k: 'up', K: 'up', q: 'quit', Q: 'quit', y: 'y', Y: 'y', n: 'n', N: 'n' };
const CONTROLS = { '\u0003': 'ctrl-c', '\t': 'tab', ' ': 'space', '\u007f': 'backspace', '\b': 'backspace', '\n': 'enter' };
// The final byte of an arrow or Home/End sequence, CSI (`ESC [`) or SS3 (`ESC O`) alike.
const FINALS = { A: 'up', B: 'down', C: 'right', D: 'left', H: 'home', F: 'end', Z: 'shift-tab' };
// `ESC [ <n> ~`, as xterm, Windows Terminal and conhost send them.
const TILDES = { 1: 'home', 7: 'home', 4: 'end', 8: 'end', 5: 'pgup', 6: 'pgdn' };

/** The keys `input` holds, in order, and `rest`: an escape sequence not finished yet, which the next chunk may
 * complete. Unknown sequences and control characters are dropped; any other character is its own key. */
export function splitKeys(input) {
  const keys = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (c === '\u001b') {
      const next = input[i + 1];
      if (next === undefined) return { keys, rest: input.slice(i) };
      if (next === '[') {
        let j = i + 2;
        while (j < input.length && input.charCodeAt(j) >= 0x20 && input.charCodeAt(j) <= 0x3f) j++;
        if (j >= input.length) return { keys, rest: input.slice(i) };
        const final = input[j];
        const key = final === '~' ? TILDES[input.slice(i + 2, j).split(';')[0]] : FINALS[final];
        if (key) keys.push(key);
        i = j + 1;
        continue;
      }
      if (next === 'O') {
        if (i + 2 >= input.length) return { keys, rest: input.slice(i) };
        if (FINALS[input[i + 2]]) keys.push(FINALS[input[i + 2]]);
        i += 3;
        continue;
      }
      // An Esc followed by anything else is an Esc, then that key (an Alt chord reads as both).
      keys.push('escape');
      i += 1;
      continue;
    }
    if (c === '\r') {
      keys.push('enter');
      i += input[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    const point = String.fromCodePoint(input.codePointAt(i));
    i += point.length;
    if (CONTROLS[point]) keys.push(CONTROLS[point]);
    else if (LETTERS[point]) keys.push(LETTERS[point]);
    else if (point >= ' ' && !(point >= '\u0080' && point <= '\u009f')) keys.push(point);
  }
  return { keys, rest: '' };
}

/** A reader fed raw chunks that calls `onKey` once per key. An Esc alone is held for `timeoutMs`: an arrow can
 * arrive split across chunks, and only an Esc with nothing after it is the key. */
export function createKeyReader({ onKey, timeoutMs = 50, setTimeout: later = setTimeout, clearTimeout: cancel = clearTimeout }) {
  let pending = '';
  let timer = null;
  return {
    feed(chunk) {
      cancel(timer);
      timer = null;
      const { keys, rest } = splitKeys(pending + chunk);
      pending = rest;
      for (const key of keys) onKey(key);
      if (pending) {
        timer = later(() => {
          timer = null;
          pending = '';
          onKey('escape');
        }, timeoutMs);
      }
    },
    dispose() {
      cancel(timer);
      timer = null;
      pending = '';
    },
  };
}

/** `text` as rows no wider than `width`: wrapped at spaces, a word longer than a row split, and every row after
 * the first indented like the first, so a wrapped item still reads as one. */
export function wrapLine(text, width) {
  const w = Math.max(1, width);
  if (text.length <= w) return [text];
  const indent = text.match(/^ */)[0].slice(0, Math.floor(w / 2));
  const rows = [];
  let row = '';
  for (const word of text.slice(indent.length).split(/ +/)) {
    let rest = word;
    while (rest) {
      const lead = row ? `${row} ` : indent;
      if (lead.length + rest.length <= w) {
        row = lead + rest;
        rest = '';
      } else if (row) {
        rows.push(row);
        row = '';
      } else {
        const room = w - indent.length;
        rows.push(indent + rest.slice(0, room));
        rest = rest.slice(room);
      }
    }
  }
  if (row) rows.push(row);
  return rows.length ? rows : [''];
}

const wrapAll = (lines, width) => lines.flatMap((line) => wrapLine(line, width));

/**
 * The rows to draw for `{ top, body, bottom }` in a `{ columns, rows }` window. Every line is wrapped one column
 * short of the window (a row that fills the last column wraps by itself on conhost, which is how the old menu
 * duplicated), so no row is clipped. `bottom` (a prompt, the keys) always shows whole; `top` gives way to a menu
 * next, keeping its first row and naming how many it hid; the body gets the rows left, around line `focus` (a
 * menu's selection) or `scroll` rows above its tail (a log).
 */
export function layoutFrame({ top = [], body = [], bottom = [], focus, scroll = 0 }, { columns = 80, rows = 24 } = {}) {
  const width = Math.max(1, (columns || 80) - 1);
  const height = Math.max(1, rows || 24);
  const bottomRows = wrapAll(bottom, width);
  if (bottomRows.length >= height) return bottomRows.slice(-height);
  const topRows = wrapAll(top, width);
  const bodyRows = [];
  let focusStart = 0;
  let focusEnd = 0;
  for (const [i, line] of body.entries()) {
    if (i === focus) focusStart = bodyRows.length;
    bodyRows.push(...wrapLine(line, width));
    if (i === focus) focusEnd = bodyRows.length;
  }
  // The top gives way to a menu (what the user acts on), down to its first row, and says what it hid; above a log
  // it stays whole, since it names the run.
  const spare = height - bottomRows.length - (focus === undefined ? 1 : Math.max(body.length ? 1 : 0, bodyRows.length));
  const topKeep = Math.max(0, Math.min(topRows.length, Math.max(Math.min(1, topRows.length), spare), height - bottomRows.length - (body.length ? 1 : 0)));
  let shownTop = topRows.slice(0, topKeep);
  if (topKeep >= 2 && topKeep < topRows.length) {
    const hidden = topRows.length - topKeep + 1;
    shownTop = [...shownTop.slice(0, -1), wrapLine(`  ... ${hidden} more rows: a taller window shows them`, width)[0]];
  }
  const room = height - topKeep - bottomRows.length;
  let start = 0;
  if (bodyRows.length > room) {
    const last = bodyRows.length - room;
    if (focus === undefined) start = Math.max(0, last - Math.max(0, scroll));
    else start = Math.min(last, Math.max(0, focusStart - Math.floor((room - (focusEnd - focusStart)) / 2)));
  }
  return [...shownTop, ...bodyRows.slice(start, start + room), ...bottomRows];
}

/** The text that repaints `rows` over the whole screen: home, each row cleared to its end, the rest cleared below.
 * No newline follows the last row, so a frame as tall as the window never scrolls it. */
export function paint(rows) {
  return `\u001b[H\u001b[?25l${rows.map((row) => `${row}\u001b[K`).join('\r\n')}\u001b[J`;
}

/** A child's output chunk split into whole lines, with the unfinished last one kept as `partial`. */
export function splitOutput(partial, chunk) {
  const parts = (partial + chunk).split(/\r?\n/);
  return { lines: parts.slice(0, -1), partial: parts.at(-1) };
}

/** One line of a child's output, safe to draw: no colors, cursor moves, titles or control characters (U+009B is a
 * one-byte CSI on some terminals), only what the last carriage return left, and tabs expanded to stops of 8. */
export function cleanLine(line) {
  const stripped = line
    .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, '')
    .replace(/(?:\u001b\[|\u009b)[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\u001b[@-_]?/g, '');
  const shown = stripped.split('\r').at(-1);
  let out = '';
  for (const c of shown) {
    if (c === '\t') out += ' '.repeat(8 - (out.length % 8));
    else if (!/[\u0000-\u001f\u007f-\u009f]/.test(c)) out += c;
  }
  return out;
}

const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'];

/**
 * The guard of the terminal: `enter` takes the alternate screen, hides the cursor and reads keys raw; `restore`
 * undoes all three, once, whatever ended the menu. It restores by itself when the process exits (an uncaught error
 * included) and on SIGINT, SIGTERM or SIGHUP, then hands the signal to `onSignal`, which ends the process.
 * `suspend` and `resume` hand the terminal to a command that asks its own questions, and back; while suspended,
 * a ctrl+c is the command's, so the guard lets it pass.
 */
export function createTerminalGuard({ stdin, stdout, proc = process, onSignal = () => {} }) {
  let entered = false;
  let suspended = false;
  const take = () => {
    stdout.write(ENTER_SCREEN);
    stdin.setRawMode?.(true);
  };
  const giveBack = () => {
    stdin.setRawMode?.(false);
    stdout.write(LEAVE_SCREEN);
  };
  const onExit = () => restore();
  const handlers = Object.fromEntries(SIGNALS.map((signal) => [signal, () => {
    if (suspended) return;
    restore();
    onSignal(signal);
  }]));
  function restore() {
    if (!entered) return;
    entered = false;
    proc.removeListener('exit', onExit);
    for (const signal of SIGNALS) proc.removeListener(signal, handlers[signal]);
    if (!suspended) giveBack();
    suspended = false;
  }
  return {
    enter() {
      if (entered) return;
      entered = true;
      take();
      proc.on('exit', onExit);
      for (const signal of SIGNALS) proc.on(signal, handlers[signal]);
    },
    suspend() {
      if (!entered || suspended) return;
      suspended = true;
      giveBack();
    },
    resume() {
      if (!entered || !suspended) return;
      suspended = false;
      take();
    },
    restore,
  };
}
