#!/usr/bin/env node
// The workshop's dispatcher: `node workshop/js-harness-workshop.mjs <command> [...args]`, run from this checkout.
// The workshop is what keeps js-harness itself, not what a project installs (odd/tasks/workshop-product-split.md):
// the seven commands that read only this repository's records, and the product's `loop` and `doctor` run with the
// ticks and the row that serve only here. It never ships: package.json's "files" names only bin/. The workshop may
// import product code; product code never imports the workshop, which bin/conventions-workshop.test.mjs holds.
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const USAGE = `Usage: node workshop/js-harness-workshop.mjs <command>

Commands:
  throughput  Table of a window's UTC days of work, every figure naming its source: pull requests merged and how long each waited, the gate lock's busy time and waits, commit gates here and on GitHub, lands, failing tests, Codex reviews, tasks closed and added, conflicts by file. js-harness throughput [--since <day>] [--until <day>] [--against <since>..<until>] [--json], where --against compares the window with an equal one before it, a row each, and judges nothing under the days of the rule throughput-compare-days a side; throughput snapshot [--day <day>] [--gate-log <file>]... keeps a settled day's gates under the home (.js-harness/throughput/<project>), because the gate log rotates in about two days; throughput status names a day with none and the reviews due; throughput reviewed (--day <day> | --shipped <day>) --found nothing|candidates and throughput shipped <item> [--day <day>] record the review's outcomes, which set when the next is due. The table and status write nothing.
  docs        What an auditor starting cold reads (docs/README.md is the entry): docs plan prints every tracked file in slices one context holds, in four tiers (core, tests, feature documents, the rest), the source beside its capability of docs/SPEC.md and each feature document with its state, at most 400,000 estimated tokens a slice (--budget <n> for another window, --json for the whole plan); docs index prints why each capability is there: the documents, rules (rule:<id>) and failure entries its text cites, apart the ones inferred from a file its Today or Proof line shares with a rule or a failure's control, the files too shared to infer from, and the rules, failure entries and feature documents no capability reaches (--json for the whole index); docs check runs check's docs row alone: the index of docs/README.md against docs/, no file over a slice, and every explicit link of the cross index resolving.
  windows-daily  Read the newest run of the daily Windows suite (.github/workflows/windows-daily.yml) on GitHub and say whether it passed; a red run not told before is told to the orchestrator once, with its failing test names. The lead's loop heartbeat runs the same reading every hour.
  subagents   Count a day's sub-agents of this project by role (writer, explorer, reviewer, verifier), model, and effort asked and ran, with their tokens and the share of the day's tokens they took, read from the Claude Code records of the main checkout and each worktree; it keeps no text of any message. --day YYYY-MM-DD, --days <n> (at most 7), --json, --cwd <dir>.
  audit       Count, per session of a day, the claims of its transcript that the transcript itself can check, and print each wrong one at its transcript and line: the hour a message to another session stamps in its opening against the hour it was sent (more than a minute apart is wrong), and the share of its context a session states of itself against the share its own reply records (more than 2 points apart is wrong). Read from the Claude Code records of the main checkout and each worktree; it prints no text of any message. --day YYYY-MM-DD, --days <n> (at most 7), --json, --cwd <dir>.
  host-watch  The host watch session's commands (F8's S9): js-harness host-watch draft --desktop <file> --code <file> prints the review file of a Claude Desktop update, one row an entry of both changelogs over the update's span, each entry outside the Code tab decided ignore and every other left "?" (--from-*/--to-* freeze the span, --sources writes its excerpts); host-watch check <review file> holds a review to its span, every entry decided, by its id; host-watch tools --surface desktop|background --list <file> [--record] diffs the app's tool list with the one the project recorded, a first capture a baseline.
  idea-watch  The idea watch of the upstream harness js-harness was built from: js-harness idea-watch status prints how many of its stable releases the record has not read; idea-watch draft [--from <v>] [--to <v>] fetches a bare clone under ~/.js-harness/upstream, recorded so uninstall machine removes it, and prints the record's entry for the next release, its changed paths placed by area. Nothing is installed or run from it.
  loop        The product's loop (js-harness loop), run with the three heartbeat ticks that serve only this repository: the daily Windows run, the throughput snapshots and reviews due, and the host watch. Its usage is the product's.
  doctor      The product's doctor (js-harness doctor), with the idea-watch row of this repository. Its usage is the product's.
  spec        Hold docs/SPEC.md's claims on \`js-harness-workshop <command>\` to this dispatcher: each claimed command is one of its commands, and each of its commands is claimed. Exit 0, 1 on a finding.

node workshop/js-harness-workshop.mjs <command> --help (or -h) prints that command's usage and its line above, and runs nothing.
`;

