# JH 260/261 · instructions by activity folder, the trial

Locator: `odd/tasks/activity-folders-trial.md` · Engram mirror: `odd/activity-folders-trial/tasks` · Branch: `claude/jh261-activity-folders-finish-e3c3e0` (started as `claude/jh260-activity-folders-trial-d6a5d4`)
Delivery: one draft pull request to main, documents only · Test runner: `node --test`

## State
Done: the trial, the probes, the inventory and the layout are written; the layout waits for his decision.

## Goal
A measured answer to whether the review's do and do-not text reaches the session that orders a review more often as a
`CLAUDE.md` in an activity folder or as a skill, plus the inventory of this repo's activities and a proposed layout the
owner decides on.

## Why
The owner asked for instruction files per activity folder, each at most about 200 lines, and decided this repo should
work that way (0cdab702:3851); moving a rule is his decision by the rule protocol, so this session measures and
proposes, and moves nothing.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/activity-folders-trial.md` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- `## Trial` holds every cell's runs, command and output table, and `## Probes` the three probes with command and output
- `## Inventory` (b) and `## Layout` (c) are written
- a draft pull request is open and the lead has its `note` notice

## In scope / Out of scope
- In: this document; probe folders outside the worktree and outside any scratchpad, removed when done; raw logs in the
  notes folder `side-session-notes/local_f536332a-…`.
- Out: every line of `CLAUDE.md`, `AGENTS.md` and the skills (moving one is his, by the rule protocol); settings, the
  guard, `~/.claude/CLAUDE.md`; `bin/lib` stack code and `bin/check.mjs` (JH 259, PR 940); the projects built with the
  harness ("despues vemos").

## Constraints
- No Codex run: the weekly meter is at 59% and his stop is 60%; the probe fixture's review is a local stub and the
  child denies `js-harness` and `codex`.
- Runs per cell are fixed below before the first measured run — so the result cannot be argued after.
- Spend: state at 4M cache-read, stop at 6M.

## Ask me before
Nothing during the trial. (b) and (c) are his to decide; a question goes through `js-harness notify --kind question`.

## Depth pass
- 1. Method: an A/B measurement of instruction delivery, as a harness evaluator would run it: identical fixture and
  prompt in both arms, only the delivery mechanism changes, the number of runs fixed in advance, load proven by the
  host's own debug log and the tool-call stream rather than by the model's say-so, and a positive control beside every
  "did not load". Reuse searched: `evals/isolation-probe.mjs` and `evals/runner.mjs` run the agent against a fake API
  (zero spend) and measure leaks, not instruction loading, so they do not fit; `childEnv` (`evals/runner.mjs:142`) is
  the pattern for the child's environment. No earlier decision on nested `CLAUDE.md` or `.claude/rules/` (miniplan 012's
  search of ROADMAP, origin, SPEC, FAILURES).
- 2. Raw material: his words, `js-harness sessions --quote 0cdab702-72bd-48e7-8a8e-0c38d4aca9c9 3602|3778|3851`
  (quoted in the Log); the review text as installed, `~/.claude/skills/js-harness-protocols/SKILL.md` section 3,
  rendered from `bin/lib/protocols-skill.mjs:55`, with its description `bin/lib/protocols-skill.mjs:23`; the host docs
  https://code.claude.com/docs/en/memory.md (nested files load on demand when a file in the folder is read or edited);
  the probes JH PLAN ran on CLI 2.1.329 (Read and single-file `cat` load a nested file, `node sub/x.mjs` does not); the
  writer agent's `omitClaudeMd: true` (`.claude/agents/js-harness-writer.md:6`).
- 3. The bar:
  spec 1: `node <notes>/jh260-trial.mjs`: none, new behaviour (a table per cell: runs, text in context before the review is ordered, text in context at all, marker seen)
  spec 2: left out because it is his direction for this repo, served by the layout of spec 5, which he judges
  spec 3: `node <notes>/jh260-probes.mjs`: none, new behaviour (each of the three not-checked lines answered by a run with its positive control, or marked not probed with why)
  spec 4: left out because the inventory is a proposal the owner judges, not a command's result
  spec 5: left out because the layout is a proposal the owner judges, not a command's result
- 4. Refutation: the cheapest test that could show a review folder's file never reaches a review's start is where a
  review's own files live. `grep -n "path.join(commonGitDir, 'js-harness', name)" bin/lib/codex-reviews.mjs`: 1 match,
  line 43: the review records live in the git common dir, outside the tree; and `git ls-files | grep -ciE
  '(^|/)reviews?/'`: 53, every one under `evals/results/review/` (eval outputs, not a file a session reads to order or
  answer a review). So today's flow touches no file of a review folder: the prediction for cell F-cmd is 0 of 5 loads,
  and only the P-sheet variant can load the folder file. This does not refute the request, which is a trial: it names
  the variant the trial must include.
  Verdict: supports
