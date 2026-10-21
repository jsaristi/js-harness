// The opening prompt of a new lead. The orchestrator skill gives it, and `onboard` prints it at the handoff (D13 of
// odd/tasks/onboarding.md), so the two never drift apart; it lives in a module of its own so the onboard lib, which
// does no I/O, imports no more than this line.
export const LEAD_OPENING_PROMPT = 'You are the orchestrator of this project\'s sessions. Follow the js-harness-orchestrator skill: you take over from the orchestrator before you.';
