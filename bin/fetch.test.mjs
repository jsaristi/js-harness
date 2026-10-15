import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchMain, readerVerdict } from './fetch.mjs';

// No test reaches the network: `fetch` is a fake that records what it was asked. The bodies are cut from what
// r.jina.ai answered on 2026-10-15 (odd/tasks/web-fetch-fallback.md, "Measurement").
const PAGE = [
  'Title: Why is conditional processing of a sorted array faster than of an unsorted array?',
  '',
  'URL Source: https://stackoverflow.com/questions/11227809/why',
  '',
  'Markdown Content:',
  'In this C++ code, sorting the data (before the timed region) makes the primary loop ~6x faster.',
].join('\n');
const CHALLENGE = [
  'Title: Just a moment...',
  '',
  'URL Source: https://www.npmjs.com/package/react',
  '',
  'Warning: Target URL returned error 403: Forbidden',
  'Warning: This page maybe not yet fully loaded, consider explicitly specify a timeout.',
  '',
  'Markdown Content:',
  'Enable JavaScript and cookies to continue',
].join('\n');
const CAPTCHA = [
  'Title: g2.com',
  '',
  'URL Source: https://www.g2.com/products/notion/reviews',
  '',
  'Warning: This page maybe requiring CAPTCHA, please make sure you are authorized to access this page.',
  '',
  'Markdown Content:',
  '',
].join('\n');
const DENIED = [
  'Title: Access to this page has been denied',
  '',
  'URL Source: https://www.zillow.com/homedetails/',
  '',
  'Markdown Content:',
  '![Image 1](https://www.zillowstatic.com/s3/pfs/static/z-logo-default.svg)',
].join('\n');
const ABUSE = JSON.stringify({
  data: null,
  code: 403,
  name: 'AbuseAlleviationError',
  status: 40305,
  message: 'Anonymous access to domain www.reddit.com blocked until Thu Oct 15 2026 12:17:13 GMT+0000 (Coordinated Universal Time) due to previous abuse',
});
// Quora's page carries a banner that reads like a block above the answers it does show: it is a page.
const BANNER = [
  'Title: What is JavaScript?',
  '',
  'URL Source: https://www.quora.com/What-is-JavaScript',
  '',
  'Markdown Content:',
  'Something went wrong. Wait a moment and try again.',
  'Verify your identity to continue',
  'JavaScript is a programming language that lets a page respond to what its reader does without asking the server again.',
].join('\n');
const NOT_FOUND = [
  'Title: Page not found',
  '',
  'URL Source: https://example.com/gone',
  '',
  'Warning: Target URL returned error 404: Not Found',
  '',
  'Markdown Content:',
  'The page you asked for is not here. Try the search box above to find what you were looking for.',
].join('\n');

/** A fetch that answers `status` and `body` once per call and records each call's URL and options. */
function fakeFetch(status, body) {
  const calls = [];
  const fn = async (url, options = {}) => {
    calls.push({ url, options });
    return { status, ok: status >= 200 && status < 300, text: async () => body };
  };
  return { fn, calls };
}

async function run(argv, fetch) {
  const out = [];
  const err = [];
  const code = await fetchMain(argv, { stdout: (text) => out.push(text), stderr: (text) => err.push(text), fetch });
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}

const NEXT = (url) => `Next rung: open ${url} in the built-in browser and read it with get_page_text; if the text comes back empty, wait a few seconds and read it again.`;

test('a page r.jina.ai reads is printed whole and exits 0; the request carries no cookie and no credential', async () => {
  const fake = fakeFetch(200, PAGE);
  const url = 'https://stackoverflow.com/questions/11227809/why?tab=votes';
  const result = await run([url], fake.fn);
  assert.deepEqual([result.code, result.stdout, result.stderr], [0, PAGE, '']);
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].url, `https://r.jina.ai/${url}`);
  const headers = Object.keys(fake.calls[0].options.headers ?? {}).map((name) => name.toLowerCase());
  assert.deepEqual(headers.filter((name) => ['cookie', 'authorization', 'x-api-key'].includes(name)), []);
  assert.equal(fake.calls[0].options.credentials ?? 'omit', 'omit');
});

test('a challenge page answered with HTTP 200 is a block: exit 3, the reason and the next rung on stderr, nothing on stdout', async () => {
  const url = 'https://www.npmjs.com/package/react';
  const result = await run([url], fakeFetch(200, CHALLENGE).fn);
  assert.equal(result.code, 3);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, `js-harness fetch: blocked at r.jina.ai: the site answered it HTTP 403.\n${NEXT(url)}`);
});

