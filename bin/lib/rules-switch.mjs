// `js-harness rules switch`: the one command that moves a home of a model and an effort to a new value
// (odd/tasks/one-model-home.md, spec 8, and spec 10 for Codex's home). On 2026-11-10 the user changed model and effort
// twice in a day; a change of both homes was four runs of `rules change`, four JSON objects and four commits, and no
// run tried the new id before it was written, so a wrong id would have been found by the first launch on it. The
// switch takes the values and his quoted words, asks each new model one short question through the installed CLI at
// the level given, and only then has the runner write the rules of the homes named in one pass
// (./rules-change-run.mjs, `changeRules`) with the writer's agent file, the copy the host reads. It then prints the
// commit to make, what is left outside the repository and what a new model may make stale that no rule holds.
//
// Pure: everything it reads or runs is handed in as `deps`, the runner's pass, the two probes, the meter, the records
// and the files of the checkout, so its tests ask no model and bin/rules.mjs holds the real ones. It commits nothing.
import { weeklyFloor } from './codex-meter.mjs';
import { settingsNotes } from './home-doctor.mjs';
import { offHomeLines, sessionsOffHome } from './home-sessions.mjs';
import { CLAUDE_HOME, CODEX_HOME, displayName, homeFaults, menuLine, sameClaudeModel } from './model-home.mjs';
import { RuleChangeError } from './rules-change.mjs';
import { DEFAULT_CONTEXT_WINDOW } from './sessions.mjs';

/** An argument of the switch that cannot be taken, with what one is: thrown and caught inside `parseSwitch`, which
 * gives it to the command as `{ error }`, since a usage error is the command's to raise. */
class NotTaken extends Error {}

/** The switch in the usage line of `js-harness rules`. */
export const SWITCH_USAGE = 'switch [--claude <model>@<effort>] [--lead <effort>] [--advisor <model>] [--codex <model>@<effort>] --quote <session>:<line>... --reading <text> --accepted <text> [--rule-by-rule] [--dry-run]';

/** The writer's agent file: the host reads only the file, so it holds a copy of the home's model and effort, which
 * the switch writes and bin/lib/writer-agent.test.mjs compares. */
export const WRITER_AGENT = '.claude/agents/js-harness-writer.md';

// What a model id may hold to be handed to a command line: Codex's id has no shape of its own to hold it to.
const ID_CHARACTERS = /^[\w.:-]+$/;

/** The faults of `value` as the value of the home rule `id`, each naming the flag it came with. */
function refuseValue(flag, id, value) {
  const fault = homeFaults({ id, value })[0];
  if (fault !== undefined) throw new NotTaken(`${flag}: ${value}: ${fault}`);
}

/** `<model>@<effort>` as `{ model, effort }`, held to the shape of the home `ids` (`{ model, effort }`, rule ids). */
function pairOf(flag, text, ids) {
  const at = text.lastIndexOf('@');
  if (at <= 0 || at === text.length - 1) throw new NotTaken(`${flag} takes <model>@<effort>, got ${JSON.stringify(text)}`);
  const [model, effort] = [text.slice(0, at), text.slice(at + 1)];
  if (!ID_CHARACTERS.test(model)) throw new NotTaken(`${flag}: ${model}: a model id is letters, digits, dots, colons, underscores and hyphens, since it is handed to a command line`);
  refuseValue(flag, ids.model, model);
  refuseValue(flag, ids.effort, effort);
  return { model, effort };
}

/** The switch's options from the words after `switch`: `{ command, claude, lead, codex, quotes, reading, accepted,
 * dryRun, ruleByRule }`. `claude` and `codex` are `{ model, effort }` or null, `lead` the lead's level or null: the
 * Claude home is one model and two levels since 2026-11-11, and `--claude` gives the level of everything but the
 * lead's session. `--rule-by-rule` is his no to one commit for several rules. Words that cannot be taken give
 * `{ error }`, the sentence of the usage error. */
export function parseSwitch(tokens) {
  try {
    return parsedSwitch(tokens);
  } catch (err) {
    if (!(err instanceof NotTaken)) throw err;
    return { error: err.message };
  }
}

