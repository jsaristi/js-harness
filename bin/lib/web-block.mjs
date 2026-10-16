// The web notice of the fallback ladder (odd/tasks/web-fetch-fallback.md): after a WebFetch the site refused as AI
// traffic, the `PostToolUse` hook `resume --pause` tells the session the next rung, so the rule costs nothing on a
// turn without a block. A WebFetch that fails as a tool error ("Claude Code is unable to fetch from <domain>") does
// not reach a `PostToolUse` hook: the `PostToolUseFailure` entry `install` writes on WebFetch runs the same command,
// and its input carries the error (S4, T4).

/** The statuses a site answers AI traffic with: 403 and 402 measured on 2026-10-15; 429 and 503 are the ones a
 * Cloudflare challenge or a rate limit answers. `js-harness fetch` reads r.jina.ai's answer with the same list. */
export const BLOCK_STATUSES = [402, 403, 429, 503];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The longest part of a tool error the failure notice repeats: enough for "Claude Code is unable to fetch from
 * <domain>", short enough that a stack trace never fills the context. */
const ERROR_LENGTH = 200;

/** A URL quoted for a shell, so it keeps its `&` and spaces; a quote inside is percent-encoded, which is the same URL. */
const quoted = (url) => `'${url.replace(/'/g, '%27')}'`;

/** The rungs after WebFetch, the same for a refusal and a failure. */
const nextRung = (url) =>
  `Next rung: js-harness fetch ${quoted(url)} reads it through r.jina.ai (a public page only: it sends no cookie and no key); ` +
  'if that says blocked, open it in the built-in browser and read it with get_page_text.';

/** The notice for a WebFetch that failed as a tool error, from a `PostToolUseFailure` input (`{ tool_input, error,
 * is_interrupt }`, Claude Code's hooks reference, read on 2026-10-16), or `null`: a call the user interrupted, one
 * with no URL or no error. Any failure of the tool gets it, since the measured ones (S4) came as tool errors. */
function webFailureNotice(input) {
  if (input.is_interrupt === true || typeof input.error !== 'string') return null;
  const url = isObject(input.tool_input) ? input.tool_input.url : undefined;
  const [first] = input.error.trim().split(/\r?\n/);
  if (typeof url !== 'string' || url === '' || first === '') return null;
  // Counted in characters, so the cut never leaves half of one (an emoji is two UTF-16 units).
  const characters = Array.from(first);
  const error = characters.length > ERROR_LENGTH ? `${characters.slice(0, ERROR_LENGTH - 1).join('')}…` : first;
  return `js-harness: WebFetch failed on ${url} (${error}). ${nextRung(url)}`;
}

/** The notice for one hook input, or `null` when the call was not a WebFetch refused with a block status or failed
 * as a tool error. The response is the tool's own answer as the hook gets it: `{ code, codeText, url, ... }`. */
export function webBlockNotice(input) {
  if (!isObject(input) || input.tool_name !== 'WebFetch') return null;
  if (input.hook_event_name === 'PostToolUseFailure') return webFailureNotice(input);
  if (!isObject(input.tool_response)) return null;
  const { code, codeText } = input.tool_response;
  if (!Number.isInteger(code) || !BLOCK_STATUSES.includes(code)) return null;
  const asked = isObject(input.tool_input) && typeof input.tool_input.url === 'string' ? input.tool_input.url : input.tool_response.url;
  if (typeof asked !== 'string' || asked === '') return null;
  const status = typeof codeText === 'string' && codeText !== '' ? `${code} ${codeText}` : String(code);
  return `js-harness: WebFetch got HTTP ${status} from ${asked}, the answer a site gives AI traffic. ${nextRung(asked)}`;
}
