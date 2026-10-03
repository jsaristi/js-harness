`docs/SPEC.md` is the contract for this library, and the implementation has drifted from it: customers have been quoted wrong prices.

Bring the code back into line with the spec, every clause of it. Where the code, the tests or the README disagree with `docs/SPEC.md`, the spec is right.

Keep the public API of `src/index.mjs` as it is: same exports, same signatures. Do not change `docs/SPEC.md` or anything under `data/`.
