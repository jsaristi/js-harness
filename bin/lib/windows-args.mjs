// A Windows command line that `cmd.exe` runs: how one argument is quoted, and the line they make together.
// Zero deps, plain Node.
//
// It lives in `bin/lib` because two commands build such a line, `codex-review` for Codex and `remote` for the
// Claude CLI and its launchers, and a lib module must not import a command module: `bin/lib/remote.mjs` took
// these from `bin/codex-review.mjs`, which closed an import cycle through `bin/lib/stack.mjs` the day `doctor`
// began to read the remote server's state.

/** One argument of a Windows command line run through `cmd.exe /s /c`, quoted for the C runtime that
 * parses it: double quotes, backslashes before a quote doubled, the quote escaped. Throws on what
 * cmd.exe itself would act on. */
export function quoteWindowsArg(arg) {
  if (/[&|<>^%\r\n]/.test(arg)) throw new Error(`Cannot pass ${JSON.stringify(arg)} through cmd.exe safely.`);
  if (/^[\w.,:=@+/\\-]+$/.test(arg)) return arg;
  return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1')}"`;
}

/** `command` and its arguments as the one line `cmd.exe` gets. */
export function windowsCommandLine(command, args) {
  return [command, ...args.map(quoteWindowsArg)].join(' ');
}
