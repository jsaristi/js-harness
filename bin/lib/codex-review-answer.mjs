// The answer of a Codex review, as data: its schema, the reader that finds it in a Codex home, and the
// finding this harness keeps. Nothing here launches anything. Zero deps, plain Node.
//
// Where the answer is. Codex's review rubric replaces the base instructions of the review sub-agent and
// makes it end with ONE message whose text is JSON: the findings, each with a file and a line range, and
// an overall verdict. `codex exec review --json` does not hand that on: it prints the review rendered as
// text, without the confidence and the verdict (odd/tasks/codex-review-lean.md, "What Codex loads, and what
// `exec review` accepts"). The JSON itself is the last message of the model in the rollout file of the
// sub-agent's thread, which exists only for a session that is not `--ephemeral`: the lean session, in a home
// of its own. So the answer as data is a lean-session feature, read before that home is removed.
//
// The shape was read from the one real lean review there was when this was written (codex-cli 0.160.1,
// 2026-10-07), which found nothing: `{"findings": [], "overall_correctness": "patch is correct",
// "overall_explanation": "…"}`, with no `overall_confidence_score`. The shape of a finding is the one the
// rubric asks the model for and was NOT yet seen in a real file.
import fs from 'node:fs';
import path from 'node:path';
import { rolloutPaths } from './codex-usage.mjs';

export const REVIEW_ANSWER_SCHEMA_VERSION = 'js-harness.codex-review-answer/v1';

const CORRECT = 'patch is correct';
const INCORRECT = 'patch is incorrect';

/** The answer the rubric asks the model for, in the shape of a JSON Schema and with the few keywords
 * `validateAnswer` knows: `type` (one name or a list), `required`, `properties`, `items`, `enum`,
 * `minimum`, `maximum` and `minLength`. It is checked by the validator below, not by a library: this
 * package has no dependency.
 *
 * Two fields are optional because the model leaves them out: `overall_confidence_score` was absent from
 * the real answer, and the rubric calls `priority` optional. Either may also be `null`. A field this schema
 * does not name is let through, so that a later CLI adding one does not turn every review into a failure.
 * The 80 characters the rubric asks a title to stay under are a request to the model and are not held
 * here: a longer title is still a finding. */
export const REVIEW_ANSWER_SCHEMA = {
  $id: REVIEW_ANSWER_SCHEMA_VERSION,
  type: 'object',
  required: ['findings', 'overall_correctness', 'overall_explanation'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'body', 'confidence_score', 'code_location'],
        properties: {
          title: { type: 'string', minLength: 1 },
          body: { type: 'string' },
          confidence_score: { type: 'number', minimum: 0, maximum: 1 },
          priority: { type: ['integer', 'null'], minimum: 0, maximum: 3 },
          code_location: {
            type: 'object',
            required: ['absolute_file_path', 'line_range'],
            properties: {
              absolute_file_path: { type: 'string', minLength: 1 },
              line_range: {
                type: 'object',
                required: ['start', 'end'],
                properties: { start: { type: 'integer', minimum: 1 }, end: { type: 'integer', minimum: 1 } },
              },
            },
          },
        },
      },
    },
    overall_correctness: { type: 'string', enum: [CORRECT, INCORRECT] },
    overall_explanation: { type: 'string' },
    overall_confidence_score: { type: ['number', 'null'], minimum: 0, maximum: 1 },
  },
};

// The path an error at the root is reported under; a field below it is named by its own path alone.
const ROOT = 'answer';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// What each `type` of the schema accepts, and how an error names it.
const TYPES = {
  object: { is: isObject, name: 'an object' },
  array: { is: Array.isArray, name: 'an array' },
  string: { is: (value) => typeof value === 'string', name: 'a string' },
  number: { is: Number.isFinite, name: 'a number' },
  integer: { is: Number.isInteger, name: 'an integer' },
  null: { is: (value) => value === null, name: 'null' },
};

/** What `value` is, as an error says it. */
function kindOf(value) {
  if (value === undefined) return 'nothing';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return typeof value === 'object' ? 'an object' : `a ${typeof value}`;
}

/** Adds to `errors` what is wrong with `value` under `schema`, each as `<path>: <what>`, in the order of
 * the schema's properties. A value of the wrong type is one error and is not looked into further. */
