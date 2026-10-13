// The second half of the tests of `codex-review.test.mjs`, in a process of its own: that file says why at
// its top. The mark is set before the import, and so the import is not a static one, which would run first.
globalThis[Symbol.for('js-harness.codex-review.second-half')] = true;
await import('./codex-review.test.mjs');
