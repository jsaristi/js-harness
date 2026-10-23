import assert from 'node:assert/strict';
import test from 'node:test';
import { BLOCK_STATUSES, webBlockNotice } from './web-block.mjs';

const URL_ASKED = 'https://site.example/page';

/** The rung the notice names for `url`, as the module words it, with the URL it quotes as `shown` (the same text after a
 * block and after a failure). */
const rungFor = (url, shown = url) =>
  `Next rung: js-harness fetch '${shown}' reads it through r.jina.ai (a public page only: it sends no cookie and no key); ` +
  'if that says blocked, open it in the built-in browser and read it with get_page_text.';

/** The input of a `PostToolUse` hook for a WebFetch that got `code` back from the site. */
const refused = (code, codeText, url = URL_ASKED) => ({
  hook_event_name: 'PostToolUse',
  tool_name: 'WebFetch',
  tool_input: { url },
  tool_response: { code, codeText, url },
});

/** The input of a `PostToolUseFailure` hook for a WebFetch that failed with `error`. */
const failed = (error, extra = {}) => ({
  hook_event_name: 'PostToolUseFailure',
  tool_name: 'WebFetch',
  tool_input: { url: URL_ASKED },
  error,
  ...extra,
});

test('the statuses a site answers AI traffic with are 402, 403, 429 and 503', () => {
  assert.deepEqual(BLOCK_STATUSES, [402, 403, 429, 503]);
});

test('a WebFetch refused with a block status gets the notice with its status, the asked URL and the next rung', () => {
  assert.equal(
    webBlockNotice(refused(403, 'Forbidden')),
    `js-harness: WebFetch got HTTP 403 Forbidden from ${URL_ASKED}, the answer a site gives AI traffic. ${rungFor(URL_ASKED)}`,
  );
});

test('every block status gets the notice, and a status without its text is named by its number alone', () => {
  for (const code of BLOCK_STATUSES) assert.match(webBlockNotice(refused(code, 'Blocked')) ?? '', new RegExp(`HTTP ${code} Blocked from`));
  assert.match(webBlockNotice(refused(429, '')) ?? '', /got HTTP 429 from /);
});

test('a status that is no block, a WebFetch of another tool, and a hook that is not an object get no notice', () => {
  assert.equal(webBlockNotice(refused(200, 'OK')), null);
  assert.equal(webBlockNotice(refused(404, 'Not Found')), null);
  assert.equal(webBlockNotice({ ...refused(403, 'Forbidden'), tool_name: 'WebSearch' }), null);
  assert.equal(webBlockNotice(null), null);
  assert.equal(webBlockNotice('WebFetch'), null);
});

test('the URL is the one asked, or the response one when the input carries none', () => {
  const input = { hook_event_name: 'PostToolUse', tool_name: 'WebFetch', tool_input: {}, tool_response: { code: 402, codeText: 'Payment Required', url: 'https://other.example/x' } };
  assert.match(webBlockNotice(input) ?? '', /from https:\/\/other\.example\/x, /);
  assert.equal(webBlockNotice({ ...input, tool_response: { code: 402, codeText: 'x' } }), null, 'no URL at all: no notice');
});

test('a URL with a quote is quoted for the shell with the quote percent-encoded, so the command is the same URL', () => {
  const url = "https://site.example/it's?q=1&r=2";
  assert.equal(
    webBlockNotice(refused(503, 'Service Unavailable', url)),
    `js-harness: WebFetch got HTTP 503 Service Unavailable from ${url}, the answer a site gives AI traffic. ${rungFor(url, 'https://site.example/it%27s?q=1&r=2')}`,
  );
});

test('a WebFetch that failed as a tool error gets the notice with the first line of its error, and the next rung', () => {
  assert.equal(
    webBlockNotice(failed('Claude Code is unable to fetch from site.example\n    at fetch (stack)')),
    `js-harness: WebFetch failed on ${URL_ASKED} (Claude Code is unable to fetch from site.example). ${rungFor(URL_ASKED)}`,
  );
});

test('a first line of an error longer than 200 characters is cut to 199 and an ellipsis, counting an emoji as one character', () => {
  // Each emoji is two UTF-16 units: a cut by units would split the 100th one.
  const cut = `${'😀'.repeat(199)}…`;
  assert.equal(webBlockNotice(failed(`${'😀'.repeat(199)} tail`)), `js-harness: WebFetch failed on ${URL_ASKED} (${cut}). ${rungFor(URL_ASKED)}`);
  // Exactly 200 characters are not cut.
  assert.match(webBlockNotice(failed('a'.repeat(200))) ?? '', new RegExp(`\\(${'a'.repeat(200)}\\)\\. `));
});

test('a failure the user interrupted, with no error, with no URL or with an empty first line gets no notice', () => {
  assert.equal(webBlockNotice(failed('Interrupted', { is_interrupt: true })), null);
  assert.equal(webBlockNotice(failed(undefined)), null);
  assert.equal(webBlockNotice({ ...failed('boom'), tool_input: {} }), null);
  assert.equal(webBlockNotice(failed('\n  \n')), null);
});
