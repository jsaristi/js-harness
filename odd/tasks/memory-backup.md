# Memory backup

Locator: `odd/tasks/memory-backup.md` · Engram mirror: `odd/memory-backup/tasks` · Branch:
`feat/memory-backup` in `D:/js-harness/.claude/worktrees/brave-taussig-2a280c` · Opened on
2026-10-19 by a session the lead (JH ORQ) started. Test runner: `node --test`. Delivery:
`ask-on-risk`.

## Goal
Everything the project knows survives a PC Manager cleanup, a Windows reinstall or a lost disk:
a full copy of the memory in a private GitHub repository, pushed by itself as sessions work, a
short public summary any clone reads to catch up, and a restore that is proven, not hoped for.

## Why
His words (2026-10-19, to the lead): "Es muy importante para mi lo de las memorias ya que el
computador esta funcionando demasiado lento y si por alguna razon despues de la limpiezas que le
hago al computador se llegan a borrar las memorias o me toca que reinstalar el sistema operativo
voy a perder todo lodel proyecto y me tocaria instalar todo desde cero incluso el desarrollo de
este proyecto del harnes." A past cleanup already lost Engram's memories once. Today the only copy
is one made by hand in `D:\js-harness-backup\2026-10-19`, on the same machine.

## Done when
- `node --test bin/backup.test.mjs bin/lib/backup.test.mjs bin/lib/backup-summary.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/memory-backup.md` exits 0
- `npm run check` exits 0
- `node bin/js-harness.mjs backup verify --from https://github.com/jsaristi/js-harness-memory.git` exits 0
- `node bin/js-harness.mjs backup verify --summary https://github.com/jsaristi/js-harness.git` exits 0
- `gh repo view jsaristi/js-harness-memory --json visibility -q .visibility` prints `PRIVATE`
- The first verify restores the newest backup into a scratch home and finds there the four counts
  (sessions, observations, prompts, relations) the backup recorded, each equal to what the live
  Engram held when it ran, and every backed-up file byte for byte; the second reads the summary
  from a fresh clone of the public repository and finds its sections and no private line. Their
  output is pasted in the Log.

## In scope / Out of scope
- In: a `backup` command and its library; its hook entries in `bin/lib/manifest.mjs` (install and
  uninstall); a backup line in `doctor --hook`; the `memory-summary` branch of the public
  repository; `RESTORE.md` in the private repository and the same steps in the README; help text
  and the roadmap lines of this section; creating `jsaristi/js-harness-memory` as private
  (authorized by Pregunta 19, below).
- Out: the full export, or anything but the summary, in `jsaristi/js-harness`, which is public.
  Engram itself (this feature only calls `engram export` and `engram import`). `AGENTS.md` (its
  budget is full). Session transcripts (`~/.claude/projects/*.jsonl`: 144 files, 1,031 MB,
  measured by reader B, over what a GitHub repository holds; S1–S3 are quoted here, so their
  source survives in this file). Skills (`install` writes them again). Login files
  (`~/.claude.json`, `.credentials.json`, `~/.codex/auth.json`): never.

## Constraints
- Nothing personal in the public repository — because it is public: the summary is built from an
  allowlist, never filtered from everything (D4).
- No secret in the private repository either — because a private repository is one leaked token
  or one visibility flip away from public; every secret value is blanked in the copy (D1).
- A wiped memory never replaces the good copy — because that is the exact loss S1 fears: the next
  session after a cleanup or a reinstall would back up an empty Engram (D2).
- The hook never slows or breaks a turn — because it rides every session's Stop.
- Zero dependencies, plain Node, `git`, `gh` and `engram` on the PATH — because `bin/` runs
  anywhere with no install step.
- Every write outside this repo is undone exactly — `AGENTS.md`: the hooks by `uninstall`, the
  local clone by deleting one folder; the two GitHub copies are his to delete.

