// The command blocks of a reply, S1 of odd/tasks/f8-lead-rigor.md: a reply that hands the user a shell command in a
// fenced block is turned back when the block is not tagged for the user's shell, or when a command of it was not run
// by the session with success first; a block the user alone can run is checked by the shell's own parser instead. The
// lead handed him a `bash` block, `rm -rf …`, whose shell is PowerShell, after its own runs had been refused
// (docs/FAILURES.md, command-handed-untested): this is the check that would have turned that reply back.
//
// A reply is already shown when the Stop hook runs (bin/reply.mjs), so the check cannot unsay a block: its refusal
// makes the session tell the user, in its next words, not to run the block and give the corrected one.
//
// Which blocks: a fenced block whose info string's first word is a shell, or one with no info string (or `text`) whose
// first command starts with a known program. The info string's second word says what the block is, a word the check
// reads and the rendered reply hides: `ran`, evidence of what the session ran (any shell tag, each command a run of
// the session, whatever its exit); `own`, the user's alone to run (his credentials, his settings), tagged for his
// shell and checked by its parser; none, handed to him to run, tagged for his shell and each command a run that
// succeeded (on win32 also parsed, since a Bash run does not prove PowerShell's reading).
//
// What a run is: a `Bash` or `PowerShell` tool call of the transcript, outside a side chain, whose result is no
// error, was not interrupted and was not moved to the background. Its command is split at the top level into simple
// commands, and one proves it succeeded when what follows it is `&&` or the end and what precedes it is not `||`:
// `X || true`, `X; exit 0` and `X | head` prove nothing of `X`. A command matches another when their words are
// equal, quotes taken off and redirections dropped.

/** The shell tags of the user's shell on each platform. */
export const HIS_SHELLS = Object.freeze({ win32: Object.freeze(['powershell', 'pwsh', 'ps1']), other: Object.freeze(['bash', 'sh', 'zsh', 'shell', 'console']) });

const SHELL_TAGS = new Set(['bash', 'sh', 'zsh', 'shell', 'console', 'shellsession', 'fish', 'powershell', 'pwsh', 'ps1', 'cmd', 'bat', 'batch']);
const PLAIN_TAGS = new Set(['', 'text', 'txt', 'plaintext']);

// The programs whose name opens an untagged block that hands a command, exact case: a prompt for a session starts
// with words, never with one of these followed by a space.
const PROGRAMS = new Set([
  'git', 'gh', 'npm', 'npx', 'pnpm', 'yarn', 'node', 'js-harness', 'claude', 'codex', 'engram', 'codegraph',
  'winget', 'choco', 'scoop', 'rm', 'cp', 'mv', 'mkdir', 'cd', 'curl', 'sudo', 'pwsh', 'powershell',
  'Remove-Item', 'Copy-Item', 'Move-Item', 'New-Item', 'Set-Location', 'Set-Content', 'Start-Process',
]);

// Commands that only print, which need no run.
const PRINTS = new Set(['echo', 'write-host', 'write-output']);

const shellsOf = (platform) => (platform === 'win32' ? HIS_SHELLS.win32 : HIS_SHELLS.other);

/** A line's prompt mark (`$ `, `PS>`, `PS C:\x> `), and the line without it, or `null` when it has none. */
function unprompted(line) {
  const match = /^\s*(?:\$|PS(?: [^>]*)?>)\s+(.*)$/.exec(line);
  return match ? match[1] : null;
}

