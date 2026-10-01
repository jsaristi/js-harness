import { UsageError } from './errors.mjs';

const UNIT_MS = { m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };

/** Turns `90m`, `12h` or `7d` into milliseconds. */
export function parseDuration(text) {
  const match = /^(\d+)([mhd])$/.exec(text);
  if (!match) throw new UsageError(`invalid duration "${text}": write a number and m, h or d, like 90m, 12h or 7d`);
  return Number(match[1]) * UNIT_MS[match[2]];
}
