// What was asked of a change, as code's two reviews are given it (odd/tasks/double-review-alignment.md, spec 7):
// `codex-review` and `lens-review` read it the same way, from their `--doc` or `--request`, before anything runs,
// so a flag given wrong is a usage error that names it and no review is started to find that out. The texts
// themselves are `./codex-review-prompt.mjs`'s (`reviewIntent`, `requestIntent`), which reads no file; this module
// is the one read, kept out of both commands.
import fs from 'node:fs';
import path from 'node:path';
import { IntentError, requestIntent, reviewIntent } from './codex-review-prompt.mjs';

/** A `--doc` or a `--request` that holds no intent: its message names the flag and what is wrong. */
export class AskedError extends Error {}

/** What was asked, from a review's `--doc` (a feature document, read from `cwd` when relative) or its `--request`
 * (the request as written), or `null` when neither was given. Throws an `AskedError` when both are given, when the
 * document cannot be read or holds no intent, or when the request is empty. `read` is for the tests. */
export function askedIntent({ doc, request, cwd }, read = fs.readFileSync) {
  if (doc !== undefined && request !== undefined) throw new AskedError('--doc and --request do not go together: a feature document is what large work was asked, and --request what small work was asked');
  if (request !== undefined) {
    try {
      return requestIntent(request);
    } catch (err) {
      if (!(err instanceof IntentError)) throw err;
      throw new AskedError(`--request: ${err.message}`);
    }
  }
  if (doc === undefined) return null;
  try {
    return reviewIntent(read(path.resolve(cwd, doc), 'utf8'));
  } catch (err) {
    throw new AskedError(`--doc ${doc}: ${err instanceof IntentError ? err.message : `cannot read it (${err.code ?? err.message})`}`);
  }
}