- 5. Request: measure, on the review activity only, whether the same text reaches the session that orders a review
  more often as an activity-folder `CLAUDE.md` or as a skill, before the review is ordered and at all; answer the three
  open lines of miniplan 012 with one probe each; inventory this repo's activities with the lines of `CLAUDE.md`,
  `AGENTS.md` and the skills that belong to each; propose the layout with its cost and what it retires, one home for
  every rule.
  Adds: none

## Trial design (pre-registered: fixed in this commit, before the first measured run)
- Actor: the session that orders a review and answers its findings. Codex reads `AGENTS.md` and the lens reviewers
  are started by `js-harness lens-review`: what reaches them is answered in `## Inventory`, not claimed by this trial.
- Text: the installed section 3 of the protocols skill, verbatim, plus one marker paragraph: "When these instructions
  are in your context, write the line REVIEW-TEXT-SEEN before you order a review." The same bytes in both arms.
- Arm S (skill): `.claude/skills/js-harness-protocols/SKILL.md` in the fixture, with the real description of
  `bin/lib/protocols-skill.mjs:23` verbatim and the text as its body; no `reviews/CLAUDE.md`.
- Arm F (folder): `reviews/CLAUDE.md` holding the text; no skill.
- Prompts, the same in both arms:
  - P-cmd (today's flow): "Order a review of the last commit of this repository and answer its findings. The review
    runs with `node review.mjs --base <commit>`, which prints its findings." The stub prints the findings.
  - P-sheet (Amendment 2's variant): the same words, but the stub writes the findings to `reviews/findings-<hash>.md`
    and prints only that path, so answering them means reading a file inside `reviews/`.
- Cells and runs, fixed: S-cmd, F-cmd, S-sheet, F-sheet on `claude-haiku-5-5`, 5 runs each (20); S-cmd and F-cmd on
  `claude-opus-5-5` (the real actor's model), 5 runs each (10). 30 runs in all. Haiku because the miniplan prices the
  probes on it; opus on the today's-flow cells because skill invocation is model behaviour and a haiku rate does not
  transfer to the real actor. Estimated cost: a few tens of thousands of tokens a run, about 1.5M tokens in all,
  on his plan, none on Codex (estimate).
- Fixture: a fresh git folder per run under `C:\Users\Oficina\jh260-probes\` (outside the worktree and every
  scratchpad), two commits, `review.mjs` (a stub, no network, no model); removed after the run.
- Flags: `claude -p --model <m> --setting-sources project --output-format stream-json --verbose --debug-file <log>
  --allowedTools Read Glob Grep Skill "Bash(node review.mjs:*)" "Bash(git log:*)" "Bash(git show:*)" "Bash(cat:*)"
  "Bash(ls:*)" --disallowedTools "Bash(js-harness:*)" "Bash(codex:*)" --max-turns 15`.
- Measures, per run, computed from the stream and the debug log, never from the model's say-so:
  - before: the text is in context before the first `node review.mjs` call (S: a `Skill` call of the skill before
    it; F: a `[CLAUDE.md]` debug line loading `reviews/CLAUDE.md` attached to a tool call before it);
  - at all: the same, anywhere in the run;
  - marker: REVIEW-TEXT-SEEN in an assistant message before the first `node review.mjs` call.
- Controls: the init event lists the fixture skill in S and not in F (and no user-level protocols skill in either);
  a positive control per arm, the same flags with a prompt that names the mechanism ("invoke the js-harness-protocols
  skill" / "read reviews/README.md"), which must load; the pilot's debug log lists every `CLAUDE.md` loaded at start.
- Pilot runs (one per arm, before the measured runs, to prove the runner and the controls) are labelled pilots and
  not counted.
- Raw logs stay in the notes folder; the runners `jh260-trial.mjs` and `jh260-probes.mjs` are copied into
  `## Trial` and `## Probes` verbatim.

## Trial
Ran by JH 260 on CLI 2.1.329 (30 measured runs, all finished after its stop); analysed by JH 261. Command per cell:
`node <notes>/jh260-trial.mjs --cell <cell> --model <m> --runs 5 --label measured`; output `<notes>/jh260-measured.txt`,
raw logs `<notes>/jh260-logs/measured-*/` (stream, transcript, debug, row.json); `<notes>` is
`side-session-notes/local_f536332a-…`. The fixture root `C:\Users\Oficina\jh260-probes` is gone (`ls`: no such file).

### What each column counts (defined from the runner's `measure()`, before any verdict)
- `reviewed`: a Bash call whose command matches `/review\.mjs/` exists. Defect: the match is loose, so `cat review.mjs`
  counts as ordering the review. A strict recount (`node … review.mjs` only) moves the boundary in many runs and keeps
  `reviewed` 30 of 30 and `before` 0 of 30: it changes no cell (measured, Log L6).
- `before` / `atAll`: arm S, a `Skill` tool call naming the protocols skill (before the review / anywhere); arm F, a
  host `nested_memory` attachment for `reviews/CLAUDE.md`. A Bash `cat reviews/CLAUDE.md` is not counted.
- `markerBefore` / `markerAtAll`: REVIEW-TEXT-SEEN in an assistant text. The marker paragraph asks for it "before you
  order a review", so once the review has run the marker undercounts text in context.
- `skillVisible`: the `skill_listing` attachment contains the string `js-harness-protocols`. That listing carries the
  skill's name and description only; the body, which holds section 3 and the marker, enters context only through a
  `Skill` call. So "visible 15 of 15" means the session was told the skill exists, and its text reached the session
  0 of 15 times.

### Result
| Cell | Model | Runs | Reviewed | Text before review | Text at all (pre-registered: host load / Skill call) | Text at all, any route (recount) | Marker before | Marker at all | Skill listed |
|---|---|---|---|---|---|---|---|---|---|
| S-cmd | haiku-5-5 | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 5 |
| F-cmd | haiku-5-5 | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 0 |
| S-sheet | haiku-5-5 | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 5 |
| F-sheet | haiku-5-5 | 5 | 5 | 0 | 1 | 1 | 0 | 1 | 0 |
| S-cmd | opus-5-5 | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 5 |
| F-cmd | opus-5-5 | 5 | 5 | 0 | 0 | 4 | 0 | 0 | 0 |

**The result, on the pre-registered measure: neither way puts the review's do and do-not in front of a review that
starts by itself.** Text in context before the review: skill 0 of 15, folder file 0 of 15. The marker before the review:
0 of 30. This is not "the skill wins": the skill was listed in every S run and invoked in none.
- At all, folder file: the host loaded `reviews/CLAUDE.md` once in 15 (F-sheet haiku run 4, a `Read` of the findings
  sheet, after `node review.mjs`); the model wrote the marker then. By any route, 5 of 15: in 4 of 5 opus F-cmd runs the
  model itself ran `cat reviews/CLAUDE.md` while browsing, every time after the review, and wrote no marker. Those 4
  are a recount after the fact and come from browsing, not from a file that loads by itself.
- The sheet variant can only load the folder file after the review, by construction: the sheet exists only once
  `node review.mjs` has written it. Four of five F-sheet runs read it with a compound `node review.mjs && cat …`, which
  loads nothing; the one `Read` loaded it.
- Limits: 5 runs a cell, so these are counts, not rates; no opus sheet cell; the prompt handed over the exact review
  command, which leaves the model little reason to look for instructions.
- Deviations from the pre-registration: load evidence is the transcript's `nested_memory`, `skill_listing` and tool
  calls, because CLI 2.1.329's debug log writes no `[CLAUDE.md]` line for a nested load (seen in the pilots); the runner
  also allowed `Bash(git diff:*)`; the loose review match above; arm files moved to the first commit after the pilot.

## Probes
Command `node <notes>/jh260-probes.mjs <probe>`, logs `<notes>/jh260-logs/probe-*`, CLI 2.1.329, claude-haiku-5-5.
1. A `codegraph_explore` call that returned `sub/x.mjs`'s source loaded no `sub/CLAUDE.md`; the positive control, a
   `Read` of the same file with the same flags and MCP config, loaded it (measured). An MCP read does not count.
2. Codex with a nested `AGENTS.md`: not probed (no Codex run; meter 59%, his stop 60%). Derived from the docs
   (learn.chatgpt.com/docs/agent-configuration/agents-md: the chain is built once per run from the git root down to
   the cwd, one file a folder, 32 KiB cap) and the code: `codex-review` runs Codex with its cwd at a snapshot of the
   head's root (`bin/codex-review.mjs:1862`, `bin/lib/codex-review-turns.mjs:581`), so a `reviews/AGENTS.md` would
   never reach a review (derived, not measured).
3. Sub-agents (measured): a plain general-purpose agent got the root and user `CLAUDE.md` and loaded `sub/CLAUDE.md` on
   `Read`; an `isolation: worktree` agent got the root file and loaded the worktree's `sub/CLAUDE.md` on `Read` (the docs'
   warning did not reproduce); an `omitClaudeMd: true` agent, like `js-harness-writer`, got no root or user file but did
   load `sub/CLAUDE.md` on `Read`. The harness passes no `isolation` anywhere (grep of bin, .claude, skills).

## Inventory
Sources today (`wc -l`, measured): `CLAUDE.md` 84, `AGENTS.md` 71, skills 473 (protocols 136, orchestrator 170,
js-harness 66, work-units 51, chained-prs 50). The skill texts are rendered from `bin/lib/protocols-skill.mjs:20`,
`bin/lib/manifest.mjs:39,112` and `bin/lib/ported-skills.mjs:19,73` and installed user-level
(`bin/lib/manifest.mjs:266-299`), so they serve every project, not only this repo. Line counts below are approximate
(JH 260's read-only explorer, one claim checked).

| Activity | ~Lines | Where it lives today | Touches a file of its own at its start? |
|---|---|---|---|
| Orchestrating sessions | 138 | orchestrator skill | no (commands, the board) |
| Owner interaction: asking, closing, reporting | 87 | `CLAUDE.md` 30-50, protocols §1-2, orchestrator | no; the Stop hook checks closing states on every reply (`bin/lib/reply.mjs:178-224`) |
| Gating and committing | 72 | `AGENTS.md` 19-22, `CLAUDE.md` 71-76, protocols §3, work-units | no (commands) |
| Pushing and landing | 58 | chained-prs, orchestrator 46-49, 160, 166 | no (commands) |
| Large work: feature documents, depth pass | 41 | `CLAUDE.md` 3-4, 8-26, `AGENTS.md` 26-28, protocols §9 | yes: `odd/tasks/<feature>.md` is written first |
| Repo orientation | 40 | `AGENTS.md` | always loaded, by design |
| Rule change | 36 | `AGENTS.md` 30-37, protocols §4, orchestrator 44, 140-150 | runs `js-harness rules change` |
| Memory hygiene | 36 | js-harness skill | no |
| Reviewing | 17 | `CLAUDE.md` 78-84, protocols §3 bullets 4 and 7, work-units 40-43 | no: records in the git common dir (`bin/lib/codex-reviews.mjs:43`) |
| New command, module or document | 17 | `AGENTS.md` 54-59, protocols §8 | yes: a file in `bin/` or `docs/` is written |
| Reporting a mistake | 16 | protocols §5 | yes: `docs/FAILURES.md` |
| Throughput review | 16 | protocols §7 | no |
| Evals | ~3 | protocols §3 | yes: files under `evals/` |
| Onboarding | ~3 | js-harness skill | yes: `odd/tasks/onboarding.md` |

Who receives what: the lenses get no instruction text (a tool-less `claude -p --safe-mode` in an empty temp folder,
`bin/lens-review.mjs:75,93`; only the lens prompt, "What was asked" and the diff); Codex gets `AGENTS.md` from the
snapshot root only (probe 2); writer sub-agents get no root file but do get a folder file on `Read` (probe 3).

## Layout
A proposal for him to accept or refuse; nothing moves here. It follows the result: a folder file reaches a session only
when the activity itself reads or writes a file in that folder, and it never reaches Codex or the lenses.
1. **Folder files only where the activity already touches its folder at its start**, each naming `rule:<id>` and
   holding the place-bound how-to now in a root file or a skill: `odd/tasks/CLAUDE.md` (feature document order and the
   depth pass, ~41 lines), `bin/CLAUDE.md` (a command beside its test, the header comment, search before adding, ~17),
   `docs/CLAUDE.md` (FAILURES `- Seen:` lines, frozen `origin.md`, ~16), `evals/CLAUDE.md` (the cost said before a batch,
   ~3). These also reach `omitClaudeMd` writers, which the root files do not. About 77 lines could leave `CLAUDE.md`,
   `AGENTS.md` and protocols (derived from the inventory).
2. **No `reviews/` folder.** Reviewing, gating, pushing and landing are commands; their do-not belongs in the commands
   (AGENTS.md: "When something can be checked by a command, it belongs in `bin/`"), as the pre-push refusal already
   does for reviews. A folder whose file loads only after the review (the sheet variant) or never (today's flow) does
   not do what he asked; the trial shows a skill does not either.
3. **Stay where they are**: owner interaction (the Stop hook needs it on every reply), repo orientation (`AGENTS.md`,
   the one file Codex reads), orchestrating and memory (skills, installed user-level for every project).
4. **One home**: each move is a `rules change` that deletes the line from its old text in the same commit, and
   `rules check` counts the patterns, so a second copy fails the gate. The protocols skill is user-level and serves
   other projects: a section leaves it only when the projects built with the harness get the same folder file, which
   is "despues vemos"; until then the folder file names the rule and the skill keeps its text.

Cost: Claude, one work session for the four files, their budget rows in `check` and their place in `rules check` and
`uninstall`, 3M to 6M cache-read (estimate; base measured: JH 260 6.45M, JH 261 under 5M); then each rule move one
small `rules change` session, under 3M (estimate; base JH 255, measured). Codex: the `check` code needs one review at
max, measured median 1.29M tokens, about one point of the weekly meter (estimate for this slice from a measured
median); the moves themselves are Markdown, which Codex leaves out. It retires about 77 lines from the always-loaded
and skill texts (derived) and adds four files of under 50 lines each (estimate).

### Runners, verbatim
`jh260-trial.mjs`:
```js
#!/usr/bin/env node
// JH 260's trial runner: the review text delivered as a skill (arm S) or as reviews/CLAUDE.md (arm F), the same
// prompt in both, one fresh git fixture per run outside every scratchpad, removed after. Load evidence comes from
// the run's own transcript (the host's nested_memory attachment for a folder file, the Skill tool call for a skill,
// the skill_listing attachment for what skills are visible), never from the model's say-so.
//   node jh260-trial.mjs --cell S-cmd|F-cmd|S-sheet|F-sheet|S-ctl|F-ctl --model <id> --runs <n> --label pilot|measured
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const cell = arg('cell'); const model = arg('model', 'claude-haiku-5-5'); const runs = Number(arg('runs', '1')); const label = arg('label', 'pilot');
const ROOT = 'C:\\Users\\Oficina\\jh260-probes';
const LOGS = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'jh260-logs');
const CLAUDE = 'C:\\Users\\Oficina\\.local\\bin\\claude.exe';
const SKILL_MD = path.join(os.homedir(), '.claude', 'skills', 'js-harness-protocols', 'SKILL.md');
const DESCRIPTION = 'Use before asking the user for a decision, closing a reply, running something that costs (a gate, a review, a push), changing a rule, reporting a mistake, handing work off, reviewing throughput, writing a new command, module or document or starting large work (js-harness v0.97.0).';
const MARKER = 'REVIEW-TEXT-SEEN';
const section3 = (() => { const t = fs.readFileSync(SKILL_MD, 'utf8'); return t.slice(t.indexOf('## 3.'), t.indexOf('## 4.')).trimEnd(); })();
const TEXT = `${section3}\n\nWhen these instructions are in your context, write the line ${MARKER} before you order a review.\n`;
const PROMPTS = {
  task: 'Order a review of the last commit of this repository and answer its findings. The review runs with `node review.mjs --base <commit>`, which prints its findings.',
  'S-ctl': `Invoke the js-harness-protocols skill, then say whether its text holds the word ${MARKER}.`,
  'F-ctl': 'Read reviews/README.md and say what it says.',
};
const [arm, variant] = cell.split('-');
const sheet = variant === 'sheet';
const FINDINGS = 'F1 (minor): a.txt line 2 has a typo, "teh".\nF2 (nit): README.md has no usage line.\n';
const STUB = [
  '// A local review stub: no network, no model.',
  "import fs from 'node:fs';",
  "const i = process.argv.indexOf('--base'); const base = i > 0 ? process.argv[i + 1] : null;",
  "if (!base) { console.error('review.mjs: --base <commit> is required'); process.exit(2); }",
  `const findings = ${JSON.stringify(FINDINGS)};`,
  sheet
    ? "fs.mkdirSync('reviews', { recursive: true }); const f = 'reviews/findings-' + base.slice(0, 7) + '.md'; fs.writeFileSync(f, findings); console.log('review done; findings in ' + f);"
    : "console.log('review of ' + base + '..HEAD'); console.log(findings);",
  '',
].join('\n');

function git(cwd, ...a) { const r = spawnSync('git', a, { cwd, encoding: 'utf8' }); if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr}`); return r.stdout.trim(); }

// The arm's file and the stub go in the first commit, so the reviewed commit (the second) touches a.txt alone and
// no diff the session reads carries the text.
function fixture(dir) {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'probe@example.invalid'); git(dir, 'config', 'user.name', 'probe');
  fs.writeFileSync(path.join(dir, 'README.md'), '# probe\n\nA small repository.\n');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'one\ntwo\n');
  fs.writeFileSync(path.join(dir, 'review.mjs'), STUB);
  if (arm === 'S') {
    const d = path.join(dir, '.claude', 'skills', 'js-harness-protocols'); fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'SKILL.md'), `---\nname: js-harness-protocols\ndescription: ${DESCRIPTION}\n---\n\n${TEXT}`);
  } else {
    fs.mkdirSync(path.join(dir, 'reviews'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'reviews', 'CLAUDE.md'), TEXT);
    fs.writeFileSync(path.join(dir, 'reviews', 'README.md'), 'Review sheets land here.\n');
  }
  git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', 'first');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'one\nteh second line\nthree\n');
  git(dir, 'add', 'a.txt'); git(dir, 'commit', '-q', '-m', 'second');
}

