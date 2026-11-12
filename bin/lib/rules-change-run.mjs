// `js-harness rules change <id>`: the one command that changes a rule (odd/tasks/rule-hierarchy.md, "The one command
// that changes a rule (T16c)"). It reads the branch's list with the rule's declaration in force on origin/main,
// computes the change (./rules-change.mjs), checks its source against the transcripts and the new list against the
// repository (./rules-check.mjs), and only then
// writes the declaration, the sources and docs/RULES.md, and appends one line to the relief file. It never commits:
// the commit, the gate, the reviews and the pull request are the session's. It runs only in the checkout it changes.
// `js-harness rules switch` writes the rules of a home of a model and an effort through the same pass, several at
// once (`changeRules`): on 2026-11-10 a change of both homes was four runs, four JSON objects and four commits, with
// no try of the new model before it was written (odd/tasks/one-model-home.md, spec 8).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { appendRelief, reliefLineOf, reliefPath } from './channel.mjs';
import { parseRegister } from './failures.mjs';
import { CLAUDE_HOME, CODEX_HOME } from './model-home.mjs';
import { checkRules } from './rules-check.mjs';
import { countFindings, isTextInForce } from './rules-scan.mjs';
import { RuleChangeError, changedList, sourceOf } from './rules-change.mjs';
import { isSessionId } from './session-id.mjs';

const NOT_FETCHED = 'not fetched: the count reads origin/main as this clone holds it; a real change fetches it first';
import { renderList, writeRules } from './rules.mjs';

const DATA = 'bin/lib/rules-data.mjs';
const SOURCES = 'docs/rule-sources.json';
const LIST = 'docs/RULES.md';
const REGISTER = 'docs/FAILURES.md';
const BASE = 'origin/main';
// The findings the new list gives before docs/RULES.md is rendered for it: the list is about to be written.
const LIST_FINDINGS = ['docs/RULES.md is missing:', 'docs/RULES.md is not what the declarations render:'];
// What each change costs, as the approved protocol asks to be said beside it.
const COST = 'cost: one gate, a small Codex review and the Claude lenses';

/** The list a text of rules-data.mjs declares: the JSON after `export const RULES = `, as `writeRules` writes it. */
export function rulesOfText(text) {
  const start = text.indexOf('export const RULES = ');
  const end = text.lastIndexOf(';');
  if (start === -1 || end < start) throw new RuleChangeError(`${DATA} is not in the shape writeRules gives`);
  return JSON.parse(text.slice(start + 'export const RULES = '.length, end));
}

/** The declaration of rule `id` in `text`, the text of `bin/lib/rules-data.mjs`, as the short hash a proposal's relief
 * line carries, so a landing confirms the proposal whose declaration the landed head holds; `none` when `text` declares
 * no such rule. Given `sources`, the parsed `docs/rule-sources.json`, the hash covers the rule's entry there too (none
 * when it has none), so a second proposal of the same declaration with another source is told apart (T16e-f). */
export function declarationOf(text, id, sources) {
  const rule = rulesOfText(text).find((one) => one.id === id);
  if (rule === undefined) return 'none';
  const held = sources === undefined ? rule : { rule, source: sources[id] ?? null };
  return crypto.createHash('sha256').update(JSON.stringify(held)).digest('hex').slice(0, 12);
}

/** A home that names AGENTS.md, however it is spelled: `./AGENTS.md`, `docs/../AGENTS.md` or another case. */
const isAgents = (file) => typeof file === 'string' && path.posix.normalize(file.replace(/\\/g, '/')).toLowerCase() === 'agents.md';

/** A path of the repository `top` that names a file inside it, and not a folder or a file outside. */
function isFileOf(top, file) {
  if (typeof file !== 'string' || path.isAbsolute(file)) return false;
  const full = path.resolve(top, file);
  const relative = path.relative(path.resolve(top), full);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) return false;
  return fs.existsSync(full) && fs.statSync(full).isFile();
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

