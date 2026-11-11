import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fetchMain, notPublic, readerVerdict } from './fetch.mjs';

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
    ['http://localhost./', 'its host is not public'],
    ['http://service.internal./', 'its host is not public'],
    ['http://intranet./wiki', 'its host is not public'],
    ['ftp://example.com/file', 'only http and https pages are read'],
    ['https://user:secret@example.com/', 'it carries a user or a password'],
    ['https://example.com/a?api_key=abc', 'its query carries a parameter named like a secret (api_key)'],
    ['https://example.com/a?access_token=abc', 'its query carries a parameter named like a secret (access_token)'],
    ['https://example.com/a?X-Amz-Signature=abc', 'its query carries a parameter named like a secret (X-Amz-Signature)'],
    ['https://example.com/a?accessToken=abc', 'its query carries a parameter named like a secret (accessToken)'],
    ['https://example.com/a?sessionToken=abc', 'its query carries a parameter named like a secret (sessionToken)'],
    ['https://example.com/a?clientSecret=abc', 'its query carries a parameter named like a secret (clientSecret)'],
    ['not a url', 'it is not a URL'],
  ];
  for (const [url, why] of cases) {
    const fake = fakeFetch(200, PAGE);
    const result = await run([url], fake.fn);
    assert.deepEqual([result.code, result.stdout, fake.calls.length], [1, '', 0], url);
    assert.equal(result.stderr, `js-harness fetch: ${url} is not read: ${why}. r.jina.ai is a third party, so only a public page goes to it.`, url);
  }
});

// No key is written here: each is made from a hash of a label, so the file holds nothing a scanner or a reader
// could take for a real one, and no vendor's format is copied.
const digest = (label, encoding) => crypto.createHash('sha256').update(label).digest(encoding);
const HEX_KEY = digest('fetch test, hex', 'hex');
const URL_KEY = digest('fetch test, base64url', 'base64url');
const ID_KEY = digest('fetch test, an id of 22', 'base64url').replace(/[-_]/g, '').slice(0, 22);
const UUID_KEY = `${HEX_KEY.slice(0, 8)}-${HEX_KEY.slice(8, 12)}-4${HEX_KEY.slice(13, 16)}-a${HEX_KEY.slice(17, 20)}-${HEX_KEY.slice(20, 32)}`;
const DOTTED_KEY = [digest('fetch test, part 1', 'base64url').slice(0, 30), digest('fetch test, part 2', 'base64url'), digest('fetch test, part 3', 'base64url')].join('.');

test('a URL whose path holds a segment that reads as a key is refused with exit 1 and nothing is sent; the reason names the segment by its place, not its text', async () => {
  const cases = [
    [`https://hooks.example.com/services/${URL_KEY}`, 2],
    [`https://example.com/reset/${HEX_KEY}/confirm`, 2],
    [`https://example.com/share/${ID_KEY}`, 2],
    [`https://example.com/v1/files/${UUID_KEY}/download`, 3],
    [`https://example.com/auth/${DOTTED_KEY}`, 2],
    // A key beside a name in one segment, as a session id written into the path is.
    [`https://example.com/app;jsessionid=${HEX_KEY.slice(0, 32)}/home`, 1],
    // Percent-encoding hides no key: the segment is read as the site will read it.
    [`https://example.com/share/%${HEX_KEY.charCodeAt(0).toString(16)}${HEX_KEY.slice(1)}`, 2],
    // Nor does one escape that encodes nothing, or a byte that is no text, beside a key written in escapes.
    [`https://example.com/share/%zz${[...HEX_KEY.slice(0, 32)].map((char) => `%${char.charCodeAt(0).toString(16)}`).join('')}`, 2],
    [`https://example.com/share/%FF${[...HEX_KEY.slice(0, 32)].map((char) => `%${char.charCodeAt(0).toString(16)}`).join('')}`, 2],
    [`https://example.com/share/${[...URL_KEY].map((char) => `%${char.charCodeAt(0).toString(16)}`).join('')}`, 2],
    [`https://example.com/a/b/c/d/${URL_KEY}?page=2`, 5],
    // The limit is 20 and no more: 19 such characters are sent, in the test of the limit below.
    [`https://example.com/share/${HEX_KEY.slice(0, 20)}`, 2],
    // Capital letters mix with digits as small ones do.
    [`https://example.com/share/${HEX_KEY.slice(0, 32).toUpperCase()}`, 2],
    // The path judged is the one the URL parser makes, which is the one sent: a backslash is a slash there.
    [`https://example.com\\share\\${HEX_KEY}`, 2],
    // The price of reading a shape, pinned: a public slug whose letter-and-digit words add up to 20 is refused too.
    ['https://medium.com/@someone/gpt4-vs-llama3-in-practice-1a2b3c4d5e6f', 2],
    ['https://github.com/nodejs/node/commit/4f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c', 4],
  ];
  for (const [url, place] of cases) {
    const fake = fakeFetch(200, PAGE);
    const result = await run([url], fake.fn);
    assert.deepEqual([result.code, result.stdout, fake.calls.length], [1, '', 0], url);
    const said = `js-harness fetch: ${url} is not read: its path carries a segment that reads as a key (segment ${place}). r.jina.ai is a third party, so only a public page goes to it.`;
    assert.equal(result.stderr, said, url);
  }
  assert.equal(notPublic(`https://example.com/reset/${HEX_KEY}`), 'its path carries a segment that reads as a key (segment 2)', 'the reason alone holds no part of the key');
});