/** `parseSwitch`'s options, or a `NotTaken` thrown at the first word that cannot be taken. */
function parsedSwitch(tokens) {
  const parsed = { command: 'switch', claude: null, lead: null, advisor: null, codex: null, quotes: [], reading: null, accepted: null, dryRun: false, ruleByRule: false };
  const valued = { '--claude': 'claude', '--lead': 'lead', '--advisor': 'advisor', '--codex': 'codex', '--reading': 'reading', '--accepted': 'accepted' };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--dry-run') parsed.dryRun = true;
    else if (token === '--rule-by-rule') parsed.ruleByRule = true;
    else if (token === '--quote' || Object.hasOwn(valued, token)) {
      const value = tokens[index += 1];
      if (value === undefined || value.startsWith('--') || value.trim() === '') throw new NotTaken(`${token} needs a value`);
      if (token === '--quote') {
        const quote = /^(.+):([1-9]\d*)$/.exec(value);
        if (quote === null) throw new NotTaken(`--quote takes <session>:<line>, got ${JSON.stringify(value)}`);
        parsed.quotes.push({ session: quote[1], line: Number(quote[2]) });
        continue;
      }
      if (parsed[valued[token]] !== null) throw new NotTaken(`${token} is given once`);
      if (token === '--claude') parsed.claude = pairOf(token, value, CLAUDE_HOME);
      else if (token === '--codex') parsed.codex = pairOf(token, value, CODEX_HOME);
      else if (token === '--lead') {
        refuseValue(token, CLAUDE_HOME.lead, value);
        parsed.lead = value;
      } else if (token === '--advisor') {
        // The advisor's model, a full Claude id (odd/tasks/advisor-home.md, spec 5).
        refuseValue(token, CLAUDE_HOME.advisor, value);
        parsed.advisor = value;
      } else parsed[valued[token]] = value;
    } else throw new NotTaken(`unknown argument: ${token}`);
  }
  if (parsed.claude === null && parsed.lead === null && parsed.advisor === null && parsed.codex === null) throw new NotTaken('rules switch names no home: give --claude <model>@<effort>, --lead <effort>, --advisor <model> or --codex <model>@<effort>');
  if (parsed.quotes.length === 0) throw new NotTaken('rules switch needs his words: --quote <session>:<line>, once for each line of the transcript that holds them');
  if (parsed.reading === null) throw new NotTaken('rules switch needs --reading "<what his words mean>"');
  if (parsed.accepted === null) throw new NotTaken('rules switch needs --accepted "<where he accepted it>"');
  return parsed;
}

/** The change of each rule the switch names, `[{ id, change }]` in the order they are written, Claude's home first:
 * its value, and his words as its source, the same for every rule since one sentence of his moves them. */
export function changesOf(parsed) {
  const source = () => ({ kind: 'words', quotes: parsed.quotes.map(({ session, line }) => ({ session, line })), reading: parsed.reading, accepted: parsed.accepted });
  const named = [
    ...(parsed.claude === null ? [] : [[CLAUDE_HOME.model, parsed.claude.model], [CLAUDE_HOME.effort, parsed.claude.effort]]),
    ...(parsed.lead === null ? [] : [[CLAUDE_HOME.lead, parsed.lead]]),
    ...(parsed.advisor === null ? [] : [[CLAUDE_HOME.advisor, parsed.advisor]]),
    ...(parsed.codex === null ? [] : [[CODEX_HOME.model, parsed.codex.model], [CODEX_HOME.effort, parsed.codex.effort]]),
  ];
  return named.map(([id, value]) => ({ id, change: { value, source: source() } }));
}

/** The two homes as the list `list` declares them, `{ claude: { model, effort, lead }, codex: { model, effort } }`,
 * a value null where the list declares none. */
function homesOf(list) {
  const value = (id) => list.find((rule) => rule.id === id)?.value ?? null;
  return {
    claude: { model: value(CLAUDE_HOME.model), effort: value(CLAUDE_HOME.effort), lead: value(CLAUDE_HOME.lead), advisor: value(CLAUDE_HOME.advisor) },
    codex: { model: value(CODEX_HOME.model), effort: value(CODEX_HOME.effort) },
  };
}

// ── the probes ──────────────────────────────────────────────────────────────────────────────────

/** What a probe asks, and the system prompt it asks under: one word back, so a call costs as little as one can. */
export const PROBE_QUESTION = 'Answer with the single word: ready';
/** The question of a probe with an advisor: one call of the advisor proves it answers (odd/tasks/advisor-home.md, L5). */
export const ADVISOR_QUESTION = 'Call your advisor tool once, then answer with the single word: ready';
export const PROBE_PROMPT = 'This is a one-line check that a model can be reached. Answer in one word and do nothing else.';

/** The probes a switch owes, `{ claude, codex }`, each a list of `{ model, effort }`: every model and level a home
 * holds `after` the write that it does not hold `before` it (both `homesOf`'s). Claude's home holds its model at two
 * levels, the sessions' and the lead's, so a new model is tried at each; a pair in force today is launched every
 * day and is not asked again. */
