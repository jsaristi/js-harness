// `readShell`: one pass over a Bash command in the grammar bash reads (quotes, `$'…'`, backslashes, comments, `$(…)`,
// backticks, `$((…))`, `${…}`, heredocs with their bodies, here-strings, operators and groups), for the advisor gate's
// reading of the acts a command runs (bin/advisor-gate.mjs; odd/tasks/advisor-use.md, T8, L35). It is apart from
// `shellWords` (./guard.mjs), which drops every heredoc body whatever reads it, keeps a `$(…)` unread in its word and
// reads `$((1<<X))` as a heredoc that swallows the next line: here a body is kept with the command it feeds, a
// substitution's commands are read, and what cannot be read whole is said `broken`, so the caller never takes a
// half-read command for a whole one. Pure: it reads a string and runs nothing.

/** One pass over `source` as bash reads it: `{ commands, bodies, broken }`. Each command is `{ words, heredocs,
 * hereStrings, stdin, raw }`, those inside a substitution among them: its words `{ text, raw, expands, quoted }`
 * (`text` with the quotes taken off, `expands` when a `$` or a backtick may change it); `stdin` says what feeds it
 * (`pipe`, `file`, or null). `bodies` holds every heredoc `{ text, quoted }`. `broken` says the reading may not be
 * bash's: an unterminated quote, substitution or heredoc, an escape past the last code point, a `case` inside a
 * substitution, or arithmetic bash may take for a subshell (it holds a quote or the advisor gate's program name). */
