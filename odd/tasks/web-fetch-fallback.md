# A fallback ladder for pages that block WebFetch as AI traffic

Locator: `odd/tasks/web-fetch-fallback.md` · Engram mirror: `odd/web-fetch-fallback/tasks` · Branch:
`feat/web-fetch-fallback` · Delivery: `ask-on-risk` · Runner: `node --test`

## Goal
When WebFetch is refused as AI traffic, the session is told at once which rung reads the page next, and the
second rung is one command that says itself whether it read the page or was blocked too.

## Why
Sebastián, on Agent-Reach: "muchas veces con el webfetch y websearch las pagina te tienen bloqueado al ser
una ia ese es el problema". The real browsers this machine has are rarely blocked; what is missing is
knowing when to switch. And r.jina.ai answers HTTP 200 with a challenge page inside (measured below), so a
session that reads its status alone takes a block for a page.

## Done when
- `node --test bin/fetch.test.mjs` exits 0
- `node --test bin/resume.test.mjs` exits 0
- `npm run check` exits 0
- A WebFetch answered 403 in a project with a `harness.json` is followed by the hook's notice naming
  `js-harness fetch <url>` and the built-in browser.

## In scope / Out of scope
- In: `bin/fetch.mjs` and its test, the dispatcher's entry, the web notice in `resume --pause`
  (`bin/lib/web-block.mjs`), this document, the roadmap item.
- Out: a new hook entry in the host's settings (`install`): the `PostToolUse` entry that runs
  `resume --pause` after every tool call is already installed, so the notice rides on it. Agent-Reach and
  any tool that needs Python, an npm package, cookies or a key.

## Constraints
- No cookies, no credentials, no keys — because the URL goes to a third party (r.jina.ai), and a session
  must never carry the user's sign-ins out of the browser.
- Public pages only: a host without a dot, a private or loopback address, a URL with a user or password,
  or a query parameter named like a secret is refused before anything is sent — for the same reason.
- No dependency: Node's own `fetch` — because `bin/` runs with no install step.

## Effort
high

## Ask me before
Nothing planned.

## Specs