export function probesOf(before, after) {
  // The advisor goes with each pair, where the home declares one: the host refuses some pairings, so the model and
  // its advisor are tried together whenever either changes (odd/tasks/advisor-home.md, spec 5).
  const pairs = (home) => [{ model: home.model, effort: home.effort }, { model: home.model, effort: home.lead }].map((pair) => (typeof home.advisor === 'string' ? { ...pair, advisor: home.advisor } : pair));
  const same = (one, other) => one.model === other.model && one.effort === other.effort && one.advisor === other.advisor;
  const claude = [];
  for (const pair of pairs(after.claude)) {
    if (!pairs(before.claude).some((held) => same(held, pair)) && !claude.some((asked) => same(asked, pair))) claude.push(pair);
  }
  return { claude, codex: same(before.codex, after.codex) ? [] : [{ model: after.codex.model, effort: after.codex.effort }] };
}

/** The CLI arguments of the Claude probe, asked as a lens asks (bin/lens-review.mjs): no tools, none of the user's
 * customizations, no session kept, so it leaves no record a listing would count. The caller runs it in a temporary
 * folder with the question on standard input. */
export function claudeProbeArgs({ model, effort, advisor, promptFile, settingsFile }) {
  return ['-p', '--safe-mode', '--tools', '', '--system-prompt-file', promptFile, '--settings', settingsFile, '--model', model, '--effort', effort, ...(advisor === undefined ? [] : ['--advisor', advisor]), '--output-format', 'json', '--no-session-persistence'];
}

// The features of Codex that give a model a tool of Codex's own, each listed off by Codex CLI 0.167.1 when it is
// disabled (`codex --disable <name> features list`, which asks no model). Two tools no flag turns off there: the plan
// tool has no feature, and `unified_exec` stays on whatever it is asked.
export const CODEX_TOOL_FEATURES = ['shell_tool', 'multi_agent', 'view_image', 'image_generation', 'sleep_tool', 'tool_suggest', 'skill_search', 'browser_use', 'computer_use'];

/** The names of the features `codex features list` printed in `text`: the first word of each line that gives a name,
 * a stage and a state. */
export function codexFeaturesOf(text) {
  return String(text ?? '').split(/\r?\n/).flatMap((line) => /^([a-z][\w.]*)\s+\S.*\s(?:true|false)\s*$/.exec(line)?.slice(1) ?? []);
}

/** The CLI arguments of the Codex probe: one `codex exec` that keeps no session, reads none of the user's
 * configuration and may write nothing, with the question on standard input. Beside what Codex loads (plugins, apps,
 * hooks), every tool of its own that a feature turns off is off (`CODEX_TOOL_FEATURES`): a read-only sandbox refuses
 * a write, not a call. The CLI refuses a feature it does not know, so with `features`, the names the installed CLI
 * lists (`codexFeaturesOf`), only the ones it lists are named; without it, all are. No flag reaches every tool, so
 * `readCodexProbe` refuses a probe that did more than answer. */
export function codexProbeArgs({ model, effort, features = null }) {
  const off = features === null ? CODEX_TOOL_FEATURES : CODEX_TOOL_FEATURES.filter((name) => features.includes(name));
  return [
    'exec', '--json', '--ephemeral', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules',
    '--disable', 'plugins', '--disable', 'apps', '--disable', 'hooks', ...off.flatMap((name) => ['--disable', name]),
    '-m', model, '-c', `model_reasoning_effort="${effort}"`, '-c', 'sandbox_mode=read-only', '-c', 'approval_policy=never', '-',
  ];
}

/** The first line of what a CLI said that holds anything, or `nothing`. */
const firstLine = (...texts) => texts.flatMap((text) => String(text ?? '').split(/\r?\n/)).map((line) => line.trim()).find((line) => line !== '') ?? 'it said nothing';

/** What the Claude probe `ran` (`{ status, stdout, stderr, error }`) proves of `{ model, effort }`: `{ ok: true,
 * answered, beside, costUsd }`, `answered` the id the CLI billed that is the model asked and `beside` any other it
 * billed, or `{ ok: false, why }` when the CLI could not run, refused the id or the level, gave nothing to read, or
 * another model answered. That the CLI ran with the level is all it says of the effort. */
