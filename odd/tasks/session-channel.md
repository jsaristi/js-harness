# Session channel

Locator: `odd/tasks/session-channel.md` · Engram mirror: `odd/session-channel/tasks` · Designed
on branch `docs/channel-and-rules-design` by the session `JH 4 · diseño canal y reglas`
(2026-10-10), together with `odd/tasks/rule-hierarchy.md`. Nothing is built here: the feature is
built later, in a session of its own, on a branch of its own, once `feat/gate-lock` is merged
(it changes `bin/sessions.mjs` and `bin/lib/sessions.mjs`, which this feature changes too).

Built from 2026-10-11 by the session `JH 5 · canal entre sesiones`, which owns this document
from then on (tasks, Progress, Next step). Worktree `D:\js-harness-worktrees\session-channel`,
one branch per slice, each cut from `origin/main`; the first is `feat/session-roster`.

## Goal
The sessions of a project tell each other, and tell Sebastián, what happened through a channel
that is recorded, addressed to a role and read with a command — so that he carries no text
between sessions, nothing goes to a session that is no longer the one for it, and a session he
opens starts at once.

## Why
On 2026-10-10, with an orchestrator and up to four work sessions, the channel was the app's
messages and his hands. What the day showed, each in the orchestrator's relief file:

- A finished feature sat undelivered for six hours, because a session opened from the phone runs
  in another permission mode and the app holds messages between the two (lines 58 to 61, 143).
- A notice reached a relieved orchestrator, because it was sent to the reply address of an
  earlier message, which belongs to a session, and not to the title, which belongs to the role
  (line 78).
- An opening pasted with no line of his was not taken as his assignment, twice, the second time
  after 28 minutes of waiting (lines 129 and 175; the second is this design session's own
  opening).
- The orchestrator was relieved more than once in the day, at 65%, 71% and about 85% of its
  context (`odd/tasks/session-board.md`, the gaps judged on 2026-10-10; relief file, line 164),
  and sessions proposed a cut near 70% because of a mark that limits nothing (lines 124 to
  127). The roadmap names "relieved more than once in a working day" as the measure that would
  reopen "one session, the orchestrator is the lead". It tripped; this design does not reopen
  that decision and lists it under "Ask me before" as his.
- Hours were written from a guess, and "no gate runs" was said while one ran (lines 122, 172).

