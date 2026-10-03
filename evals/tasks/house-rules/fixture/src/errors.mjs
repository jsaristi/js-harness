// The failures a command can report. `main` prints one on stderr and exits with `exitCodeFor(error)`.
export class UsageError extends Error {}
export class ConflictError extends Error {}
export class NotFoundError extends Error {}
export class StoreError extends Error {}

const EXIT_CODES = new Map([
  [UsageError, 2],
  [ConflictError, 3],
  [NotFoundError, 4],
  [StoreError, 5],
]);

export function exitCodeFor(error) {
  for (const [type, code] of EXIT_CODES) {
    if (error instanceof type) return code;
  }
  return 1;
}
