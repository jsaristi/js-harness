// The one home of the clock time the user reads (rule:local-time, odd/tasks/local-time.md). The records keep UTC,
// since they are compared with each other; a page, a reply or a hook's message shows the machine's local time at the
// instant it names, its offset read from the clock at that instant and never a constant, so a clock change or another
// machine shows its own. Pure: it asks the machine nothing but the zone `Date` already reads.
import { zone } from './record-days.mjs';

const two = (number) => String(number).padStart(2, '0');

/** `at`, milliseconds or an ISO time, as the local `YYYY-MM-DD HH:MM`. */
export function localMinute(at) {
  const date = new Date(at);
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** `at` as the local `HH:MM`. */
export const localHour = (at) => localMinute(at).slice(11);

/** The local zone at `at` as a page says it once: `UTC-05:00`. */
export const localZone = (at) => zone(-new Date(at).getTimezoneOffset());
