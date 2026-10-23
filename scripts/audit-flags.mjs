#!/usr/bin/env node
// Holds the flags a command names to the flags its parser takes (odd/tasks/launch-audit.md, S5b):
//
//   node scripts/audit-flags.mjs [--only <command>] [--allow <file>] [--json] [--cwd <repo>]
//
// Documented but not accepted. Each flag that a command's `--help`, its README section, or a line or backticked span
// of README.md, docs/SPEC.md and docs/GUIDE.md that begins `js-harness <command>` names is probed: the dispatcher runs
// the command with that flag, the value `x` when the place shows one (`--to <n>`, `--pm npm|pnpm`, `--home=<path>`),
// and a sentinel unknown argument after it. Every command refuses an argument it does not know with exit 2 and
// `unknown argument: <token>` before it does any work (bin/conventions-arguments.test.mjs), so the probe never runs the
// command. A refusal naming the flag is `not-accepted`; one naming the sentinel or the value means the parser took the
// flag; anything else is `unprobed`, with the first line of stderr as the detail.
//
// Accepted but not documented. A flag literal in the command's entry file (bin/<name>.mjs, as the dispatcher's COMMANDS
// names it) that its `--help` does not name is `undocumented`. A file that several commands share counts a literal as
// named when any of them names it, and reports it under the first of them.
//
// Each probe runs in a child with every home it could write under pointed into one fresh temporary folder, from a
// fresh folder that is not a repository, with PATH reduced to the folder of node (so no git, npm, gh, claude or codex),
// and a 20 s timeout; both folders are removed after it.
//
// The allow-list (odd/tasks/launch-audit/allow/flags.json unless --allow; a missing default is empty) is a JSON array of
// { kind, location, why }. An entry that matches a finding counts it as allowed; one that matches none is a
// `stale-allow` finding. Findings print one a line, `<kind>  <location>  <detail>`, then `<n> findings, <k> allowed`;
// --json prints one object instead. Exit 0 with no finding beyond the allow-list, 1 with findings, 2 on a usage error.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'usage: node scripts/audit-flags.mjs [--only <command>] [--allow <file>] [--json] [--cwd <repo>]';
const DEFAULT_ALLOW = 'odd/tasks/launch-audit/allow/flags.json';
const SENTINEL = '--zz-audit-sentinel';
const TIMEOUT_MS = 20000;
// Every variable that names a home, a config, a data or a cache folder, and the temp folder; each points into the probe's own folder.
const HOME_VARIABLES = [
  'HOME', 'USERPROFILE', 'JS_HARNESS_HOME', 'CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'APPDATA', 'LOCALAPPDATA',
  'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME', 'TEMP', 'TMP', 'TMPDIR',
];
const DOCS = [
  { file: 'README.md', tag: 'README' },
  { file: 'docs/SPEC.md', tag: 'SPEC' },
  { file: 'docs/GUIDE.md', tag: 'GUIDE' },
];

