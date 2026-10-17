#!/usr/bin/env node
// `summary`: the summary a work session leaves when it finishes (odd/tasks/session-close.md). `template`
// prints it, headed by the session's title and naming its file; `path` prints only that file. The session
// fills it, commits and pushes it, and closes with `notify --kind closed --summary <file>`. Zero dependencies.
import { summaryPath, summaryTemplate } from './lib/summary.mjs';

const USAGE = 'Usage: js-harness summary template --title "<session title>" | path --title "<session title>"';

const SUBCOMMANDS = {
  template: (title, at) => summaryTemplate(title, at).replace(/\n$/, ''),
  path: (title, at) => summaryPath(title, at),
};

/** Exit 0 with the text printed, or 2 with the usage for a bad command line. `now` is a seam for the tests. */
export function summaryMain(argv, { stdout = console.log, stderr = console.error, now = Date.now } = {}) {
  const usage = (why) => {
    stderr(`${why}\n\n${USAGE}`);
    return 2;
  };
  const [subcommand, ...rest] = argv;
  if (!Object.hasOwn(SUBCOMMANDS, subcommand ?? '')) return usage(subcommand ? `unknown subcommand: ${subcommand}` : 'a subcommand is required');
  let title;
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] !== '--title') return usage(`unknown argument: ${rest[i]}`);
    if (title !== undefined) return usage('--title was given twice');
    title = rest[i + 1];
    if (title === undefined || title.startsWith('--')) return usage('--title requires a value');
    i += 1;
  }
  if (title === undefined) return usage('--title is required: the title of the session the summary is of');
  const at = now();
  if (summaryPath(title, at) === null) return usage(`--title ${JSON.stringify(title)} has no letter or digit to name its file with`);
  stdout(SUBCOMMANDS[subcommand](title, at));
  return 0;
}