test('a public page whose path holds a long slug, numbers and short ids is sent', async () => {
  const pages = [
    'https://stackoverflow.com/questions/11227809/why-is-processing-a-sorted-array-faster-than-processing-an-unsorted-array',
    'https://medium.com/@karpathy/software-2-0-a64152b37c35',
    'https://medium.com/@someone/python3-asyncio-explained-9f8e7d6c5b4a',
    'https://en.wikipedia.org/wiki/%E6%97%A5%E6%9C%AC%E8%AA%9E%E3%81%AE%E6%96%87%E6%B3%95',
    'https://es.wikipedia.org/wiki/Programaci%C3%B3n_orientada_a_objetos',
    'https://www.amazon.com/Apple-iPhone-15-Pro-Max-256GB-Natural-Titanium/dp/B0CMZ4S8FG/ref=sr_1_3',
    'https://www.bhphotovideo.com/c/product/1784093-REG/apple_mu773ll_a_iphone_15_pro_256gb.html',
    'https://www.zillow.com/homedetails/123-Main-St-Springfield-IL-62701/12345678_zpid/',
    'https://www.nature.com/articles/s41586-024-07487-w',
    'https://doi.org/10.1145/3292500.3330701',
    'https://arxiv.org/abs/2410.12345v2',
    'https://developer.mozilla.org/en-US/docs/Web/API/Document/getElementById',
    'https://github.com/nodejs/node/commit/4f1a2b3',
    'https://www.bbc.com/news/articles/c4g9kz0d2xro',
    'https://x.com/someone/status/1845678901234567890',
    // A percent sign that encodes nothing is read as it is written, and refuses nothing.
    'https://example.com/sales/100%-off',
    // An escaped letter of another alphabet cuts the segment where it stands; it does not join its neighbours.
    'https://example.com/wiki/abcdefghij%C3%A91234567890x',
  ];
  for (const url of pages) {
    const fake = fakeFetch(200, PAGE);
    assert.deepEqual([(await run([url], fake.fn)).code, fake.calls.length], [0, 1], url);
  }
});

test('the limit the help states holds: a key of letters alone, of digits alone, under 20 characters, cut into pieces that do not mix, or spread over segments or parameters is not seen, and is sent', async () => {
  const letters = HEX_KEY.replace(/[0-9]/g, '').padEnd(32, 'q').slice(0, 32);
  const digits = HEX_KEY.replace(/[a-f]/g, '').padEnd(18, '7').slice(0, 18);
  const unseen = [
    `https://example.com/share/${letters}`,
    `https://example.com/share/${digits}`,
    `https://example.com/share/${ID_KEY.slice(0, 19)}`,
    // 22 characters of the base64url alphabet, as a key is, with no piece that mixes letters and digits.
    `https://example.com/share/${letters.slice(0, 10)}-${digits.slice(0, 11)}`,
    // Any character that is no letter or digit cuts as a hyphen does.
    `https://example.com/share/${letters.slice(0, 16)}.${digits.slice(0, 16)}`,
    `https://example.com/share/${HEX_KEY.slice(0, 19)}/${HEX_KEY.slice(19, 38)}`,
    `https://example.com/share/${[...HEX_KEY.slice(0, 32)].map((char) => `%25${char.charCodeAt(0).toString(16)}`).join('')}`,
    `https://example.com/callback?first=${HEX_KEY.slice(0, 19)}&second=${HEX_KEY.slice(19, 38)}`,
  ];
  for (const url of unseen) {
    const fake = fakeFetch(200, PAGE);
    assert.deepEqual([(await run([url], fake.fn)).code, fake.calls.length], [0, 1], url);
  }
  // The help is wrapped by hand, so it is read as one line.
  const help = (await run(['--help'], fakeFetch(200, PAGE).fn)).stdout.replace(/\s+/g, ' ');
  for (const said of [
    'one that holds a path segment, a query name or a query value that reads as a key (its pieces that mix letters and digits add up to 20 characters or more) is refused with exit 1',
    "These go out with the URL: a key of letters alone or of digits alone; one shorter than 20 characters; one that other characters (a hyphen, an underscore, a dot, an escape) cut into pieces too few of which mix letters and digits (about one random 22-character base64url key in four); one spread over several segments or parameters; one escaped twice; one in the host's name.",
    'these public pages are refused as well: one whose path holds an id of that shape (a commit hash, a UUID), a slug or a search whose words that mix letters and digits (gpt4, llama3, a 12-character id) add up to 20 characters, and one whose query carries an id of that shape (a playlist, a click id such as fbclid). The refusal names the parameter: without a click id the page is the same page. Read the others in the built-in browser',
  ]) assert.ok(help.includes(said), said);
});