export function readClaudeProbe(ran, { model, effort, advisor }) {
  if (ran?.error) return { ok: false, why: `the claude CLI could not run: ${ran.error.message}` };
  let out = null;
  try {
    out = JSON.parse(ran?.stdout ?? '');
  } catch {
    // Read below: a refusal when the CLI failed, else an answer that cannot be read.
  }
  if (ran?.status !== 0 || out?.is_error) {
    const said = out?.is_error ? firstLine(out.result) : firstLine(ran?.stderr, ran?.stdout);
    return { ok: false, why: `the claude CLI refused ${model} at ${effort}${ran?.status !== 0 ? ` (exit ${ran?.status})` : ''}: ${said}` };
  }
  if (out === null || typeof out !== 'object') return { ok: false, why: 'the claude CLI gave no answer that can be read' };
  const billed = Object.keys(out.modelUsage ?? {});
  if (billed.length === 0) return { ok: false, why: 'the claude CLI\'s answer names no model, so which model answered is not proven' };
  const answered = billed.find((id) => id === model || sameClaudeModel(id, model));
  if (answered === undefined) return { ok: false, why: `another model answered: ${billed.join(', ')}, not ${model}` };
  // With an advisor, only a call of it proves it answers: the CLI refuses an unknown id, not a pairing that drops it.
  const advised = advisor === undefined ? null : (out.usage?.iterations ?? []).find((step) => step?.type === 'advisor_message' && sameClaudeModel(step.model, advisor));
  if (advisor !== undefined && advised === undefined) return { ok: false, why: `the advisor ${advisor} did not answer: the reply of ${model} holds no advisor_message of it` };
  return { ok: true, answered, advised: advised?.model ?? null, beside: billed.filter((id) => id !== answered && (advised == null || !sameClaudeModel(id, advisor))), costUsd: typeof out.total_cost_usd === 'number' ? out.total_cost_usd : null };
}

/** The first text under a key `model` in `value`, three levels deep at most, or null. */
function modelIn(value, depth = 0) {
  if (value === null || typeof value !== 'object' || depth > 3) return null;
  if (typeof value.model === 'string' && value.model !== '') return value.model;
  for (const inner of Object.values(value)) {
    const found = modelIn(inner, depth + 1);
    if (found !== null) return found;
  }
  return null;
}

/** What the Codex probe `ran` proves of `{ model, effort }`: `{ ok: true, answered }`, or `{ ok: false, why }`. It
 * proves that the CLI took the id and the level and that a turn ended; `answered` is the model only where an event of
 * `codex exec --json` names one, and null where none does (odd/tasks/one-model-home.md, L13, "Claude 12"). */
export function readCodexProbe(ran, { model, effort }) {
  if (ran?.error) return { ok: false, why: `the codex CLI could not run: ${ran.error.message}` };
  const events = String(ran?.stdout ?? '').split(/\r?\n/).flatMap((line) => {
    try {
      const event = JSON.parse(line);
      return event !== null && typeof event === 'object' ? [event] : [];
    } catch {
      return [];
    }
  });
  const failed = events.find((event) => event.type === 'error' || event.type === 'turn.failed');
  if (ran?.status !== 0 || failed !== undefined) {
    const said = failed === undefined ? firstLine(ran?.stderr, ran?.stdout) : firstLine(failed.message, failed.error?.message);
    return { ok: false, why: `the codex CLI refused ${model} at ${effort}${ran?.status !== 0 ? ` (exit ${ran?.status})` : ''}: ${said}` };
  }
  const ended = events.some((event) => event.type === 'turn.completed' || (event.type === 'item.completed' && event.item?.type === 'agent_message'));
  if (!ended) return { ok: false, why: `the codex CLI gave no answer to ${model} at ${effort}` };
  // What a turn did beside thinking and answering: a tool no flag turns off (`codexProbeArgs`), each a call more.
  const did = events.filter((event) => event.type === 'item.completed' && !['agent_message', 'reasoning'].includes(event.item?.type)).map((event) => String(event.item?.type));
  if (did.length > 0) return { ok: false, why: `${model} at ${effort} did more than answer the one question: ${did.join(', ')}; a probe is one call with no tool` };
  const answered = events.map((event) => modelIn(event)).find((id) => id !== null) ?? null;
  if (answered !== null && answered !== model) return { ok: false, why: `another model answered: ${answered}, not ${model}` };
  return { ok: true, answered };
}

// ── the writer's agent file ─────────────────────────────────────────────────────────────────────

/** `text`, the writer's agent file, with the `model:` and `effort:` lines of its frontmatter holding `model` and
 * `effort`, and nothing else of it changed. It throws a `RuleChangeError` when the file has no such line: a copy
 * that cannot be written would leave the writers on the model that leaves. */
export function agentCopy(text, { model, effort }) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (block === null) throw new RuleChangeError(`${WRITER_AGENT} opens with no frontmatter block between --- lines, so its model and its effort cannot be written: restore it from main`);
  let front = block[1];
  for (const [key, value] of [['model', model], ['effort', effort]]) {
    const line = new RegExp(`^${key}:[ \\t]*\\S.*$`, 'm');
    if (!line.test(front)) throw new RuleChangeError(`${WRITER_AGENT} holds no \`${key}:\` line in its frontmatter, so the switch cannot write it: restore it from main`);
    front = front.replace(line, () => `${key}: ${value}`);
  }
  const start = text.indexOf('\n') + 1;
  return `${text.slice(0, start)}${front}${text.slice(start + block[1].length)}`;
}