export function readShell(source, { body = false } = {}) {
  const commands = [];
  const bodies = [];
  const pending = [];
  let broken = false;
  let i = 0;
  // Git for Windows' bash ends a line at `\r\n` and keeps a lone `\r` as a character (the verifier's round 1, run
  // there); on another bash a `\r` left at a line's end only makes a word no command takes.
  const s = source.replace(/\r\n/g, '\n');

  // Reads the heredoc bodies pending at the newline at `i`; `i` ends on the newline after the last.
  const readBodies = () => {
    for (const heredoc of pending.splice(0)) {
      const lines = [];
      let found = false;
      while (i < s.length) {
        const next = s.indexOf('\n', i + 1);
        const line = s.slice(i + 1, next === -1 ? s.length : next);
        i = next === -1 ? s.length : next;
        const bare = heredoc.tabs ? line.replace(/^\t+/, '') : line;
        if (bare === heredoc.end) {
          found = true;
          break;
        }
        // Inside a substitution bash 5.3 also ends the body at a line that starts with the delimiter and has a `)`
        // after it (`EOF)`, `EOF x)`): where that is cannot be told here, so the reading is broken.
        if (bare.startsWith(heredoc.end) && bare.indexOf(')', heredoc.end.length) !== -1) broken = true;
        // An unquoted body joins a line that ends in a backslash with the next before it looks for the end line: the
        // join is not read here, so the reading is broken (Codex on 92695d2).
        if (!heredoc.quoted && /(^|[^\\])(\\\\)*\\$/.test(line)) broken = true;
        lines.push(heredoc.tabs ? line.replace(/^\t+/, '') : line);
      }
      if (!found) broken = true;
      heredoc.text = lines.join('\n');
      bodies.push(heredoc);
      // An unquoted delimiter's body is expanded: its substitutions run.
      if (!heredoc.quoted) {
        const sub = readShell(heredoc.text, { body: true });
        if (sub.broken) broken = true;
        commands.push(...sub.commands);
        bodies.push(...sub.bodies);
      }
    }
  };

  // Reads the expansion that starts at `i` (`$` or a backtick) into `word`; `inDouble` inside double quotes, where
  // `$'` is two characters and a single quote in `${…}` is one.
  const readDollar = (word, inDouble = false) => {
    if (s[i] === '`') {
      let end = i + 1;
      let inner = '';
      while (end < s.length && s[end] !== '`') {
        // Inside double quotes a backslash also escapes a double quote.
        if (s[end] === '\\' && (inDouble ? /[`$\\"]/ : /[`$\\]/).test(s[end + 1] ?? '')) end++;
        inner += s[end];
        end++;
      }
      if (end >= s.length) broken = true;
      const sub = readShell(inner);
      if (sub.broken) broken = true;
      commands.push(...sub.commands);
      bodies.push(...sub.bodies);
      word.text += s.slice(i, end + 1);
      word.raw += s.slice(i, end + 1);
      word.expands = true;
      i = end + 1;
      return true;
    }
    if (s[i] !== '$') return false;
    const start = i;
    if ((s[i + 1] === '(' && s[i + 2] === '(') || s[i + 1] === '[') {
      i += 1;
      arithmetic(start);
    } else if (s[i + 1] === '(') {
      i += 1;
      subshell();
    } else if (s[i + 1] === '{') {
      // A parameter expansion: to its matching `}`, its quotes and substitutions read.
      i += 2;
      // Bash 5.3 runs `${ cmd; }` and `${| cmd; }` in the current shell: not read here, so broken (Codex on 92695d2).
      if (/[ \t\n|]/.test(s[i] ?? '')) broken = true;
      let depth = 1;
      const inner = { text: '', raw: '', expands: false };
      while (i < s.length && depth > 0) {
        const c = s[i];
        if (c === '\\') {
          i += 2;
        } else if (c === "'" && !inDouble) {
          const end = s.indexOf("'", i + 1);
          if (end === -1) broken = true;
          i = end === -1 ? s.length : end + 1;
        } else if (c === '"') {
          readDouble(inner);
        } else if (c === '$' || c === '`') {
          readDollar(inner, inDouble);
        } else {
          // A literal `{` does not hide the `}` that ends the expansion, and a `<(…)` or `>(…)` in an unquoted operand
          // runs (inside double quotes it is text): neither is read here, so the reading is broken (Codex on 92695d2).
          if (c === '{' || (!inDouble && (c === '<' || c === '>') && s[i + 1] === '(')) broken = true;
          if (c === '{') depth++;
          else if (c === '}') depth--;
          i++;
        }
      }
      if (depth > 0) broken = true;
    } else if (s[i + 1] === '"' && !inDouble) {
      // Locale quoting, `$"…"`: double quotes once translated, here read as they are.
      i += 1;
      readDouble(word);
      return true;
    } else if (s[i + 1] === "'" && !inDouble) {
      // ANSI-C quoting, its escapes decoded as bash decodes them: the text is the word bash runs.
      i += 2;
      while (i < s.length && s[i] !== "'") {
        if (s[i] === '\\') {
          const decoded = ansiEscape();
          // Bash cuts the word at a decoded NUL; that cut is not read here, so the reading is broken (Codex on 92695d2).
          if (decoded.includes('\0')) broken = true;
          word.text += decoded;
        } else word.text += s[i++];
      }
      if (i >= s.length) broken = true;
      word.raw += s.slice(start, i + 1);
      word.quoted = true;
      i += 1;
      return true;
    } else if (/[A-Za-z0-9_@*#?$!-]/.test(s[i + 1] ?? '')) {
      i += 1;
      while (/[A-Za-z0-9_]/.test(s[i] ?? '')) i++;
      if (i === start + 1) i++;
    } else {
      // A lone `$` is a character.
      word.text += '$';
      word.raw += '$';
      i += 1;
      return true;
    }
    word.text += s.slice(start, i);
    word.raw += s.slice(start, i);
    word.expands = true;
    return true;
  };

  // Reads arithmetic, `$((…))`, `$[…]` or a `((…))` command, whose first bracket is at `i`, to its match; `i` ends
  // after it. `<<` in it is a shift, not a heredoc; a `$(` or a backtick inside still runs. bash may read a `((`
  // that is no arithmetic as a subshell: such a text is said broken, below.
  const arithmetic = (start) => {
    const open = s[i];
    const close = open === '[' ? ']' : ')';
    let depth = 0;
    for (; i < s.length; i++) {
      if (s[i] === '$' && s[i + 1] === '(' && s[i + 2] !== '(') {
        i += 1;
        subshell();
        i -= 1;
      } else if (s[i] === '`') {
        readDollar({ text: '', raw: '', expands: false });
        i -= 1;
      } else if (s[i] === open) depth++;
      else if (s[i] === close && --depth === 0) break;
    }
    // Which of the two bash takes cannot be told here: a quote, or the program's name (the advisor gate's), says
    // the text may be commands, so it is not read as arithmetic.
    if (i >= s.length || /['"\\]|js-harness/i.test(s.slice(start, i))) broken = true;
    i += 1;
  };

  // Decodes one escape of `$'…'` whose backslash is at `i`; `i` ends after it.
  const ansiEscape = () => {
    const c = s[i + 1] ?? '';
    const simple = { a: '\x07', b: '\b', e: '\x1b', E: '\x1b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v' };
    const digits = (from, re, max, base) => {
      let k = from;
      while (k < from + max && re.test(s[k] ?? '')) k++;
      const value = s.slice(from, k);
      if (value === '') return null;
      i = k;
      const point = parseInt(value, base);
      if (point > 0x10ffff) {
        broken = true;
        return '';
      }
      return String.fromCodePoint(point);
    };
    if (Object.hasOwn(simple, c)) {
      i += 2;
      return simple[c];
    }
    if (/[0-7]/.test(c)) return digits(i + 1, /[0-7]/, 3, 8);
    if (c === 'x' || c === 'u' || c === 'U') {
      const value = digits(i + 2, /[0-9A-Fa-f]/, c === 'x' ? 2 : c === 'u' ? 4 : 8, 16);
      if (value !== null) return value;
    } else if (c === 'c' && i + 2 < s.length) {
      i += 3;
      return String.fromCharCode(s[i - 1].toUpperCase().charCodeAt(0) ^ 64);
    }
    i += 2;
    return /['"\\?]/.test(c) ? c : '\\' + c;
  };

  // Reads a `$(` whose `(` is at `i`, to its `)`; `i` ends after it.
  const subshell = () => {
    i += 1;
    list(')');
    if (s[i] !== ')') broken = true;
    i += 1;
  };

  // Reads a double-quoted span whose `"` is at `i` into `word`.
  const readDouble = (word) => {
    const start = i;
    i += 1;
    while (i < s.length && s[i] !== '"') {
      if (s[i] === '\\' && /[$`"\\\n]/.test(s[i + 1] ?? '')) {
        if (s[i + 1] !== '\n') word.text += s[i + 1];
        i += 2;
      } else if (s[i] === '$' || s[i] === '`') {
        const before = word.raw;
        readDollar(word, true);
        word.raw = before;
      } else {
        word.text += s[i];
        i += 1;
      }
    }
    if (i >= s.length) broken = true;
    i += 1;
    word.raw += s.slice(start, i);
    word.quoted = true;
  };

  // Reads one word from `i`, or returns null at an operator, a blank, a newline or the end.
  const readWord = () => {
    const word = { text: '', raw: '', expands: false, quoted: false };
    let any = false;
    while (i < s.length) {
      const c = s[i];
      if (c === '\\') {
        if (s[i + 1] === '\n') {
          i += 2;
          continue;
        }
        word.text += s[i + 1] ?? '';
        word.raw += s.slice(i, i + 2);
        word.quoted = true;
        i += 2;
      } else if (c === "'") {
        const end = s.indexOf("'", i + 1);
        if (end === -1) {
          broken = true;
          word.text += s.slice(i + 1);
          word.raw += s.slice(i);
          i = s.length;
        } else {
          word.text += s.slice(i + 1, end);
          word.raw += s.slice(i, end + 1);
          i = end + 1;
        }
        word.quoted = true;
      } else if (c === '"') {
        readDouble(word);
      } else if (c === '$' || c === '`') {
        // An expansion outside double quotes is split into words and globbed: `splits` says so.
        const was = word.expands;
        word.expands = false;
        readDollar(word);
        if (word.expands) word.splits = true;
        word.expands ||= was;
      } else if ((c === '<' || c === '>') && s[i + 1] === '(') {
        // A process substitution runs its commands.
        i += 1;
        subshell();
        word.text += '<()';
        word.raw += '<()';
        word.expands = true;
      } else if (c === '(' && !word.quoted && /^[A-Za-z_][A-Za-z0-9_]*\+?=$/.test(word.raw)) {
        // An array assignment, `name=(a b)`: its elements are words of this one, their substitutions still read.
        const open = i;
        i += 1;
        while (i < s.length && s[i] !== ')') {
          if (/[ \t\n]/.test(s[i])) i++;
          else if (readWord() === null) {
            broken = true;
            i++;
          }
        }
        if (i >= s.length) broken = true;
        i += 1;
        word.text += s.slice(open, i);
        word.raw += s.slice(open, i);
        word.expands = true;
      } else if (/[ \t\n;&|()<>]/.test(c)) {
        // bash's blanks are a space and a tab: a carriage return, a form feed or a no-break space is a character.
        break;
      } else {
        // A glob or brace character outside quotes may make other words: `globs` says so.
        if (/[*?[{~]/.test(c)) word.globs = true;
        word.text += c;
        word.raw += c;
        i += 1;
      }
      any = true;
    }
    return any ? word : null;
  };

  // Reads commands until `end` (`)` for a substitution) or the end of the text.
  const list = (end) => {
    let depth = 0;
    let command = null;
    let pipedIn = false;
    let commandStart = i;
    const finish = () => {
      if (command !== null) {
        command.raw = s.slice(commandStart, i);
        commands.push(command);
      }
      command = null;
    };
    const current = () => {
      if (command === null) {
        command = { words: [], heredocs: [], hereStrings: [], stdin: pipedIn ? 'pipe' : null, raw: '' };
        commandStart = i;
        pipedIn = false;
      }
      return command;
    };
    while (i < s.length) {
      const c = s[i];
      if (c === ' ' || c === '\t') {
        i++;
      } else if (c === '\\' && s[i + 1] === '\n') {
        i += 2;
      } else if (c === '#') {
        while (i < s.length && s[i] !== '\n') i++;
      } else if (c === '\n') {
        finish();
        readBodies();
        i++;
      } else if (c === ')') {
        if (depth === 0 && end === ')') {
          finish();
          return;
        }
        finish();
        if (depth > 0) depth--;
        i++;
      } else if (c === '(') {
        finish();
        if (s[i + 1] === '(') {
          arithmetic(i);
        } else {
          depth++;
          i++;
        }
      } else if (c === ';' || c === '&' || c === '|') {
        if (c === '&' && s[i + 1] === '>') {
          // `&>` and `&>>` redirect both outputs.
          i += s[i + 2] === '>' ? 3 : 2;
          current();
          skipBlanks();
          readWord();
          continue;
        }
        finish();
        const pipe = c === '|' && s[i + 1] !== '|';
        i += s[i + 1] === c || (c === '|' && s[i + 1] === '&') || (c === ';' && s[i + 1] === '&') ? 2 : 1;
        if (pipe) pipedIn = true;
      } else if ((c === '<' || c === '>') && s[i + 1] !== '(') {
        const cmd = current();
        // A descriptor written before the operator (`2>`, `{name}>`) is no word.
        const last = cmd.words.at(-1);
        if (last !== undefined && /^(?:\d+|\{[A-Za-z_][A-Za-z0-9_]*\})$/.test(last.raw) && cmd.words.lastEnd === i) cmd.words.pop();
        if (s.startsWith('<<<', i)) {
          i += 3;
          skipBlanks();
          const word = readWord();
          if (word === null) broken = true;
          else cmd.hereStrings.push(word);
        } else if (s.startsWith('<<', i)) {
          const tabs = s[i + 2] === '-';
          i += tabs ? 3 : 2;
          skipBlanks();
          const word = readWord();
          if (word === null) broken = true;
          else {
            const heredoc = { end: word.text, quoted: word.quoted, tabs, text: '' };
            cmd.heredocs.push(heredoc);
            pending.push(heredoc);
          }
        } else {
          const input = c === '<';
          i += 1;
          if (/[>&|]/.test(s[i] ?? '')) i += 1;
          skipBlanks();
          readWord();
          if (input && cmd.stdin === null) cmd.stdin = 'file';
        }
      } else {
        const cmd = current();
        const word = readWord();
        if (word === null) {
          i++;
          continue;
        }
        // A `case` pattern's `)` would close the substitution it is in, and its commands be read as the outer word.
        if (end === ')' && !word.quoted && word.text === 'case') broken = true;
        cmd.words.push(word);
        cmd.words.lastEnd = i;
      }
    }
    finish();
    if (end === ')') broken = true;
    if (depth > 0) broken = true;
  };
  const skipBlanks = () => {
    while (s[i] === ' ' || s[i] === '\t') i++;
  };

  if (body) {
    // An unquoted heredoc's body: text in which a backslash escapes `$`, a backtick or itself, and the rest is read.
    const word = { text: '', raw: '', expands: false, quoted: false };
    while (i < s.length) {
      if (s[i] === '\\' && /[$`\\]/.test(s[i + 1] ?? '')) i += 2;
      else if (s[i] === '$' || s[i] === '`') readDollar(word, true);
      else i += 1;
    }
  } else list(null);
  if (pending.length > 0) {
    broken = true;
    for (const heredoc of pending.splice(0)) bodies.push(heredoc);
  }
  return { commands, bodies, broken };
}
