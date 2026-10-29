// The pure part of the rehearsal (scripts/rehearsal.mjs, F8 S13): the steps of the walk of the reverse-engineering
// document's 11.1 on a scratch project in a scratch home, which row each step proves, and how a step's evidence is
// judged: the paths the manifests recorded are gone or back to their bytes after the uninstalls, nothing of
// gentle-ai, Orca or herdr is on the walk's PATH or among what it ran, engram's hook brings back the planted
// observation within its limit, and a planted directive without a control makes `rules check` exit 1.
// Nothing here reads the disk or starts a process; the platform is a parameter, so both path rules are tested
// on one machine. The design is in odd/tasks/f8-s13-rehearsal.md.
import path from 'node:path';

const pathFor = (platform) => (platform === 'win32' ? path.win32 : path.posix);

// ---- the walk ---------------------------------------------------------------------------------------------------------

/** The steps of the walk, in order. An `id` goes into the record of a walk, so it never changes once one was written. */
export const REHEARSAL = Object.freeze([
  { id: 'real-home-before', title: 'hash his files the walk must leave as they are' },
  { id: 'install', title: 'js-harness install writes the skills, the style, the Rules block, the permissions and the hooks into the scratch home' },
  { id: 'stack-install', title: 'stack install installs and registers codex, codegraph and context7; engram and its plugin by his steps as stack prints them' },
  { id: 'init', title: 'init --preset complete writes harness.json, AGENTS.md, the CLAUDE.md that imports it, FAILURES.md, both hooks, the index and the settings' },
  { id: 'engram-start', title: 'a session start brings back a planted observation within 16,384 bytes' },
  { id: 'engram-compact', title: 'a compaction brings it back again within 16,384 bytes' },
  { id: 'feature', title: 'a feature document opens with the task contract, and contract check passes' },
  { id: 'push-main', title: 'the first push to the local bare remote goes through the pre-push check' },
  { id: 'commit', title: 'a work unit commits through the pre-commit gate, and a commit that breaks a test is refused' },
  { id: 'push-refused', title: 'a push of a code commit no review covers is refused' },
  { id: 'reviews', title: 'codex-review and lens-review record the slice in the scratch project\'s git folder' },
  { id: 'push-reviewed', title: 'the same push goes through once both reviews cover it' },
  { id: 'updates', title: 'update reports the release, and init again writes nothing new' },
  { id: 'guide', title: 'the day-to-day guide: doctor names each row and its fix, throughput counts the reviews, check lists no skip' },
  { id: 'import-row', title: 'doctor\'s import row is green, and a CLAUDE.md planted above the project turns it red' },
  { id: 'directive', title: 'a planted directive without a control makes rules check exit 1' },
  { id: 'uninstall-project', title: 'uninstall project undoes what init wrote' },
  { id: 'uninstall-machine', title: 'uninstall machine undoes install and what stack install ran' },
  { id: 'recorded-paths', title: 'every path either manifest recorded is gone or back to its bytes' },
  { id: 'foreign-absent', title: 'nothing of gentle-ai, Orca or herdr was on the PATH or ran' },
  { id: 'real-home-after', title: 'his files are as they were' },
].map((step) => Object.freeze(step)));

/** Each row of 11.1, by its number, and the step that proves it. */
export const ROWS = Object.freeze({
  1: 'install',
  2: 'stack-install',
  3: 'init',
  4: 'engram-start',
  5: 'feature',
  6: 'commit',
  7: 'reviews',
  8: 'push-reviewed',
  9: 'updates',
});

/** The steps that run whatever failed before them: the proof that his files were left alone matters most then. */
export const ALWAYS = Object.freeze(['real-home-after']);

// ---- what the manifests recorded --------------------------------------------------------------------------------------

/** Every `path` the manifest `manifestText` records, at any depth, as absolute paths from `base` (a relative path is
 * a project's, taken from its top), sorted and once each; on Windows two paths that differ only in case are one. A
 * manifest that is missing or no JSON records nothing. */
export function recordedPaths(manifestText, base, platform = process.platform) {
  let manifest;
  try {
    manifest = JSON.parse(manifestText ?? '');
  } catch {
    return [];
  }
  const p = pathFor(platform);
  const found = new Map();
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (value === null || typeof value !== 'object') return;
    for (const [key, inner] of Object.entries(value)) {
      if (key === 'path' && typeof inner === 'string' && inner !== '') {
        const absolute = p.resolve(base, inner);
        const key2 = keyOf(absolute, platform);
        if (!found.has(key2)) found.set(key2, absolute);
      } else visit(inner);
    }
  };
  visit(manifest);
  return [...found.values()].sort();
}

const keyOf = (file, platform) => (platform === 'win32' ? file.toLowerCase() : file);

/** What is wrong with `paths` after the uninstalls, one line each, or none: `before` and `after` are snapshots of
 * the scratch folder, `{ [absolutePath]: hash }` with no key for a file that is not there. A path passes when it is
 * gone and was not there before, or holds the bytes it held before the walk. */