/** The copies of the home the pass writes beside the rules, `[[path, text]]`, for the list `list` it writes and the
 * `ids` it writes now: the agent file, when the model or the sessions' level changes and its text differs. */
function agentWrites(list, ids, readFile) {
  if (!ids.includes(CLAUDE_HOME.model) && !ids.includes(CLAUDE_HOME.effort)) return [];
  const text = readFile(WRITER_AGENT);
  if (text === null) throw new RuleChangeError(`${WRITER_AGENT} is not in this checkout: it is the copy of the home the host reads for a writer, and the switch writes it with the rules; restore it from main`);
  const { model, effort } = homesOf(list).claude;
  const copy = agentCopy(text, { model, effort });
  return copy === text ? [] : [[WRITER_AGENT, copy]];
}

// ── what a new model may make stale, and no rule holds ──────────────────────────────────────────

// Where a run of the evals takes its model when none is named: each is read from its file, never restated here.
const EVAL_DEFAULTS = [
  { home: 'claude', file: 'evals/suite.mjs', name: 'EVAL_MODEL', what: 'the default model of a new eval run' },
  { home: 'claude', file: 'evals/isolation-probe.mjs', name: 'PROBE_MODEL', what: 'the model an isolation probe runs on' },
  { home: 'codex', file: 'evals/suite.mjs', name: 'CODEX_EVAL_MODEL', what: 'the default model of a new eval run' },
  { home: 'codex', file: 'evals/codex-isolation-probe.mjs', name: 'PROBE_MODEL', what: 'the model an isolation probe runs on' },
];
const HOOK = 'bin/commit-msg.mjs';
const PRICES = 'evals/prices.mjs';

const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const lineAt = (text, index) => text.slice(0, index).split('\n').length;

/** The constant `name` of the module text `text` when it is given a quoted text, `{ value, line }`, else null. */
function constantIn(text, name) {
  const found = new RegExp(`^(?:export )?const ${name} = (['"\`])([^'"\`\\n]+)\\1;`, 'm').exec(text ?? '');
  return found === null ? null : { value: found[2], line: lineAt(text, found.index) };
}

/** The lines of what the new models may make stale that no rule holds, each found by a check of the checkout's own
 * files and none listed by hand (spec 8). `claude` and `codex` are the new model of each home, or null for a home
 * that keeps its model, which is not checked. `readFile(path)` gives a file of the checkout or null; `window` is the
 * window the host is configured to compact on, `{ window, source }` or null.
 *
 * For Claude: the context window the board assumes, which no check can know of a model and is always said; the name
 * the commit-message hook strips, tried against its own `HOST_NAME`; and the model's row in the list prices. For
 * both: where a run of the evals takes another model by default, which `docs/future-model.md` owns. A file or a
 * constant that cannot be read is said as not checked, never passed over. */
export function staleLines({ claude, codex, readFile, window }) {
  const lines = [];
  if (claude !== null) {
    const configured = window === null ? 'no autoCompactWindow is configured' : `${window.source} configures ${window.window}`;
    lines.push(`the board assumes a context window of ${DEFAULT_CONTEXT_WINDOW} tokens (DEFAULT_CONTEXT_WINDOW, bin/lib/sessions.mjs) and ${configured}: no check knows the window of ${claude}, so confirm it`);
    const name = `Claude ${displayName(claude)}`;
    if (displayName(claude) !== claude) {
      const hook = readFile(HOOK);
      const found = /^const HOST_NAME = \/(.+)\/([a-z]*);[ \t]*$/m.exec(hook ?? '');
      let knows = null;
      try {
        knows = found === null ? null : new RegExp(found[1], found[2]).test(name);
      } catch {
        knows = null;
      }
      if (knows === null) lines.push(`not checked: ${HOOK} holds no HOST_NAME that can be read, so whether the hook knows "${name}" is not known`);
      else if (!knows) lines.push(`the commit-message hook does not know the name "${name}" (HOST_NAME, ${HOOK}:${lineAt(hook, found.index)}): it would leave that attribution line in a message`);
    }
    const prices = readFile(PRICES);
    if (prices === null) lines.push(`not checked: ${PRICES} cannot be read, so whether ${claude} has a list price is not known`);
    else if (!new RegExp(`(['"])${escaped(claude)}\\1\\s*:`).test(prices)) lines.push(`${PRICES} holds no row for ${claude}: a cost on it has no list price`);
  }
  for (const [home, model] of [['claude', claude], ['codex', codex]]) {
    if (model === null) continue;
    for (const { file, name, what } of EVAL_DEFAULTS.filter((one) => one.home === home)) {
      const held = constantIn(readFile(file), name);
      if (held === null) lines.push(`not checked: ${file} holds no ${name} that can be read`);
      else if (held.value !== model && !sameClaudeModel(held.value, model)) lines.push(`${what} is ${held.value}, not ${model} (${name}, ${file}:${held.line}): docs/future-model.md owns changing it`);
    }
  }
  return lines;
}

