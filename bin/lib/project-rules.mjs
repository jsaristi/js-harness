// A project's own rules: the list a project that installs the harness keeps in `docs/rules.json`, in prose, by
// a sensor that enforces them, or retired (odd/tasks/project-rules.md, "Design"). This file reads the text of
// that list and holds it to the files around it; like ./rules-check.mjs it holds no fs and no process access,
// so the caller reads every file and passes its text in. The harness never writes the list.
import { RULES } from './rules-data.mjs';
import { readRules } from './rules.mjs';

/** Where a project keeps its own rules, from its git top. */
export const PROJECT_RULES_PATH = 'docs/rules.json';
// The one format this copy reads. A later one is refused by name, never misread.
const FORMAT = 1;

/** `text` with every run of white space read as one space and the ends trimmed. */
const squash = (text) => text.replace(/\s+/g, ' ').trim();

/** True when `text` holds `phrase`, each with every run of white space read as one space: the test the shipped
 * list's homes are held to (./rules-check.mjs). */
const holds = (text, phrase) => squash(text).includes(squash(phrase));

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The rules of a list file's `text`, or `null` with the faults that make it unreadable as a file. A byte-order
 * mark (PowerShell 5.1 writes one) is skipped, and CRLF is JSON white space. The rules themselves are not
 * checked here: `readRules` does that. */
export function parseProjectRules(text) {
  let data;
  try {
    data = JSON.parse(text.replace(/^﻿/, ''));
  } catch (err) {
    return { rules: null, faults: [`${PROJECT_RULES_PATH} is not JSON: ${err.message}`] };
  }
  if (!isObject(data) || !Number.isInteger(data.format) || !Array.isArray(data.rules)) {
    return { rules: null, faults: [`${PROJECT_RULES_PATH} is not { "format": ${FORMAT}, "rules": [...] }`] };
  }
  if (data.format > FORMAT) {
    return { rules: null, faults: [`${PROJECT_RULES_PATH} is format ${data.format}, newer than this js-harness reads (format ${FORMAT}): run \`js-harness sync\``] };
  }
  if (data.format !== FORMAT) {
    return { rules: null, faults: [`${PROJECT_RULES_PATH} is not { "format": ${FORMAT}, "rules": [...] }`] };
  }
  const extra = Object.keys(data).filter((key) => key !== 'format' && key !== 'rules');
  if (extra.length > 0) {
    return { rules: null, faults: extra.map((key) => `${PROJECT_RULES_PATH} holds the key "${key}": it holds format and rules only`) };
  }
  return { rules: data.rules, faults: [] };
}

/** What is wrong with a project's list, one sentence each, and what is only worth saying.
 *
 * - `text`: the list file as it is now; `headText`: as it is at `HEAD`, or `null` when it is not there.
 * - `readFile(path)`: the text of a file of the project from its git top, or `null` when it is not there.
 * - `sensors`: the names of the sensors `check` runs in the project, or `null` when they cannot be known (a
 *   `harness.json` that does not parse, which the gate reports in its own row): then no sensor rule is held to them.
 * - `failureIds`: the ids of `docs/FAILURES.md`, or `null` when the project keeps no register.
 *
 * `readable` is false when the list cannot be read, and then only its faults are given. A rule present at `HEAD` and gone now is a finding: a rule is
 * retired, never deleted, so it never disappears in silence. An id the harness also ships is a note, so that a
 * later release of the harness never turns a project's commit red. */
export function checkProjectRules({ text, headText = null, readFile, sensors = [], failureIds = null, shipped = RULES }) {
  const parsed = parseProjectRules(text);
  if (parsed.rules === null) return { readable: false, rules: [], findings: parsed.faults, notes: [] };
  const { rules } = parsed;
  const faults = readRules(rules, { project: true });
  if (faults.length > 0) return { readable: false, rules, findings: faults, notes: [] };

  const findings = [];
  const live = rules.filter((rule) => !Object.hasOwn(rule, 'retired'));
  for (const rule of live.filter((item) => Object.hasOwn(item, 'path'))) {
    const home = readFile(rule.path);
    if (home === null) {
      findings.push(`rule "${rule.id}": its home ${rule.path} is not there`);
      continue;
    }
    for (const phrase of rule.phrases) {
      if (!holds(home, phrase)) findings.push(`rule "${rule.id}": ${rule.path} no longer holds the phrase "${phrase}"`);
    }
  }
  for (const rule of sensors === null ? [] : live.filter((item) => Object.hasOwn(item, 'sensor'))) {
    if (!sensors.includes(rule.sensor)) {
      const there = sensors.length === 0 ? 'none is declared' : `the sensors are: ${sensors.join(', ')}`;
      findings.push(`rule "${rule.id}": the sensor "${rule.sensor}" is not declared (${there})`);
    }
  }
  if (failureIds !== null) {
    for (const rule of rules.filter((item) => item.failure !== undefined && !failureIds.includes(item.failure))) {
      findings.push(`rule "${rule.id}": the failure "${rule.failure}" is not an entry of docs/FAILURES.md`);
    }
  }
  const before = headText === null ? null : parseProjectRules(headText).rules;
  if (Array.isArray(before)) {
    const now = new Set(rules.map((rule) => rule.id));
    for (const id of before.filter(isObject).map((rule) => rule.id).filter((id) => typeof id === 'string')) {
      if (!now.has(id)) findings.push(`rule "${id}" is in the list of HEAD and gone from ${PROJECT_RULES_PATH}: retire it (retired, successors) instead of deleting it`);
    }
  }

  const harness = new Set(shipped.map((rule) => rule.id));
  const notes = rules
    .filter((rule) => harness.has(rule.id))
    .map((rule) => `rule "${rule.id}": the harness ships a rule with the same id; \`js-harness rules ${rule.id}\` prints both`);
  return { readable: true, rules, findings, notes };
}
