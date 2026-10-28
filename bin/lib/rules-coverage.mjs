// Directive coverage (F8 S5c-a, odd/tasks/f8-s5c-a-coverage.md; the reverse-engineering document, section 14.2):
// a text the harness ships or sends to an agent is cut into spans, a sentence, a list item, a table row, a fenced
// block or a line of front matter, each named by the hash of its words; a span is tied to the rules it names or whose
// phrases it holds, and the rest are declared in the register (bin/lib/rules-coverage-data.mjs) as owed or as context.
// A rule's control says what proves it, in the grammar of the failure register's `Control` (bin/lib/failures.mjs)
// extended by the level `eval` and a date on `owed`. Pure: every function takes text or plain data, and what a check
// needs of a file is asked through the `readFile` the caller hands it.
import { createHash } from 'node:crypto';
import { ruleValue } from './rules.mjs';

/** How many hexadecimal characters of a span's SHA-256 name it. */
export const SPAN_ID_LENGTH = 12;
/** The levels a control can be at: the failure register's four, its `owed` with a date, and `eval`. */
export const LEVELS = ['check', 'eval', 'line', 'protocol', 'measured', 'owed'];
// The keys of a control at each level; `of` names one obligation of a rule that bundles several.
const LEVEL_KEYS = {
  check: ['level', 'test', 'break'],
  eval: ['level', 'cases'],
  line: ['level', 'path', 'phrase'],
  protocol: ['level', 'path', 'phrase'],
  measured: ['level', 'path', 'phrase'],
  owed: ['level', 'since'],
};
const BREAK_KEYS = ['find', 'path', 'replace'];
// A phrase shorter than this could be found by accident; it is also the shortest span that sits inside a phrase.
const MIN_PHRASE = ruleValue('control-phrase-min', 'characters');
const NAME_PATTERN = /`rule:([a-z][a-z0-9-]*)`/g;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VERSION = /\bv?\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?\b/g;
const LIST_MARK = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/;
const ITEM = /^\s*(?:[-*+]|\d+[.)])\s+\S/;
const FENCE = /^\s*(`{3,}|~{3,})/;
const HEADING = /^\s{0,3}#{1,6}(?:\s|$)/;
const MARKER = /^\s*<!--.*-->\s*$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-*:?\s*\|?\s*$/;
// Where a sentence ends: its mark, any closing quote, bracket or emphasis, then space before a capital, a digit or
// an opening mark.
const SENTENCE_END = /[.!?]["')\]*_`]*\s+(?=[A-Z0-9"'`(\[*_])/g;

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.length > 0;
const squash = (text) => text.replace(/\s+/g, ' ').trim();
const isPath = (path) => isText(path) && !path.startsWith('/') && !/^[A-Za-z]:/.test(path) && !path.includes('\\') && !path.split('/').includes('..');

/** The words of a span that its id is read from: white space squashed, a list marker and every version number taken
 * out, so a rewrap, a renumbered list or a release does not rename it. */
export function normalSpan(text) {
  return squash(text.replace(/\r\n/g, '\n').replace(LIST_MARK, '').replace(VERSION, 'v#'));
}

/** The id of a span: the first `SPAN_ID_LENGTH` hexadecimal characters of the SHA-256 of `normalSpan(text)`. */
export function spanId(text) {
  return createHash('sha256').update(normalSpan(text)).digest('hex').slice(0, SPAN_ID_LENGTH);
}

/** The lines of `text` with where each one starts and ends in it, a carriage return left out of the line. */
function linesOf(text) {
  const lines = [];
  let start = 0;
  for (const raw of text.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    lines.push({ line, start, end: start + line.length });
    start += raw.length + 1;
  }
  return lines;
}

/** The sentences of the paragraph `text[start, end)`, each `{ start, end }` in `text`. */
function sentencesOf(text, start, end) {
  const body = text.slice(start, end);
  const out = [];
  let from = 0;
  for (const match of body.matchAll(SENTENCE_END)) {
    const stop = match.index + match[0].trimEnd().length;
    out.push({ start: start + from, end: start + stop });
    from = match.index + match[0].length;
  }
  if (from < body.length) out.push({ start: start + from, end });
  return out;
}

/** The spans of `text`, in order: `{ id, kind, text, start, end }`, `kind` one of `sentence`, `item`, `row`, `code`
 * and `line`. A heading, a marker comment, a table's rule line and a blank line are structure, and no span. */
export function cutSpans(text) {
  const lines = linesOf(text);
  const spans = [];
  const push = (kind, start, end) => {
    const body = text.slice(start, end);
    if (body.trim() !== '') spans.push({ id: spanId(body), kind, text: body, start, end });
  };
  let index = 0;
  // Front matter: one span a line between the two `---` lines.
  if (lines[0]?.line === '---') {
    const close = lines.findIndex((entry, i) => i > 0 && entry.line === '---');
    if (close > 0) {
      for (const entry of lines.slice(1, close)) push('line', entry.start, entry.end);
      index = close + 1;
    }
  }
  while (index < lines.length) {
    const { line, start } = lines[index];
    const fence = FENCE.exec(line);
    if (fence) {
      let close = index + 1;
      while (close < lines.length && !lines[close].line.trimStart().startsWith(fence[1])) close += 1;
      const last = Math.min(close, lines.length - 1);
      push('code', start, lines[last].end);
      index = last + 1;
    } else if (line.trim() === '' || HEADING.test(line) || MARKER.test(line) || TABLE_RULE.test(line)) {
      index += 1;
    } else if (TABLE_ROW.test(line)) {
      push('row', start, lines[index].end);
      index += 1;
    } else {
      // An item, or a paragraph: it runs to a blank line or to the next line that opens something else.
      const item = ITEM.test(line);
      let last = index;
      while (last + 1 < lines.length) {
        const next = lines[last + 1].line;
        if (next.trim() === '' || ITEM.test(next) || FENCE.test(next) || HEADING.test(next) || MARKER.test(next) || TABLE_ROW.test(next)) break;
        last += 1;
      }
      if (item) push('item', start, lines[last].end);
      else for (const sentence of sentencesOf(text, start, lines[last].end)) push('sentence', sentence.start, sentence.end);
      index = last + 1;
    }
  }
  return spans;
}

/** The ids of the live rules of `rules` that `text` is tied to: each one it names as `rule:<id>` in code marks, and
 * each rule in prose whose phrase it holds or sits inside, in any case. A span shorter than the shortest phrase sits inside none. */
export function tiesOf(text, rules) {
  const live = new Map(rules.filter((rule) => !Object.hasOwn(rule, 'retired')).map((rule) => [rule.id, rule]));
  const tied = new Set();
  for (const match of text.matchAll(NAME_PATTERN)) if (live.has(match[1])) tied.add(match[1]);
  const words = squash(text).toLowerCase();
  for (const rule of live.values()) {
    if (!Array.isArray(rule.phrases)) continue;
    const holds = rule.phrases.some((phrase) => {
      const said = squash(phrase).toLowerCase();
      return words.includes(said) || (words.length >= MIN_PHRASE && said.includes(words));
    });
    if (holds) tied.add(rule.id);
  }
  return [...tied].sort();
}

/** The faults of one control's shape at its level, `of` aside. */
function levelFaults(control, { baseline, ruleSince }) {
  if (!isObject(control)) return ['a control is an object with its level'];
  if (!LEVELS.includes(control.level)) return [`the level is "${String(control.level)}": it is check, eval, line, protocol, measured or owed`];
  const faults = [];
  for (const key of Object.keys(control)) if (key !== 'of' && !LEVEL_KEYS[control.level].includes(key)) faults.push(`unknown key "${key}"`);
  switch (control.level) {
    case 'check': {
      if (!isPath(control.test)) faults.push('a check names its test, a path of the repository');
      const planted = control.break;
      if (planted === undefined) faults.push('a check names its planted break { path, find, replace }: a proof that names only a file is refused');
      else if (!isObject(planted) || Object.keys(planted).sort().join(',') !== BREAK_KEYS.join(',') || !isPath(planted.path) || !isText(planted.find) || typeof planted.replace !== 'string') {
        faults.push('the planted break is { path, find, replace }: a path of the repository, the text it finds and the text it puts there');
      } else if (planted.find === planted.replace) faults.push('a planted break changes what it finds: find and replace are two different texts');
      break;
    }
    case 'eval':
      if (!Array.isArray(control.cases) || control.cases.length === 0 || !control.cases.every(isText)) faults.push('an eval control names its cases, a list of task names');
      break;
    case 'owed':
      if (!(typeof control.since === 'string' && DATE_PATTERN.test(control.since))) faults.push('owed carries the day it is owed since, written YYYY-MM-DD');
      else if (control.since > baseline) faults.push(`owed since ${control.since}, after the baseline of ${baseline}: only a gap of the baseline is owed`);
      else if (ruleSince > baseline) faults.push(`the rule is declared on ${ruleSince}, after the baseline of ${baseline}, so it is not owed: it names its control`);
      break;
    default:
      if (!isPath(control.path)) faults.push(`a ${control.level} names the path it is written in`);
      if (!isText(control.phrase) || squash(control.phrase).length < MIN_PHRASE) faults.push(`a ${control.level} names a phrase of at least ${MIN_PHRASE} characters, so that it is not found by accident`);
  }
  return faults;
}

/** The faults of a rule's control, in shape only: `[]` when it is well formed. A list is a rule that bundles several
 * obligations, each named in `of` with its own control. `baseline` is the day the debt was seeded, and `ruleSince`
 * the day the rule was declared: an `owed` is admitted only for a rule and a day of the baseline. */
export function controlFaults(control, { baseline, ruleSince }) {
  if (control === undefined) return ['no control: it names a check, an eval case, a line, a protocol, a measurement or a dated owed'];
  if (!Array.isArray(control)) return levelFaults(control, { baseline, ruleSince });
  if (control.length === 0) return ['a bundled control names at least one obligation'];
  return control.flatMap((item, index) => {
    const own = isObject(item) && isText(item.of) ? [] : ['a bundled control names each obligation in "of"'];
    return [...own, ...levelFaults(item, { baseline, ruleSince })].map((fault) => `obligation ${index + 1}: ${fault}`);
  });
}

/** How many times `find` is in `text`. */
const timesIn = (text, find) => text.split(find).length - 1;

/** The faults of a well-formed control against the files it names, which `readFile(path)` gives as text or `null`, and
 * the cases `caseExists(name)` knows: the test and the break's file are there, the break finds its text once, each
 * case is in `evals/tasks`, and a line, a protocol or a measurement holds its phrase. */
export function controlFileFaults(control, { readFile, caseExists }) {
  if (Array.isArray(control)) return control.flatMap((item, index) => controlFileFaults(item, { readFile, caseExists }).map((fault) => `obligation ${index + 1}: ${fault}`));
  const faults = [];
  switch (control.level) {
    case 'check': {
      if (readFile(control.test) === null) faults.push(`the test ${control.test} is not there`);
      const text = readFile(control.break.path);
      if (text === null) faults.push(`the break names ${control.break.path}, which is not there`);
      else {
        const times = timesIn(text.replace(/\r\n/g, '\n'), control.break.find);
        if (times !== 1) faults.push(`the break finds "${control.break.find}" ${times} times in ${control.break.path}: it finds its text once`);
      }
      break;
    }
    case 'eval':
      for (const name of control.cases) if (!caseExists(name)) faults.push(`the eval case ${name} is not in evals/tasks`);
      break;
    case 'owed':
      break;
    default: {
      const text = readFile(control.path);
      if (text === null) faults.push(`the ${control.level} names ${control.path}, which is not there`);
      else if (!squash(text).includes(squash(control.phrase))) faults.push(`the phrase "${control.phrase}" is not in ${control.path}`);
    }
  }
  return faults;
}

/** The hash a register entry names: an owed span is its hash, a context span `{ hash, context }`. */
export const entryHash = (entry) => (typeof entry === 'string' ? entry : entry.hash);

/** `entries`, a source's spans as the register lists them in order, against `spans`, its current untied spans in
 * order: `kept` pairs a span with its entry, `edited` pairs a span with the entry it replaced one for one in the same
 * place, `added` are spans with no entry, and `gone` entries with no span. The pairing is the longest common
 * sequence of hashes; in each stretch between two kept spans, the first entries and spans pair up as edits, and what
 * is left over is gone or added. */
export function alignSpans(entries, spans) {
  const a = entries.map(entryHash);
  const b = spans.map((span) => span.id);
  // lengths[i][j]: the longest common sequence of a[i..] and b[j..].
  const lengths = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) lengths[i][j] = a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
  }
  const out = { kept: [], edited: [], added: [], gone: [] };
  let removed = [];
  let inserted = [];
  const settle = () => {
    const pairs = Math.min(removed.length, inserted.length);
    for (let k = 0; k < pairs; k += 1) out.edited.push({ entry: removed[k], span: inserted[k] });
    out.gone.push(...removed.slice(pairs));
    out.added.push(...inserted.slice(pairs));
    removed = [];
    inserted = [];
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      settle();
      out.kept.push({ entry: entries[i], span: spans[j] });
      i += 1;
      j += 1;
    } else if (j < b.length && (i === a.length || lengths[i][j + 1] >= lengths[i + 1][j])) {
      inserted.push(spans[j]);
      j += 1;
    } else {
      removed.push(entries[i]);
      i += 1;
    }
  }
  settle();
  return out;
}

/** The coverage of one source: `spans` as `cutSpans` gives them, `entries` as the register lists the source, and the
 * declared `rules`. `tied` spans name their rules; of the rest, `owed` and `context` are declared, `edited` were owed
 * and changed in place (still owed), `reopened` were context and changed (`{ span, reason }`, open until listed
 * again), `gaps` are new spans no one declared, and `gone` the hashes of entries no span holds any more. */
export function sourceCoverage({ spans, entries, rules }) {
  const tied = [];
  const untied = [];
  for (const span of spans) {
    const ids = tiesOf(span.text, rules);
    if (ids.length > 0) tied.push({ span, rules: ids });
    else untied.push(span);
  }
  const aligned = alignSpans(entries, untied);
  const coverage = { tied, owed: [], context: [], edited: [], reopened: [], gaps: aligned.added, gone: aligned.gone.map(entryHash) };
  for (const { entry, span } of aligned.kept) {
    if (typeof entry === 'string') coverage.owed.push(span);
    else coverage.context.push({ span, reason: entry.context });
  }
  for (const { entry, span } of aligned.edited) {
    if (typeof entry === 'string') coverage.edited.push(span);
    else coverage.reopened.push({ span, reason: entry.context });
  }
  return coverage;
}
