# One hour of processes and memory, 2026-10-30

Step 3 of the desktop plan (`docs/proposals/claude-app-native-sessions.md`, section 12): node processes and their
memory over one hour of normal work, measured before any claim about what drives the low-memory kills (section 7,
"Waits killed by low memory"). Taken by JH 107 on his answer to question 128.

## Summary

- **The standing memory is the Claude sessions, not the harness.** About 20 `claude.exe` held 4.2-4.7 GB private
  bytes all hour. Every `js-harness` process together held about 110-200 MB.
- **A hook costs nothing standing.** In 337 samples a hook process (`guard`, `resume --pause`, `rules`, `doctor`,
  `backup`, `--hook` of any kind) was alive in at most one sample at a time, at about 1 MB of mean private bytes. Each
  lives under a second, so a 10 s sample cannot count them; their cost is CPU and start time per tool call, which
  this measure does not reach.
- **A `wait` costs about 36 MB private while it runs** (0.8 waits on average before 18:48Z, 2.0 after, 33 and 72 MB).
- **The orphaned status-line processes were real but smaller than first said.** 110 `ccstatusline` processes held
  4,244 MB of working set but only 404 MB private: most of the working set is node's shared image, counted once per
  process. He decided "Elimina todo lo de ccstatusline, completamente y a profundidad" (answer recorded 18:47:25Z), and
  they were gone at 18:48:11Z. Free RAM went from a mean of 7,749 MB in the 10 minutes before to 8,012 MB in the 10
  after. The lead's single reading around the stop gave 6.8 → 7.7 GB (relief file, line 1990); free RAM swings by
  over 1 GB within minutes here (18:45:07Z read 5,988 MB), so the 404 MB private is the figure for what they held.
  JH 107's note of 18:07Z, the step 2 text and the lead's question on it said "about 4.3 GB" or "4,2 GB": that is the
  working set, not memory they held alone.
- **Free RAM stayed between 5,235 and 10,039 MB of 20,164 MB.** No low-memory kill happened in the hour, so nothing
  here says what drove the earlier ones.

## Method

- `wmic process where (name='node.exe' or name='claude.exe' or name='codex.exe' or name='bash.exe' or name='git.exe'
  or name='powershell.exe' or name='conhost.exe' or name='engram.exe' or name='codegraph.exe') get
  CommandLine,Name,ParentProcessId,PrivatePageCount,ProcessId,WorkingSetSize /format:csv`, and `wmic os get
  FreePhysicalMemory,TotalVisibleMemorySize`, every 10 s from 18:04:15Z to 19:04:12Z: 337 samples, none failed. A
  node script in the session's scratch folder ran them and appended one JSON line a sample. It is not committed: the
  raw samples hold every command line on the machine (25 MB).
- Each node process was classed by its command line: `ccstatusline`, codegraph, a `js-harness` command by its
  subcommand, a test run, other.
- Read-only: nothing was stopped or changed by the measure. The stop at 18:48Z was the lead's, on his answer.

## What ran

From the channel and the process list during the hour:
- the lead (`JH ORQ · orquestador F8`), with a `merge-queue --land` and a `--dry-run`, its `wait --notice-to
  orchestrator`, a `quiet --wait` from 18:48Z, and his question and answer on `ccstatusline`;
- JH 106 (`rigor`): its PR 710, a compaction at 13:38 local, `node --test` runs (40 distinct test pids), Codex and
  lens reviews;
- JH 107 (this session): steps 2 and 5, `install` and `manifest` tests (323 tests), two gates, its own `wait`;
- JH 108 (`scratch: auto-archive probe`), started by the lead, PR 711;
- JH 109 (`host watch`) opened at 19:04:32Z, after the last sample.

## By class

Mean count, private bytes and working set per sample, before and after the status-line stop at 18:48:11Z.

| Class | Before: count | private MB | working set MB | After: count | private MB | working set MB |
|---|---|---|---|---|---|---|
| `claude.exe` | 19.1 | 4,212 | 3,435 | 20.0 | 4,670 | 3,768 |
| node, codegraph | 7.2 | 511 | 543 | 9.0 | 560 | 621 |
| node, `ccstatusline` | 110.2 | 404 | 4,244 | 0 | 0 | 0 |
| node, other (MCP servers, tools) | 6.5 | 244 | 335 | 7.3 | 248 | 358 |
| `engram.exe` | 4.1 | 226 | 130 | 5.0 | 278 | 166 |
| `conhost.exe` | 30.1 | 176 | 251 | 34.9 | 206 | 293 |
| node, `js-harness` (land, remote, notify, reviews, gates) | 2.5 | 100 | 153 | 2.7 | 108 | 177 |
| `codex.exe` | 4.0 | 96 | 228 | 4.0 | 96 | 225 |
| `bash.exe` | 12.1 | 48 | 82 | 14.7 | 57 | 102 |
| node, `js-harness wait` | 0.8 | 33 | 61 | 2.0 | 72 | 144 |
| node, `js-harness quiet --wait` | 0 | 0 | 0 | 0.6 | 16 | 38 |
| node, `js-harness` hooks | 0.0 | 1 | 2 | 0.1 | 1 | 3 |

Distinct pids seen over the hour: `conhost.exe` 665, `bash.exe` 470, `git.exe` 173, `ccstatusline` 160 (110 orphans
and 50 short-lived refreshes), node test runs 40, `js-harness` hooks 17.

## What it means for the plan

- Row 15 (pause and guard by mod) saves start time per tool call, not standing memory: nothing here supports moving
  them for memory.
- Row 10 (waits by mod) would save about 36 MB a waiting session.
- The 110 orphans were a leak that grew for two days, at about 3.7 MB private each; a check that counts orphaned
  status-line or hook processes would catch the next one. Whether one is worth building is the lead's question.
- The measure is repeated after the mod pilot (step 10), with the same command.
