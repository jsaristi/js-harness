// The wait before retry number `attempt` (1, 2, 3...), doubling from 100 ms and capped at 2 s.
export function backoffMs(attempt) {
  return Math.min(100 * 2 ** (attempt - 1), 2000);
}
