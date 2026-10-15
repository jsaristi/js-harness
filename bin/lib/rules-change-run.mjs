// `js-harness rules change <id>`: the one command that changes a rule (odd/tasks/rule-hierarchy.md, "The one command
// that changes a rule (T16c)"). It reads the list in force from origin/main, computes the change (./rules-change.mjs),
// checks its source against the transcripts and the new list against the repository (./rules-check.mjs), and only then
// writes the declaration, the sources and docs/RULES.md, and appends one line to the relief file. It never commits:
// the commit, the gate, the reviews and the pull request are the session's. It runs only in the checkout it changes.
import fs from 'node:fs';
import path from 'node:path';
import { appendRelief, reliefLineOf, reliefPath } from './channel.mjs';
import { checkRules } from './rules-check.mjs';
import { RuleChangeError, changedList, sourceOf } from './rules-change.mjs';
import { renderList, writeRules } from './rules.mjs';

const DATA = 'bin/lib/rules-data.mjs';
const SOURCES = 'docs/rule-sources.json';
const LIST = 'docs/RULES.md';
const BASE = 'origin/main';
// The findings the new list gives before docs/RULES.md is rendered for it: the list is about to be written.
const LIST_FINDINGS = ['docs/RULES.md is missing:', 'docs/RULES.md is not what the declarations render:'];
// What each change costs, as the approved protocol asks to be said beside it.
const COST = "cost: one gate, gentle-ai's assessment and a small Codex review";
// A session id as the host names a transcript: no folder can be named through it.
const SESSION_ID = /^[A-Za-z0-9-]+$/;

/** The list a text of rules-data.mjs declares: the JSON after `export const RULES = `, as `writeRules` writes it. */
export function rulesOfText(text) {
  const start = text.indexOf('export const RULES = ');
  const end = text.lastIndexOf(';');
  if (start === -1 || end < start) throw new RuleChangeError(`${DATA} is not in the shape writeRules gives`);
  return JSON.parse(text.slice(start + 'export const RULES = '.length, end));
}

/** Two paths name the same folder, without regard to case on Windows. */
function samePath(a, b) {
  const [x, y] = [path.resolve(a), path.resolve(b)];
  return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
}

/** The day of `ms` by this machine's clock, YYYY-MM-DD. */
function dayOf(ms) {
  const at = new Date(ms);
  const two = (n) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
}

/** An object with its keys sorted, as the sources file keeps them. */
const sortedKeys = (object) => Object.fromEntries(Object.keys(object).sort().map((key) => [key, object[key]]));

/** The place (from 1, blank lines counted) of the last line of the relief file `text` that this command wrote for
 * `id`, or `null`. A line of a longer id that starts the same is not one: the id is followed by a space. */
function lastLineFor(text, id) {
  const mark = `rule:${id} proposed `;
  const lines = text.split('\n');
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].includes(mark)) return index + 1;
  }
  return null;
}

/** The paths `git status --porcelain` names as changed in the tree, a rename giving both of its paths. */
function changedPaths(porcelain) {
  return porcelain.split(/\r?\n/).filter((line) => line.trim() !== '').flatMap((line) => line.slice(3).split(' -> ')).map((file) => file.replace(/^"|"$/g, ''));
}

/**
 * Runs the change of the rule `id` in the checkout `top` and gives the exit code: 0 when it is written (or printed,
 * with `dryRun`), 1 when it is refused. `checkSource` checks the stored source of `id` again instead of a change.
 * `packageRoot` is the folder of the code that runs; `readTree(top)` reads the code and the texts the check reads;
 * `git(args)` runs git in `top` and gives `{ status, stdout }`; `stdin()` gives the change as JSON. The relief file is
 * the one of `slug` under `home`, and a transcript is read from `transcripts`. `rename` is fs.renameSync unless a test
 * makes it fail.
 */