// ── what is left outside the repository ─────────────────────────────────────────────────────────

/** The lines of what a switch leaves outside the repository, which it never changes (spec 8). `home` is the Claude
 * home the switch gives, `{ model, effort, lead }`; `sessions` what ./home-sessions-read.mjs read, `{ desktop,
 * background, unread }`, or null when Claude's home does not change and its sessions stay where they are; `settings`
 * his settings as read, `{ user, project }`. Each open session off the new home gets the act that sets it, as
 * `rules applied` says it, then who does each act; then what his settings hold that the new home does not. The
 * installed copy comes first: until it is refreshed, a start and the guard hold the home that leaves. */
export function outsideLines({ home, sessions, settings, isLead = () => false }) {
  const lines = [
    'Left outside the repository, for after the land (this command changed none of it):',
    '  the installed copy still holds the home that leaves: refresh it at the land (js-harness merge-queue --land --refresh-copy), since a start, the guard and the reviews read the home from the copy that runs',
  ];
  if (sessions === null) return lines;
  lines.push(...offHomeLines(sessionsOffHome(home, { desktop: sessions.desktop, background: sessions.background, isLead }), home, { unread: sessions.unread }).slice(1));
  lines.push('  the lead\'s session tools are set_session_model and set_session_effort, called by the lead on another open session: a session changes neither of its own');
  if (typeof home.model === 'string' && typeof (home.lead ?? home.effort) === 'string') lines.push(`  only he changes the lead's own session. To give him: ${menuLine({ model: home.model, effort: home.lead ?? home.effort })}`);
  lines.push('  a resume starts a background session again on the home\'s model and level, whatever its record holds, and refuses a job at work');
  const notes = settingsNotes(home, settings ?? {});
  if (notes.length === 0) lines.push('  his settings: nothing read holds what the new home does not');
  for (const note of notes) lines.push(`  ${note}`);
  return lines;
}

// ── the switch ──────────────────────────────────────────────────────────────────────────────────

/** `texts` as words say a list: "a", "a and b", "a, b and c". */
const listed = (texts) => (texts.length <= 1 ? texts.join('') : `${texts.slice(0, -1).join(', ')} and ${texts.at(-1)}`);

/** What `run()` gives, or `{ error }` when it throws: a probe that cannot start is a probe that failed. */
function tried(run) {
  try {
    return run();
  } catch (error) {
    return { error };
  }
}

/**
 * Runs the switch `parsed` (`parseSwitch`'s) and gives its exit code: 0 when the rules are written, or with
 * `--dry-run` when they would be; 1 when the runner refuses, a probe fails or Codex is at its weekly floor, and then
 * nothing is written; and the runner's own code when the pass that writes does not finish after the probes, where the
 * runner's line says what was written and the switch's closing line defers to it.
 *
 * `deps` is everything it reads or runs: `pass(options, stdout, stderr)` is `changeRules` of the runner bound to the
 * checkout; `readFile(path)` a file of the checkout or null; `probeClaude({ model, effort })` and `probeCodex(...)`
 * ask the one question and give `{ status, stdout, stderr, error }`; `claudeVersion()` and `codexVersion()` the
 * version of each CLI or null; `readMeter()` Codex's limits (`readRateLimits`) and `weeklyFloor` the percent of the
 * weekly limit that must be left (rule:codex-weekly-floor, as bin/codex-review.mjs reads it); `readSessions()` and
 * `readSettings()` what is outside the repository; `configuredWindow()` the window the host compacts on; `isLead`
 * whether a title is a lead's.
 *
 * The order keeps a refusal cheap. The pass runs dry first, so a branch, a tree or a source the runner refuses costs
 * no probe. The cost of the probes is said, then Codex's weekly limit is read before any question, Claude's included,
 * so no call is spent on a switch the floor stops. Every probe passes before the pass that writes.
 */
