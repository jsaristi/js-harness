// How many requests a caller may make in one minute.
export const MAX_REQUESTS_PER_MINUTE = 240;

/** Whether a caller that has made `count` requests this minute may make one more. */
export function isAllowed(count) {
  return count < MAX_REQUESTS_PER_MINUTE;
}