- **S1** (the lead's brief, 2026-10-15): "design and build a fallback ladder for agents whose
  WebFetch/WebSearch reads get blocked as AI traffic (403, Cloudflare challenge, empty body). Ladder: (1)
  WebFetch; (2) on a block, `curl https://r.jina.ai/<url>` for public pages only (no install, no key); (3)
  on a further block, the built-in browser's `get_page_text`."
- **S2** (the same brief): "measure first — pick 5-10 real pages that block WebFetch today and record which
  rung reads each (command and output as evidence)."
- **S3** (the same brief): "decide the smallest place the rule lives: a check or helper in `bin/`
  (preferred, with its `*.test.mjs` written first) or, if it cannot be a command, at most a few lines in
  AGENTS.md within its token budget. Never handle cookies or credentials; never add Python or npm
  dependencies."
  - Decided: two pieces in `bin/`, no line in AGENTS.md. (a) `js-harness fetch <url>`, rung 2: it asks
    r.jina.ai and reads the answer for a block, prints the page and exits 0 when it read one, and exits 3
    with the reason and the next rung (the built-in browser's `get_page_text`) when it did not. (b) The
    `PostToolUse` hook `resume --pause`, already installed with no matcher, adds one notice after a
    WebFetch answered 402, 403, 429 or 503: the next rung is `js-harness fetch <url>`, then the browser.
    The rule costs nothing on a turn without a block.
- **S4**: a WebFetch that fails as a tool error ("Claude Code is unable to fetch from <domain>", measured on
  reddit.com and stackoverflow.com) does not reach a `PostToolUse` hook; covering it needs a
  `PostToolUseFailure` entry in `install`, which is a change to the host's settings. Not in this slice.

## Measurement (2026-10-15, this machine)

WebFetch from this session; rung 2 is `curl -s -w '%{http_code}' https://r.jina.ai/<url>`; rung 3 is
`preview_start`/`navigate` then `get_page_text` in the built-in browser.

| Page | 1 WebFetch | 2 r.jina.ai | 3 built-in browser | Read by |
|------|------------|-------------|--------------------|---------|
| `www.npmjs.com/package/react` | 403 Forbidden | 200, `Title: Just a moment...`, `Warning: Target URL returned error 403: Forbidden` | read: "react 19.3.1 • Public • Published 18 hours ago" | 3 |
| `medium.com/@karpathy/software-2-0-…` | 403 Forbidden | 200, `Title: Just a moment...`, `Warning: Target URL returned error 403` | read: "Software 2.0 … Andrej Karpathy · 9 min read" | 3 |
| `www.g2.com/products/notion/reviews` | 403 Forbidden | 200, `Warning: This page maybe requiring CAPTCHA`, empty content | empty at once; read after a 6 s wait: "Notion Reviews & Product Details" | 3 |
| `www.quora.com/What-is-JavaScript` | 403 Forbidden | 200, 23,002 bytes with the answers | not needed | 2 |
| `www.zillow.com/homes/` | 403 Forbidden | 200, "648 results" with listings | not needed | 2 |
| `x.com/AnthropicAI` | 402 Payment Required | 200, 6,435 bytes with the posts ("We've opened an office in Singapore…") | not needed | 2 |
| `stackoverflow.com/questions/11227809/…` | tool error: "Claude Code is unable to fetch from stackoverflow.com" | 200, 104,574 bytes, the question and answers | not needed | 2 |
| `www.reddit.com/r/ClaudeAI/` | tool error: "Claude Code is unable to fetch from www.reddit.com" | 403 `AbuseAlleviationError`: "Anonymous access to domain www.reddit.com blocked until Thu Oct 15 2026 12:17:13 GMT" | refused: "not allowed due to safety restrictions" | none |
| `www.investing.com/currencies/usd-cop` (control) | read: "USD/COP is at 3,197.63" | not needed | not needed | 1 |

Eight pages blocked WebFetch: r.jina.ai read four, the browser three more, and none read reddit. Three of
the four blocks at rung 2 came back as HTTP 200, which is why rung 2 is a command that reads the body.
The WebFetch answers are in this session's transcript (`toolUseResult` holds `code` and `codeText`, the
shape the hook reads).

## Tasks
- [x] T1 (kind: build) `js-harness fetch <url>`: refuses what is not a public page, asks r.jina.ai, says read or blocked with the next rung (S1, S3). Inline. RED: `node --test bin/fetch.test.mjs` failed, no module; GREEN: 8/8
- [x] T2 (kind: build) the web notice in `resume --pause` after a blocked WebFetch (S3). Inline. RED: 3 of the 4 new tests failed; GREEN: `node --test bin/resume.test.mjs` 84/84
- [ ] T3 (kind: verify) `npm run check`, gentle-ai and Codex reviews recorded, a draft pull request
- [ ] T4 (kind: build) a `PostToolUseFailure` entry for WebFetch's tool error, if Sebastián wants it (S4): not started

## Log

- **L1** (2026-10-15T11:13:18Z, the lead's transcript `e152c9d8-53bc-4366-8fa5-526b1576bcb6`, line 311,
  read with `js-harness sessions --quote`, sent while the lead worked): "sino que muchas veces con el
  webfetch y websearch las pagina te tienen bloqueado al ser una ia ese es el problema". It answered his
  question on Agent-Reach (line 229, 11:10:12Z, typed): "Agent-Reach pero ya hace mas de 4 meses que no lo
  actualizan, me gustaria saber si necesitariamos alguna solucion asi?".
- **L2** (2026-10-15): the lead recommended not adopting Agent-Reach (Python dependencies, cookie files on
  disk, a fixed context load) and opened this session with the brief quoted in S1 to S3.
- **L3** (2026-10-15): measured the nine pages above. The /homedetails/ path first tried on Zillow was a
  page that does not exist; the row is `/homes/`, measured on all three rungs.
- **L4** (2026-10-15): T1 and T2 built test first. Live: `node bin/js-harness.mjs fetch` exits 3 on npmjs.com
  ("the site answered it HTTP 403") and on g2.com ("the site asks for a CAPTCHA"), 0 on x.com (6,436 bytes),
  1 on `http://localhost:3000/`; the measured WebFetch answer for Medium piped into `resume --pause` as a
  sub-agent's input prints the notice. The installed copy on the path says it only after this branch is
  merged and synced.