His words that day ask for one thing under several forms: a place, always current, that says
which sessions are alive and what each is for (line 78); to be asked only what is his (line 124);
sessions that work without stopping (line 151); and every failure learned, with the proof that it
does not return (lines 143 and 145).

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/session-channel.md` exits 0
- `node --test bin/lib/channel.test.mjs` exits 0
- `node --test bin/notify.test.mjs` exits 0
- `node --test bin/sessions.test.mjs` exits 0
- `node --test scripts/practice-lib.test.mjs` exits 0
- The practice journey, with this feature's step in it, passes on the machine that builds it
  (here `node scripts/practice.mjs run --root D:\js-harness-practice`), and its record line is
  quoted in Progress. The folder is one machine's, so this is read, not a command of the
  contract.
- One real stretch on this machine, recorded in Progress: an orchestrator and two work sessions,
  one of them opened from the phone, in which he pastes no text between sessions and every
  notice is on the board.

## In scope / Out of scope
- In: new `bin/notify.mjs` and `bin/lib/channel.mjs`; `bin/sessions.mjs` and
  `bin/lib/sessions.mjs` (the roster, the channel section, the measures, what the reader takes
  from a transcript, the context figure); `bin/js-harness.mjs` (dispatcher); the orchestrator
  skill and one hook entry in `bin/lib/manifest.mjs`; a row in `bin/lib/stack.mjs`; a step in
  `scripts/practice*.mjs`; `docs/ROADMAP.md`; and the two sentences of `AGENTS.md` about the
  resume prompt of a cut, which become false the day T6 lands. The test files the contract
  names (`bin/lib/channel.test.mjs`, `bin/notify.test.mjs`) do not exist yet: the build creates
  them, and adds to "Done when" the test of each command it ships (`--address`, `--quote`,
  `--measures`, the resume hook, the row `session-classes`).
- Out: how a reply closes and the rest of "Working with Sebastián" — `odd/tasks/rule-hierarchy.md`
  owns the rewrite of `AGENTS.md` and the reply check. The gate lock and the gate log — `feat/gate-lock`. A
  second machine and several accounts — kept for later by him (roadmap, item 5 of the order).
  Opening a session from a session — only its two tests are owed here.

## Constraints
- The record is a file and the app's message is only the doorbell — because a message can be
  held, expire or reach a session that left, and none of that can be read afterwards; a file
  can be read by the board, by Codex and by a session in any permission mode.
- A notice is a claim, never his word — because he decided it (2026-10-09), and because the host
  itself tells a session that a message from another session never approves anything.
- Nothing asks an agent to remember to write: every line of the record is appended by a command
  that stamps the clock — because hours were guessed on 2026-10-10 (relief file, line 172).
- The channel never becomes the way gates take turns — because a lock holds when nobody is
  listening (roadmap, point 5).
- Each notice is one line and there are few kinds — because each one costs the receiver a turn.
- Zero dependencies, fixture-based tests, and what is written under the home folder is recorded
  in the manifest and removed by `uninstall`.

## Effort
high

## Ask me before
How the two permission classes meet on his machine was asked and answered on 2026-10-11: A
("Permission classes" below); the setting is a security setting, his alone, changed by him at
the computer. Whether `install` may write that setting for him on an explicit flag (a product
choice, and a change on a machine). Installing the resume hook on this machine. Whether notices are also pushed into a work session by a hook (option C below; it has
the same exposure as A). Archiving or deleting any session. Any change to the charter.

Three things already put to him and not answered, which this document does not settle:
- Whether the roster is built ahead of the rest of the channel, as a slice of its own (relief
  file, line 78). "Delivery" below keeps both orders possible. Not answered by him in his own
  words. On 2026-10-11 the lead read his words of line 78 as "the roster first", told him so
  in its chat and in the opening of the build session, and the build follows that reading: it
  is the lead's, and his to correct.
- Whether "one session, the orchestrator is the lead" is reopened, now that its measure tripped
  (see "Why").
- Tests 1, 2, 3 and 6 of "Tests owed" need him at the app, and test 2 creates a scheduled task
  on his machine: each is asked before it is run.

## TDD
Mode: strict (source: user global config). Runner: `node --test`. The transcript reader is
tested with fixture transcripts, as today. The skill is passive text: its test is that the
installed copy equals the source, which exists.

## Delivery
Forecast: about 1,600 to 2,000 authored lines over five slices, each its own pull request
against `main`, merged in order (`stacked-to-main`). Slices: 1 = T1 and T2; 2 = T3 and T4;
3 = T5 and T6; 4 = T7 to T9; 5 = T10 to T12. If he chooses the roster first, slice 2 is built
before slice 1: T3 and the roster of T4 read only transcripts and need nothing of T1; the
roster then shows role, purpose and last activity, and gains "opened, closed, relieved" when
the record exists.

Order taken on 2026-10-11 (the lead's reading of line 78, his to correct): the roster first.
The first pull request, branch `feat/session-roster`, holds T3, the roster of T4 and
`sessions --address`, which the proposal put to him at line 78 names with the roster (a
message goes to a role, and a command prints its current address) and which needs only titles.
The second holds T1 and T2. The rest of T4 (the channel section, `--opening`, `--quote`, the
watch that wakes on a notice, failures 7 and 8) needs the record and follows T1, in a pull
request of its own before T5. Strategy: `stacked-to-main`, as above; Codex within 3 million
input tokens for the feature.

## Design

### What exists to build on (surveyed on 2026-10-10)
- The board reads every transcript of the project (`bin/lib/sessions.mjs:106-137`, `:212-262`)
  and computes state, context, open background work, worktrees, gates and pull requests. It
  prints the last five lines of the relief file and never writes it (`bin/sessions.mjs:245-251`).
- A transcript already holds what the channel needs and the reader does not take yet (key tally
  of two transcripts, no text read): a `user` entry carries `origin.kind` (a person, a peer
  session, a task notification), and for a peer the sender's name, session and permission mode
  and a message id; an outgoing `SendMessage` carries its `to` and the id returned; `user`
  entries carry `permissionMode`; a `custom-title` entry carries the title.
- Two defects follow from the reader ignoring `origin`: a message from another session counts as
  a prompt, so the session reads as working (`bin/lib/sessions.mjs:118`), and it can become the
  session's fallback title (`:92`).
  Corrected by the build on 2026-10-11, from a tally of keys and enum values over 48 real
  transcripts (T3; no message text read into the repository): both claims are false. A message
  from another session is a `user` entry with `isMeta: true` (185 of 185) and `origin.kind:
  "peer"`, and the reader already skipped meta entries, so it never counted as his prompt and
  never became a title. The defect that did exist is the opposite one: such a message starts a
  turn (a reply follows every one; median 9 s, longest 99 s) and the session read as `waiting`
  during it. Three shapes of a peer entry exist: another session (168: `name`, `fromSession`
  as `local_<uuid>`, `fromMode`, `msg_id`, sometimes `hopChain`), a sub-agent handing back (15:
  `handback`, `senderTaskId`) and one the host injects (2: `hostInjected`). An outgoing
  `SendMessage` carries `to` and `recipient_kind` (`name`, `session`, `agent`, or absent on
  older hosts); a send to a session returns `msg_id`, one to a sub-agent returns `pin`.
  `permissionMode` on `user` entries was `bypassPermissions` or `auto`; `fromMode` only ever
  `bypass`. Nothing in a transcript names its own app session: that id appears only as
  `fromSession` in the transcripts of the sessions it wrote to.
- `install` writes one `SessionStart` entry per host, matcher `startup|resume`
  (`bin/lib/manifest.mjs:128-150`); a second entry is one more item and `uninstall` removes it.
- `appendJsonLine` and `readJsonLines` write and read a `.jsonl` record
  (`bin/lib/codex-reviews.mjs:60-93`), but their folder is the repository's git folder and
  there is none outside a repository (`jsonLinesPath`, `:30-33`, pointed out by the review of
  this document), so the channel takes their shape and writes under the home folder with a
  writer of its own.
- The hosts (official documentation, read by a sub-agent on 2026-10-10, each a claim to confirm
  before it is built on): Claude Code addresses a message by the session's name; hooks receive
  `session_title`; `SessionStart` has the matcher `compact` on both hosts; the `Stop` hook's
  input carries `background_tasks`; `claude --name` with an initial prompt opens an interactive
  session; `crossSessionInbound` takes `accept`, `hold` or `refuse` and a held message expires
  after five minutes by default; Codex has hooks and no messages between sessions. Not
  documented: whether a name stops resolving after a rename, and whether a held message is
  reported to its sender.

### 1. Names (decided, 2026-10-09)
`<project code> <role> · <what it does>`: `JH ORQ · js-harness`, `JH 1 · …`, numbered in the
order they open, never reused. The title is the address of the role. New here: the roster parses
the role and the number from the title, so a title that does not follow the shape is a line of
the board.

### 2. The record
One file per project on the machine, beside the relief file: `<home>/.js-harness/channel/<slug>.jsonl`.
It is written only by a command:

`js-harness notify --to <role> --kind <kind> "<one line>"`

It appends one line: the time read from the clock, the sender (the session id the host gives,
its title, its permission mode when known), the role it is for, the kind and the text. Kinds:
`opened` (feature, worktree, branch), `waiting` (on what, and whose it is), `closed` (what was
delivered, and that nothing more goes to the sender), `note` (from the orchestrator: only what
the receiver cannot see), `answer` (his words given in the orchestrator's chat, with the
transcript and the line), `relieved` (who has the role now). It prints the current address of
the role, so the sender can ring it.

The orchestrator needs no message to receive a notice: its `sessions --watch` returns when a
line addressed to its role appears. So a notice from a phone-opened session, from Codex, or
from a session whose message would be held reaches the orchestrator the same way, and failure 5
of the day (six hours undelivered) has no path left.

The relief file stays the orchestrator's own log, in prose. It gains the same writer:
`js-harness notify --relief "<line>"` appends to it with the clock, so no hour is written from
memory.

Judged twice: in a project that only uses the harness the record ships with the board, and it is
the only channel a Codex session has.

As built (T1, 2026-10-11). A line of the record:
`{"schema":"js-harness.channel-notice/v1","at":"<clock, ISO>","from":{"host","id","source","title","permissionMode"},"to":{"role","number"},"kind","text","cwd","worktree","branch"}`;
an `answer` adds `transcript` and `line`, which the command requires for that kind and refuses
for the others. The folder, the worktree and the branch are read by the command, not written by
the agent, so `opened` carries the real worktree the roster cannot see. The text is one line of
500 characters at most (a relief line 6,000, an opening's title 120 and its text 100,000); a
text that begins with `--` goes after a lone `--`. Each notice is one write on a file opened for
appending (tested with four processes writing at once). The exit is 0 once the notice is
recorded, with an address or without one; 2 for a usage error, with nothing written. An opening
is one JSON file per title under `openings/<project>/`, named from the title's letters and a
hash of it; the library finds it by the exact title or by `<code> <role>`. `uninstall` removes
the channel's folder as it does the gate lock's and says so, or fails when it cannot; it does
not remove the relief file, which predates this feature. Two limits: a Codex session has no id
this repository reads, so its notice records `host: "unknown"` and no sender (whether Codex
gives its commands a session id is not verified); and a sender whose transcript carries no
title records none (see point 4).

### 3. The doorbell, and a role as the address
`SendMessage` stays what wakes an idle session: after `notify`, the sender sends the same line
to the title `notify` printed. Three rules, each a count on the board instead of a sentence:

- A message goes to the title of a role, never to the `from` of an earlier message. `js-harness
  sessions --address <role>` prints the title of the one session that holds the role and exits
  0; it exits 1 when none holds it and 2 when more than one does, printing each. It never
  counts the session that runs it, so the answer is always about the others.
  As built (2026-10-11): the role is `orchestrator` (or `ORQ`) or a work session's number. A
  session holds a role only when its last timed entry is inside the board's window; the file's
  date is not enough, since the app appends untimed entries to old transcripts. Exit 1 means
  that none holds it and every transcript of the window was read; when none is found and one
  could not be read, the answer is not known and the exit is 2. So 2 is "no clean answer":
  several holders, cannot tell, or a usage error, and only 0 gives an address.
- A send that is held or fails is not retried: the record already holds the notice.
- A relieved or finished session that receives a message answers with one line saying who has
  the role now.

### 4. The roster
A section of the board, computed at each read and stored nowhere: every session of the project
with its role and number (from the title), what it is for (the text after the dot), its feature
and worktree (from the folder and branch of its entries), its permission mode, its last
activity, and its place in the record: opened, waiting, closed, relieved by whom. One app
session that owns several transcripts (relief file, line 148) is one row, keyed by title.

What it cannot know, said on its last line: whether a silent session is alive or archived. No
command outside a session lists the app's sessions (not documented), so a session with no
`closed` or `relieved` line is shown as "silent since" its last entry, never as alive. This
replaces the roster the orchestrators rewrote by hand as a line of the relief file.

Two limits found by the build (2026-10-11), both printed on the section's last line. A row is
keyed by its title because a transcript does not name its app session: a session the app
restarted continues in a new file under the same title (seen: one ended and the next began 26 s
later), so two live sessions under one identical title are one row, and `--address` does not
see them as two. The record closes this, since a notice carries the sender's session id (T1,
T4b); a rule on transcripts that overlap in time was considered and not built, because a
resumed session may copy old entries into a new file. And the folder a row shows is the one its
entries record: a session that works in a worktree by changing directory still records the main
checkout, so the real worktree and branch come with the `opened` notice.

A third limit, found on 2026-10-11 while running test owed 4: the transcript of a session
opened from the phone carries no title at all (`rg -c '"type":"custom-title"'` on `213bd4ec`
and `4454b298`, both of permission mode `auto` and entry point `sdk-cli`: 0 and 0; the search
would have matched the entry the desktop sessions' titles are read from). Its title lives in
the app only. So such a session is a row with no role, and a notice it writes has no sender's
title. Plan, for T4b: the command by which a session reads its opening (`sessions --opening`)
appends to the record which session id read which title, so the roster and `notify` take the
title from the record when the transcript has none; nothing asks the session to state it.
Whether a phone-opened session has `CLAUDE_CODE_SESSION_ID` in its environment is part of
test owed 1, which needs him.

### 5. One orchestrator, checked
`sessions --address orchestrator` is the check: a session that starts as orchestrator runs it
first. Exit 1 (no other session holds the role) lets it start; exit 0 or 2 (another one does)
makes it refuse, unless it was opened as that one's relief, which the opening says. A work
session reads the same command the other way: only exit 0 gives it an address. The board prints
a line when two sessions carry the orchestrator's title. Only the exact title `<code> ORQ ·
<project>` holds the role: `ORQ nueva` and `ORQ relevada` are other titles on purpose, so a
handover never reads as two orchestrators and notices keep reaching the one that still holds
the title. The handover of the title, done more than once on 2026-10-10
and written nowhere but the relief file, becomes four steps of the skill: the new one opens as
`<code> ORQ nueva`; it reads the record, the relief file and the board, and asks the one before
by message only what the files do not hold; on its "ready" the one before renames itself
`<code> ORQ relevada` and renames the new one in the same step, then appends `relieved`; he
archives the one before only after the board shows one orchestrator.

### 6. Opening a session
A session he opens starts at once, and its opening is on disk. The orchestrator writes the
opening to a file with `js-harness notify --opening "<title>"` (text on standard input, stored
under `<home>/.js-harness/channel/openings/`), and gives him one short line to send in the new
session:

`Sos "JH 5 · <qué hace>": corré js-harness sessions --opening "JH 5" y seguí lo que imprime.`

That line is his word, and it asks for the file to be followed, which is what the host requires
of pasted or read text. The opening survives a compaction, since it is a file, and the resume
hook below points back to it.

Assumed, and the first thing the build tests: a line that short, pasted from the phone or the
desktop, reaches the session as typed text and not wrapped as pasted content. If it is wrapped,
the line is typed by hand, and it is short enough for that.

Two ways for the orchestrator to open a session by itself are tests owed, not designed: a
scheduled task with no schedule (seen to start, take a title and receive a message; not tried:
whether he can type in its chat and whether it can commit), and `claude --name "<title>"
"<line>"` started from a command (documented; whether such a session appears in the desktop
app is not known). Until one passes, opening a session stays one line of his.

### 7. His words, when they travel
His decision of 2026-10-10 (relief file, line 149): an answer he gives in the orchestrator's
chat travels to the session that asked, with his exact words and the place where that session
reads them in the orchestrator's transcript. Two things make it a check:

- `js-harness sessions --quote <transcript> <line>` prints the entry only when it is a `user`
  entry whose origin is a person, with its time; it exits 1 for a peer message, a task
  notification or an assistant entry, and warns when the entry is only pasted content. The
  receiving session runs it before it uses the words.
- The notice of kind `answer` is in the record, so the board lists the answers that travelled
  and whether the receiver quoted the line.

A limit found in this session, to state plainly. A travelling answer carries information and a
choice among options already put to him; it does not approve a pending question in a session
whose host tells it that a message from another session never approves anything. On 2026-10-10
the orchestrator carried his words to this session with their lines (406 and 449 of its
transcript `1d16beeb`, both `user` entries of origin `human`, read by this session afterwards)
and the session still waited for a word typed in its own chat. So the protocol does
not replace the fix of point 6: what removes the question is an opening that carries his line.
And a question that was not his to answer should not have been asked: that is the reply check
of `odd/tasks/rule-hierarchy.md` (C1).

### 8. How he is told
For the orchestrator's replies (decided, 2026-10-09): what needs him and where, or nothing; then
what runs alone; then what was done; in everyday Rioplatense Spanish, a technical word explained
the first time it appears. A wake with no news is one line. New here: a reply no longer ends
with a prompt for another session; it says what was recorded and sent and whether it arrived.
Two texts for him to carry remain, and the reply check of the rule hierarchy knows both (its
C1, "a carry block"): the one line that opens a session (point 6), and a notice for a session
that neither the record nor a message can reach. Each sits under the three labels, names the
other session under "where it goes", and says there that he types a line of his own with it.

### 9. Context
His rule of 2026-10-10 (relief file, lines 126 and 127): no session stops, slows or proposes a
cut for a percentage. At 85% it pauses, writes its state in its feature document (done, in
flight, next step), and judges: little left, it finishes well; much left, the compaction is done
there and the same task continues after it, from the document. What makes the rule act:

- The board states the limit as room left before the host's compaction against what the
  session's last task cost, not as a share of the window; the 73% mark leaves
  (`bin/lib/sessions.mjs:13-21`). The window the board assumes (480,000) and the one the app
  reports (500,000, compacting near 467,000) become one figure, read where it can be.
- A `SessionStart` hook with the matcher `compact`, on both hosts: it prints the session's
  title, its opening file, its feature document and the instruction to read "Next step" and to
  repeat any open question. He then pastes no resume prompt, and a cut is the bare `/compact`.
  Like every hook the harness installs, it acts only in a project that opted in (a
  `harness.json` at its root) and prints nothing elsewhere.
- The nudge at 85% rides on the reply check of the rule hierarchy (its `Stop` hook reads the
  transcript the board reads). Until that feature ships, the board flags it and the orchestrator
  tells the session once, as today.
- The orchestrator is relieved, not compacted; its own row is in the roster like any other.

Proofs: the count of cuts proposed under 85% is zero; no task is reopened because a cut lost
what it needed.

### 10. Permission classes
Claude Code delivers a message only between sessions of the same class, unless
`crossSessionInbound` says otherwise; his desktop sessions bypass permission prompts and a
session opened from the phone runs in `auto`. With the record, this no longer loses a notice to
the orchestrator. What it still costs: an idle session of the other class cannot be woken by the
orchestrator, so a notice for it waits until its next turn or his paste. The three ways, his to
choose:

- A. He sets `crossSessionInbound` to `accept` in his user settings. Every message arrives. Its
  cost: on the whole machine a session that asks for permissions can put text into one that
  does not, without his approval; a message still approves nothing and changes no setting.
- B. The desktop sessions move to `auto`, so both roads are one class. Its cost: the desktop
  sessions stop bypassing prompts, which is the roadmap's open decision 2.
- C. Built here on his word only: a hook hands a work session the notices addressed to it when
  its turn ends. It works across hosts and classes, and its exposure is the one of A, moved
  into the harness.

Recommended: A, as the orchestrator recommended when it put the choice to him (relief file,
line 61); C is not built unless he asks.

Decided by Sebastián on 2026-10-11, in the design session's chat, his words: "Entonces la A
pero quiero que sea lo mas automatico posible". So it is A, and C and B are not taken. The
reading of the second half, his to correct: the need is that he does nothing by hand that a
program can do, and that what stays by hand is done once and is said to him plainly. What it
changes in this design:

- The setting is one step, once, and the harness says which. `doctor` gains a row
  `session-classes`: it reads the permission mode of the project's recent sessions and the
  setting, and when the classes differ and nothing joins them it reports the gap with the
  exact fix. Since `install` already writes a `SessionStart` entry that shows a new gap, he is
  told at the next session he opens, not by an agent that remembers.
- Proposed, his to decide when it is built: `install` writes the setting for him on an
  explicit flag, recorded in the manifest and removed by `uninstall`, as it does for its hook
  entries. Without the flag the harness never writes a security setting. No agent writes it
  either: the design session did not, and told him the steps.
- Everything else in the channel is already designed to need no hands: a notice is written and
  read by commands, the watch wakes the orchestrator, the resume after a compaction is a hook.
  What still needs him after this feature, as a list the build keeps honest: the setting, once;
  one short line to open a session, until one of the two automatic openings passes its test
  (tests 2 and 3); and the six kinds of decision that are his.

In a project that only uses the harness this is the first thing a second device meets, so the
row ships.

### 11. The orchestrator skill, rewritten
The installed skill describes a watchman; he decided a lead (2026-10-09) and changed its charter
(2026-10-10). The rewrite, within about the size it has today, carries:

- The lead: for every request, the need behind his words, where it falls in the map, the
  proposal, then the record. Before an opening, four answers in writing (does it touch what
  another touches; does it need something unfinished; is it better joined with another; is there
  room). When a session closes or starts waiting, the next one proposed. Doubts kept in the
  relief file and asked one at a time.
- The charter. Alone, told afterwards: the next feature within the order, up to three work
  sessions; plan steps and notices; pushes and pull requests once the gate and both reviews are
  green; the merge of a pull request, documents or code, when the gate passed, both reviews are
  recorded with nothing blocking and it is clean; the go-ahead of a later stage inside a plan he
  approved; a Codex review within the cost its plan prints, up to 3 million input tokens for a
  feature unless he raised it for that feature (6.5 million for the gate lock, 2026-10-10);
  compaction left to the host, with the feature document as the record. This paragraph is the
  charter of 2026-10-09 with his change of 2026-10-10 and nothing else: what it does not
  repeat stands as the roadmap and the relief file have it. His, asked one at a time: spend
  outside the plan; anything installed or changed on a machine; a product choice; what cannot be
  undone; a change of the plan or of its order; a new protocol. Before it calls something his,
  it names which of the six.
- It still never implements, never commits in a worktree and never answers for him; it writes
  the relief file and notices, through the command.
- The handover of point 5, and the questions to the one before.
- A work session: its three notices; it settles its plan with him before building; it writes a
  plan change in its document before going on; it reports each mistake in five parts; a wait it
  hands to a session that cannot be reached names a process that ends.
- What leaves the skill, because a check does it: reading `Gates` before a commit (the lock),
  the 73% limit (point 9), "say whose prompt it is" (no prompts for other sessions).

A sensor for the second entry-gate question, on the board: the files two branches both changed.

### 12. Measures
His words of 2026-10-10: review what is measured and what is missing, to improve from numbers.
Each measure answers a decision, is computed from what already exists, and asks no agent to
write anything. `js-harness sessions --measures` prints them over a window.

| Measure | The decision it answers | Read from |
|---|---|---|
| Notices recorded, rung, held, carried by his paste, sent to no role | whether the channel works without him | the record; `SendMessage` and peer entries of the transcripts |
| A bare yes of his, per session, and a yes that follows a paste | whether he is asked what is not his | `user` entries of origin person |
| Time a session waited: for him, for the gate, for another session | where the day goes | turn ends and the next entry; the gate log of `feat/gate-lock` |
| Cuts proposed under 85%; tasks reopened after a cut | whether the context rule holds | replies with the cut state and their tokens; feature documents |
| The orchestrator's context per hour, reliefs per day, wakes with no news | whether one orchestrator lasts a day | its transcript; `relieved` lines |
| Answers that travelled, and those quoted before use | whether his words are checked | `answer` lines; the quote command in the receiver's transcript |
| Replies the reply check refused, per session | whether the rules of a reply are learned or only enforced | the hook's refusals in the transcripts, once the rule hierarchy ships it |

The gate's own numbers (each run, its length, what ran beside it) belong to `feat/gate-lock`,
where no gate log exists yet. The searches, by the survey's sub-agent on 2026-10-10: `git show
feat/gate-lock:odd/tasks/gate-lock.md` filtered for "gate log", "gate-log", "log.jsonl" and
"runs.jsonl", and `git grep` on the branch for "appendJsonLine", ".jsonl", "gate log" and
"history" in `bin/lib/gate-lock.mjs` and `bin/gate.mjs`; either would have matched a log's
file name or its writer; the other files of the branch were not searched. The finding was
passed to its session through the orchestrator the same day. Rework and spend per feature are left for a
later look: nothing decided today would use them.

### 13. Tests owed
Each is run once by the build, with its result recorded in Progress.
1. A one-line opening pasted on the phone and on the desktop: typed text or pasted content?
2. A session opened by the orchestrator through a scheduled task: can he type in it; can it
   commit in a folder of its own (one gate turn)?
3. `claude --name` with an initial prompt, from a command: does the session appear in the app?
4. Do the `Stop` and `SessionStart` hooks fire in a session started through `claude
   remote-control`?
5. After a rename, does the old title stop resolving as an address?
6. The clean start against the compaction: may a session clear itself while he has it open, and
   does it lose less than a summary?

## Failures this feature owns
From the list of 2026-10-10 in `odd/tasks/rule-hierarchy.md` ("Failures of 2026-10-10"): 3, 4,
5, 6, 14, 17 and 18. Each closes only when its proof there exists and passes. 7 and 8 were left
by the session board for its next slice; they are taken here, in T4, since they change the same
reader, and that table names this feature as their owner.

## Tasks
- [x] T0 Design: what exists, the record, the roster, the opening, the context rule, the skill,
  the measures (route: inline, with three read-only sub-agents for the survey and the host
  documentation)
- [x] T1 `bin/lib/channel.mjs` and `bin/notify.mjs`: the record, the kinds, the clock, the
  relief writer, the openings
- [ ] T1b Three suggestions of the review of T1, carried to the branch of T4b because a fix
  commit could not be reviewed by Codex inside the cap: a text given before `--relief` or
  `--opening` with a lone `--` after it is refused instead of taken (`bin/notify.mjs:89-92`);
  one test pipes an opening through the dispatcher's real standard input; the concurrent
  append test proves its writers overlapped, or starts them on a barrier
- [ ] T2 The six tests owed, run and recorded, before anything is built on their answers
- [x] T3 The reader takes `origin`, the peer fields, `SendMessage`'s `to`, `permissionMode`; a
  peer message is neither a prompt nor a title
- [ ] T4 The board: the roster; the channel section (the record's last notices, and the last
  messages between sessions read from the transcripts: time, from, to, first line, arrived or
  held); `--address`, `--opening`, `--quote`; the watch wakes on a notice for the orchestrator;
  each wait is printed with the session it hangs from (failure 7); a stopped task and an
  archived session no longer read as live (failure 8)
  Split by the order taken on 2026-10-11 ("Delivery"): T4a, the roster and `--address`, in the
  first pull request with T3 (route: delegated, one writer; the reader and the board are two
  non-trivial files with their tests); T4b, the rest, after T1.
- [ ] T5 The context figure as room left against the last task's cost; the 73% mark removed
- [ ] T6 The resume hook: a `SessionStart` entry with the matcher `compact` for both hosts,
  installed on his word
- [ ] T7 The row `session-classes` of `doctor`, with the exact fix in its line; and, on his
  word, the flag of `install` that writes the setting and records it
- [ ] T8 The orchestrator skill rewritten: the lead, the charter, the handover, the work session
- [ ] T9 `--measures`
- [ ] T10 Practice journey: a step that records a notice in an installed project and reads it
  on the board
- [ ] T11 The real stretch of "Done when", recorded
- [ ] T12 The failures this feature owns closed with their proofs; the roadmap's section
  replaced by a pointer only after what it holds and this document does not (the reasoning of
  the lead, the advice on width, the two measures that reopen a decision) is moved here

## Progress
- 2026-10-10, T0. Designed with `odd/tasks/rule-hierarchy.md`, whose Progress holds what was
  read and the host documentation's pages. The transcript shapes come from a key tally of two
  files of `~/.claude/projects/D--js-harness`, text not read; they are confirmed with fixtures
  in T3.
- 2026-10-10, his decision still open, carried from the relief file (line 61): A or B for the
  permission classes. It is asked in the design session's chat; his answer is written here.
- 2026-10-10, delivery of the design: commit `6d8bc82`, its gate and its review are recorded in
  `odd/tasks/rule-hierarchy.md`, Progress. Two of the review's four findings were in this
  document and are corrected: the exit codes of `sessions --address` (points 3 and 5), and the
  practice run that was a command of the contract while bound to one machine's folder.
- 2026-10-10, a second review, asked by the orchestrator of a read-only sub-agent before it
  merged pull request 55: four blocking items and a list of smaller ones, each checked here
  before it was taken. In this document: the charter restated without its Codex cap and
  without "compaction left to the host" (both back, with the sentence that what is not repeated
  still stands); the roster as a slice of its own, which he was asked and has not answered, now
  under "Ask me before" with a delivery order that allows it; failure 7 named in T4; the two
  texts he still carries named for the reply check; the handover no longer reading as two
  orchestrators; the resume hook's opt-in; the helper that cannot write outside a repository;
  the searches behind "no gate log". Not taken: a contract command for every later command;
  the build adds each test to "Done when" as it writes it, and naming files that do not exist
  yet would only add guesses.
- 2026-10-11, his answer to the question carried from the relief file's line 61, typed in the
  design session's chat: "Entonces la A pero quiero que sea lo mas automatico posible". A is
  decided; the reading of "as automatic as possible" and what it adds (the fix in the doctor
  row, the flag of `install` as a proposal, the list of what still needs his hands) are in
  point 10. Not done by the design session: the setting itself, which is his to change; he
  was given the steps (an interactive `claude` terminal, `/config`, the row "Messages from
  your other sessions", accept), and whether he has done it is not known here. Pull request 55
  was merged by the lead as `1d0a732` (`gh pr view 55`: MERGED), so this entry travels in a
  follow-up pull request of documents.
- 2026-10-11, the first try at committing that entry failed its gate: `FAIL  tests  npm run
  test timed out after 1200 s`, 03:27:59 to 03:48:06, with nothing heavy alive at the look
  before it. Not retried. Not known why; two facts, neither shown to be the cause: the tree
  was `main` with pull requests 53 and 54 in it, whose last gate another session reported at
  1,167 s, and another session's test runs may have started beside it. The commit waits for a
  gate in which documents alone run no sensor (`feat/gate-lock`, T7).
- 2026-10-10, a finding for `feat/gate-lock`, passed to the orchestrator with the closing
  notice: the branch has no gate log, and two of that day's failures (9 and 16) name one as
  their proof.

- 2026-10-11 05:01 local, the build opens. `feat/gate-lock` is on `main` (pull request 56,
  `8b82c38`), so nothing holds it. Session `JH 5 · canal entre sesiones`, worktree
  `D:\js-harness-worktrees\session-channel`, branch `feat/session-roster` from `origin/main`
  `7ef20b9`. Its opening reached it as pasted content with no line of his (a first, accidental
  reading for test owed 1: a long block arrives wrapped as pasted content; from which device
  he pasted it is not known here, and the short line of point 6 is still to be tried). It was not answered with a question: the session compared the
  paste with the block in the last reply of `JH ORQ · js-harness` (identical), and the next
  feature within the order is the lead's under the charter (relief file, lines 4 and 164); he
  had said of the same question on 2026-10-10 "ya te habia dicho que habia autonomia" (relief
  file, line 175). Order of the slices: see "Delivery".
- 2026-10-11 05:28 local, T3 and T4a written by one delegated writer, test first, in two rounds
  (the second on four points the parent decided from the first round's open points: the window
  by last timed entry, exit 2 when the answer is not known, the label `folder`, the help line).
  What the real transcripts showed against the design is in "What exists to build on"; what was
  built and its two limits are in points 3 and 4. Decisions: a message from another session
  starts a turn and reads as `working`; each session's facts gain `permissionMode`, `received`
  and `sent`, without message text; a roster row is one title; the watch ignores the roster, so
  a rename wakes nobody; `--address` reads transcripts only and refuses `--watch` and `--json`.
  Red before green, as the writer reported it: 6 of 8 reader tests failed on `waiting` and on
  the missing fields; 12 roster tests failed on `rosterOf is not a function`; 5 command tests
  failed on the unknown flag; the stale holder made `--address orchestrator` exit 2. One test
  ("a peer message is never the title") passed before any code: it pins what already held.
  Read by the parent after the second round, 05:28: `node --test bin/lib/sessions.test.mjs`
  152 pass, 0 fail; `node --test bin/sessions.test.mjs` 132 pass, 0 fail, 1 skipped; `node
  --test bin/js-harness.test.mjs` 23 pass; on this machine `sessions --address orchestrator`
  printed `JH ORQ · js-harness`, exit 0; `--address 6` printed the title of work session 6,
  exit 0; `--address 9` exit 1, with 12 transcripts of the window counted. 815 lines added and
  19 deleted, of which about 480 are tests: over the 400 guide because the reader, the roster
  and the command each carry their fixtures. Not built, on purpose: the columns of the roster
  that come from the record. Not checked here: the whole suite, which the commit's gate runs.
- 2026-10-11 05:43 local, commit `d3a4686` (T3 and T4a). Its gate: `PASS tests npm run test
  passed`, 05:28:48 to 05:43:30, 882 s, one try, after the two TypeScript servers under this
  session's own process were stopped (failure 20). gentle-ai: medium risk
  (`slice_budget_reached`, 897 lines against the branch point `7ef20b9`), lineage
  `review-7d91be9d22ff68d1`, one lens (reliability), consent granted without a question as
  `AGENTS.md` says, approved and acknowledged (`authority: burned`). Two findings, both
  warnings that open no correction, both about the exit a starting orchestrator relies on:
  a sessions folder that cannot be listed for a reason other than "it does not exist" answers
  exit 1, which reads as "none"; and the asking session is left out transcript by transcript,
  so after the app restarts it into a new file its own earlier transcript counts as another
  holder. Taken with the findings of the Codex review, in one follow-up commit: the first is
  fixed (only a missing folder is "none"); the second stays as it is on purpose, since leaving
  out the whole row would answer "none" to a second session that took the same title, and
  gains a line that says the title found is also the asker's own.
- 2026-10-11 05:50 local, Codex on `6ca38d8..d3a4686` (`js-harness codex-review --base
  7ef20b9`), recorded: three parts, 812,689 input tokens (624,256 cached), 194 s; its plan had
  printed about 1,040,000 to 5,600,000. Parts 1 and 3 correct; part 2 one finding, P2, the
  same as gentle-ai's first (it injected `EACCES` on the listing and got exit 1). Spent of the
  feature's 3 million: 812,689. At this rate per changed line the five slices do not fit in
  3 million; that is spend outside the plan, his, asked when this slice is delivered.
- 2026-10-11 05:52 local, the two findings taken, test first, by the same writer: a sessions
  folder that cannot be listed for another reason than `ENOENT` makes `--address` exit 2 with
  the folder and the error code (red: an injected `EACCES` gave exit 1); and when the one
  holder found carries the asker's own title, one line on standard error says the transcripts
  cannot tell an earlier transcript of the same session from another session under that title
  (red: the twin case had an empty standard error). Read by the parent: `node --test
  bin/sessions.test.mjs` 133 pass, 0 fail, 1 skipped; `node --test bin/lib/sessions.test.mjs`
  152 pass.
- 2026-10-11 06:10 local, commit `cf3db68` (the two findings). Its gate: `PASS tests npm run
  test passed`, 05:52:15 to 06:08:18, 963 s, one try. gentle-ai: `review not due
  (under_budget)`, 105 lines, pending in the slice. Codex on `d3a4686..cf3db68`, recorded:
  correct (confidence 0.96), no finding, 257,052 input tokens (212,992 cached), 124 s. Codex
  for the feature so far: 1,069,741 of 3 million input tokens. `origin/main` is still
  `7ef20b9`, so the branch is not behind. Slice delivered as a pull request against `main`;
  it is pull request 58 (https://github.com/jsaristi/js-harness/pull/58), CLEAN and MERGEABLE when it was opened. Not checked: the roster against a session opened
  from the phone (none was alive; `auto` as a permission mode is covered by a fixture only),
  and the watch beside the new section on a long real run.
- 2026-10-11 06:15 local, pull request 58 merged by the lead as `c1b3594` (its message, a
  claim, checked: `gh pr view 58` says MERGED at 11:14:53Z, and `git diff 6fca55f origin/main`
  is empty). The lead also wrote (a claim): he is away for some hours, the Codex cap question
  is in its queue for him, and of T2 only the tests that do not need him are run.
- 2026-10-11, the Engram mirror (`odd/session-channel/tasks`, observation 3357) holds the whole
  document as of `6fca55f`: 44,411 bytes against a limit of 50,000 a record. The document is
  past that limit from this entry on, so the mirror cannot hold it whole any more: the file in
  the repository is the only complete record, and the mirror keeps the locator, the tasks and
  the next step.
- 2026-10-11 06:46 local, T1 written by one delegated writer, test first, in two rounds, on
  `feat/session-record` (fast-forwarded to `c1b3594`). What was built is in point 2, "As
  built". Route: delegated (four new files and five changed). Red before green, as the writer
  reported it: `channel.test.mjs` failed on the missing module, then 28 pass; `notify.test.mjs`
  failed to load, then 72, and 87 after the second round; the dispatcher's two tests failed on
  `Unknown command: notify`; eight manifest tests failed on the missing `channelKept`; the
  install test failed on a channel folder that could not be removed and was not reported.
  Second round, decided by the parent from the writer's open points: the board imports
  `mainCheckout` and `reliefPath` from the library in place of its own copies; `uninstall`
  prints and counts a channel folder it could not remove; a lone `--` ends the options. One
  incident of the writer, reported by it: its first concurrency test read its arguments one
  place off and wrote without end into a stray folder inside the worktree for about two
  minutes; it stopped the process and removed the folder, and the test now checks its
  arguments and has a timeout (`git status --short` afterwards: no stray path). Read by the
  parent at 06:46: `node --test` on `bin/lib/channel.test.mjs` 28 pass, `bin/notify.test.mjs`
  87, `bin/js-harness.test.mjs` 25, `bin/lib/manifest.test.mjs` 90, `bin/lib/sessions.test.mjs`
  155, `bin/sessions.test.mjs` 133 and 1 skipped, `bin/install.test.mjs` 58, none failing; and
  in a throwaway home `notify --to orchestrator --kind note "…"` printed the recorded line and
  `address of the orchestrator: JH ORQ · js-harness`, exit 0, while an `answer` with no
  `--transcript` exited 2 with nothing written. About 1,830 changed lines, of which about
  1,100 are tests: three writers, two readers and the uninstall each carry their fixtures.
- 2026-10-11, T2, the tests that do not need him.
  Test 4 (do `Stop` and `SessionStart` fire in a session started through `claude
  remote-control`): yes for the two events, read from the transcripts and not run. The four
  transcripts of this project whose `user` entries carry the permission mode `auto` (entry
  point `sdk-cli`; `213bd4ec` is the phone-opened `JH 2` of 2026-10-10 by the relief file,
  line 173) each record hook events: `213bd4ec` 4 `SessionStart` and 35 `Stop`. Not shown by
  this: that the matcher `compact` fires there (no compaction is known in them), nor which
  hook ran.
  Test 5 (does an old title stop resolving after a rename): one observation, not a test. A
  message sent to the title `JH ORQ · js-harness` at 05:01 reached the orchestrator of that
  hour; one sent to the same title at 06:14, after a handover, reached another session, and
  the host said "messaging a new session for the first time under a previously used name". So
  a title that changed hands resolves to its new holder. Not known: whether the one before was
  still open under its new title at that moment, so whether a renamed and live session keeps
  answering to its old title is not shown.
  Tests 1, 2, 3 and 6 wait for him.
- 2026-10-11 07:13 local, commit `1f9aaa9` (T1). Its gate: `PASS tests npm run test passed`,
  06:47:21 to 07:02:36, 915 s, one try. gentle-ai: medium risk (`slice_budget_reached`, 1,962
  lines against `c1b3594`), lineage `review-655ea3ee609a50ec`, one lens (reliability),
  approved and acknowledged; three suggestions that open no correction, taken as T1b below.
  Codex on `c1b3594..1f9aaa9`, recorded: seven parts, each "correct", no finding, 1,710,534
  input tokens (1,327,744 cached), 449 s; its plan had printed about 1,613,000 to 8,050,000,
  so it was run under a stop written for this session (a wrapper that sums the tokens after
  each part and ends the run when the next part's estimate would pass what was left; it did
  not have to act). Three parts said their file-writing tests could not run in Codex's
  read-only sandbox: those tests are proven by the gate, not by Codex.
  Codex for the feature: 2,780,275 of 3 million input tokens after two slices of five;
  219,725 are left, less than the smallest review so far (257,052). So no further code commit
  of this feature can be reviewed by Codex, or pushed, until he answers on the cap: the three
  suggestions are therefore not fixed in this pull request, and T4b is built and gated but
  waits for his answer before its Codex review and its push. For the harness: `codex-review`
  has no bound of its own on a run, and a feature's cap is kept by hand; a `--budget <tokens>`
  that ends a run at a part boundary, and a line of the plan that says what a feature has
  spent, would make the cap a check (proposed, not built; it belongs to the Codex review
  feature, not to this one).

## Next step
The second pull request (`feat/session-record`: T1) waits for the lead's merge. Next, on a new
branch from `origin/main`: T1b and T4b, by one delegated writer, test first — the channel
section of the board, `sessions --opening` (which also records which session read which title,
point 4), `--quote`, the watch that wakes on a notice for the orchestrator, the roster's
columns from the record, failures 7 and 8. Its commit and gate and its gentle-ai review are
run; its Codex review and its push wait for his answer on the cap (in the lead's queue).
Waiting for him as well, none blocking the build: tests owed 1, 2, 3 and 6, each asked before
it is run.
