# compact-window-suffix

Branch `fix/compact-window-suffix`, from main. One pull request. Runner: `node --test`.

## Goal
The context pause reads `CLAUDE_CODE_AUTO_COMPACT_WINDOW` written with a `k` or `M` suffix, as Claude Code does.

## Why
Claude Code 2.1.304's changelog: "Fixed `CLAUDE_CODE_AUTO_COMPACT_WINDOW=200k` silently setting a 100K window: the variable now accepts `k` and `M` suffixes like `--autocompact`". `configuredWindow` in `bin/lib/pause.mjs` read only plain digits. A window written as `350k` was passed over for the settings files, so the pause measured against the wrong window. The lead found it in the host-update review of 2026-10-22.

## Done when
- `node --test bin/lib/pause.test.mjs` exits 0
- `200k` reads as 200000 and `1M` as 1000000. `200K`, `1m`, `1.5M`, `k` and `200kb` are passed over, as before.

## In scope / Out of scope
- In: `configuredWindow` in `bin/lib/pause.mjs`, its test, and the README line that names the variable.
- Out: `autoCompactWindow` in the settings files. The changelog names only the variable, and a number there is a JSON number.

## Constraints
- Only the spellings the changelog names — because a spelling the host would not read as that window would put the pause at a window the host does not use.

## Ask me before
Nothing: a follow-up of the host-update review he was told of.

## Tasks
- [x] T1 (kind: build) the suffixes, in 5f7772a8. Route: inline.

## Log
- L1. 2026-10-23, the test written first and seen failing ('200k' gave the settings' 350000). Then 58 of 58 pass in `bin/lib/pause.test.mjs`. gentle-ai on 5f7772a8: medium, not due (under_budget); the slice is this pull request. Codex on 6b16971..5f7772a (61,345 input tokens): "the patch is correct (confidence 0.94)", no findings, recorded.
