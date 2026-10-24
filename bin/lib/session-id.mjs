// The shape of a session id, as one helper every reader of one calls: `inbox.mjs`, `pause.mjs` and `rules-reach.mjs`
// here, and `rules-change-run.mjs` of this folder. A session id becomes a file name (its transcript, its pause state,
// its inbox), so the shape refuses a folder separator and a dot, which can name a folder, and a leading dash, which
// reads as an option. It is pure: it reads nothing and asks nothing of the machine, so a hook that calls it keeps its
// deadline.
//
// The rule was one copy per reader for a while, and the copies differed: `rules-change-run.mjs` accepted ids of one to
// seven characters and ids that start with a dash. Its tests name only UUIDs (36 characters, hex and dashes), which
// this shape accepts, and every source the rules file stores holds one, so no reader needs the looser form.

/** The shape of a session id: a letter or a digit, then at least seven letters, digits, underscores or dashes. */
export const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{7,}$/;

/** True when `value` is a session id of that shape; false for any other value, a string or not. */
export function isSessionId(value) {
  return typeof value === 'string' && SESSION_ID.test(value);
}