/** The command text of a block's body: with prompt marks, only the marked lines; continuation lines joined. */
function commandText(body) {
  const lines = body.split(/\r?\n/);
  const marked = lines.map(unprompted);
  const kept = marked.some((line) => line !== null) ? marked.filter((line) => line !== null) : lines;
  return kept.join('\n').replace(/[\\`]\r?\n/g, ' ');
}

/** The top-level parts of a command line: `{ words, before, after }`, the separators around each simple command
 * (`&&`, `||`, `;`, `|`, a newline, or `''` at either end). Quotes keep what they hold and are taken off; brackets keep
 * a separator inside them; a `#` that starts a word ends the line; redirections are dropped. */
export function simpleCommands(text) {
  const parts = [];
  let words = [];
  let word = null;
  let quote = null;
  let depth = 0;
  let before = '';
  const endWord = () => {
    if (word !== null) words.push(word);
    word = null;
  };
  const endPart = (separator) => {
    endWord();
    const kept = dropRedirections(words);
    if (kept.length > 0) parts.push({ words: kept, before, after: separator });
    else if (parts.length > 0 && separator !== '') parts.at(-1).after = separator;
    words = [];
    before = separator;
  };
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quote !== null) {
      if (c === quote) quote = null;
      else word += c;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      word ??= '';
      continue;
    }
    if (depth === 0) {
      const two = text.slice(i, i + 2);
      if (two === '&&' || two === '||') {
        endPart(two);
        i += 1;
        continue;
      }
      if (c === ';' || c === '|' || c === '\n') {
        endPart(c === '\n' ? '\n' : c);
        continue;
      }
      if (c === '#' && word === null) {
        const end = text.indexOf('\n', i);
        if (end === -1) break;
        i = end - 1;
        continue;
      }
    }
    if ('({['.includes(c)) depth += 1;
    if (')}]'.includes(c)) depth = Math.max(0, depth - 1);
    if (/\s/.test(c) && depth === 0) {
      endWord();
      continue;
    }
    word = (word ?? '') + c;
  }
  endPart('');
  return parts;
}

/** `words` without redirections: `2>&1`, `>/dev/null`, `>$null`, and `>`/`>>` with the word after it. */
function dropRedirections(words) {
  const kept = [];
  for (let i = 0; i < words.length; i += 1) {
    if (/^[0-9*]?>>?$/.test(words[i])) {
      i += 1;
      continue;
    }
    if (/^[0-9*]?>>?\S/.test(words[i])) continue;
    kept.push(words[i]);
  }
  return kept;
}

/** Whether a part proves it succeeded, read from the exit of the whole run. */
const proves = (part) => (part.after === '&&' || part.after === '') && part.before !== '||';

/** The parts a run's command holds, with whether each proves success; a part that runs PowerShell with `-Command`
 * adds the parts of its argument, proving what it proves. */
export function runParts(command) {
  const out = [];
  for (const part of simpleCommands(command)) {
    const proved = proves(part);
    out.push({ words: part.words, proved });
    const program = part.words[0].replace(/^.*[\\/]/, '').replace(/\.exe$/i, '').toLowerCase();
    const flag = part.words.findIndex((w, i) => i > 0 && /^-(c|command)$/i.test(w));
    if ((program === 'pwsh' || program === 'powershell') && flag !== -1 && part.words[flag + 1] !== undefined) {
      for (const inner of simpleCommands(part.words.slice(flag + 1).join(' '))) out.push({ words: inner.words, proved: proved && proves(inner) });
    }
  }
  return out;
}

const key = (words) => words.join(' ');

/** The command blocks of a reply's fenced `blocks` (`{ start, info, body }`): `{ start, first, tag, kind, commands }`,
 * `kind` one of `ran`, `own` or `handed`, `commands` the word lists of its simple commands that are no print. */
export function commandBlocks(blocks) {
  const found = [];
  for (const block of blocks) {
    const [tag = '', marker = ''] = block.info.trim().split(/\s+/);
    const lowered = tag.toLowerCase();
    const text = commandText(block.body);
    const parts = simpleCommands(text);
    if (parts.length === 0) continue;
    const isShell = SHELL_TAGS.has(lowered);
    if (!isShell && !(PLAIN_TAGS.has(lowered) && PROGRAMS.has(parts[0].words[0]))) continue;
    const kind = marker === 'ran' || marker === 'own' ? marker : 'handed';
    const commands = parts.map((part) => part.words).filter((words) => !PRINTS.has(words[0].toLowerCase()));
    const first = block.body.split(/\r?\n/).find((line) => line.trim() !== '')?.trim() ?? '';
    found.push({ start: block.start, first, tag: isShell ? lowered : '', kind, text, commands });
  }
  return found;
}

/** The runs of a Claude Code transcript `text`: `{ readable, runs }`, each run `{ id, parts, pos }` of a `Bash` or
 * `PowerShell` call outside a side chain, and `readable` false when the text holds no Claude Code entry (Codex's
 * rollout, a missing file), where no run can be shown. */
export function transcriptRuns(text) {
  if (typeof text !== 'string' || !text.includes('"type":"assistant"')) return { readable: false, runs: [] };
  const runs = [];
  for (const name of ['"name":"Bash"', '"name":"PowerShell"']) {
    let at = text.indexOf(name);
    while (at !== -1) {
      const start = text.lastIndexOf('\n', at) + 1;
      const end = text.indexOf('\n', at);
      const stop = end === -1 ? text.length : end;
      let entry = null;
      try {
        entry = JSON.parse(text.slice(start, stop));
      } catch {
        // A torn line is no entry.
      }
      if (entry?.type === 'assistant' && entry.isSidechain !== true && Array.isArray(entry.message?.content)) {
        for (const block of entry.message.content) {
          if (block?.type === 'tool_use' && (block.name === 'Bash' || block.name === 'PowerShell') && typeof block.input?.command === 'string' && typeof block.id === 'string') {
            runs.push({ id: block.id, parts: runParts(block.input.command), pos: stop });
          }
        }
      }
      at = text.indexOf(name, stop);
    }
  }
  return { readable: true, runs };
}

/** Whether the run of tool use `id`, called before `from` in `text`, ended with no error, uninterrupted and in the
 * foreground. */
export function runSucceeded(text, id, from) {
  const needle = `"tool_use_id":"${id}"`;
  let at = text.indexOf(needle, from);
  while (at !== -1) {
    const start = text.lastIndexOf('\n', at) + 1;
    const end = text.indexOf('\n', at);
    let entry = null;
    try {
      entry = JSON.parse(text.slice(start, end === -1 ? undefined : end));
    } catch {
      // A torn line is no entry.
    }
    const result = Array.isArray(entry?.message?.content) ? entry.message.content.find((block) => block?.type === 'tool_result' && block.tool_use_id === id) : null;
    if (result) {
      const extra = entry.toolUseResult;
      const extraObject = extra !== null && typeof extra === 'object';
      return result.is_error !== true && !(extraObject && (extra.interrupted === true || typeof extra.backgroundTaskId === 'string'));
    }
    at = text.indexOf(needle, end === -1 ? text.length : end);
  }
  return false;
}

/** For each command of a block, whether a run of `runs` holds it: `succeeded` asks for a part that proves success in
 * a run that succeeded, else any part of any run counts. */
function unrun(commands, runs, text, succeeded) {
  const verdict = new Map();
  return commands.filter((words) => {
    const wanted = key(words);
    for (const run of runs) {
      for (const part of run.parts) {
        if (key(part.words) !== wanted || (succeeded && !part.proved)) continue;
        if (!succeeded) return false;
        if (!verdict.has(run.id)) verdict.set(run.id, runSucceeded(text, run.id, run.pos));
        if (verdict.get(run.id)) return false;
      }
    }
    return true;
  });
}

/** Why the command blocks of a reply are refused, one reason a block, or `[]`. `blocks` are the reply's fenced blocks
 * (`{ start, info, body }`), `platform` the user's, `transcript` the transcript's text (or `null`), and `parse(texts)`
 * the shell's checker over the texts of the blocks that need it: `{ errors }`, one list a text, or `{ failed }` when it
 * could not run. */
export function commandRefusals(blocks, { platform, transcript, parse }) {
  const found = commandBlocks(blocks);
  if (found.length === 0) return [];
  const his = shellsOf(platform);
  const reasons = new Map();
  const add = (block, why) => reasons.set(block, [...(reasons.get(block) ?? []), why]);
  const { readable, runs } = transcriptRuns(transcript);
  const toParse = [];
  for (const block of found) {
    if (block.kind !== 'ran' && !his.includes(block.tag)) {
      add(block, block.tag === '' ? `it is not tagged; tag it ${his[0]}` : `it is tagged ${block.tag}, which is not his shell; tag it ${his[0]} and write it for that shell`);
      continue;
    }
    if (block.kind === 'own' || !readable) toParse.push(block);
    else {
      const missing = unrun(block.commands, runs, transcript, block.kind === 'handed');
      if (missing.length > 0) {
        const what = block.kind === 'ran' ? 'no run of this session holds' : 'no run of this session that succeeded holds';
        add(block, `${what} ${missing.map((words) => `\`${key(words)}\``).join(', ')}`);
      }
      if (block.kind === 'handed' && platform === 'win32') toParse.push(block);
    }
  }
  if (toParse.length > 0) {
    const checked = parse(toParse.map((block) => block.text));
    toParse.forEach((block, i) => {
      if (checked.failed) add(block, `its parser could not check it (${checked.failed})`);
      else for (const error of checked.errors[i] ?? []) add(block, error);
    });
  }
  return [...reasons].map(([block, whys]) => `the block that starts "${block.first}" (line ${block.start + 1}): ${whys.join('; ')}`);
}
