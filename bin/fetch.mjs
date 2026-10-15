#!/usr/bin/env node
// `fetch`: the second rung of the ladder for a page that refuses WebFetch as AI traffic
// (odd/tasks/web-fetch-fallback.md). It asks r.jina.ai for the page and reads the answer for a block, because
// r.jina.ai answers HTTP 200 with the site's challenge page inside: three of the four blocks measured there did.
// Exit 0: the page, printed whole. Exit 3: blocked at this rung, with the reason and the next rung (the built-in
// browser). Exit 1: not a public page, and nothing sent. Exit 2: a usage error. Zero dependencies: Node's fetch.
import { BLOCK_STATUSES } from './lib/web-block.mjs';

const USAGE = [
  'Usage: js-harness fetch <url>',
  '  Reads a public page through r.jina.ai, the rung after a WebFetch the site refused as AI traffic. It prints the',
  '    page and exits 0 when it read one. It exits 3 when this rung is blocked too (a challenge page, a CAPTCHA, an',
  '    empty page, an error of r.jina.ai, or no answer within 60 s), with the reason and the next rung on stderr: the',
  "    built-in browser's get_page_text.",
  '  It sends no cookie and no key. The URL goes to a third party, so a host that is not public (no dot, loopback, a',
  '    private address), a URL with a user or a password, or one whose query names a secret is refused with exit 1',
  '    and nothing is sent. Exit 2: a usage error.',
].join('\n');

const READER = 'https://r.jina.ai/';
const TIMEOUT_MS = 60_000;

const CHALLENGE_TITLE = /^Title: (Just a moment\.\.\.|Attention Required! \| Cloudflare|Access to this page has been denied|Access Denied)\s*$/m;
const SECRET_NAME = /^(?:.*[-_])?(?:token|key|apikey|secret|password|passwd|pwd|sig|signature|auth|session|sessionid|credential|credentials)$/i;
const PRIVATE_SUFFIX = /\.(?:localhost|local|internal|test|lan|home\.arpa)$/i;

/** Why `text` is not a public page to hand a third party, or `null` when it is one. */
export function notPublic(text) {
  let url;
  try {
    url = new URL(text);
  } catch {
    return 'it is not a URL';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'only http and https pages are read';
  if (url.username !== '' || url.password !== '') return 'it carries a user or a password';
  if (!publicHost(url.hostname)) return 'its host is not public';
  for (const name of url.searchParams.keys()) {
    // `accessToken` is `access_token` in camelCase: a boundary of case counts as a separator.
    if (SECRET_NAME.test(name.replace(/([a-z0-9])([A-Z])/g, '$1_$2'))) return `its query carries a parameter named like a secret (${name})`;
  }
  return null;
}

function publicHost(host) {
  // `localhost.` and `service.internal.` are the absolute DNS spellings of the same hosts: the final dot goes.
  const name = host.toLowerCase().replace(/\.$/, '');
  if (name.startsWith('[')) {
    const ip = name.slice(1, -1);
    return !(ip === '::' || ip === '::1' || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || ip.startsWith('::ffff:'));
  }
  if (!name.includes('.') || name === 'localhost' || PRIVATE_SUFFIX.test(name)) return false;
  const v4 = name.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4 === null) return true;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  return true;
}

/** What r.jina.ai's answer is: `{ read: true }` for a page, `{ read: false, reason }` for a block. */
export function readerVerdict(status, body) {
  if (status < 200 || status > 299) {
    const said = messageOf(body);
    return { read: false, reason: `r.jina.ai answered HTTP ${status}${said === '' ? '' : `: ${said}`}` };
  }
  const target = body.match(/^Warning: Target URL returned error (\d{3})/m);
  if (target !== null && BLOCK_STATUSES.includes(Number(target[1]))) return { read: false, reason: `the site answered it HTTP ${target[1]}` };
  if (/^Warning: This page maybe requiring CAPTCHA/m.test(body)) return { read: false, reason: 'the site asks for a CAPTCHA' };
  const title = body.match(CHALLENGE_TITLE);
  if (title !== null) return { read: false, reason: `the site sent a challenge page ("${title[1]}")` };
  const marker = body.indexOf('Markdown Content:');
  const content = marker === -1 ? body : body.slice(marker + 'Markdown Content:'.length);
  if (content.trim() === '') return { read: false, reason: 'the page came back empty' };
  return { read: true };
}

/** The message of an error answer: the `message` of its JSON when it has one, else its first line, cut short. */
function messageOf(body) {
  let said = '';
  try {
    const parsed = JSON.parse(body);
    if (parsed !== null && typeof parsed.message === 'string') said = parsed.message;
  } catch {
    said = body.split(/\r?\n/).find((line) => line.trim() !== '') ?? '';
  }
  said = said.trim();
  return said.length > 300 ? `${said.slice(0, 300)}…` : said;
}

const nextRung = (url) =>
  `Next rung: open ${url} in the built-in browser and read it with get_page_text; if the text comes back empty, wait a few seconds and read it again.`;

export async function fetchMain(argv, { stdout = (text) => process.stdout.write(`${text}\n`), stderr = console.error, fetch = globalThis.fetch } = {}) {
  if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
    stdout(USAGE);
    return 0;
  }
  if (argv.length !== 1 || argv[0].startsWith('-')) {
    if (argv.length > 0 && argv.some((token) => token.startsWith('-'))) stderr(`unknown argument: ${argv.find((token) => token.startsWith('-'))}`);
    stderr(USAGE);
    return 2;
  }
  const url = argv[0];
  const why = notPublic(url);
  if (why !== null) {
    stderr(`js-harness fetch: ${url} is not read: ${why}. r.jina.ai is a third party, so only a public page goes to it.`);
    return 1;
  }
  let verdict;
  let body = '';
  try {
    const response = await fetch(`${READER}${url}`, { credentials: 'omit', redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
    body = await response.text();
    verdict = readerVerdict(response.status, body);
  } catch (error) {
    verdict = { read: false, reason: `r.jina.ai could not be reached (${error?.message ?? String(error)})` };
  }
  if (verdict.read) {
    stdout(body);
    return 0;
  }
  stderr(`js-harness fetch: blocked at r.jina.ai: ${verdict.reason}.\n${nextRung(url)}`);
  return 3;
}
