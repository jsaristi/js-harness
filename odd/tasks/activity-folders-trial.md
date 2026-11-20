# JH 260 · instructions by activity folder, the trial

Locator: `odd/tasks/activity-folders-trial.md` · Engram mirror: `odd/activity-folders-trial/tasks` · Branch: `claude/jh260-activity-folders-trial-d6a5d4`
Delivery: one draft pull request to main, documents only · Test runner: `node --test`

## State
Design pre-registered (this commit); the trial runs next, then the inventory (b) and the layout (c).

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
- a draft pull request is open with its lens record and the lead has its `ready` notice

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
- [ ] T2 (kind: verify) pilots and controls, then the 30 measured runs — spec 1
- [ ] T3 (kind: verify) the three probes — spec 3
- [ ] T4 (kind: docs) the inventory — spec 4
- [ ] T5 (kind: docs) the layout — spec 5
- [ ] T6 (kind: verify) check, lens record, draft PR, ready notice

## Log
- L1 (2026-11-20 16:17 local, 0cdab702:3602, his words): "Me acaban de dar un truco que quiero que investiguemos, no
  tenemos que escribir un claude.md grandisimo podemos tener varias carpetas y en cada carpeta tener un claude.md en
  cada carpeta que tengas indicaciones para cada cosa en especifico y podriamos tener varias funcionalidades y asi
  podemos tener muchos archivos de maximo 200 lineas"
- L2 (16:44 local, 0cdab702:3778): the activity reading, spec 1.
- L3 (16:50 local, 0cdab702:3851): his go for the trial and this repo as the target, spec 2.
- L4 (2026-11-20): brief is miniplan 012 with its three amendments (notes folder of the lead); Amendment 3 is the scope.
