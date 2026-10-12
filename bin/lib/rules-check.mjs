// The checks that hold the rules list to the files around it: the homes of the rules in prose, the sources
// of the rules, the code and the text that name a rule, the generated data file and the generated list. It
// reads what it is given and returns what is wrong, one sentence each, and what was left out. It holds no fs
// and no process access, so the caller reads every file and passes its text in.
import { RULES } from './rules-data.mjs';
import { isDay, readRules, renderList, writeRules } from './rules.mjs';

// A read of a rule by a literal id, by one of the three functions that read a rule. A call whose first argument
// is not a string literal is not found: the pattern cannot know what a variable holds, so such a call is not
// guaranteed to be seen.
const READ_PATTERN = /\b(ruleValue|ruleHere|ruleOf)\(\s*(['"])([^'"]*)\2/g;
// A mark that names a rule in code marks, on one line of a text.
const NAME_PATTERN = /`rule:([a-z][a-z0-9-]*)`/g;
// The run of backticks or tildes at the start of a trimmed line, three or more long: the mark that opens a fence.
const FENCE_RUN = /^(`{3,}|~{3,})/;
// The characters that can end a sentence.
const TERMINATORS = '.?!';
// The line that ends a feature document's plan: what follows it is history.
const PROGRESS_LINE = /^## Progress\r?$/;

/** `text` with every run of white space read as one space and the ends trimmed. */
const squash = (text) => text.replace(/\s+/g, ' ').trim();

/** True when `text` holds `phrase`, each with every run of white space read as one space: the same test that the
 * failures register applies to a control, kept here so that this file reads no module that reads a rule. */
const holds = (text, phrase) => squash(text).includes(squash(phrase));

/** `text` with each `\r\n` read as `\n`, or `null` as it is, so that a file from Windows compares as one from Unix. */
const normal = (text) => (text === null ? null : text.replace(/\r\n/g, '\n'));

/** True for a plain object: not null, not an array, and not a text, a number or a list. */
const isPlain = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** True for a non-empty text. */
const isText = (value) => typeof value === 'string' && value.length > 0;

/** True for a source that is a design: `{ kind: 'design', path }` with a non-empty path. */
const isDesign = (source) => isPlain(source) && source.kind === 'design' && isText(source.path);

/** True for one quotation of his words: a quote, a session and a line, with the day it was said. */
const isQuote = (item) => isPlain(item)
  && isText(item.quote)
  && isDay(item.date)
  && isText(item.session)
  && Number.isInteger(item.line)
  && item.line > 0;

/** True for the check that read his words: a date, and `by` is the session or the command. */
const isChecked = (checked) => isPlain(checked)
  && isDay(checked.date)
  && (checked.by === 'session' || checked.by === 'command');

/** True for a source that is his words: `{ kind: 'words', quotes, reading, accepted, checked }`, well formed. */
const isWords = (source) => isPlain(source)
  && source.kind === 'words'
  && Array.isArray(source.quotes)
  && source.quotes.length > 0
  && source.quotes.every(isQuote)
  && isText(source.reading)
  && isText(source.accepted)
  && isChecked(source.checked);

/** Every read of a rule in the code files, in file order then text order: `{ path, id, by }`, where `by` is the name
 * of the function that reads it. A read is found only when its first argument is a string literal, so a read through
 * a variable is not guaranteed to be listed. */
export function findReads(codeFiles) {
  const reads = [];
  for (const { path, text } of codeFiles) {
    for (const match of text.matchAll(READ_PATTERN)) reads.push({ path, id: match[3], by: match[1] });
  }
  return reads;
}

/** The sentence of `text` that holds `phrase`, with white space read as one space, or `null` when the text does
 * not hold the phrase. A sentence starts after the last `. `, `? ` or `! ` that ends before the phrase, and ends
 * with the first `.`, `?` or `!` at or after the phrase's last character that is followed by a space or the end of
 * the text, so a phrase that ends with its own terminator does not run on into the next sentence. */
export function sentenceOf(text, phrase) {
  const body = squash(text);
  const wanted = squash(phrase);
  const at = body.indexOf(wanted);
  if (at === -1) return null;

  const after = at + wanted.length;
  let start = 0;
  for (let i = 0; i + 2 <= at; i += 1) {
    if (TERMINATORS.includes(body[i]) && body[i + 1] === ' ') start = i + 2;
  }
  let stop = body.length;
  for (let i = Math.max(at, after - 1); i < body.length; i += 1) {
    if (TERMINATORS.includes(body[i]) && (i + 1 === body.length || body[i + 1] === ' ')) {
      stop = i + 1;
      break;
    }
  }
  return body.slice(start, stop);
}

/** The walk of the fences of `text`: `{ walked, open }`. `walked` holds each line with whether it lies outside a fenced
 * block, `{ line, outside }`; `open` is the number, from 1, of the line that opens a fence which no later line closes,
 * or `null`. A fence opens on a line that starts with three or more backticks or tildes, and closes on the next line
 * that starts with the same character as many times or more, so a longer fence can hold a shorter one. A line of
 * backticks whose words hold another backtick opens nothing: it is a code span written with three marks, and taking it
 * for a fence would hide every mark after it and report a fence that is not there. The lines that open and close a
 * fence are not outside. */
function fenceWalk(text) {
  const walked = [];
  let fence = null;
  let opened = 0;
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const run = FENCE_RUN.exec(trimmed);
    if (fence !== null) {
      if (run !== null && run[1][0] === fence[0] && run[1].length >= fence.length) fence = null;
      walked.push({ line, outside: false });
    } else if (run !== null && !(run[1][0] === '`' && trimmed.slice(run[1].length).includes('`'))) {
      fence = run[1];
      opened = index + 1;
      walked.push({ line, outside: false });
    } else {
      walked.push({ line, outside: true });
    }
  }
  return { walked, open: fence === null ? null : opened };
}

/** The number, from 1, of the line that opens a fence which no later line closes in `text`, or `null` when every fence
 * is closed. The marks after such a line are not read, so a caller reports it. */
export function openFence(text) {
  return fenceWalk(text).open;
}

/** Every `rule:<id>` mark in code marks, on a line that is not inside a fenced block: `{ path, id }`. The lines that
 * open and close a fence are not read for marks. */
export function namedRules(textFiles) {
  const named = [];
  for (const { path, text } of textFiles) {
    for (const { line, outside } of fenceWalk(text).walked) {
      if (outside) for (const match of line.matchAll(NAME_PATTERN)) named.push({ path, id: match[1] });
    }
  }
  return named;
}

/** `text` cut at its first `## Progress` line outside a fenced block, which is left out with everything after it: the
 * text before that line, byte for byte, or the whole text when there is no such line. That line is exactly
 * `## Progress`, with a trailing `\r` allowed and nothing else. */
export function beforeProgress(text) {
  let offset = 0;
  for (const { line, outside } of fenceWalk(text).walked) {
    if (outside && PROGRESS_LINE.test(line)) return text.slice(0, offset);
    offset += line.length + 1;
  }
  return text;
}

/** The faults that make the rules list hold no check: what `checkRules` returns when `readRules` finds faults in it,
 * so that no other check reads a list that cannot be read. */
const unreadable = (faults) => ({ findings: faults, notes: [], readers: {}, sentences: {} });

/** The findings and notes of the rules list against the files of the repository, and what it reads and says.
 * `input` is `{ rules, sources, dataText, listText, codeFiles, textFiles, readFile }`: the declarations (default
 * `RULES`), the sources object or `null`, the text of rules-data.mjs or `null`, the text of docs/RULES.md or `null`,
 * the code and text files as `{ path, text }`, and `readFile(path)` for a file of the repository, or `null`. A
 * finding is a fault that must be repaired; a note is what was left out because it was not given. */
export function checkRules(input) {
  const {
    rules = RULES,
    sources = null,
    codeFiles = [],
    textFiles = [],
    readFile,
  } = input;
  const dataText = normal(input.dataText ?? null);
  const listText = normal(input.listText ?? null);

  // A list that cannot be read has no meaning for the checks below, so only its faults are told.
  const faults = readRules(rules);
  if (faults.length > 0) return unreadable(faults);

  const findings = [];
  const notes = [];

  // The homes of the rules in prose: the file is there, and it holds each phrase. Its sentence is kept for the list.
  const sentences = {};
  for (const rule of rules.filter((item) => Object.hasOwn(item, 'path'))) {
    const text = readFile(rule.path);
    if (text === null) {
      findings.push(`rule "${rule.id}": its home ${rule.path} is not there`);
      continue;
    }
    for (const phrase of rule.phrases) {
      if (!holds(text, phrase)) findings.push(`rule "${rule.id}": ${rule.path} no longer holds the phrase "${phrase}"`);
    }
    const sentence = sentenceOf(text, rule.phrases[0]);
    if (sentence !== null) sentences[rule.id] = sentence;
  }

  // The sources: each rule in force has one that is well formed, and each entry is the source of a rule.
  // A source that is not well formed cannot be rendered, so the list is not compared while one stands.
  let unsound = false;
  if (sources === null) {
    notes.push('no docs/rule-sources.json here: the sources were not checked');
  } else if (typeof sources !== 'object' || Array.isArray(sources)) {
    findings.push('docs/rule-sources.json is not an object keyed by rule id');
    unsound = true;
  } else {
    unsound = Object.values(sources).some((source) => !isDesign(source) && !isWords(source));
    for (const rule of rules.filter((item) => !Object.hasOwn(item, 'retired'))) {
      const source = Object.hasOwn(sources, rule.id) ? sources[rule.id] : undefined;
      if (source === undefined) {
        findings.push(`rule "${rule.id}": no source in docs/rule-sources.json`);
      } else if (!isDesign(source) && !isWords(source)) {
        findings.push(`rule "${rule.id}": its source is not a design with its path, or his words with their quotes, reading, acceptance and check`);
      } else if (isDesign(source) && rule.owner === 'sebastian') {
        findings.push(`rule "${rule.id}": a rule of his needs his words as its source`);
      }
    }
    // A retired rule needs no source, but a source it has must be one that can be rendered, like the others.
    for (const rule of rules.filter((item) => Object.hasOwn(item, 'retired'))) {
      const source = Object.hasOwn(sources, rule.id) ? sources[rule.id] : undefined;
      if (source !== undefined && !isDesign(source) && !isWords(source)) {
        findings.push(`rule "${rule.id}": its source is not a design with its path, or his words with their quotes, reading, acceptance and check`);
      }
    }
    for (const key of Object.keys(sources)) {
      if (!rules.some((rule) => rule.id === key)) findings.push(`source "${key}": no rule has that id`);
    }
  }

  // The reads of a rule in code: each one names a rule with a value, except ruleOf, which gives a declaration of any
  // live rule. A ruleValue read of a rule of this repository only is a finding: that rule is read with ruleHere.
  const reads = findReads(codeFiles);
  for (const { path, id, by } of reads) {
    const rule = rules.find((item) => item.id === id);
    if (rule === undefined) {
      findings.push(`${path}: reads rule "${id}", which is declared nowhere`);
      continue;
    }
    if (by !== 'ruleOf' && !Object.hasOwn(rule, 'value')) findings.push(`${path}: reads rule "${id}", which has no value`);
    if (by === 'ruleOf' && Object.hasOwn(rule, 'retired')) findings.push(`${path}: reads rule "${id}" with ruleOf, and it is retired`);
    if (by === 'ruleValue' && rule.scope === 'repository' && !Object.hasOwn(rule, 'retired')) {
      findings.push(`${path}: reads rule "${id}" with ruleValue, and it is of this repository only: read it with ruleHere`);
    }
  }
  const readers = {};
  for (const { path, id } of reads) {
    const rule = rules.find((item) => item.id === id);
    if (rule !== undefined && Object.hasOwn(rule, 'value')) {
      const paths = Object.hasOwn(readers, id) ? readers[id] : [];
      readers[id] = [...new Set([...paths, path])].sort();
    }
  }

  // The marks of a rule in text: a mark of a rule that is retired says what replaces it.
  for (const { path, id } of namedRules(textFiles)) {
    const rule = rules.find((item) => item.id === id);
    if (rule === undefined) {
      findings.push(`${path}: names rule "${id}", which is declared nowhere`);
    } else if (Object.hasOwn(rule, 'retired')) {
      const successors = rule.successors ?? [];
      findings.push(successors.length > 0
        ? `${path}: names rule "${id}", retired on ${rule.retired}: read ${successors.join(', ')} instead`
        : `${path}: names rule "${id}", retired on ${rule.retired}, which no rule replaces`);
    }
  }

  // The fences left open: the marks after one are not read, so the text is named rather than read short.
  for (const { path, text } of textFiles) {
    const line = openFence(text);
    if (line !== null) findings.push(`${path}: the fence opened at line ${line} is never closed, so the marks of rules after it are not read`);
  }

  // The generated data file: it is the shape writeRules gives for the declarations.
  if (dataText === null) {
    notes.push('no bin/lib/rules-data.mjs text was given: its shape was not checked');
  } else if (dataText !== writeRules(rules)) {
    findings.push('bin/lib/rules-data.mjs is not in the shape writeRules gives');
  }

  // The generated list: it is what renderList gives for the declarations, with the sources, readers and sentences.
  if (listText === null) {
    if (sources === null) notes.push('no docs/RULES.md here: js-harness rules prints the list');
    else findings.push('docs/RULES.md is missing: run js-harness rules render');
  } else if (!unsound && listText !== renderList(rules, { sources: sources ?? {}, readers, sentences })) {
    findings.push('docs/RULES.md is not what the declarations render: run js-harness rules render');
  }

  return { findings, notes, readers, sentences };
}