export async function switchRules(parsed, deps, stdout, stderr) {
  const changes = changesOf(parsed);
  const options = { changes, oneAtATime: parsed.ruleByRule, also: (list, ids) => agentWrites(list, ids, deps.readFile) };
  const dryLines = [];
  const dry = deps.pass({ ...options, dryRun: true }, (line) => dryLines.push(line), stderr);
  if (dry.code !== 0) return dry.code;

  const before = homesOf(dry.baseList);
  const after = homesOf(dry.list);
  // The homes once every rule named is written: a run that writes one rule at a time leaves less than that.
  const target = {
    claude: { model: parsed.claude?.model ?? after.claude.model, effort: parsed.claude?.effort ?? after.claude.effort, lead: parsed.lead ?? after.claude.lead, advisor: parsed.advisor ?? after.claude.advisor },
    codex: { model: parsed.codex?.model ?? after.codex.model, effort: parsed.codex?.effort ?? after.codex.effort },
  };
  // An advisor that is the model itself is refused: a transcript could not tell it from none (odd/tasks/advisor-home.md,
  // spec 6), and it adds nothing a session does not have.
  if (typeof target.claude.advisor === 'string' && sameClaudeModel(target.claude.advisor, target.claude.model)) {
    stderr(`not switched: the advisor ${target.claude.advisor} is the model of the home itself, ${target.claude.model}; give --advisor another model, or --claude another model; nothing was probed and nothing was written`);
    return 2;
  }
  const probes = probesOf(before, after);
  const sequence = changes.map(({ id }) => id).filter((id) => !dry.skipped.some((one) => one.id === id));

  stdout(`switch on ${dry.branch}${parsed.ruleByRule ? ', a rule a run' : ''}:`);
  for (const { id } of changes) {
    const written = dry.written.find((one) => one.id === id);
    const skipped = dry.skipped.find((one) => one.id === id);
    if (written?.back) stdout(`  ${id}: back to ${written.to}, the value in force on origin/main, from ${written.from} on this branch`);
    else if (written !== undefined) stdout(`  ${id}: ${written.from} to ${written.to}`);
    else if (skipped !== undefined) stdout(`  ${id}: stays ${skipped.value}, not written`);
    else stdout(`  ${id}: ${dry.already.includes(id) ? 'on the branch already' : 'written by a later run'}`);
  }
  const owed = [...probes.claude, ...probes.codex];
  if (owed.length === 0) stdout('probe: none is owed, since every model and level this writes is in force already');
  else {
    const floorSaid = probes.codex.length > 0 ? '; Codex\'s is not asked at or under rule:codex-weekly-floor' : '';
    stdout(`probe: ${owed.length} short ${owed.length === 1 ? 'question' : 'questions'} through the installed CLI, one cheap call each with no session kept, Claude's with no tools and Codex's with every tool a flag turns off off, refused if it does more than answer: ${listed(owed.map((probe) => `${probe.model} at ${probe.effort}${probe.advisor === undefined ? '' : ` with the advisor ${probe.advisor}, asked to consult it once`}`))}${floorSaid}; nothing is written unless each answers`);
  }

  /** What follows the rules, for a real run and a dry one: what is outside the repository, and what may be stale. */
  const tail = () => {
    const claudeChanges = sequence.some((id) => Object.values(CLAUDE_HOME).includes(id));
    let sessions = null;
    if (claudeChanges) {
      const read = tried(() => deps.readSessions());
      sessions = read.error ? { desktop: [], background: [], unread: [`the sessions (${read.error.message})`] } : read;
    }
    const settings = tried(() => deps.readSettings());
    for (const line of outsideLines({ home: target.claude, sessions, settings: settings.error ? {} : settings, isLead: deps.isLead })) stdout(line);
    const newClaude = target.claude.model !== before.claude.model ? target.claude.model : null;
    const newCodex = target.codex.model !== before.codex.model ? target.codex.model : null;
    if (newClaude === null && newCodex === null) return;
    stdout('What the new model may make stale, that no rule holds:');
    const window = tried(() => deps.configuredWindow());
    const stale = staleLines({ claude: newClaude, codex: newCodex, readFile: deps.readFile, window: window === null || window.error ? null : window });
    for (const line of stale) stdout(`  ${line}`);
    if (stale.length === 0) stdout('  nothing a check of this checkout finds');
    if (newClaude !== null) stdout(`not tried by any command: that the app's start_session and set_session_model take ${newClaude}; the probe tries the CLI only, so check it the first time a start names it`);
  };

  if (parsed.dryRun) {
    for (const line of dryLines) stdout(line);
    tail();
    stdout('dry run: nothing was probed and nothing was written');
    return 0;
  }

  if (probes.codex.length > 0) {
    const floor = deps.weeklyFloor;
    const weekly = weeklyFloor(await deps.readMeter(), floor);
    if (weekly.stop) {
      const why = weekly.interrupted
        ? 'the read of Codex\'s weekly limit was interrupted'
        : `Codex's weekly limit has ${Math.round(weekly.left * 10) / 10}% left, at or under its floor of ${floor}% (rule:codex-weekly-floor)`;
      stderr(`not switched: ${why}, so nothing was probed and nothing was written. A reset credit is spent only on the user's word, asked through the lead where one leads; js-harness codex-meter reads what is left, and a switch of Claude's home alone asks nothing of Codex`);
      return 1;
    }
    if (weekly.unread !== undefined) stdout(`Codex's weekly limit could not be read before the probe: ${weekly.unread} The probe runs without it.`);
  }

  const day = dry.today;
  const proven = [];
  const claudeCli = probes.claude.length > 0 ? tried(() => deps.claudeVersion()) : null;
  const claudeSaid = `claude ${typeof claudeCli === 'string' ? claudeCli : 'of a version that was not read'}`;
  const answers = [];
  for (const probe of probes.claude) {
    const read = readClaudeProbe(tried(() => deps.probeClaude(probe)), probe);
    if (!read.ok) {
      stderr(`not switched: ${read.why}; nothing was written`);
      return 1;
    }
    answers.push({ answered: read.answered, effort: probe.effort });
    // What the CLI itself put the call at, where its answer holds a number: said as the CLI's figure, not a bill.
    const cost = read.costUsd === null ? '' : `; the CLI put the call at ${Math.round(read.costUsd * 10000) / 10000} USD`;
    stdout(`probed: ${read.answered} answered through ${claudeSaid} at ${probe.effort}${read.advised ? `, and its advisor ${read.advised} answered` : ''} on ${day}${read.beside.length > 0 ? `, with ${listed(read.beside)} billed beside it` : ''}${cost}`);
  }
  for (const answered of new Set(answers.map((one) => one.answered))) {
    proven.push(`${answered} answered through ${claudeSaid} at ${answers.filter((one) => one.answered === answered).map((one) => one.effort).join(' and at ')}`);
  }
  for (const probe of probes.codex) {
    const read = readCodexProbe(tried(() => deps.probeCodex(probe)), probe);
    if (!read.ok) {
      stderr(`not switched: ${read.why}; nothing was written`);
      return 1;
    }
    const cli = tried(() => deps.codexVersion());
    const took = `the codex CLI ${typeof cli === 'string' ? cli : 'of a version that was not read'} took ${probe.model} at ${probe.effort}`;
    stdout(`probed: ${took} on ${day}; ${read.answered === null ? 'its output names no model, so which model answered is not proven' : `${read.answered} answered`}`);
    proven.push(read.answered === null ? `${took}, and its output names no model` : `${took}, and ${read.answered} answered`);
  }

  const done = deps.pass({ ...options, dryRun: false }, stdout, stderr);
  if (done.code !== 0) {
    // The runner has said why on the line before, and only it knows what it left: a refusal wrote nothing, a failed
    // write put the files back or names the command that does, and a relief line appended before the failure stays.
    stderr('not switched: the pass that writes did not finish after its dry run passed, and the probes were spent; its own line, above, says what was and was not written, and a relief line it appended before it failed stays until the next run supersedes it; put right what that line names and run the switch again, which probes again');
    return done.code;
  }
  stdout('not proven: the effort the model then works at; a probe shows which model answered and that the CLI took the level, and no more');

  const said = proven.length === 0 ? 'No probe was owed: every model and level written was in force already.' : `Probed on ${day}: ${proven.join('; ')}. The effort the model then works at is not proven.`;
  const commit = [`git add ${done.files.join(' ')}`, `git commit -m "feat(rules): ${done.written.map((one) => `${one.id} is ${one.to}`).join(', ')}" -m "${said}"`];
  if (!parsed.ruleByRule) {
    stdout(`commit to make on ${done.branch}, one commit for the rules of the home:`);
    for (const line of commit) stdout(`  ${line}`);
  } else {
    stdout(`commit to make on ${done.branch}, a commit a rule, in this order:`);
    sequence.forEach((id, index) => {
      if (done.written.some((one) => one.id === id)) {
        stdout(`  ${index + 1}. ${id}, written now:`);
        for (const line of commit) stdout(`     ${line}`);
      } else if (done.already.includes(id)) stdout(`  ${index + 1}. ${id}: on the branch already`);
      else stdout(`  ${index + 1}. ${id}: ${done.left[0] === id ? 'the next run of this command writes it, after that commit' : 'a later run writes it'}`);
    });
    stdout('  each run probes again what its commit leaves the home holding: a probe leaves no record');
  }
  tail();
  return 0;
}