test('the marks of a block are each read: a CAPTCHA warning, a denied title, an empty page, an answer of r.jina.ai that is not 2xx', () => {
  assert.deepEqual(readerVerdict(200, CHALLENGE), { read: false, reason: 'the site answered it HTTP 403' });
  assert.deepEqual(readerVerdict(200, CAPTCHA), { read: false, reason: 'the site asks for a CAPTCHA' });
  assert.deepEqual(readerVerdict(200, DENIED), { read: false, reason: 'the site sent a challenge page ("Access to this page has been denied")' });
  assert.deepEqual(readerVerdict(200, 'Title: x\n\nMarkdown Content:\n\n'), { read: false, reason: 'the page came back empty' });
  assert.deepEqual(readerVerdict(200, ''), { read: false, reason: 'the page came back empty' });
  assert.deepEqual(readerVerdict(403, ABUSE), { read: false, reason: 'r.jina.ai answered HTTP 403: Anonymous access to domain www.reddit.com blocked until Thu Oct 15 2026 12:17:13 GMT+0000 (Coordinated Universal Time) due to previous abuse' });
  assert.deepEqual(readerVerdict(429, 'Too Many Requests'), { read: false, reason: 'r.jina.ai answered HTTP 429: Too Many Requests' });
});

test('a page that only looks like a block, and a page the site says is not there, are pages: exit 0 and printed', async () => {
  assert.deepEqual(readerVerdict(200, BANNER), { read: true });
  assert.deepEqual(readerVerdict(200, NOT_FOUND), { read: true });
  const result = await run(['https://www.quora.com/What-is-JavaScript'], fakeFetch(200, BANNER).fn);
  assert.deepEqual([result.code, result.stdout], [0, BANNER]);
});

test('r.jina.ai answering an error, or not reached at all, is a block at this rung: exit 3 with the next rung', async () => {
  const url = 'https://www.reddit.com/r/ClaudeAI/';
  const refused = await run([url], fakeFetch(403, ABUSE).fn);
  assert.equal(refused.code, 3);
  assert.match(refused.stderr, /^js-harness fetch: blocked at r\.jina\.ai: r\.jina\.ai answered HTTP 403: Anonymous access to domain www\.reddit\.com blocked/);
  assert.ok(refused.stderr.endsWith(NEXT(url)));
  const unreachable = await run([url], async () => {
    throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
  });
  assert.deepEqual([unreachable.code, unreachable.stdout], [3, '']);
  assert.equal(unreachable.stderr, `js-harness fetch: blocked at r.jina.ai: r.jina.ai could not be reached (The operation was aborted due to timeout).\n${NEXT(url)}`);
});

test('what is not a public page is refused with exit 1 and nothing is sent', async () => {
  const cases = [
    ['http://localhost:3000/', 'its host is not public'],
    ['http://intranet/wiki', 'its host is not public'],
    ['http://127.0.0.1/', 'its host is not public'],
    ['http://10.1.2.3/', 'its host is not public'],
    ['http://172.20.0.1/', 'its host is not public'],
    ['http://192.168.1.10/', 'its host is not public'],
    ['http://169.254.169.254/latest/meta-data/', 'its host is not public'],
    ['http://[::1]/', 'its host is not public'],
    ['http://app.localhost/', 'its host is not public'],
    ['ftp://example.com/file', 'only http and https pages are read'],
    ['https://user:secret@example.com/', 'it carries a user or a password'],
    ['https://example.com/a?api_key=abc', 'its query carries a parameter named like a secret (api_key)'],
    ['https://example.com/a?access_token=abc', 'its query carries a parameter named like a secret (access_token)'],
    ['https://example.com/a?X-Amz-Signature=abc', 'its query carries a parameter named like a secret (X-Amz-Signature)'],
    ['not a url', 'it is not a URL'],
  ];
  for (const [url, why] of cases) {
    const fake = fakeFetch(200, PAGE);
    const result = await run([url], fake.fn);
    assert.deepEqual([result.code, result.stdout, fake.calls.length], [1, '', 0], url);
    assert.equal(result.stderr, `js-harness fetch: ${url} is not read: ${why}. r.jina.ai is a third party, so only a public page goes to it.`, url);
  }
});

test('a public page with an ordinary query is sent', async () => {
  const fake = fakeFetch(200, PAGE);
  assert.equal((await run(['https://example.com/search?q=keyboard&page=2'], fake.fn)).code, 0);
  assert.equal(fake.calls.length, 1);
});

test('no URL, two of them or an unknown flag is a usage error: exit 2 and nothing is sent; --help prints the usage and exits 0', async () => {
  for (const argv of [[], ['https://a.example.com/', 'https://b.example.com/'], ['--raw', 'https://a.example.com/']]) {
    const fake = fakeFetch(200, PAGE);
    const result = await run(argv, fake.fn);
    assert.deepEqual([result.code, fake.calls.length], [2, 0], JSON.stringify(argv));
    assert.match(result.stderr, /Usage: js-harness fetch <url>/);
  }
  const help = await run(['--help'], fakeFetch(200, PAGE).fn);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /^Usage: js-harness fetch <url>/);
});
