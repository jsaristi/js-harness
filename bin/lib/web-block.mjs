// The web notice of the fallback ladder (odd/tasks/web-fetch-fallback.md): after a WebFetch the site refused as AI
// traffic, the `PostToolUse` hook `resume --pause` tells the session the next rung, so the rule costs nothing on a
// turn without a block. A WebFetch that fails as a tool error ("Claude Code is unable to fetch from <domain>") does
// not reach a `PostToolUse` hook, so it is not covered here (S4).

/** The statuses a site answers AI traffic with: 403 and 402 measured on 2026-10-15; 429 and 503 are the ones a
 * Cloudflare challenge or a rate limit answers. `js-harness fetch` reads r.jina.ai's answer with the same list. */
export const BLOCK_STATUSES = [402, 403, 429, 503];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The notice for one hook input, or `null` when the call was not a WebFetch refused with a block status. The
 * response is the tool's own answer as the hook gets it: `{ code, codeText, url, ... }`. */
export function webBlockNotice(input) {
  if (!isObject(input) || input.tool_name !== 'WebFetch' || !isObject(input.tool_response)) return null;
  const { code, codeText } = input.tool_response;
  if (!Number.isInteger(code) || !BLOCK_STATUSES.includes(code)) return null;
  const asked = isObject(input.tool_input) && typeof input.tool_input.url === 'string' ? input.tool_input.url : input.tool_response.url;
  if (typeof asked !== 'string' || asked === '') return null;
  const status = typeof codeText === 'string' && codeText !== '' ? `${code} ${codeText}` : String(code);
  return (
    `js-harness: WebFetch got HTTP ${status} from ${asked}, the answer a site gives AI traffic. ` +
    `Next rung: js-harness fetch ${asked} reads it through r.jina.ai (a public page only: it sends no cookie and no key); ` +
    'if that says blocked, open it in the built-in browser and read it with get_page_text.'
  );
}