function check(value, schema, at, errors) {
  const types = [].concat(schema.type);
  if (!types.some((type) => TYPES[type].is(value))) {
    errors.push(`${at}: expected ${types.map((type) => TYPES[type].name).join(' or ')}, got ${kindOf(value)}`);
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${at}: expected ${schema.enum.map((allowed) => JSON.stringify(allowed)).join(' or ')}, got ${JSON.stringify(value)}`);
  } else if (typeof value === 'string' && value.length < (schema.minLength ?? 0)) {
    errors.push(`${at}: ${value === '' ? 'is empty' : `is shorter than ${schema.minLength} characters`}`);
  } else if (typeof value === 'number') {
    if (value < (schema.minimum ?? -Infinity)) errors.push(`${at}: ${value} is below ${schema.minimum}`);
    else if (value > (schema.maximum ?? Infinity)) errors.push(`${at}: ${value} is above ${schema.maximum}`);
  } else if (Array.isArray(value)) {
    if (schema.items) value.forEach((item, index) => check(item, schema.items, `${at}[${index}]`, errors));
  } else if (isObject(value)) {
    for (const [name, property] of Object.entries(schema.properties ?? {})) {
      const where = at === ROOT ? name : `${at}.${name}`;
      if (Object.hasOwn(value, name)) check(value[name], property, where, errors);
      else if (schema.required?.includes(name)) errors.push(`${where}: is required`);
    }
  }
}

/** Whether `value` is an answer of `REVIEW_ANSWER_SCHEMA`: `{ ok: true, answer }`, the value itself, or
 * `{ ok: false, errors }` with every error as `<path>: <what was wrong>` (`findings[0].priority: 7 is
 * above 3`). One rule is held beside the schema, which cannot say it: a line range does not end before it
 * starts. */
export function validateAnswer(value) {
  const errors = [];
  check(value, REVIEW_ANSWER_SCHEMA, ROOT, errors);
  if (errors.length === 0) {
    value.findings.forEach((finding, index) => {
      const { start, end } = finding.code_location.line_range;
      if (end < start) errors.push(`findings[${index}].code_location.line_range: end ${end} is before start ${start}`);
    });
  }
  return errors.length === 0 ? { ok: true, answer: value } : { ok: false, errors };
}

/** The file of a finding as this harness names it: from the repository's `root`, with forward slashes,
 * when the path Codex gave is under it; else the path as given, since a finding outside the repository
 * is still a finding. On Windows (`platform` is `win32`) neither the drive nor the folders have a case
 * and either slash separates them: git names the root with forward slashes and Codex the file with
 * backslashes. A path the model gave relative, against what it was asked for, is taken as from the root
 * already. The platform's own rules are used whatever host this runs on. */
function repoFile(file, root, platform) {
  const flavour = platform === 'win32' ? path.win32 : path.posix;
  if (!flavour.isAbsolute(file)) return platform === 'win32' ? file.replaceAll('\\', '/') : file;
  if (typeof root !== 'string' || !flavour.isAbsolute(root)) return file;
  const inside = flavour.relative(root, file);
  const outside = inside === '' || inside === '..' || inside.startsWith(`..${flavour.sep}`) || flavour.isAbsolute(inside);
  return outside ? file : inside.split(flavour.sep).join('/');
}

/** A valid answer (see `validateAnswer`) as this harness keeps it:
 *  - `findings`: each `{ file, start, end, severity, title, body, confidence }`, where `file` is from the
 *    repository `root` when it is under it (see `repoFile`), `severity` is `P0` to `P3` from the model's
 *    `priority`, or `null` when it gave none, and `confidence` its `confidence_score`;
 *  - `verdict`: `correct` or `incorrect`; `explanation`; and `confidence`, `null` when the model gave none.
 * `platform` is where Codex ran, which decides how its paths are read. */
export function normalizeAnswer(answer, { root, platform = process.platform } = {}) {
  return {
    findings: answer.findings.map((finding) => ({
      file: repoFile(finding.code_location.absolute_file_path, root, platform),
      start: finding.code_location.line_range.start,
      end: finding.code_location.line_range.end,
      severity: Number.isInteger(finding.priority) ? `P${finding.priority}` : null,
      title: finding.title,
      body: finding.body,
      confidence: finding.confidence_score,
    })),
    verdict: answer.overall_correctness === CORRECT ? 'correct' : 'incorrect',
    explanation: answer.overall_explanation,
    confidence: answer.overall_confidence_score ?? null,
  };
}

/** How many `findings` (as `normalizeAnswer` gives them) there are, and how many of each severity, `none`
 * being the ones with no severity. Every key is always there, so two runs compare field by field. */
export function findingCounts(findings) {
  const bySeverity = { P0: 0, P1: 0, P2: 0, P3: 0, none: 0 };
  for (const { severity } of findings) bySeverity[Object.hasOwn(bySeverity, severity) ? severity : 'none'] += 1;
  return { total: findings.length, bySeverity };
}

/** The lines of one rollout file that are JSON objects, in order. A file that cannot be read holds none,
 * and a line that is not JSON is skipped: a last line cut short by a kill, for one. */
function rolloutLines(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const lines = [];
  for (const line of text.split('\n')) {
    try {
      const parsed = JSON.parse(line);
      if (isObject(parsed)) lines.push(parsed);
    } catch {
      // Not a line of the rollout.
    }
  }
  return lines;
}

/** Whether `lines` are the thread of the review sub-agent: its first line says so in `source`. The parent
 * thread of `exec review` says `"exec"` there, and it ends with a message of the model too, the review
 * rendered as text, which is why the answer is never looked for by position alone. */
const isReviewSession = (lines) => lines[0]?.type === 'session_meta' && lines[0].payload?.source?.subagent === 'review';

const isModelMessage = (line) => line.type === 'response_item' && line.payload?.type === 'message' && line.payload.role === 'assistant';

/** The text of a message: that of its content items, joined. The type of an item is not asked for, only
 * its `text`, so a type this reader has never seen is read too. */
function messageText(message) {
  const { content } = message.payload;
  return Array.isArray(content) ? content.map((item) => (typeof item?.text === 'string' ? item.text : '')).join('') : '';
}

/** `text` as JSON, in `{ value }`, or `null` when it is none. A text that is not JSON as a whole is tried
 * again from its first `{` to its last `}`, which reads an answer inside a code fence or after a sentence.
 * Codex's own reader of this message does the same before it gives up (`parse_review_output_event` in
 * `core/src/tasks/review.rs` at rust-v0.160.0), so what Codex takes as an answer is one here too. */
function jsonOf(text) {
  for (const candidate of [text, text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)]) {
    try {
      return { value: JSON.parse(candidate) };
    } catch {
      // Tried as it is first, then without what surrounds the object.
    }
  }
  return null;
}

/** The answer of the review that ran in the Codex home `home`, read from its rollout files (see
 * `rolloutPaths`): the session whose first line is a `session_meta` with the source `{ "subagent":
 * "review" }`, and in it the LAST message of the model. `home` is a home made for one run, so it holds one
 * such session; should it hold several, the last by file name is read.
 *
 * Returns `{ ok: true, answer }`, the answer as Codex wrote it and valid under `REVIEW_ANSWER_SCHEMA`, or
 * `{ ok: false, reason }` with why there is none:
 *  - `no-review-session`: no rollout file is the review sub-agent's (none at all, for one);
 *  - `no-answer`: that session holds no message of the model, or one with no text;
 *  - `not-json`: its text is not JSON;
 *  - `off-schema`: it is JSON and not an answer; `errors` says where, as `validateAnswer` does.
 * Never throws: a home that is not a path, a file that cannot be read and a line that is not JSON all read
 * as nothing, as in `rolloutReading`. */
export function rolloutAnswer(home) {
  const session = rolloutPaths(home).map(rolloutLines).filter(isReviewSession).at(-1);
  if (session === undefined) return { ok: false, reason: 'no-review-session' };
  const message = session.findLast(isModelMessage);
  const text = message === undefined ? '' : messageText(message).trim();
  if (text === '') return { ok: false, reason: 'no-answer' };
  const parsed = jsonOf(text);
  if (parsed === null) return { ok: false, reason: 'not-json' };
  const checked = validateAnswer(parsed.value);
  return checked.ok ? checked : { ok: false, reason: 'off-schema', errors: checked.errors };
}