## Ask me before
- Creating `jsaristi/js-harness-memory`: authorized by Pregunta 19; the lead is told first.
- Whether the memories of his other projects go to GitHub too (Readers, A-open-1).
- Deleting or rewriting the history of either GitHub copy: never without his word.

## Specs
- S1 His order, verbatim (2026-10-19): "Es muy importante para mi lo de las memorias ya que el
  computador esta funcionando demasiado lento y si por alguna razon despues de la limpiezas que
  le hago al computador se llegan a borrar las memorias o me toca que reinstalar el sistema
  operativo voy a perder todo lodel proyecto y me tocaria instalar todo desde cero incluso el
  desarrollo de este proyecto del harnes."
- S2 His answer to Pregunta 18 ("¿Dónde guardamos la copia de tus memorias que sobrevive a una
  limpieza o a reinstalar Windows?"), verbatim: "El repo ya no es privado sino publico, las
  opciones que tenemos es o hacer un github privado solo para memorias o hacer unos resumenes
  que se actualicen cada cierto ciclo para tener un resumen si las memorias completas se pierden
  y pueden ir en el repositorio publico".
- S3 His answer to Pregunta 19 ("Tu respuesta a la 18 nombra dos caminos; ¿cuál hacemos?"):
  "Los dos (Recommended)", whose description read: "Un resumen vivo en el repo público,
  regenerado cada ciclo, solo con lo del proyecto (decisiones, convenciones, estado, trabajo
  abierto; nada personal), que cualquier clon lee para ponerse al día; y la copia completa de
  Engram en un repo privado aparte. Si se pierde todo, el resumen te pone al día al instante y el
  privado te devuelve cada memoria."
- S4 What the private copy holds (the lead's brief): the Engram export of every project, the
  Claude memory folders, `~/.js-harness`.
- S5 When it runs (the lead's brief): at each session's close. Pregunta 18's recommended option
  said "sube ahí al cerrar cada sesión".
- S6 The public summary (S3, the lead's brief): regenerated each cycle from Engram, the roadmap
  and the feature documents; project matters only (decisions, conventions, state, open work);
  nothing personal: no emails, plan, credentials, private names.
- S7 The full export goes only to a new private repository, `jsaristi/js-harness-memory`; never
  to `jsaristi/js-harness`, which is public.
- S8 A restore proven on a scratch home, from both copies (roadmap: "Restore proven from both on
  a scratch home").

## Design

Searched his earlier words: the lead's transcript `908805db…jsonl` for "Pregunta 18", "Pregunta
19" and "memorias" (S1–S3 quote what it holds), engram `mem_search` for "memorias backup Pregunta
19 repositorio privado" (nothing on the subject), and the roadmap section on `feat/release-095`.
This is the second version; "Readers" below says what each reader changed.

### D1 What a backup holds
`~/.js-harness/memory-backup/repo`, a clone of the private repository:
- `engram/export.json` — `engram export --all` (on 2026-10-19: 5,074 observations, 301
  sessions, 267 prompts, 1,079 relations, 9.1 MB). Two exports a second apart differ only in
  `exported_at` (measured), so a new export whose content past that field equals the clone's
  leaves the file untouched, and a backup with nothing new commits nothing.
- `claude/projects/<slug>/memory/**` — every non-empty `~/.claude/projects/*/memory` (three
  today, 157 KB).
- `js-harness-home/**` — `~/.js-harness` without its `memory-backup` folder, `*.log` and
  `gate-log/` (logs, 2.8 MB and 1.4 MB). About 5.4 MB today.
- `config/**` — reference copies, never restored over a live file: `~/.claude/CLAUDE.md`,
  `~/.claude/settings.json`, `~/.claude/hooks/`, `~/.claude/scheduled-tasks/`,
  `~/.codex/config.toml`, `~/.codex/hooks.json`, `~/.codex/AGENTS.md`,
  `~/.engram/protocol-mode.json` (about 230 KB).
- `git/js-harness.bundle` — a `git bundle` of the refs of `D:/js-harness` whose commits are on no
  remote (S1: "incluso el desarrollo de este proyecto"; reader B counted 35 such commits, among
  them 13 on `feat/codex-parity`). Empty bundle, no file.
- `private-terms.txt` — the words the public summary must never print (D4); it lives in the
  clone, so it is backed up with the rest.
- `RESTORE.md` — the steps of D5, written by `backup init`, readable on GitHub from any machine.
- `manifest.json` — machine name, engram's version, the four counts of the export, the three
  counts `engram stats --all` printed just before it (the live figure, so a restore is compared
  with what Engram held, not with itself), the sha256 and size of every file, and every file
  whose secrets were blanked, with their kinds. It holds no time, so it changes only with content;
  the time of each run goes to `~/.js-harness/memory-backup/last.json`, outside the clone.

Secrets: every file passes `redactSecrets` (`bin/lib/backup.mjs`), which blanks the value of a
GitHub, `sk-` style, Slack or AWS key, a bearer token, a private key, or a field named like a
credential (JSON, TOML or env) whose value is 20 characters or more, and keeps the rest of the
file, so a JSON document stays JSON. Measured on the real home: it blanks the Context7 key in
`backups/claude.json.before-fixed-load-…` and `backups/stack-v4-…/codex-config.toml`, one
`$env:…_OAUTH_TOKEN = …` inside an Engram observation (the export still parses, 5,074
observations), and nothing in the memory index; `task-`, `ask-on-risk` and
`risk-assessment-…` pass.

### D2 When it runs
A `Stop` hook in both hosts, `js-harness backup --hook || exit 0`, five seconds like the other
Stop entries. It returns at once unless a backup is due: the clone exists, no run holds the lock
(stale after 10 minutes), the last success is older than 30 minutes (`BACKUP_EVERY_MINUTES`), and
the newest modification time among `engram.db`, `engram.db-wal`, the memory folders and
`~/.js-harness` (its backup folder aside) is past it. Engram writes through its WAL: on
2026-10-19 `engram.db` last changed at 00:02 and `engram.db-wal` at 02:09. Due, it spawns
`js-harness backup run` detached and returns. Whether that child outlives the hook's process on
both hosts is measured in T4 before anything relies on it; if a host kills it, the entry goes
`async` on that host instead.

Why `Stop` and not `SessionEnd`: Claude's `SessionEnd` fires on every app restart
(`docs/todo.md:50`), but a session left open for days never reaches it, and whether Codex has
such an event is unconfirmed here (`bin/lib/manifest.mjs`, the rules hook: "until a logging hook
confirms Codex's events"). `Stop` fires in both at the close of every turn; the throttle bounds
the cost. `js-harness backup run` by hand does the same at once.

`backup run`, in order: read `engram stats --all`; export to a temporary file and read it back;
refuse, keeping the clone as it was, when any of the four counts is under the last manifest's by
more than 10 percent (`--allow-shrink` when he means it) — the cleanup and the reinstall of S1
both look like that; blank secrets; copy the trees; bundle; write the manifest; refuse when the
clone's `origin` is not the configured repository or `gh repo view -q .visibility` does not read
`PRIVATE` (read before every push, so a flip to public stops the next push; a refusal when it
cannot be read); commit when something changed; push with `GIT_TERMINAL_PROMPT=0` and
`GCM_INTERACTIVE=never` and a two-minute limit, so a sign-in prompt can never hang a process
with no window. A push the remote rejects fetches and rebases once. Two machines: the remote's
manifest names its machine; a run from another refuses until `backup run --adopt` (the first
run after a reinstall, whose machine name may differ). Each step's outcome goes to `last.json`;
`backup status` prints it with the unpushed commits.

He learns it stopped: `doctor --hook`, already a `SessionStart` hook in both hosts, prints one
line when the last success is over 24 hours old, the last run failed, a push is owed, or the
clone is missing, and nothing otherwise.

### D3 The private repository
`js-harness backup init --repo jsaristi/js-harness-memory` creates it with `gh repo create
--private` only when it does not exist, reads its visibility back and stops unless `PRIVATE`,
clones it, writes `RESTORE.md` and a first `private-terms.txt`, and records the repository in
`~/.js-harness/memory-backup/config.json`. The hook never creates or clones anything: with no
clone it does nothing, and `doctor` says so. The repository is never rewritten.

### D4 The public summary
Read by any clone with `git fetch origin memory-summary` and `git show
FETCH_HEAD:SUMMARY.md` (the README says so). It lives on a branch of its own, `memory-summary`,
one file, one commit replaced each time (`--force-with-lease`), pushed by `backup run` at most
once a day: no feature branch carries it, so it never conflicts in the merge queue and always
reads main's roadmap (reader A, 8). Built by `js-harness backup summary` with no model call, from
an allowlist only:
1. State — each roadmap phase's share, from `js-harness progress --json` on `origin/main`.
2. Open work — the roadmap's unchecked items, by section.
3. Features in flight — each `odd/tasks/*.md` on `origin/main` with an unchecked task: its first
   Goal sentence and its next unchecked task.
4. Decisions — the titles of the last 30 Engram observations of project `js-harness` whose
   `topic_key` mirrors a feature document (`odd/<feature>/…`), whose text is already public in
   that document; their date and feature, never their content.
Then every line passes the privacy check, which drops the line and counts it: an email address,
a secret (D1), a path under a user's home (`C:\Users\…`, `/home/…`), or a whole word of
`private-terms.txt` (three letters or more; seeded at `init` from the Engram project names other
than `js-harness` and longer than three letters, and the names he adds). A summary is not pushed
when the terms list is missing. The last line gives the count of dropped lines.

### D5 Restore
`js-harness backup restore --from <dir|git url> --home <dir>` reads the newest backup, refuses
when the target Engram already holds observations (unless `--merge`), and in this order: runs
`engram import` with `ENGRAM_DATA_DIR=<home>/.engram`; copies the memory folders, printing where
each went (`--map <old>=<new>` for a project now at another path); copies `js-harness-home`
without `manifest.json`, which records an install the new machine does not have yet; puts
`config/` under `<home>/.js-harness/restored-config/` for him to compare, never over a live file;
unbundles nothing by itself and prints the `git fetch <bundle>` line. It warns when the installed
engram's version differs from the manifest's.

`backup verify --from <url>` restores into a fresh scratch home under the system temp folder,
runs `engram export --all` there and compares the four array lengths with the manifest, and the
manifest's export counts with its live `engram stats` figures, checks every file's sha256, prints
the result and removes the scratch home even when it fails. `backup verify --summary <url>`
fetches the `memory-summary` branch into a scratch clone and checks its four sections and the
privacy check (with the local terms list when there is one, and says when there is none).

`RESTORE.md`, after a reinstall, in this order: install Node, git, `gh` (`gh auth login`) and
engram; install Claude Code and Codex; clone `jsaristi/js-harness` to `D:\js-harness` (the
memory folder's name comes from that path); `node bin/js-harness.mjs backup restore --from
https://github.com/jsaristi/js-harness-memory.git --home %USERPROFILE%` before any session and
before `install`, so no hook backs up an empty memory first; `install`; `backup init` to clone
again and `backup run --adopt`.

Known limits: an Engram restore does not bring back `observation_versions` (136 rows, the edit
history of observations; reader A measured 136 to 0) nor its sync tables; the current text of
every observation comes back.

### D6 Install and undo
The hook entries are two more `manifest.mjs` targets (`claude-backup-hook`, `codex-backup-hook`),
so `uninstall` removes them exactly. The clone and its state are one folder,
`~/.js-harness/memory-backup`. The private repository and the `memory-summary` branch are his.

## Readers

Round 1, 2026-10-19, both on Opus, read-only, given this file, his words and the paths it cites.

Reader A (attacks claims) — 4 blockers, 5 should-fix, 3 notes. Changed: the secret filter
(D1: `sk-` matched `task-`, 63 lines of the export, and would have dropped the export and
`MEMORY.md`; the real Context7 key slipped past; now values are blanked in place, tested on the
real files); "due" read `engram.db`, which WAL mode leaves untouched for hours (D2); the terms
list lived outside the clone and was matched as substrings (`v` dropped 15 of 40 titles) and a
title is free text (D4: allowlist of feature-mirror titles, whole words); the detached child's
survival is now a measurement in T4, five seconds not two; commits when nothing changed (D1,
the manifest holds no time); `engram stats` prints no relation count (D5 counts from an export of
the scratch home); visibility read before every push (D2); the summary on its own branch, not
committed by features (D4); `-q .visibility` in Done when. Confirmed: a restore brings back
5,079 observations, 301 sessions, 267 prompts, 1,079 relations and the topic keys; a second
import into the same folder is harmless.

Reader B (looks for what is missing) — 4 blockers, 7 should-fix, 2 notes. Changed: a wiped
Engram backed up over the good copy (D2, refusal past 10 percent, tested); the restore steps
written nowhere off the machine (D5, `RESTORE.md` in the private repository, and before
`install`); the secret filter dropping the export (same as A); he never learns it stopped (D2,
`doctor --hook`); `~/.js-harness` deleted (D3, the hook does nothing, `doctor` says so; the terms
list now in the clone; restore leaves out `manifest.json`); a push that hangs or is rejected
(D2); two machines (D2, `--adopt`); unpushed commits (D1, the bundle); the config files (D1,
`config/`); transcripts out, said so (Out of scope); Codex (T4, T7); engram version (D5); the
memory folder's path (D5, `--map`).

Round 2, 2026-10-19, one reader on Opus, only round 1's blockers: A2, A3, B2 and B4 settled;
A1/B3, A4 and B1 partly. Changed: the real Context7 key is UUID-shaped and, loose in plain text,
slipped past the `API key` pattern (now matched, test with that shape); the shrink refusal
checked observations only (now all four counts, against the clone's last export, test for
sessions). Still open: A4's fallback, if a host kills the detached child, is `async` on that
host, unverified for Codex; the second fallback is a scheduled task (`schtasks`), which
`bin/lib/manifest.mjs` already uses for the daily boot task. T4 measures before either is used.

Open after round 1, not settled by this session:
- A-open-1 (his): `engram export --all` holds every project's memories, among them his client
  project (reader B: 490 observations of `abogadaclaudiajimenez`, and a 21 KB Claude memory
  folder). The lead's brief says "every project"; whether a client's matters go to GitHub, even
  private, is his. Asked of the lead before T2 pushes anything. The lead, by message: "Until then
  push nothing that holds another project's memories; keep building, and make the scope one
  switch so either answer is a one-line change." Built as D7 below.

D7, the scope switch: `scope` in `~/.js-harness/memory-backup/config.json`, `"all"` or one
project name; unset, it is `DEFAULT_SCOPE` (`bin/backup.mjs`), `js-harness` until he answers.
Under a project scope, `engram export` and `engram stats` take `--project <name>`, and only the
Claude memory folders of that checkout and its worktrees (`D--js-harness`,
`D--js-harness--claude-worktrees-*`) are copied; a folder another scope copied is removed from
the clone. The first run after the scope changes skips the shrink refusal, since counts of
another scope say nothing about a wipe, and the manifest records the scope. His answer "all" is
`DEFAULT_SCOPE = 'all'` or `"scope": "all"` in config.json.
- Unguaranteed: the allowlist keeps the summary to text already public, but a feature document's
  own words are only as clean as its author kept them; the privacy check is a net, not a proof.
- Unguaranteed until T4: that a detached child survives a Stop hook on each host.

## Tasks
- [x] T1 (kind: design) The design above, past two read-only readers, their findings above
- [x] T2 (kind: build) `backup run` and `status`: export, shrink refusal, secrets, trees, bundle, manifest, push guard (186a7c79, 22bbe6e8, 83df03c2; inline)
- [ ] T3 (kind: build) `backup init`: create the private repository, verify its visibility, clone, `RESTORE.md`
- [ ] T4 (kind: build) `backup --hook`, its manifest entries, throttle, lock; the detached child measured on both hosts
- [ ] T5 (kind: build) `backup summary` and its privacy check; the `memory-summary` branch
- [ ] T6 (kind: build) `backup restore` and `verify`, both copies; `doctor --hook` line
- [ ] T7 (kind: verify) Restore proven from both copies on a scratch home; the Done-when commands
- [ ] T8 (kind: docs) Help, README, roadmap lines checked off

## Log
- L1 2026-10-19, the lead's brief: "Build the roadmap section \"Memory that survives the machine\"
  of D:/js-harness … Done when the commands of the contract exit 0 and a restore from both copies
  is proven. Ask the lead (JH ORQ) before anything irreversible."
- L2 2026-10-19 07:12Z, design v2 after round 1 of the readers. T2 started test first:
  `bin/lib/backup.mjs` (`redactSecrets`, `collectFiles`, `exportEngram`), 6 tests green.
- L3 2026-10-19 07:16Z, round 2 of the readers recorded; library at 13 tests green (`parseStats`,
  `buildManifest`, `pushRefusal`, four-count shrink refusal, UUID-shaped key).
- L4 2026-10-19 07:27Z, state for a compaction. Commit 186a7c79 holds the design and the library
  (gentle-ai assess: medium, under_budget, pending in the slice). Uncommitted, all green:
  `bin/backup.mjs` (run, status, init, --hook; written before its test, then 9 tests in
  `bin/backup.test.mjs`, so no RED was observed for it), `claude-backup-hook` and
  `codex-backup-hook` in `bin/lib/manifest.mjs` (RED seen, 180 green), the dispatcher line, the
  README section, the SPEC capability. One red left: `scripts/practice-lib.test.mjs`
  `HARNESS_HOOKS` must list the backup Stop entry for both hosts (`scripts/practice-lib.mjs:344`).
  Lead asked (07:13Z) whether other projects' memories go to GitHub; no answer yet; nothing pushed.
- L5 2026-10-19 07:46Z. Commit 22bbe6e8 holds T2's command, the hooks and the docs. gentle-ai
  review of 84dd74b5..22bbe6e8 (lineage review-1c2fa0ab4d5b178c, high by --escalate-item 2,
  lenses risk, resilience, reliability; consent granted unasked per AGENTS.md): risk and
  resilience found nothing; reliability found one CRITICAL, R3-raw-export-temp-committed (the
  raw export, secrets unblanked, was written inside the clone and a killed run left it for the
  next git add -A). Corrected in 83df03c2 (raw export beside the clone, one fixed name; RED
  seen), validator approved, acknowledged, authority burned. Codex review of 84dd74b5..83df03c2:
  the first run was discarded because this worktree was edited while it ran (124,228 input
  tokens spent, nothing recorded); rerun from a clean detached worktree. Scope switch D7 built
  test first (RED seen on the missing DEFAULT_SCOPE), 27 backup tests green.

## Next step
Commit D7 (scope switch); record the Codex review of 84dd74b5..83df03c2 when it lands. Then T5
summary, T6 restore/verify, T4's measurement, T3 init on GitHub with the default scope
(js-harness only) after telling the lead, T7 proofs, T8 docs.
