// The two times of the permit relay (`js-harness permit`, odd/tasks/held-sessions.md, S8): how long a card waits for
// the lead, and how long a lease holds the relay. `permit` re-exports them; the manifest's instructions name both and
// read them from here, so building them does not load the command (odd/tasks/reorganization.md, S3).

/** How long a card waits for the lead: under the hook's 600 s timeout, so the hook answers before the host cuts it. */
export const WAIT_MS = 570 * 1000;

/** How long a lease holds the relay without a renewal. */
export const LEASE_MINUTES = 40;