// A quoted example such as `"--a text"` is a text a command takes, not a flag of it, so a quote before the dashes is no flag.
const FLAG = /(?<![\w"'-])--[a-z][a-z0-9-]*/g;
const MENTION = /js-harness +([a-z][a-z0-9-]*)/g;
const PLAIN_WORD = /^[a-z][a-z0-9-]*$/;
const PLACEHOLDER = /^<[^>]+>$/;
const PLACEHOLDER_START = /^\[?<[^>]+>/;
const PIPED_VALUE = /^[A-Za-z0-9_.<>][A-Za-z0-9_.<>-]*\|[A-Za-z0-9_.<>-]+/;
const CAPS_VALUE = /^[A-Z][A-Z0-9_-]*[,.;:)\]]*$/;
const RANK = { none: 0, space: 1, eq: 2 };
const LITERALS = [
  /\bcase\s+(['"`])(--[a-z][a-z0-9-]*)\1/g,
  /(?:===|!==|==|!=)\s*(['"`])(--[a-z][a-z0-9-]*)\1/g,
  /(['"`])(--[a-z][a-z0-9-]*)\1\s*(?:===|!==|==|!=)/g,
  /\.startsWith\(\s*(['"`])(--[a-z][a-z0-9-]*)=?\1/g,
];
const LIST = /\[([^[\]]*)\]/g;
// `new Set(` and `new Map(`, not `.map(`; `bool`, not `Boolean(`, which wraps any call.
const LIST_HEAD = /parse|flag|option|known|new (?:Set|Map)\(|valid|allow|switch|value|bool(?!ean\()/i;
// A quoted item that is no flag: such a list holds another program's arguments (`['rev-parse', '--verify']`).
const QUOTED_ITEM = /(['"`])([^'"`]*)\1/g;
const holdsNonFlag = (items) => [...items.matchAll(QUOTED_ITEM)].some((item) => !item[2].startsWith('--'));
const LIST_TAIL = /^\s*\.(includes|has)\(/;
const QUOTED_FLAG = /(['"`])(--[a-z][a-z0-9-]*)\1/g;

/** The commands `--help` of the dispatcher lists, in its order: the first word of each line under "Commands:". */
export function commandsFromHelp(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const from = lines.indexOf('Commands:');
  const names = [];
  if (from === -1) return names;
  for (const line of lines.slice(from + 1)) {
    const named = /^ {2}(\S+) /.exec(line);
    if (!named) break;
    names.push(named[1]);
  }
  return names;
}

/** The lines of a markdown text, each with whether it stands inside a fence (a fence closes on its own marker). A
 * heading shown in an example, such as the contract template's `## Goal`, is not a heading of the page. */
export function markdownLines(text) {
  let fence = null;
  return text.split('\n').map((line) => {
    const marker = /^(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence === null && marker) {
      fence = marker;
      return { text: line, fenced: true };
    }
    if (fence !== null) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker) fence = null;
      return { text: line, fenced: true };
    }
    return { text: line, fenced: false };
  });
}

/** The sections under `## Commands` whose heading is `### js-harness <command>`, each with its lines and their numbers. */
export function commandSections(text, commands) {
  const lines = markdownLines(text);
  const start = lines.findIndex(({ text: line, fenced }) => !fenced && line === '## Commands');
  const sections = [];
  if (start === -1) return sections;
  for (let index = start + 1; index < lines.length; index += 1) {
    const { text: line, fenced } = lines[index];
    if (!fenced && line.startsWith('## ')) break;
    if (!fenced && line.startsWith('### ')) {
      const named = /^### js-harness (\S+)\s*$/.exec(line)?.[1];
      sections.push({ name: commands.includes(named) ? named : null, lines: [] });
    } else {
      sections.at(-1)?.lines.push({ text: line, number: index + 1, fenced });
    }
  }
  return sections.filter((section) => section.name !== null);
}

/** The sub words of a usage place: the plain words after its command and before the flag (`rules check`, and `loop run <name>`
 * with the placeholder read as `x`), at most two, since no command here takes more. A bracket, a parenthesis or a flag ends
 * them, so `gate [--wait` has none. */
export function subWords(words) {
  const run = [];
  for (const word of words) {
    if (PLAIN_WORD.test(word)) run.push(word);
    else if (PLACEHOLDER.test(word)) run.push('x');
    else break;
  }
  return run.slice(0, 2);
}

/** How the place shows the flag's value: `eq` for `--home=<path>`, `space` for a value after a space (`--to <n>`,
 * `--pm npm|pnpm`, `--day YYYY-MM-DD`, `--purpose "<text>"`), `none` when nothing follows that reads as one. */
export function valueShape(after) {
  if (after.startsWith('=')) return 'eq';
  const token = /^\s+(\S+)/.exec(after)?.[1] ?? '';
  const shown = PLACEHOLDER_START.test(token) || PIPED_VALUE.test(token) || CAPS_VALUE.test(token) || /^["']/.test(token);
  return shown ? 'space' : 'none';
}

/** The flags of one line with their places. A flag belongs to the command its own words name: a bare command word right
 * before it (`sessions --address`), or else the nearest `js-harness <command>` before it, or else `fallback` (null where a
 * line may name no command). A line that starts with a bare word of the fallback's help (`  init --repo <owner/name>` in
 * backup's help) names a sub word of that command. The sub words are the plain words after the last mention of that command
 * before the flag: after `js-harness <command>` they are read as they stand, and after a bare word only the one word that
 * stands before the flag or before a bracket or parenthesis (`throughput reviewed (--day`). A flag of an alternative group
 * closed by a bracket before it belongs to no sub word (`change <id> [--dry-run] | --hook`). */
export function flagsOnLine(line, fallback, commands) {
  const mentions = [...line.matchAll(MENTION)].filter((match) => commands.includes(match[1]));
  const names = [...line.matchAll(new RegExp(`(?<![\w-])(js-harness +)?(${commands.join('|')})(?![\w-])`, 'g'))];
  const found = [];
  for (const match of line.matchAll(FLAG)) {
    const flag = match[0];
    if (flag === '--help') continue;
    const at = match.index;
    const gap = (earlier, later) => /^\s*$/.test(line.slice(earlier.index + earlier[0].length, later.index));
    const direct = names.filter((named) => named.index < at).at(-1);
    const chained = direct !== undefined && names.some((named) => named.index + named[0].length <= direct.index && gap(named, direct));
    const adjacent = direct !== undefined && !direct[1] && !chained && /^\s*$/.test(line.slice(direct.index + direct[0].length, at));
    // A mention a parenthesis closes before the flag, as in `(js-harness permit lease) and --every`, names an example.
    const open = (named) => {
      const between = line.slice(named.index, at);
      return between.split(')').length <= between.split('(').length;
    };
    const mention = mentions.filter((named) => named.index < at && open(named)).at(-1);
    const listed = adjacent && fallback !== null && direct[2] !== fallback && /^\s*$/.test(line.slice(0, direct.index));
    let command = fallback;
    let sub = [];
    if (listed) {
      sub = [direct[2]];
    } else if (adjacent) {
      command = direct[2];
    } else if (mention) {
      command = mention[1];
    }
    if (!command) continue;
    const anchor = listed ? undefined : adjacent ? direct : names.filter((named) => named[2] === command && named.index < at).at(-1);
    if (anchor && !listed) {
      const parts = line.slice(anchor.index + anchor[0].length, at).split(/\s\|\s/);
      const group = parts.findLastIndex((part) => /^\s*\[?\s*[a-z<]/.test(part));
      const closed = group !== -1 && parts.slice(group + 1).some((part) => part.includes(']'));
      const between = group === -1 || closed ? '' : parts[group];
      if (anchor[1]) sub = subWords(between.split(/\s+/).filter(Boolean));
      else if (/^\s*[a-z][a-z-]*\s*(?:[[(]\s*)?$/.test(between)) sub = [between.trim().replace(/[\s[(]/g, '')];
    }
    found.push({ command, sub, flag, value: valueShape(line.slice(at + flag.length)) });
  }
  return found;
}

/** The flags a command's `--help` names: each line read the way flagsOnLine reads it, placed as `help` (or `help of <command>`
 * for a flag the help names for another command). */
export function helpOccurrences(command, text, commands) {
  return text.split('\n').flatMap((line) => flagsOnLine(line, command, commands)).map((occurrence) => ({
    ...occurrence,
    place: occurrence.command === command ? 'help' : `help of ${command}`,
  }));
}

/** The flags the documents name: the fenced example lines of a README section that show `js-harness`, and every line or
 * backticked span of the documents that begins `js-harness <command>`, each placed by its file and line (`README:12`). The
 * prose of a section names other tools' flags too (`git diff --quiet`), so it is not read. */
export function documentedOccurrences(docs, commands) {
  const found = [];
  for (const { tag, text } of docs) {
    const place = (number) => `${tag}:${number}`;
    if (tag === 'README') {
      for (const section of commandSections(text, commands)) {
        for (const { text: line, number, fenced } of section.lines) {
          if (!fenced || !/js-harness/.test(line)) continue;
          for (const occurrence of flagsOnLine(line, section.name, commands)) found.push({ ...occurrence, place: place(number) });
        }
      }
    }
    markdownLines(text).forEach(({ text: line, fenced }, index) => {
      const candidates = fenced ? [line] : [...line.matchAll(/`([^`\n]+)`/g)].map((match) => match[1]);
      for (const candidate of candidates) {
        const span = candidate.trim();
        if (!/^js-harness +[a-z]/.test(span)) continue;
        for (const occurrence of flagsOnLine(span, null, commands)) found.push({ ...occurrence, place: place(index + 1) });
      }
    });
  }
  return found;
}

/** One probe per distinct (command, sub words, flag): the strongest value shape any place shows, and every place. A bare
 * probe of a flag that another place names under a sub word is the same flag (a description line `--tool: codex` of stack),
 * so it joins that probe instead of probing a command that never takes it bare. */
export function probesOf(occurrences) {
  const probes = new Map();
  for (const occurrence of occurrences) {
    const key = JSON.stringify([occurrence.command, occurrence.sub, occurrence.flag]);
    const probe = probes.get(key) ?? { command: occurrence.command, sub: occurrence.sub, flag: occurrence.flag, value: 'none', places: [] };
    if (RANK[occurrence.value] > RANK[probe.value]) probe.value = occurrence.value;
    if (!probe.places.includes(occurrence.place)) probe.places.push(occurrence.place);
    probes.set(key, probe);
  }
  const list = [...probes.values()];
  const kept = [];
  for (const probe of list) {
    const sibling = probe.sub.length === 0 ? list.find((other) => other.sub.length > 0 && other.command === probe.command && other.flag === probe.flag) : undefined;
    if (!sibling) {
      kept.push(probe);
      continue;
    }
    for (const place of probe.places) if (!sibling.places.includes(place)) sibling.places.push(place);
    if (RANK[probe.value] > RANK[sibling.value]) sibling.value = probe.value;
  }
  return kept;
}

// The words a command needs after its sentinel: gate refuses an argument list with no `--` before it does anything else
// (bin/conventions-arguments.test.mjs gives it the same tail). Nothing else needs one.
const TAIL = { gate: ['--', 'node', '--version'] };

/** The argv of a probe: the command, its sub words, the flag with its value, and the sentinel that must be refused. */
export function probeArgs({ command, sub, flag, value }) {
  const token = value === 'eq' ? `${flag}=x` : flag;
  return [command, ...sub, token, ...(value === 'space' ? ['x'] : []), SENTINEL, ...(TAIL[command] ?? [])];
}

/** The finding of one probe's result, or null when the parser took the flag. */
export function classifyProbe(probe, result) {
  const lines = (result.stderr ?? '').split(/\r?\n/);
  const refused = lines.map((line) => /unknown argument: ([^\s;(]+)/.exec(line)).find(Boolean)?.[1];
  if (result.status === 2 && refused !== undefined) {
    if (refused === probe.flag || refused.startsWith(`${probe.flag}=`)) return { kind: 'not-accepted', detail: probe.places.join(', ') };
    if (refused === SENTINEL || refused === 'x') return null;
  }
  if (result.error) return { kind: 'unprobed', detail: String(result.error.code ?? result.error.message) };
  const first = lines.find((line) => line.trim() !== '');
  return { kind: 'unprobed', detail: first ?? `exit ${result.status}, no output` };
}

/** The flag literals of a parser source: case labels, comparisons, startsWith prefixes, and the quoted flags of a list
 * whose line names a parser, a set of known flags or a switch. Each once, with its line. */
export function parserFlags(source) {
  const found = [];
  for (const pattern of LITERALS) {
    for (const match of source.matchAll(pattern)) found.push({ flag: match[2], index: match.index });
  }
  for (const list of source.matchAll(LIST)) {
    const lineStart = source.lastIndexOf('\n', list.index) + 1;
    const tail = source.slice(list.index + list[0].length, list.index + list[0].length + 16);
    if (!LIST_HEAD.test(source.slice(lineStart, list.index)) && !LIST_TAIL.test(tail)) continue;
    if (holdsNonFlag(list[1])) continue;
    for (const item of list[1].matchAll(QUOTED_FLAG)) found.push({ flag: item[2], index: list.index + 1 + item.index });
  }
  found.sort((a, b) => a.index - b.index);
  const seen = new Set();
  const flags = [];
  for (const { flag, index } of found) {
    if (seen.has(flag) || flag === '--help') continue;
    seen.add(flag);
    flags.push({ flag, line: source.slice(0, index).split('\n').length });
  }
  return flags;
}

/** The entry file of each command: the last module its loader in the dispatcher's COMMANDS imports (rules imports its
 * hook module first and its own module last), relative to bin/. */
export function entryFiles(dispatcherText) {
  const block = /const COMMANDS = \{\n([\s\S]*?)\n\};/.exec(dispatcherText.replace(/\r\n/g, '\n'))?.[1] ?? '';
  const files = new Map();
  let command = null;
  for (const line of block.split('\n')) {
    const named = /^\s*'?([\w-]+)'?:/.exec(line);
    if (named) command = named[1];
    const imports = [...line.matchAll(/import\('\.\/([^']+\.mjs)'\)/g)];
    if (command !== null && imports.length > 0) files.set(command, imports.at(-1)[1]);
  }
  return files;
}

/** Every flag a text names, whatever its place. */
export function namedFlags(text) {
  return new Set([...text.matchAll(FLAG)].map((match) => match[0]));
}

/** The findings without the ones the allow-list holds. An entry matching a finding is used; one matching none is
 * `stale-allow`, except an entry of another command when the run is limited with `only`. */
export function applyAllow(findings, entries, only = null) {
  const used = new Set();
  const kept = [];
  let allowed = 0;
  for (const finding of findings) {
    const matched = entries.flatMap((entry, index) => (entry.kind === finding.kind && entry.location === finding.location ? [index] : []));
    if (matched.length === 0) {
      kept.push(finding);
    } else {
      allowed += 1;
      for (const index of matched) used.add(index);
    }
  }
  entries.forEach((entry, index) => {
    if (used.has(index) || (only !== null && entry.location.split(' ')[0] !== only)) return;
    kept.push({ kind: 'stale-allow', location: entry.location, detail: `no ${entry.kind} finding matches this entry: ${entry.why}` });
  });
  return { findings: kept, allowed };
}

// The files are read with LF endings whatever the checkout holds: a Windows checkout has CRLF, and a pattern over lines
// must not miss the dispatcher's COMMANDS for it.
function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/** The allow-list at a file: an array of { kind, location, why }. A missing file is an empty list unless one was named. */
export function readAllow(file, { required }) {
  const text = readText(file);
  if (text === null) {
    if (required) throw new Error(`no allow-list at ${file}`);
    return [];
  }
  let entries;
  try {
    entries = JSON.parse(text);
  } catch (error) {
    throw new Error(`${file} is not JSON: ${error.message}`);
  }
  const shaped = (entry) => entry && ['kind', 'location', 'why'].every((key) => typeof entry[key] === 'string');
  if (!Array.isArray(entries) || !entries.every(shaped)) throw new Error(`${file} is not an array of { kind, location, why }`);
  return entries;
}

/** Runs a script with the given arguments in the isolated probe: every home pointed into one fresh temp folder, the
 * cwd a fresh folder that is not a repository, PATH the folder of node alone, a timeout, and the folder removed after. */
export function isolated(script, args) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-flags-'));
  try {
    const cwd = path.join(root, 'cwd');
    fs.mkdirSync(cwd);
    const env = { PATH: path.dirname(process.execPath), GIT_CEILING_DIRECTORIES: root };
    if (process.env.SYSTEMROOT) env.SYSTEMROOT = process.env.SYSTEMROOT;
    for (const name of HOME_VARIABLES) env[name] = path.join(root, name.toLowerCase());
    const result = spawnSync(process.execPath, [script, ...args], {
      cwd, env, encoding: 'utf8', input: '', timeout: TIMEOUT_MS, windowsHide: true,
    });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

/** The audit of one repository: its dispatcher, its help texts, its documents and its entry files, then the probes.
 * `run` runs a script and is injected by a test that does not spawn. */
export function audit({ repo = REPO_ROOT, only = null, allow = [], run = isolated } = {}) {
  const dispatcher = path.join(repo, 'bin', 'js-harness.mjs');
  const top = run(dispatcher, ['--help']);
  if (top.status !== 0) throw new Error(`${dispatcher} --help exits ${top.status}`);
  const commands = commandsFromHelp(top.stdout);
  if (commands.length === 0) throw new Error('the dispatcher lists no commands under "Commands:"');
  if (only !== null && !commands.includes(only)) throw new Error(`no command named ${only}`);
  const selected = only === null ? commands : [only];

  const help = new Map();
  for (const command of commands) {
    const result = run(dispatcher, [command, '--help']);
    if (result.status !== 0) throw new Error(`${command} --help exits ${result.status}`);
    help.set(command, result.stdout);
  }
  const docs = DOCS.flatMap(({ file, tag }) => {
    const text = readText(path.join(repo, file));
    return text === null ? [] : [{ tag, text: text.replace(/\r\n/g, '\n') }];
  });
  const occurrences = [
    ...selected.flatMap((command) => helpOccurrences(command, help.get(command), commands)),
    ...documentedOccurrences(docs, commands),
  ].filter((occurrence) => selected.includes(occurrence.command));

  const findings = [];
  for (const probe of probesOf(occurrences)) {
    let result = run(dispatcher, probeArgs(probe));
    // A parser that says the flag requires a value is probed once more with one: the place did not show it.
    if (probe.value === 'none' && result.status === 2 && (result.stderr ?? '').includes(`${probe.flag} requires a value`)) {
      result = run(dispatcher, probeArgs({ ...probe, value: 'space' }));
    }
    const verdict = classifyProbe(probe, result);
    if (verdict) findings.push({ kind: verdict.kind, location: [probe.command, ...probe.sub, probe.flag].join(' '), detail: verdict.detail });
  }

  const sharing = new Map();
  const entry = entryFiles(readText(dispatcher) ?? '');
  for (const command of commands) {
    const file = entry.get(command);
    if (file) sharing.set(file, [...(sharing.get(file) ?? []), command]);
  }
  for (const [file, owners] of sharing) {
    const owner = owners.find((command) => selected.includes(command));
    const source = readText(path.join(repo, 'bin', file));
    if (!owner || source === null) continue;
    const named = new Set(owners.flatMap((command) => [...namedFlags(help.get(command))]));
    for (const { flag, line } of parserFlags(source)) {
      if (!named.has(flag)) findings.push({ kind: 'undocumented', location: `${owner} ${flag}`, detail: `bin/${file}:${line}` });
    }
  }
  return applyAllow(findings, allow, only);
}

/** The command line: the options, or `{ error }` for an argument it does not know or a value it lacks. */
export function parseArgs(argv) {
  const options = { only: null, allow: null, json: false, cwd: REPO_ROOT };
  const valued = ['--only', '--allow', '--cwd'];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      options.json = true;
    } else if (valued.includes(arg)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) return { error: `${arg} takes a value` };
      options[arg.slice(2)] = value;
      index += 1;
    } else {
      return { error: `unknown argument: ${arg}` };
    }
  }
  return options;
}

export function main(argv) {
  const options = parseArgs(argv);
  if (options.error) {
    console.error(`${options.error}\n${USAGE}`);
    return 2;
  }
  const repo = path.resolve(options.cwd);
  try {
    const allow = readAllow(path.resolve(repo, options.allow ?? DEFAULT_ALLOW), { required: options.allow !== null });
    const { findings, allowed } = audit({ repo, only: options.only, allow });
    if (options.json) {
      console.log(JSON.stringify({ findings: findings.map(({ kind, location, detail }) => ({ kind, location, detail })), allowed }, null, 2));
    } else {
      for (const { kind, location, detail } of findings) console.log(`${kind}  ${location}  ${detail}`);
      console.log(`${findings.length} findings, ${allowed} allowed`);
    }
    return findings.length === 0 ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