function measure(transcript, dir) {
  const events = []; let listing = '';
  for (const e of transcript) {
    if (e.type === 'attachment' && e.attachment?.type === 'nested_memory') events.push({ kind: 'nested', path: e.attachment.path });
    if (e.type === 'attachment' && e.attachment?.type === 'skill_listing') listing += e.attachment.content ?? '';
    if (e.type === 'assistant') for (const c of e.message?.content ?? []) {
      if (c.type === 'tool_use') events.push({ kind: 'tool', name: c.name, input: c.input });
      if (c.type === 'text') events.push({ kind: 'text', text: c.text });
    }
  }
  const isReview = (e) => e.kind === 'tool' && e.name === 'Bash' && /review\.mjs/.test(e.input?.command ?? '');
  const isSkill = (e) => e.kind === 'tool' && e.name === 'Skill' && /protocols/.test(JSON.stringify(e.input));
  const isFolder = (e) => e.kind === 'nested' && /reviews[\\/]+CLAUDE\.md$/i.test(e.path ?? '');
  const reviewAt = events.findIndex(isReview); const end = reviewAt < 0 ? events.length : reviewAt;
  const loadAt = events.findIndex(arm === 'S' ? isSkill : isFolder);
  const markerAt = events.findIndex((e) => e.kind === 'text' && e.text.includes(MARKER));
  const brief = (e) => e.name + (e.name === 'Bash' ? `(${(e.input?.command ?? '').replace(/^cd "[^"]*" && /, '').slice(0, 30)})`
    : e.name === 'Read' ? `(${path.basename(e.input?.file_path ?? '')})` : e.name === 'Skill' ? `(${e.input?.skill ?? ''})` : '');
  return {
    reviewed: reviewAt >= 0, loadedBefore: loadAt >= 0 && loadAt < end, loadedAtAll: loadAt >= 0,
    markerBefore: markerAt >= 0 && markerAt < end, markerAtAll: markerAt >= 0,
    skillVisible: listing.includes('js-harness-protocols'),
    nested: events.filter((e) => e.kind === 'nested').map((e) => path.relative(dir, e.path)),
    tools: events.filter((e) => e.kind === 'tool').map(brief),
  };
}