/** The heartbeat's three ticks, which the product's `loop` runs only when they are given. */
export const TICKS = {
  // The heartbeat's reading of the daily Windows run: null when it is not due, else what it found.
  windowsDaily: async (options) => (await import('../bin/lib/windows-daily.mjs')).windowsDailyTick(options),
  // The heartbeat's throughput tick: keeps the settled days with no snapshot, and says which review is due.
  throughputTick: async (options) => (await import('../bin/throughput.mjs')).throughputTick(options),
  // The heartbeat's reading of the host: null when it is not due, else an update no host watch session holds.
  hostWatch: async (options) => (await import('../bin/host-watch.mjs')).hostWatchTick(options),
};

/** The idea-watch row's reading, which the product's `doctor` shows only when it is given: the record's state, or
 * `null` where the project keeps none, with the command that drafts the next entry. */
export async function ideas(project) {
  const [{ ideaWatchHealth }, { ideaFix }] = await Promise.all([import('../bin/idea-watch.mjs'), import('../bin/lib/idea-watch.mjs')]);
  const state = await ideaWatchHealth(project);
  return state === null ? null : { ...state, fix: ideaFix(state) };
}

/** `spec`: the product's spec row, held to this dispatcher's commands. */
async function specMain(argv, { cwd = process.cwd(), stdout = console.log, stderr = console.error } = {}) {
  if (argv.length > 0) {
    stderr(`js-harness-workshop spec takes no argument: ${argv.join(' ')}`);
    return 2;
  }
  const { checkSpec } = await import('../bin/lib/spec.mjs');
  const rows = checkSpec(cwd, { own: true, workshopCommands: Object.keys(COMMANDS) });
  for (const row of rows) {
    stdout(`${row.pass ? 'PASS' : 'FAIL'}  ${row.name}  ${row.detail}`);
    for (const line of row.lines ?? []) stdout(`      ${line}`);
  }
  return rows.every((row) => row.pass) ? 0 : 1;
}

// Each loader imports its command's module when that command runs, as the product's dispatcher does.
const COMMANDS = {
  throughput: async () => (await import('../bin/throughput.mjs')).throughputMain,
  docs: async () => (await import('../bin/docs.mjs')).docsMain,
  'windows-daily': async () => (await import('../bin/windows-daily.mjs')).windowsDailyMain,
  subagents: async () => (await import('../bin/subagents.mjs')).subagentsMain,
  audit: async () => (await import('../bin/audit.mjs')).auditMain,
  'host-watch': async () => (await import('../bin/host-watch.mjs')).hostWatchMain,
  'idea-watch': async () => (await import('../bin/idea-watch.mjs')).ideaWatchMain,
  loop: async () => {
    const { loopMain } = await import('../bin/loop.mjs');
    return (argv) => loopMain(argv, process.env, TICKS);
  },
  doctor: async () => {
    const { doctorCommand } = await import('../bin/doctor.mjs');
    return (argv) => doctorCommand(argv, { ideas });
  },
  spec: async () => specMain,
};

// The usage each command prints on a usage error, which `<command> --help` prints too: [its module, the export].
// A command left out answers --help itself (windows-daily, spec).
const HELP = {
  throughput: ['../bin/throughput.mjs', 'USAGE'],
  docs: ['../bin/docs.mjs', 'USAGE'],
  subagents: ['../bin/subagents.mjs', 'USAGE'],
  audit: ['../bin/audit.mjs', 'USAGE'],
  'host-watch': ['../bin/host-watch.mjs', 'USAGE'],
  'idea-watch': ['../bin/idea-watch.mjs', 'USAGE'],
  loop: ['../bin/loop.mjs', 'USAGE'],
  doctor: ['../bin/doctor.mjs', 'USAGE'],
};

/** The help of one command: its module's usage (a string, or an array of lines), then its line of the main help. */
async function commandHelp(command) {
  const [file, name] = HELP[command];
  const usage = [(await import(file))[name]].flat().join('\n');
  const line = USAGE.split('\n').find((text) => text.startsWith(`  ${command} `));
  return `${usage}\n\n${line.trim().slice(command.length).trim()}`;
}

async function run(argv, { commands = COMMANDS } = {}) {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') {
    console.log(USAGE);
    return 0;
  }
  if (Object.hasOwn(commands, command)) {
    if (rest.length === 1 && (rest[0] === '--help' || rest[0] === '-h') && Object.hasOwn(HELP, command)) {
      console.log(await commandHelp(command));
      return 0;
    }
    const commandMain = await commands[command]();
    return commandMain(rest);
  }
  console.error(`Unknown command: ${command}\n\n${USAGE}`);
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  // exitCode, not process.exit(), as the product's dispatcher does (libuv on Windows).
  run(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

export { run, COMMANDS };
