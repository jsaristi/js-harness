// The one check every command that writes outside the repository runs on its argv before it acts:
// a token it does not know is refused, never ignored. `install --help` was run to read its help and
// installed on his machine (2026-10-09); a command that skips a flag it does not know does what the
// user did not ask, with the flag they meant left out (odd/tasks/commands-and-doctor.md, T1).

/** The first token of `argv` that is no flag `known` names and no value of one, or `null`.
 * `known.valued` lists the flags that take a value (the token after one is its value, unless it
 * starts with `--`, as each command's own `requireValue` reads it, which then says the value is
 * missing), `known.bare` those that take none, and `known.positional` allows words that do not start
 * with `-`. `--help` and `-h` are unknown unless listed: a command that prints no help of its own
 * refuses them, so reading for help never acts. */
export function unknownArgument(argv, { valued = [], bare = [], positional = false } = {}) {
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (valued.includes(token)) {
      if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) i += 1;
    }
    else if (bare.includes(token)) continue;
    else if (positional && !token.startsWith('-')) continue;
    else return token;
  }
  return null;
}