/** Orders declarations by id, as the list keeps them. */
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// The rules of the two homes of a model and an effort, each with the flag of `js-harness rules switch` that names it.
// `rules change` refuses a new value for one: a home's value is tried on the installed CLI before it is written, and
// the switch is the command that tries it (odd/tasks/one-model-home.md, spec 8). The flags are restated here and
// not read from ./rules-switch.mjs, which this module does not import; exported so its test holds each one to what
// `parseSwitch` takes.
const CLAUDE_FLAG = '--claude <model>@<effort>';
const CODEX_FLAG = '--codex <model>@<effort>';
export const HOME_FLAGS = { [CLAUDE_HOME.model]: CLAUDE_FLAG, [CLAUDE_HOME.effort]: CLAUDE_FLAG, [CLAUDE_HOME.lead]: '--lead <effort>', [CLAUDE_HOME.advisor]: '--advisor <model>', [CODEX_HOME.model]: CODEX_FLAG, [CODEX_HOME.effort]: CODEX_FLAG };

/**
 * Runs the change of the rule `id` in the checkout `top` and gives the exit code: 0 when it is written (or printed,
 * with `dryRun`), 1 when it is refused. `checkSource` checks the stored source of `id` again instead of a change.
 * `withPaths` are the paths whose changes in the tree are admitted beside the rule's, for the same commit.
 * `packageRoot` is the folder of the code that runs; `readTree(top)` reads the code and the texts the check reads;
 * `git(args)` runs git in `top` and gives `{ status, stdout }`; `stdin()` gives the change as JSON. The relief file is
 * the one of `slug` under `home`, and a transcript is read from `transcripts`. `rename` is fs.renameSync unless a test
 * makes it fail.
 */
export function changeRule(options, stdout, stderr) {
  return runPass({ ...options, changes: null }, stdout, stderr).code;
}

/**
 * Writes several rules in one pass, for `js-harness rules switch`: the rules of a home change by one sentence of his,
 * so they are checked together and written together, the declarations, their sources, docs/RULES.md and a relief line
 * a rule. `changes` is `[{ id, change }]` in the order they are written, each `change` what `rules change` takes on
 * standard input. A change that gives the value in force on origin/main is skipped and named, so the half of a home
 * that does not change is not written; a pass that changes nothing is refused. Where the branch holds another value
 * for such a rule, from an earlier run on it, the rule is not skipped: its declaration and its source go back to
 * origin/main's, so the home written is the one asked for and not what the earlier run proposed.
 *
 * It has two ways (odd/tasks/one-model-home.md, L13, "Claude 7"). By default every rule is written now, for one
 * commit. With `oneAtATime`, his no to one commit for several rules, a run writes the first rule the branch does not
 * hold yet and keeps the ones it holds, so the same command run after each commit gives a commit a rule, in order.
 *
 * `also(list, ids)` gives the other files of the same commit as `[[path, text]]`, from the list the pass writes and
 * the ids it writes now: a copy a foreign reader needs. They are written, and put back, with the three files. `command`
 * is the sub-command a refusal names and `branchName` the branch it proposes. The rest is `changeRule`'s.
 *
 * It gives `{ code }`, and with code 0 also `{ branch, today, written: [{ id, what, from, to, back }], skipped: [{ id,
 * value }], already: [id], left: [id], files, baseList, list }`: the lists are origin/main's and the one written, and
 * `back` is true for a rule put back, whose `from` is the value the branch held.
 */
export function changeRules(options, stdout, stderr) {
  return runPass({ ...options, id: undefined, checkSource: false, withPaths: [] }, stdout, stderr);
}

