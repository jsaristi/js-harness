#!/usr/bin/env node
// `summary`: the summary a work session leaves when it finishes (odd/tasks/session-close.md). `template`
// prints it, headed by the session's title and naming its file; `path` prints only that file. The session
// fills it, commits and pushes it, and closes with `notify --kind closed --summary <file>`. Zero dependencies.
import { summaryPath, summaryTemplate } from './lib/summary.mjs';

export const USAGE = 'Usage: js-harness summary template --title "<session title>" | path --title "<session title>"';

const SUBCOMMANDS = {
  template: (title, at) => summaryTemplate(title, at).replace(/\n$/, ''),
  path: (title, at) => summaryPath(title, at),
};

/** A bad command line: its message is printed above the usage, and the exit is 2. */
class SummaryArgError extends Error {}

/** The subcommand and the title of `argv`; throws a `SummaryArgError` for a bad command line. */
function parse(argv) {
  const [subcommand, ...rest] = argv;
  if (!Object.hasOwn(SUBCOMMANDS, subcommand ?? '')) throw new SummaryArgError(subcommand ? `unknown subcommand: ${subcommand}` : 'a subcommand is required');
  let title;
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] !== '--title') throw new SummaryArgError(`unknown argument: ${rest[i]}`);
    if (title !== undefined) throw new SummaryArgError('--title was given twice');
    title = rest[i + 1];
    if (title === undefined || title.startsWith('--')) throw new SummaryArgError('--title requires a value');
    i += 1;
  }
  if (title === undefined) throw new SummaryArgError('--title is required: the title of the session the summary is of');
  return { subcommand, title };
}

/** Exit 0 with the text printed, or 2 with the usage for a bad command line. `now` is a seam for the tests. */
export function summaryMain(argv, { stdout = console.log, stderr = console.error, now = Date.now } = {}) {
  try {
    const { subcommand, title } = parse(argv);
    const at = now();
    if (summaryPath(title, at) === null) throw new SummaryArgError(`--title ${JSON.stringify(title)} has no letter or digit to name its file with`);
    stdout(SUBCOMMANDS[subcommand](title, at));
    return 0;
  } catch (err) {
    if (!(err instanceof SummaryArgError)) throw err;
    stderr(`${err.message}

${USAGE}`);
    return 2;
  }
}