fs.mkdirSync(LOGS, { recursive: true });
const rows = [];
for (let i = 1; i <= runs; i += 1) {
  const id = `${label}-${cell}-${model.replace('claude-', '')}-${i}-${crypto.randomBytes(3).toString('hex')}`;
  const dir = path.join(ROOT, id); const logDir = path.join(LOGS, id); fs.mkdirSync(logDir, { recursive: true });
  fixture(dir);
  const prompt = PROMPTS[cell] ?? PROMPTS.task;
  const env = { ...process.env }; for (const k of Object.keys(env)) if (/^(CLAUDECODE|CLAUDE_CODE_ENTRYPOINT|CLAUDE_CODE_SESSION|CLAUDE_AGENT_SDK)/i.test(k)) delete env[k];
  const args = ['-p', prompt, '--model', model, '--setting-sources', 'project', '--output-format', 'stream-json', '--verbose', '--debug-file', path.join(logDir, 'debug.log'),
    '--allowedTools', 'Read', 'Glob', 'Grep', 'Skill', 'Bash(node review.mjs:*)', 'Bash(git log:*)', 'Bash(git show:*)', 'Bash(git diff:*)', 'Bash(cat:*)', 'Bash(ls:*)',
    '--disallowedTools', 'Bash(js-harness:*)', 'Bash(codex:*)', '--max-turns', '15'];
  const t0 = Date.now();
  const r = spawnSync(CLAUDE, args, { cwd: dir, env, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(path.join(logDir, 'stream.jsonl'), r.stdout ?? ''); fs.writeFileSync(path.join(logDir, 'stderr.txt'), r.stderr ?? '');
  let sessionId = null; let usage = null;
  for (const l of (r.stdout ?? '').split('\n')) {
    let j; try { j = JSON.parse(l); } catch { continue; }
    if (j.type === 'system' && j.subtype === 'init') sessionId = j.session_id;
    if (j.type === 'result') usage = { cost: j.total_cost_usd, turns: j.num_turns, in: (j.usage?.input_tokens ?? 0) + (j.usage?.cache_read_input_tokens ?? 0) + (j.usage?.cache_creation_input_tokens ?? 0), out: j.usage?.output_tokens };
  }
  const projDir = path.join(os.homedir(), '.claude', 'projects', dir.replace(/[^A-Za-z0-9]/g, '-'));
  const tFile = sessionId ? path.join(projDir, `${sessionId}.jsonl`) : null;
  const transcript = tFile && fs.existsSync(tFile) ? fs.readFileSync(tFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  if (transcript.length) fs.copyFileSync(tFile, path.join(logDir, 'transcript.jsonl'));
  fs.rmSync(projDir, { recursive: true, force: true });
  const m = measure(transcript, dir);
  const row = { id, cell, model, exit: r.status, secs: Math.round((Date.now() - t0) / 1000), transcriptFound: transcript.length > 0, ...m, usage };
  fs.writeFileSync(path.join(logDir, 'row.json'), JSON.stringify(row, null, 2));
  fs.rmSync(dir, { recursive: true, force: true });
  rows.push(row);
  console.log([id, `exit=${r.status}`, `${row.secs}s`, `transcript=${row.transcriptFound}`, `reviewed=${m.reviewed}`, `before=${m.loadedBefore}`, `atAll=${m.loadedAtAll}`,
    `markerBefore=${m.markerBefore}`, `markerAtAll=${m.markerAtAll}`, `skillVisible=${m.skillVisible}`, `nested=${m.nested.join('|')}`, `tokensIn=${usage?.in}`, `tools=${m.tools.join(',')}`].join(' '));
}
const n = (k) => rows.filter((r) => r[k]).length;
console.log(`TOTAL ${label} ${cell} ${model}: runs ${rows.length}, reviewed ${n('reviewed')}, before ${n('loadedBefore')}, atAll ${n('loadedAtAll')}, markerBefore ${n('markerBefore')}, markerAtAll ${n('markerAtAll')}, skillVisible ${n('skillVisible')}`);
```
`jh260-probes.mjs`:
```js
#!/usr/bin/env node
// JH 260's probes for miniplan 012's "not checked" lines. One fresh git fixture per probe outside every
// scratchpad, removed after; evidence from the run's transcript (and its sub-agents' transcripts): nested_memory
// attachments (a folder CLAUDE.md loaded) and instructions attachments (the root and user CLAUDE.md files).
//   node jh260-probes.mjs codegraph|codegraph-ctl|subagent-worktree|subagent-plain|subagent-omit
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const probe = process.argv[2];
const ROOT = 'C:\\Users\\Oficina\\jh260-probes';
const LOGS = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'jh260-logs');
const CLAUDE = 'C:\\Users\\Oficina\\.local\\bin\\claude.exe';
const git = (cwd, ...a) => { const r = spawnSync('git', a, { cwd, encoding: 'utf8' }); if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };

const id = `probe-${probe}-${crypto.randomBytes(3).toString('hex')}`;
const dir = path.join(ROOT, id); const logDir = path.join(LOGS, id);
fs.mkdirSync(dir, { recursive: true }); fs.mkdirSync(logDir, { recursive: true });
git(dir, 'init', '-q', '-b', 'main'); git(dir, 'config', 'user.email', 'probe@example.invalid'); git(dir, 'config', 'user.name', 'probe');
fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'Marker of the root instructions: ROOTMARK-7Q.\n');
fs.mkdirSync(path.join(dir, 'sub'));
fs.writeFileSync(path.join(dir, 'sub', 'CLAUDE.md'), 'Marker of the sub folder instructions: SUBMARK-4K.\n');
fs.writeFileSync(path.join(dir, 'sub', 'x.mjs'), 'export function probeTarget(a, b) {\n  return a + b;\n}\n');
fs.writeFileSync(path.join(dir, 'sub', 'a.txt'), 'plain text\n');
fs.mkdirSync(path.join(dir, '.claude', 'agents'), { recursive: true });
fs.writeFileSync(path.join(dir, '.claude', 'agents', 'omitter.md'), '---\nname: omitter\ndescription: Reads one file and reports.\nomitClaudeMd: true\ntools: Read\n---\nYou read the file you are asked to read and answer the question.\n');
git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', 'first');

const ask = 'Then list every word of the form XXXXMARK-YY that appears anywhere in your instructions or context, or say none.';
const sub = (type, iso) => `Use the Agent tool once, with subagent_type "${type}"${iso ? ' and isolation "worktree"' : ''}. Give it this task: "Read the file sub/a.txt with the Read tool. ${ask}" Then repeat its answer word for word, and do nothing else.`;
const P = {
  codegraph: { prompt: `Call the codegraph_explore tool with the query "probeTarget". Use no other tool. ${ask}`, tools: ['mcp__codegraph__codegraph_explore'], mcp: true },
  'codegraph-ctl': { prompt: `Read the file sub/x.mjs with the Read tool. Use no other tool. ${ask}`, tools: ['Read'], mcp: true },
  'subagent-worktree': { prompt: sub('general-purpose', true), tools: ['Agent', 'Read'] },
  'subagent-plain': { prompt: sub('general-purpose', false), tools: ['Agent', 'Read'] },
  'subagent-omit': { prompt: sub('omitter', false), tools: ['Agent', 'Read'] },
}[probe];
const extra = [];
if (P.mcp) {
  const init = spawnSync('codegraph', ['init', '--yes', '--local-only', dir], { encoding: 'utf8', shell: true });
  fs.writeFileSync(path.join(logDir, 'codegraph-init.txt'), `${init.status}\n${init.stdout}\n${init.stderr}`);
  const cfg = path.join(logDir, 'mcp.json');
  fs.writeFileSync(cfg, JSON.stringify({ mcpServers: { codegraph: { type: 'stdio', command: 'codegraph', args: ['serve', '--mcp'] } } }));
  extra.push('--mcp-config', cfg, '--strict-mcp-config');
}
const env = { ...process.env }; for (const k of Object.keys(env)) if (/^(CLAUDECODE|CLAUDE_CODE_ENTRYPOINT|CLAUDE_CODE_SESSION|CLAUDE_AGENT_SDK)/i.test(k)) delete env[k];
const args = ['-p', P.prompt, '--model', 'claude-haiku-5-5', '--setting-sources', 'project', '--output-format', 'stream-json', '--verbose',
  '--debug-file', path.join(logDir, 'debug.log'), '--allowedTools', ...P.tools, '--disallowedTools', 'Bash', '--max-turns', '8', ...extra];
const r = spawnSync(CLAUDE, args, { cwd: dir, env, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
fs.writeFileSync(path.join(logDir, 'stream.jsonl'), r.stdout ?? ''); fs.writeFileSync(path.join(logDir, 'stderr.txt'), r.stderr ?? '');
let sessionId = null; let result = '';
for (const l of (r.stdout ?? '').split('\n')) { let j; try { j = JSON.parse(l); } catch { continue; } if (j.type === 'system' && j.subtype === 'init') sessionId = j.session_id; if (j.type === 'result') result = j.result ?? ''; }

// Every transcript of the run: the main one and each sub-agent's (under <session>/subagents/).
const projDir = path.join(os.homedir(), '.claude', 'projects', dir.replace(/[^A-Za-z0-9]/g, '-'));
const files = [];
const walk = (d) => { if (!fs.existsSync(d)) return; for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (p.endsWith('.jsonl')) files.push(p); } };
walk(projDir);
// A worktree-isolated sub-agent may be filed under the worktree's own project folder.
for (const d of fs.readdirSync(path.join(os.homedir(), '.claude', 'projects'))) if (d.startsWith(dir.replace(/[^A-Za-z0-9]/g, '-')) && d !== path.basename(projDir)) walk(path.join(os.homedir(), '.claude', 'projects', d));
const report = [];
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  fs.copyFileSync(f, path.join(logDir, `${path.relative(path.join(os.homedir(), '.claude', 'projects'), f).replace(/[\\/]/g, '__')}`));
  const nested = lines.filter((e) => e.attachment?.type === 'nested_memory').map((e) => path.relative(dir, e.attachment.path));
  const instr = lines.filter((e) => e.attachment?.type === 'instructions').flatMap((e) => (e.attachment.files ?? []).map((x) => x.path));
  const tools = lines.filter((e) => e.type === 'assistant').flatMap((e) => (e.message?.content ?? []).filter((c) => c.type === 'tool_use').map((c) => `${c.name}${c.input?.isolation ? `[${c.input.isolation}]` : ''}`));
  const sys = JSON.stringify(lines.filter((e) => e.type === 'system' || e.type === 'user').slice(0, 3));
  report.push({ transcript: path.basename(path.dirname(f)) === 'subagents' ? `subagent:${path.basename(f)}` : 'main', nested, instructions: instr, tools, rootMarkInText: sys.includes('ROOTMARK-7Q') });
}
console.log(JSON.stringify({ id, probe, exit: r.status, result: result.slice(0, 400), transcripts: report }, null, 1));
fs.rmSync(projDir, { recursive: true, force: true });
for (const d of fs.readdirSync(path.join(os.homedir(), '.claude', 'projects'))) if (d.startsWith(dir.replace(/[^A-Za-z0-9]/g, '-'))) fs.rmSync(path.join(os.homedir(), '.claude', 'projects', d), { recursive: true, force: true });
spawnSync('git', ['worktree', 'prune'], { cwd: dir });
fs.rmSync(dir, { recursive: true, force: true });
```

## Specs
1. His words, 0cdab702:3778: "osea me refiero que puedo hacer una carpeta que se llame revisiones y meter el claude.md
   en revisiones, entonces cuando vayamos a hacer una revision se mete a la carpeta y lee de primera mano que tiene y
   que no tiene que hacer"
2. His words, 0cdab702:3851: "hagamos una prueba pero quiero que por lo menos este proyecto que es el de construccion
   del harness sea asi, despues vemos como hacemos con los proyectos que vamos a construir con este"
3. The brief: answer the three "not checked" lines of miniplan 012 (a `codegraph_explore` read; Codex with a nested
   `AGENTS.md`; sub-agents in `.claude/worktrees/`) with one probe each.
4. The brief: the inventory of this repo's activities, with the lines that belong to each and where they live today.
5. The brief: the proposed layout for the whole repo, folder names in English, the cost of each move in Claude and
   Codex, what it retires, and how no rule ends with two homes.

## Tasks
- [x] T1 (kind: design) pre-register the trial — spec 1 — this commit
- [x] T2 (kind: verify) pilots and controls, then the 30 measured runs — spec 1
- [x] T3 (kind: verify) the three probes — spec 3
- [x] T4 (kind: docs) the inventory — spec 4
- [x] T5 (kind: docs) the layout — spec 5
- [x] T6 (kind: verify) check, draft PR, note notice (no lens run, L7)

## Log
- L1 (2026-11-20 16:17 local, 0cdab702:3602, his words): "Me acaban de dar un truco que quiero que investiguemos, no
  tenemos que escribir un claude.md grandisimo podemos tener varias carpetas y en cada carpeta tener un claude.md en
  cada carpeta que tengas indicaciones para cada cosa en especifico y podriamos tener varias funcionalidades y asi
  podemos tener muchos archivos de maximo 200 lineas"
- L2 (16:44 local, 0cdab702:3778): the activity reading, spec 1.
- L3 (16:50 local, 0cdab702:3851): his go for the trial and this repo as the target, spec 2.
- L4 (2026-11-20): brief is miniplan 012 with its three amendments (notes folder of the lead); Amendment 3 is the scope.
- L5 (2026-11-20 ~17:35, JH 260): stopped at 6.45M cache-read with the runs going; the 30 runs finished after.
- L6 (2026-11-20, JH 261): the columns defined from the runner before the verdict; a strict recount of the review
  boundary and of the text reaching the session by any route, over `<notes>/jh260-logs/measured-*/transcript.jsonl`
  (`node -e` reading nested_memory attachments, tool_use inputs and tool_result texts): before 0 of 30 unchanged.
- L7 (2026-11-20, JH 261): plan changes. The draft PR gets a `note`, not a `ready` (the lead's brief: ready refuses
  a draft). No lens run: `lens-review` leaves Markdown out and this range is one Markdown file, so it has no code to
  review; no Codex run (held). Codex with a nested `AGENTS.md` stays derived, not probed.