export function restoreProblems(before, after, paths, platform = process.platform) {
  const fold = (snapshot) => new Map(Object.entries(snapshot).map(([file, hash]) => [keyOf(file, platform), hash]));
  const was = fold(before);
  const is = fold(after);
  const problems = [];
  for (const file of paths) {
    const key = keyOf(file, platform);
    const then = was.get(key) ?? null;
    const now = is.get(key) ?? null;
    if (then === now) continue;
    if (then === null) problems.push(`left: ${file} was written by the walk and is still there`);
    else if (now === null) problems.push(`removed: ${file} was there before the walk and is gone`);
    else problems.push(`changed: ${file} was there before the walk and its bytes differ`);
  }
  return problems;
}

// ---- what takes part --------------------------------------------------------------------------------------------------

/** The tools F8 removes at S2, which no step of the walk may need. */
export const FOREIGN_TOOLS = Object.freeze(['gentle-ai', 'orca', 'herdr']);

const programName = (file) => file.split(/[\\/]/).pop().replace(/\.(exe|cmd|bat|ps1|sh)$/i, '').toLowerCase();

/** What of `FOREIGN_TOOLS` took part, one line each: a word of a command the walk ran (`commands`, each its words)
 * that names one as a program, or a file of the walk's PATH folders (`pathFiles`, their names) that is one. */
export function foreignProblems({ commands = [], pathFiles = [] }) {
  const problems = [];
  for (const words of commands) {
    const tool = FOREIGN_TOOLS.find((name) => words.some((word) => programName(String(word)) === name));
    if (tool) problems.push(`the walk ran ${tool}: ${words.join(' ')}`);
  }
  for (const file of pathFiles) {
    const tool = FOREIGN_TOOLS.find((name) => programName(file) === name);
    if (tool) problems.push(`the walk's PATH holds ${tool}: ${file}`);
  }
  return problems;
}

// ---- engram's recovery ------------------------------------------------------------------------------------------------

/** The most a session start or a compaction may bring back (reverse-engineering document, 13.3 row 11). */
export const ENGRAM_CONTEXT_LIMIT = 16384;

/** What is wrong with what engram's hook printed (`output`) for the planted observation `marker`, or `null`. */
export function engramRecoveryProblem(output, marker, limit = ENGRAM_CONTEXT_LIMIT) {
  const text = output ?? '';
  if (text.trim() === '') return 'engram\'s hook printed nothing';
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > limit) return `engram's hook printed ${bytes} bytes, past the ${limit} it may bring back`;
  if (!text.includes(marker)) return `engram's hook does not hold the planted observation ${marker}`;
  return null;
}

// ---- the planted directive --------------------------------------------------------------------------------------------

/** The rule the walk and the rehearsal test plant: a project rule in prose with no control. */
export const PLANTED_RULE = Object.freeze({
  id: 'no-hand-deploy',
  subject: 'how the scratch project is deployed',
  since: '2026-10-29',
  phrase: 'Never deploy the scratch project by hand',
});

/** The two files that plant `PLANTED_RULE` in a project, by path from its top: the phrase in a file of the project's
 * own, so the missing control is the rule's only finding and no file `init` wrote is edited (`uninstall project`
 * would keep an edited one), and the rule in `docs/rules.json`. */
export function plantedRuleFiles() {
  const { id, subject, since, phrase } = PLANTED_RULE;
  return {
    'docs/conventions.md': `# Conventions\n\n- ${phrase}.\n`,
    'docs/rules.json': `${JSON.stringify({ format: 1, rules: [{ id, subject, since, path: 'docs/conventions.md', phrases: [phrase] }] }, null, 2)}\n`,
  };
}

/** What is wrong with `rules check` on the planted rule (`{ code, stdout }`), or `null`: it must exit 1 and name the
 * planted rule's missing control. */
export function directiveProblem({ code, stdout }) {
  if (code !== 1) return `rules check exited ${code}, not 1, on the planted directive`;
  if (!(stdout ?? '').includes(`rule "${PLANTED_RULE.id}": no control`)) return `rules check exited 1 but does not name the missing control of ${PLANTED_RULE.id}`;
  return null;
}

// ---- the import row ---------------------------------------------------------------------------------------------------

/** The project cell of doctor's claude-import row in `doctorJson`, what `doctor --json` printed, or `absent` when the
 * row is not there or the text is no report. */
export function importRowState(doctorJson) {
  try {
    return JSON.parse(doctorJson).find((row) => row.id === 'claude-import')?.project ?? 'absent';
  } catch {
    return 'absent';
  }
}

// ---- cost -------------------------------------------------------------------------------------------------------------

/** The multiple of its estimate at which a paid run stops (his words of 2026-10-29T10:40Z, as JH 90's brief quotes). */
export const COST_STOP = 1.5;

/** What is wrong with a paid run's cost, or `null`: past `COST_STOP` times its estimate it stops. */
export function costProblem({ estimate, actual }) {
  if (actual <= estimate * COST_STOP) return null;
  return `$${actual.toFixed(2)} is ${(actual / estimate).toFixed(2)} times the estimate of $${estimate.toFixed(2)}, past ${COST_STOP}`;
}