export function changeRule({ id, dryRun, checkSource, top, packageRoot, readTree, git, stdin, now, home, slug, transcripts, rename = fs.renameSync }, stdout, stderr) {
  try {
    return runChange();
  } catch (err) {
    if (!(err instanceof RuleChangeError)) throw err;
    stderr(`not changed: ${err.message}`);
    return 1;
  }

  function out(args) {
    const result = git(args);
    if (result.status !== 0) throw new RuleChangeError(`git ${args.join(' ')} failed${result.stderr ? `: ${String(result.stderr).trim()}` : ''}`);
    return String(result.stdout ?? '').trim();
  }

  function runChange() {
    if (!fs.existsSync(path.join(top, DATA)) || !samePath(top, packageRoot)) {
      throw new RuleChangeError(`the command runs from the checkout it changes: run node bin/js-harness.mjs rules change in ${top}, not the installed command`);
    }

    // The branch: rule/<name>, based on origin/main.
    const branch = out(['rev-parse', '--abbrev-ref', 'HEAD']);
    if (!branch.startsWith('rule/')) {
      throw new RuleChangeError(`it runs on a branch rule/<name> based on ${BASE}, and this is ${branch}: git switch -c rule/${id} ${BASE}`);
    }
    if (git(['merge-base', '--is-ancestor', BASE, 'HEAD']).status !== 0) {
      throw new RuleChangeError(`${branch} is not based on ${BASE}: git rebase ${BASE}`);
    }

    // The one open change: another rule/ branch whose declarations are not those of origin/main.
    const baseBlob = out(['rev-parse', `${BASE}:${DATA}`]);
    const refs = out(['for-each-ref', '--format=%(refname:short)', 'refs/heads/rule/', 'refs/remotes/origin/rule/']).split(/\r?\n/).filter(Boolean);
    for (const ref of refs) {
      if (ref === branch || ref === `origin/${branch}`) continue;
      const blob = git(['rev-parse', `${ref}:${DATA}`]);
      if (blob.status === 0 && String(blob.stdout).trim() !== baseBlob) {
        throw new RuleChangeError(`${ref} holds a rule change not on ${BASE}: one change is open at a time`);
      }
    }

    // The list and the sources in force, from origin/main.
    const base = rulesOfText(out(['show', `${BASE}:${DATA}`]));
    const baseSources = JSON.parse(out(['show', `${BASE}:${SOURCES}`]));
    const before = base.find((rule) => rule.id === id);
    const today = dayOf(now());

    let change = null;
    if (!checkSource) {
      try {
        change = JSON.parse(stdin());
      } catch {
        throw new RuleChangeError('the change on standard input is not JSON');
      }
      if (change === null || typeof change !== 'object' || Array.isArray(change)) throw new RuleChangeError('the change is a JSON object');
    }
    const { list, rule, what } = checkSource ? { list: base, rule: before, what: 'source checked' } : changedList(base, id, change, { today });
    if (rule === undefined) throw new RuleChangeError(`no rule "${id}" is declared on ${BASE}`);
    if (before?.path === 'AGENTS.md' || rule.path === 'AGENTS.md') {
      throw new RuleChangeError('a phrase of AGENTS.md changes only by its approved draft (letter G), which is not built');
    }

    // The tree may differ from the branch only in the home of a text that changes with its declaration.
    const homes = new Set([before?.path, rule.path].filter((file) => typeof file === 'string' && change !== null && (Object.hasOwn(change, 'path') || Object.hasOwn(change, 'phrases'))));
    // Read untrimmed: the first column of the first line may be a space.
    const status = git(['status', '--porcelain', '-uall']);
    if (status.status !== 0) throw new RuleChangeError('git status failed');
    const outside = changedPaths(String(status.stdout ?? '')).filter((file) => !homes.has(file));
    if (outside.length > 0) throw new RuleChangeError(`the tree holds changes outside the rule's home: ${outside.join(', ')}`);

    // The source, read from its transcripts and checked.
    let given;
    if (checkSource) {
      const stored = baseSources[id];
      if (stored?.kind !== 'words') throw new RuleChangeError(`the source of "${id}" is not his words, so there is nothing to check against a transcript`);
      given = { kind: 'words', quotes: stored.quotes.map((quote) => ({ session: quote.session, line: quote.line, excerpt: quote.quote })), reading: stored.reading, accepted: stored.accepted };
    } else {
      given = change.source;
    }
    const transcriptOf = (session) => {
      if (typeof session !== 'string' || !SESSION_ID.test(session)) return null;
      const file = path.join(transcripts, `${session}.jsonl`);
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    };
    const source = sourceOf(given, { owner: rule.owner, today, transcriptOf, exists: (file) => fs.existsSync(path.join(top, file)) });
    const sources = sortedKeys({ ...baseSources, [id]: source });

    // The new list, checked against the repository before anything is written.
    const dataText = writeRules(list);
    const tree = readTree(top);
    const first = checkRules({ rules: list, declared: list, sources, dataText, listText: null, codeFiles: tree.codeFiles, textFiles: tree.textFiles, readFile: tree.readFile });
    const findings = first.findings.filter((finding) => !LIST_FINDINGS.some((prefix) => finding.startsWith(prefix)));
    if (findings.length > 0) throw new RuleChangeError(`the new list has ${findings.length === 1 ? 'a finding' : 'findings'}:\n${findings.map((finding) => `      ${finding}`).join('\n')}`);
    const listText = renderList(list, { sources, readers: first.readers, sentences: first.sentences });
    const sourcesText = `${JSON.stringify(sources, null, 2)}\n`;

    // The relief line, built and checked before any write.
    const reliefFile = reliefPath(home, slug);
    const relief = fs.existsSync(reliefFile) ? fs.readFileSync(reliefFile, 'utf8') : '';
    const previous = lastLineFor(relief, id);
    const line = `rule:${id} proposed on ${branch}, not landed: ${what}; source ${source.kind}; supersedes ${previous === null ? 'no relief line' : `relief line ${previous}`}`;
    try {
      reliefLineOf(line);
    } catch (err) {
      throw new RuleChangeError(err.message);
    }

    const memory = before !== undefined && Object.hasOwn(before, 'value') && what !== 'form' && what !== 'source checked'
      ? `memory: a memory note or engram observation that states ${before.unit === undefined ? before.value : `${before.value} ${before.unit}`} for ${before.subject} is changed to point to rule:${id}; the command reads no memory`
      : `memory: a memory note that restates "${id}" points to rule:${id}; the command reads no memory`;

    if (dryRun) {
      stdout(JSON.stringify(list.find((item) => item.id === id), null, 2));
      stdout(`Source: ${JSON.stringify(source, null, 2)}`);
      stdout(`Relief line: ${line}`);
      stdout(memory);
      stdout(COST);
      return 0;
    }

    // The write: each file beside itself, then renamed; a failed rename puts the three back, and nothing is appended.
    const writes = [[DATA, dataText], [SOURCES, sourcesText], [LIST, listText]];
    try {
      for (const [file, text] of writes) {
        const target = path.join(top, ...file.split('/'));
        fs.writeFileSync(`${target}.change-tmp`, text, 'utf8');
        rename(`${target}.change-tmp`, target);
      }
    } catch (err) {
      for (const [file] of writes) fs.rmSync(path.join(top, ...file.split('/')) + '.change-tmp', { force: true });
      git(['checkout', 'HEAD', '--', ...writes.map(([file]) => file)]);
      stderr(`not changed: a file could not be written (${err.code ?? err.message}); ${writes.map(([file]) => file).join(', ')} are as they were`);
      return 1;
    }
    const written = appendRelief(home, slug, line, now(), 'rules change');
    stdout(`changed: ${id}, ${what}; ${writes.map(([file]) => file).join(', ')} written`);
    stdout(`relief: ${written.line}`);
    stdout(memory);
    stdout(COST);
    stdout(`next: commit on ${branch}, through the gate and both reviews, in a pull request of its own against main`);
    return 0;
  }
}