function runPass({ id: oneId, changes, oneAtATime = false, also = () => [], command = 'change', branchName, dryRun, checkSource, withPaths = [], top, packageRoot, readTree, git, stdin, now, home, slug, transcripts, rename = fs.renameSync }, stdout, stderr) {
  const several = changes !== null;
  try {
    return run();
  } catch (err) {
    if (!(err instanceof RuleChangeError)) throw err;
    stderr(`not changed: ${err.message}`);
    return { code: 1 };
  }

  function out(args) {
    const result = git(args);
    if (result.status !== 0) throw new RuleChangeError(`git ${args.join(' ')} failed${result.stderr ? `: ${String(result.stderr).trim()}` : ''}`);
    return String(result.stdout ?? '').trim();
  }

  function run() {
    if (!fs.existsSync(path.join(top, DATA)) || !samePath(top, packageRoot)) {
      throw new RuleChangeError(`the command runs from the checkout it changes: run node bin/js-harness.mjs rules ${command} in ${top}, not the installed command`);
    }

    // The branch: rule/<name>, based on origin/main.
    const branch = out(['rev-parse', '--abbrev-ref', 'HEAD']);
    if (!branch.startsWith('rule/')) {
      throw new RuleChangeError(`it runs on a branch rule/<name> based on ${BASE}, and this is ${branch}: git switch -c rule/${branchName ?? oneId} ${BASE}`);
    }
    // The change is read now and refused for its shape later, where it always was. A turn to refuse is counted on
    // origin/main as it is now, not on a copy fetched days ago (T16d), so it fetches before origin/main is read. A dry
    // run moves no ref: it reads the origin/main this clone holds, and says so.
    const input = several || checkSource ? null : stdin();
    let peeked = null;
    try {
      peeked = input === null ? null : JSON.parse(input);
    } catch {
      peeked = null;
    }
    const row = peeked?.set?.row;
    const refusing = row !== null && typeof row === 'object' && Object.hasOwn(row, 'refuses');
    if (refusing && !dryRun) {
      const fetched = git(['fetch', 'origin', 'main']);
      if (fetched.status !== 0) throw new RuleChangeError(`a turn to refuse counts on ${BASE} as it is now, and git fetch origin main failed${fetched.stderr ? `: ${String(fetched.stderr).trim()}` : ''}`);
    }
    // A merge, not a rebase: a rebase gives every commit a new id, and a Codex review record covers commits by id.
    if (git(['merge-base', '--is-ancestor', BASE, 'HEAD']).status !== 0) {
      throw new RuleChangeError(`${branch} is not based on ${BASE}: git merge ${BASE}`);
    }

    // The list and the sources in force, from origin/main.
    const base = rulesOfText(out(['show', `${BASE}:${DATA}`]));
    const baseSources = JSON.parse(out(['show', `${BASE}:${SOURCES}`]));
    const inBase = (id) => base.find((rule) => rule.id === id);

    // The one open change: another rule/ branch holding a declaration it changed that origin/main does not hold.
    // Only the ids a branch changed since its merge base count, so a branch landed by a merge (its tip is the base)
    // or by a squash (main holds what it changed) is no open change, even after later changes land.
    const declarations = (rules) => new Map(rules.map((rule) => [rule.id, JSON.stringify(rule)]));
    const inForce = declarations(base);
    const listAt = (rev) => {
      const shown = git(['show', `${rev}:${DATA}`]);
      return shown.status === 0 ? declarations(rulesOfText(String(shown.stdout))) : new Map();
    };
    const refs = out(['for-each-ref', '--format=%(refname:short)', 'refs/heads/rule/', 'refs/remotes/origin/rule/']).split(/\r?\n/).filter(Boolean);
    for (const ref of refs) {
      if (ref === branch || ref === `origin/${branch}`) continue;
      const fork = git(['merge-base', ref, BASE]);
      const forked = fork.status === 0 ? listAt(String(fork.stdout).trim()) : new Map();
      let held = [...listAt(ref)].filter(([ruleId, text]) => forked.get(ruleId) !== text && inForce.get(ruleId) !== text);
      // A squash that a later change of the same id superseded: origin/main held the declaration in some commit since.
      if (held.length > 0 && fork.status === 0) {
        const since = out(['log', '--format=%H', `${String(fork.stdout).trim()}..${BASE}`, '--', DATA]).split(/\r?\n/).filter(Boolean);
        for (const commit of since) {
          const then = listAt(commit);
          held = held.filter(([ruleId, text]) => then.get(ruleId) !== text);
          if (held.length === 0) break;
        }
      }
      if (held.length > 0) {
        const clear = ref.startsWith('origin/') ? `git push origin --delete ${ref.slice('origin/'.length)}` : `git branch -D ${ref}`;
        throw new RuleChangeError(`${ref} holds a rule change not on ${BASE} (${held.map(([ruleId]) => ruleId).join(', ')}): one change is open at a time; when it has landed or is dropped, ${clear}`);
      }
    }

    const head = rulesOfText(out(['show', `HEAD:${DATA}`]));
    const headSources = JSON.parse(out(['show', `HEAD:${SOURCES}`]));

    // Which rules this pass writes. One rule: the id given. Several: every change but one that gives the value in
    // force, which is skipped and named, unless this branch holds another value for it, which is put back (`back`,
    // the value the branch held); and, a rule at a time, only the first the branch does not hold yet.
    let items = several ? [] : [{ id: oneId, change: null }];
    const skipped = [];
    let already = [];
    let left = [];
    if (several) {
      const changing = [];
      for (const item of changes) {
        const before = inBase(item.id);
        const inForce = before !== undefined && Object.hasOwn(before, 'value') && before.value === item.change.value;
        const held = head.find((rule) => rule.id === item.id)?.value;
        if (inForce && held === before.value) skipped.push({ id: item.id, value: before.value });
        else changing.push({ id: item.id, change: item.change, ...(inForce ? { back: held } : {}) });
      }
      if (changing.length === 0) throw new RuleChangeError(`nothing changes: ${skipped.map((one) => `${one.id} is ${one.value}`).join(' and ')} on ${BASE} already`);
      items = changing;
      if (oneAtATime) {
        const pending = changing.filter((item) => head.find((rule) => rule.id === item.id)?.value !== item.change.value);
        already = changing.filter((item) => !pending.includes(item)).map((item) => item.id);
        if (pending.length === 0) throw new RuleChangeError(`every rule named is on ${branch} already (${already.join(', ')}): nothing is left to write`);
        items = [pending[0]];
        left = pending.slice(1).map((item) => item.id);
      }
    }
    const ids = items.map((item) => item.id);

    // The list the change starts from: this branch's, so a second id on it keeps the first, with the declaration of
    // each id it writes taken from origin/main, so a run again on an id corrects it instead of stacking on a value
    // never in force.
    const start = [...head.filter((rule) => !ids.includes(rule.id)), ...ids.map(inBase).filter((rule) => rule !== undefined)].sort(byId);
    const startSources = { ...headSources };
    for (const id of ids) {
      if (Object.hasOwn(baseSources, id)) startSources[id] = baseSources[id];
      else delete startSources[id];
    }
    const today = dayOf(now());

    if (!several && !checkSource) {
      let change;
      try {
        change = JSON.parse(input);
      } catch {
        throw new RuleChangeError('the change on standard input is not JSON');
      }
      if (change === null || typeof change !== 'object' || Array.isArray(change)) throw new RuleChangeError('the change is a JSON object');
      if (Object.hasOwn(change, 'value') && Object.hasOwn(HOME_FLAGS, oneId)) {
        throw new RuleChangeError(`"${oneId}" is a rule of a home of a model and an effort, and a home's new value is tried on the installed CLI before it is written: js-harness rules switch ${HOME_FLAGS[oneId]}, with his words; a change of its form, its patterns or its subject still runs here`);
      }
      items[0].change = change;
    }

    // What the keys of the row `rules` are checked against: the entries of the register on this branch, and the
    // findings of a rule's patterns in origin/main's texts in force, read once and only when a count is asked.
    const register = git(['show', `HEAD:${REGISTER}`]);
    const failures = new Set(register.status === 0 ? parseRegister(String(register.stdout)).entries.map((entry) => entry.id) : []);
    let mainTexts = null;
    const countOf = (rule) => {
      mainTexts ??= out(['-c', 'core.quotePath=false', 'ls-tree', '-r', '--name-only', BASE]).split(/\r?\n/).filter(isTextInForce).map((file) => ({ path: file, text: out(['show', `${BASE}:${file}`]) }));
      return countFindings([rule], mainTexts).counts[rule.id] ?? 0;
    };

    // Each change in its turn, on the list the one before it gave.
    let list = checkSource ? head : start;
    try {
      for (const item of items) {
        item.before = inBase(item.id);
        if (checkSource) {
          item.rule = head.find((rule) => rule.id === item.id);
          item.what = 'source checked';
          continue;
        }
        // Put back: the list this pass starts from holds origin/main's declaration of it already.
        if (Object.hasOwn(item, 'back')) {
          item.rule = item.before;
          item.what = `put back to ${item.before.value}, the value in force on ${BASE}, from ${item.back} on this branch`;
          continue;
        }
        const changed = changedList(list, item.id, item.change, { today, failures, countOf });
        list = changed.list;
        item.rule = changed.rule;
        item.what = changed.what;
      }
    } catch (error) {
      // A dry run fetched nothing, so a refusal it reaches may rest on an old origin/main: it says so, as its output does.
      if (error instanceof RuleChangeError && refusing && dryRun) throw new RuleChangeError(`${error.message} (${NOT_FETCHED})`);
      throw error;
    }
    for (const { id, before, rule } of items) {
      if (rule === undefined) throw new RuleChangeError(`no rule "${id}" is declared on ${branch}`);
      if (isAgents(before?.path) || isAgents(rule.path)) {
        throw new RuleChangeError('a phrase of AGENTS.md changes only by its approved draft (letter G), which is not built');
      }
    }

    // The tree may differ from the branch only in the home of a text that changes with its declaration, and in the
    // paths `--with` names: what moves in the same commit as the rule, as the readers of one that retires do. A path
    // named is one that holds a change, so a misspelled one is not passed over, and never one of the three files
    // this command writes.
    const homes = new Set(items.flatMap(({ before, rule, change }) => [before?.path, rule.path].filter((file) => typeof file === 'string' && change !== null && (Object.hasOwn(change, 'path') || Object.hasOwn(change, 'phrases')))));
    const named = withPaths.map((file) => path.posix.normalize(String(file).replace(/\\/g, '/')));
    const own = named.find((file) => [DATA, SOURCES, LIST].includes(file));
    if (own !== undefined) throw new RuleChangeError(`--with names ${own}, which the command writes itself`);
    // Read untrimmed: the first column of the first line may be a space.
    const status = git(['status', '--porcelain', '-uall']);
    if (status.status !== 0) throw new RuleChangeError('git status failed');
    const changedNow = changedPaths(String(status.stdout ?? ''));
    const unchanged = named.find((file) => !changedNow.includes(file));
    if (unchanged !== undefined) throw new RuleChangeError(`--with names ${unchanged}, which holds no change in the tree`);
    const outside = changedNow.filter((file) => !homes.has(file) && !named.includes(file));
    if (outside.length > 0) {
      const written = outside.some((file) => [DATA, SOURCES, LIST].includes(file)) ? '; commit the change already written before the next one' : '';
      throw new RuleChangeError(`the tree holds changes outside the rule's home${named.length > 0 ? ' and the paths named' : ''}: ${outside.join(', ')}${written}`);
    }

    // The source of each change, read from its transcripts and checked.
    const transcriptOf = (session) => {
      if (!isSessionId(session)) return null;
      const file = path.join(transcripts, `${session}.jsonl`);
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    };
    let sources = { ...startSources };
    for (const item of items) {
      const { id, before, rule, change, what } = item;
      // A rule put back keeps the source origin/main holds for it: nothing of his is read for a value already in force.
      if (Object.hasOwn(item, 'back')) {
        item.formOnly = false;
        item.stored = startSources[id];
        item.sourceSaid = `the rule's own on ${BASE} kept`;
        continue;
      }
      let given;
      if (checkSource) {
        const stored = headSources[id];
        if (stored?.kind !== 'words') throw new RuleChangeError(`the source of "${id}" is not his words, so there is nothing to check against a transcript`);
        given = { kind: 'words', quotes: stored.quotes.map((quote) => ({ session: quote.session, line: quote.line, excerpt: quote.quote })), reading: stored.reading, accepted: stored.accepted };
      } else {
        given = change.source;
      }
      // A change of form alone (patterns or failure, nothing else) says nothing of the value, so the rule keeps the source
      // of its value, and the relief line names where the change came from; any other change stores its own source.
      const formOnly = change !== null && what === 'form' && Object.hasOwn(startSources, id)
        && Object.keys(change).every((key) => key === 'set' || key === 'source')
        && Object.keys(change.set ?? {}).length > 0 && Object.keys(change.set).every((key) => key === 'patterns' || key === 'failure');
      // A rule of his needs his words whether it is his before the change or after it, except for a change of its form
      // alone, which keeps his words as its source (his answer of 2026-10-16, odd/tasks/rule-hierarchy.md).
      const owner = before?.owner === 'sebastian' ? 'sebastian' : rule.owner;
      const source = sourceOf(given, { owner, form: formOnly, today, transcriptOf, exists: (file) => isFileOf(top, file) });
      item.formOnly = formOnly;
      item.stored = formOnly ? startSources[id] : source;
      item.sourceSaid = formOnly ? `${source.kind}${source.kind === 'design' ? ` ${source.path}` : ''}, the rule's own source kept` : source.kind;
      sources[id] = item.stored;
    }
    sources = sortedKeys(sources);

    // The new list, checked against the repository before anything is written.
    const dataText = writeRules(list);
    const tree = readTree(top);
    const first = checkRules({ rules: list, declared: list, sources, dataText, listText: null, codeFiles: tree.codeFiles, textFiles: tree.textFiles, readFile: tree.readFile });
    const findings = first.findings.filter((finding) => !LIST_FINDINGS.some((prefix) => finding.startsWith(prefix)));
    if (findings.length > 0) throw new RuleChangeError(`the new list has ${findings.length === 1 ? 'a finding' : 'findings'}:\n${findings.map((finding) => `      ${finding}`).join('\n')}`);
    const listText = renderList(list, { sources, readers: first.readers, sentences: first.sentences });
    const sourcesText = `${JSON.stringify(sources, null, 2)}\n`;
    // The other files of the same commit, each a copy of what the list now says.
    const copies = several ? also(list, ids) : [];

    // The relief line of each rule, built and checked before any write.
    const reliefFile = reliefPath(home, slug);
    const relief = fs.existsSync(reliefFile) ? fs.readFileSync(reliefFile, 'utf8') : '';
    for (const item of items) {
      const previous = lastLineFor(relief, item.id);
      item.line = `rule:${item.id} proposed on ${branch}, not landed: ${item.what}; source ${item.sourceSaid}; supersedes ${previous === null ? 'no relief line' : `relief line ${previous}`}; declaration and source ${declarationOf(dataText, item.id, sources)}`;
      try {
        reliefLineOf(item.line);
      } catch (err) {
        throw new RuleChangeError(err.message);
      }
      const { id, before, rule, what } = item;
      item.memory = before !== undefined && Object.hasOwn(before, 'value') && what !== 'form' && what !== 'source checked' && !Object.hasOwn(item, 'back')
        ? `memory: a memory note or engram observation that states ${before.unit === undefined ? before.value : `${before.value} ${before.unit}`} for ${before.subject} is changed to point to rule:${id}; the command reads no memory`
        : `memory: a memory note that restates "${id}" points to rule:${id}; the command reads no memory`;
      // A rule with patterns says how many findings they have on origin/main, so a first pattern is tried by its dry run.
      const count = !checkSource && Array.isArray(rule.patterns) ? countOf(rule) : null;
      item.countLine = count === null ? null : `count: ${count} ${count === 1 ? 'finding' : 'findings'} of its patterns in ${BASE}'s texts in force`;
    }
    const skippedLines = skipped.map((one) => `skipped: ${one.id} stays ${one.value}, the value in force on ${BASE}`);
    const writes = [[DATA, dataText], [SOURCES, sourcesText], [LIST, listText], ...copies];
    const result = {
      code: 0, branch, today, skipped, already, left, files: writes.map(([file]) => file), baseList: base, list,
      written: items.map((item) => ({ id: item.id, what: item.what, from: Object.hasOwn(item, 'back') ? item.back : item.before?.value, to: item.rule.value, back: Object.hasOwn(item, 'back') })),
    };

    if (dryRun) {
      for (const item of items) {
        stdout(JSON.stringify(list.find((rule) => rule.id === item.id), null, 2));
        stdout(`Source: ${item.formOnly ? "kept, the rule's own: " : ''}${JSON.stringify(item.stored, null, 2)}`);
        stdout(`Relief line: ${item.line}`);
        if (refusing) stdout(NOT_FETCHED);
        if (item.countLine !== null) stdout(item.countLine);
        stdout(item.memory);
      }
      for (const line of skippedLines) stdout(line);
      for (const [file] of copies) stdout(`also written: ${file}`);
      stdout(COST);
      return result;
    }

    // The write: each file beside itself, then renamed, then the relief lines; a failure puts the files back. A relief
    // line appended before a later one failed stays: it proposes what was put back, and the next run supersedes it.
    const reliefs = [];
    try {
      for (const [file, text] of writes) {
        const target = path.join(top, ...file.split('/'));
        fs.writeFileSync(`${target}.change-tmp`, text, 'utf8');
        rename(`${target}.change-tmp`, target);
      }
      for (const item of items) reliefs.push(appendRelief(home, slug, item.line, now(), `rules ${command}`));
    } catch (err) {
      for (const [file] of writes) fs.rmSync(path.join(top, ...file.split('/')) + '.change-tmp', { force: true });
      const files = writes.map(([file]) => file);
      const restored = git(['checkout', 'HEAD', '--', ...files]).status === 0;
      stderr(restored
        ? `not changed: a file could not be written (${err.code ?? err.message}); ${files.join(', ')} are as they were`
        : `not changed: a file could not be written (${err.code ?? err.message}), and putting ${files.join(', ')} back failed too: git checkout HEAD -- ${files.join(' ')}`);
      return { code: 1 };
    }
    items.forEach((item, index) => {
      stdout(`changed: ${item.id}, ${item.what}; ${result.files.join(', ')} written`);
      stdout(`relief: ${reliefs[index].line}`);
      if (item.countLine !== null) stdout(item.countLine);
      stdout(item.memory);
    });
    for (const line of skippedLines) stdout(line);
    stdout(COST);
    const gate = 'through the gate and both reviews';
    if (!several) stdout(`next: commit on ${branch}, ${gate}, in a pull request of its own against main; the rules of a home change together, by js-harness rules switch, and land in one pull request`);
    else if (!oneAtATime) stdout(`next: one commit on ${branch} for the ${items.length === 1 ? 'rule' : `${items.length} rules`}, ${gate}: the rules of a home land in one pull request against main`);
    else stdout(`next: commit ${ids[0]} on ${branch}${left.length === 0 ? ': it is the last' : `, then run the same command again for ${left.join(', ')}, a commit a rule in this order`}; the rules of a home still land in one pull request against main`);
    return result;
  }
}

