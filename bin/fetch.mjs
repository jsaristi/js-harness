#!/usr/bin/env node
// `fetch`: the second rung of the ladder for a page that refuses WebFetch as AI traffic
// (odd/tasks/web-fetch-fallback.md). It asks r.jina.ai for the page and reads the answer for a block, because
// r.jina.ai answers HTTP 200 with the site's challenge page inside: three of the four blocks measured there did.
// Exit 0: the page, printed whole. Exit 3: blocked at this rung, with the reason and the next rung (the built-in
// browser). Exit 1: not a public page, and nothing sent. Exit 2: a usage error. Zero dependencies: Node's fetch.
import { BLOCK_STATUSES } from './lib/web-block.mjs';

/** How many characters the pieces that mix letters and digits may add up to, in one path segment, one query name or
 * one query value, before it reads as a key. Measured in odd/tasks/audit-u10-security-claims.md (the depth pass,
 * item 4): at 20 it refuses the 22-character ids of private pages by link and no other of the 333 URLs this
 * repository cites, none of them by its query; at 16 it also refuses a Medium slug with one word such as `python3`
 * beside its 12-character id; at 24 those ids pass. */
const KEY_LIKE_LENGTH = 20;

const USAGE = [
  'Usage: js-harness fetch <url>',
  '  Reads a public page through r.jina.ai, the rung after a WebFetch the site refused as AI traffic. It prints the',
  '    page and exits 0 when it read one. It exits 3 when this rung is blocked too (a challenge page, a CAPTCHA, an',
  '    empty page, an error of r.jina.ai, or no answer within 60 s), with the reason and the next rung on stderr: the',
  "    built-in browser's get_page_text.",
  '  It sends no cookie and no key of its own. The URL goes to a third party, so a host that is not public (no dot,',
  '    loopback, a private address), a URL with a user or a password, one whose query names a secret, or one that',
  '    holds a path segment, a query name or a query value that reads as a key (its pieces that mix letters and digits',
  `    add up to ${KEY_LIKE_LENGTH} characters or more) is refused with exit 1 and nothing is sent. Exit 2: a usage error.`,
  '  Those checks read names and shapes, and know no secret. These go out with the URL: a key of letters alone or of',
  `    digits alone; one shorter than ${KEY_LIKE_LENGTH} characters; one that other characters (a hyphen, an underscore, a dot, an`,
  '    escape) cut into pieces too few of which mix letters and digits (about one random 22-character base64url key',
  "    in four); one spread over several segments or parameters; one escaped twice; one in the host's name.",
  '  And these public pages are refused as well: one whose path holds an id of that shape (a commit hash, a UUID), a',
  `    slug or a search whose words that mix letters and digits (gpt4, llama3, a 12-character id) add up to ${KEY_LIKE_LENGTH}`,
  '    characters, and one whose query carries an id of that shape (a playlist, a click id such as fbclid). The refusal',
  '    names the parameter: without a click id the page is the same page. Read the others in the built-in browser,',
  '    which sends the URL to no third party.',
].join('\n');

const READER = 'https://r.jina.ai/';
const TIMEOUT_MS = 60_000;

const CHALLENGE_TITLE = /^Title: (Just a moment\.\.\.|Attention Required! \| Cloudflare|Access to this page has been denied|Access Denied)\s*$/m;
// The `s` flag: a decoded name can hold a line break, and without it one before the separator hid the name.
const SECRET_NAME = /^(?:.*[-_])?(?:token|key|apikey|secret|password|passwd|pwd|sig|signature|auth|session|sessionid|credential|credentials)$/is;
/** Whether a reason may repeat a parameter's `name`: a short plain word that does not itself read as a key. Any other
 * is named by its place alone, since a decoded name can hold line breaks, control characters and free text, or be
 * the key, and a reason is copied into reports. */
const repeatable = (name) => /^[A-Za-z0-9_.[\]-]{1,40}$/.test(name) && !readsAsKey(name);
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
  const parameters = [...url.searchParams];
  for (const [index, [name]] of parameters.entries()) {
    // `accessToken` is `access_token` in camelCase: a boundary of case counts as a separator.
    if (SECRET_NAME.test(name.replace(/([a-z0-9])([A-Z])/g, '$1_$2'))) {
      return `its query carries a parameter named like a secret (${repeatable(name) ? name : `parameter ${index + 1}`})`;
    }
  }
  const place = keyLikeSegment(url.pathname);
  // The segment is named by its place and never quoted: a reason is copied into reports.
  if (place !== 0) return `its path carries a segment that reads as a key (segment ${place})`;
  // The names and values are the ones `URLSearchParams` decoded, as the site will read them. A parameter is named by
  // its place, which no empty or repeated name leaves in doubt; a value's parameter by its name too when that is a
  // plain word, since the page without a click id is the same page; a name that is the key, never.
  for (const [index, [name, value]] of parameters.entries()) {
    if (readsAsKey(name)) return `its query carries a name that reads as a key (parameter ${index + 1})`;
    if (readsAsKey(value)) return `its query carries a value that reads as a key (parameter ${index + 1}${repeatable(name) ? `, ${name}` : ''})`;
  }
  return null;
}

/** Whether `text` reads as a key: cut at every character that is no ASCII letter or digit, its pieces that hold both
 * a letter and a digit add up to `KEY_LIKE_LENGTH` characters or more. The one judgement of the path and the query. */
function readsAsKey(text) {
  const mixed = text.split(/[^A-Za-z0-9]+/).filter((piece) => /[A-Za-z]/.test(piece) && /[0-9]/.test(piece));
  return mixed.reduce((sum, piece) => sum + piece.length, 0) >= KEY_LIKE_LENGTH;
}

/** The place, counted from 1, of the first segment of `pathname` that reads as a key, or 0 when none does. What
 * `readsAsKey` takes for one: a random token in hex or base62, a UUID, a session id written beside its name, and
 * most tokens in base64url. A word, a number and one short id (`a64152b37c35`, `256GB`) are no key, so a slug of
 * plain words passes at any length.
 *
 * It reads a shape and knows no secret, so it errs both ways, in the path and in the query alike, and the help says
 * each. Sent: a key of letters alone or of digits alone, one spread over several segments or parameters, one escaped
 * twice, and a key whose other characters (the hyphens and underscores of base64url, the escapes of standard base64)
 * leave too few pieces that mix the two (about one of 22 characters in four, one of 32 in twenty). Refused: a public
 * id of the same shape (a commit hash, a tracking value), and a slug whose letter-and-digit words add up to the
 * limit (`gpt4`, `llama3` and a 12-character id).
 *
 * Each escape of an ASCII character is decoded on its own, as the site will read it, and any other escape is a cut:
 * a segment decoded whole would be judged as written the moment one escape in it is malformed, and a key written in
 * escapes would pass behind it. */
function keyLikeSegment(pathname) {
  const segments = pathname.split('/').slice(1);
  for (const [index, raw] of segments.entries()) {
    const segment = raw.replace(/%([0-9A-Fa-f]{2})/g, (escape, hex) => (parseInt(hex, 16) < 0x80 ? String.fromCharCode(parseInt(hex, 16)) : ' '));
    if (readsAsKey(segment)) return index + 1;
  }
  return 0;
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