test('a URL whose query holds a value or a name that reads as a key is refused with exit 1 and nothing is sent; a value is named by its parameter, a name by its place', async () => {
  const escaped = [...HEX_KEY.slice(0, 32)].map((char) => `%${char.charCodeAt(0).toString(16)}`).join('');
  const cases = [
    [`https://example.com/callback?code=${HEX_KEY}&state=ok`, 'its query carries a value that reads as a key (parameter 1, code)'],
    [`https://example.com/open?page=2&doc=${UUID_KEY}`, 'its query carries a value that reads as a key (parameter 2, doc)'],
    [`https://example.com/open?next=${escaped}`, 'its query carries a value that reads as a key (parameter 1, next)'],
    [`https://example.com/open?id=${ID_KEY}#top`, 'its query carries a value that reads as a key (parameter 1, id)'],
    // The place tells a repeated name apart, and stands alone for a name that is empty or no plain word: a decoded
    // name can hold a line break or a control character, and a reason is copied into reports.
    [`https://example.com/open?id=7&id=${UUID_KEY}`, 'its query carries a value that reads as a key (parameter 2, id)'],
    [`https://example.com/open?=${HEX_KEY}`, 'its query carries a value that reads as a key (parameter 1)'],
    [`https://example.com/open?a%0Ab=${HEX_KEY}`, 'its query carries a value that reads as a key (parameter 1)'],
    [`https://example.com/open?a%1B%5B31m=${HEX_KEY}`, 'its query carries a value that reads as a key (parameter 1)'],
    [`https://example.com/open?${'n'.repeat(41)}=${HEX_KEY}`, 'its query carries a value that reads as a key (parameter 1)'],
    // A key in the place of a name is never repeated: it is named by where it stands.
    [`https://example.com/callback?${HEX_KEY}`, 'its query carries a name that reads as a key (parameter 1)'],
    [`https://example.com/callback?page=2&${URL_KEY}=1`, 'its query carries a name that reads as a key (parameter 2)'],
    // The price, pinned: these public pages have the same shape. Without its click id the first is the same page;
    // the playlist and the search are not, and the help sends them to the built-in browser.
    [`https://example.com/article?utm_source=mail&fbclid=${URL_KEY}`, 'its query carries a value that reads as a key (parameter 2, fbclid)'],
    [`https://www.youtube.com/playlist?list=PL${URL_KEY.slice(0, 32)}`, 'its query carries a value that reads as a key (parameter 1, list)'],
    ['https://www.google.com/search?q=h264+vs+h265+vs+av1+vs+vp9+vs+mp4+vs+rtx4090', 'its query carries a value that reads as a key (parameter 1, q)'],
    // A name like a secret is told the same way, and a line break in it hides it no more.
    ['https://example.com/open?a%1B_token=1', 'its query carries a parameter named like a secret (parameter 1)'],
    ['https://example.com/open?page=2&a%0A_token=1', 'its query carries a parameter named like a secret (parameter 2)'],
  ];
  for (const [url, why] of cases) {
    const fake = fakeFetch(200, PAGE);
    const result = await run([url], fake.fn);
    assert.deepEqual([result.code, result.stdout, fake.calls.length], [1, '', 0], url);
    assert.equal(result.stderr, `js-harness fetch: ${url} is not read: ${why}. r.jina.ai is a third party, so only a public page goes to it.`, url);
  }
});

test('a public page whose query holds words, numbers and short ids is sent', async () => {
  const pages = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
    'https://www.google.com/search?q=h264+vs+h265+vs+av1+vs+vp9+2026',
    'https://www.amazon.com/s?k=iphone+15+pro+256gb&crid=2Q8X5N7Z1K3LM&sprefix=iphone+15%2Caps%2C120',
    'https://github.com/search?q=repo%3Anodejs%2Fnode+keyLike&type=code',
    'https://example.com/article?utm_source=newsletter&utm_medium=email&utm_campaign=2026w46',
    'https://en.wikipedia.org/w/index.php?title=Node.js&oldid=1251234567',
    'https://example.com/login?next=%2Fdashboard%2Fsettings',
    `https://example.com/open?id=${ID_KEY.slice(0, 19)}`,
  ];
  for (const url of pages) {
    const fake = fakeFetch(200, PAGE);
    assert.deepEqual([(await run([url], fake.fn)).code, fake.calls.length], [0, 1], url);
  }
});

test('a public page with an ordinary query is sent', async () => {
  const fake = fakeFetch(200, PAGE);
  assert.equal((await run(['https://example.com/search?q=keyboard&page=2&monkey=1&tokenize=yes'], fake.fn)).code, 0);
  assert.equal((await run(['https://www.example.com./docs'], fake.fn)).code, 0);
  assert.equal(fake.calls.length, 2);
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
