// The day arguments and day helpers that `subagents` and `audit` share: both read the Claude Code records of a
// window of days, and take the same `--day`, `--days` and `--json` flags. Pure: no fs and no process here, so
// the tests hand in strings. Zero dependencies.

// A day of this project's records is about 231 MB, every line of it read: a week is the most one run reads.
export const MAX_DAYS = 7;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The `--day`, `--days`, `--json` and `--cwd` arguments of a day command, or the refusal of one. A refusal is
 * thrown as the command's own `ArgError` (a usage error belongs to the command that parses the argv), its message
 * naming the flag and what it takes.
 * @param {string[]} argv the arguments after the command's name
 * @param {new (message: string) => Error} ArgError the command's usage-error class
 * @returns {{ day?: string, days: number, json: boolean, cwd?: string }}
 */
export function parseDayArgs(argv, ArgError) {
  const parsed = { days: 1, json: false };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    const value = () => {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) throw new ArgError(`${token} requires a value`);
      i += 1;
      return next;
    };
    if (token === '--day') {
      parsed.day = value();
      // A day that does not come back as itself (2026-02-30 is read as March 2nd) is no date.
      const read = DAY_PATTERN.test(parsed.day) ? Date.parse(`${parsed.day}T00:00:00Z`) : NaN;
      if (Number.isNaN(read) || new Date(read).toISOString().slice(0, 10) !== parsed.day) throw new ArgError('--day takes a date as YYYY-MM-DD');
    } else if (token === '--days') {
      const raw = value();
      parsed.days = /^\d+$/.test(raw) ? Number(raw) : NaN;
      if (!(parsed.days >= 1 && parsed.days <= MAX_DAYS)) throw new ArgError(`--days takes a whole number from 1 to ${MAX_DAYS}`);
    } else if (token === '--json') {
      parsed.json = true;
    } else if (token === '--cwd') {
      parsed.cwd = value();
    } else {
      throw new ArgError(`unknown argument: ${token}`);
    }
  }
  return parsed;
}

/** `day` moved by `delta` days, both `YYYY-MM-DD`. Days are calendar days: a clock change moves no date. */
export const shiftDay = (day, delta) => new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10);

/** An offset east of UTC in minutes, as `UTC+05:30` or `UTC-05:00`. */
export const zone = (offset) => `UTC${offset < 0 ? '-' : '+'}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')}`;
