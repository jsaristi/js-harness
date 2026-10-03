Users report three problems with the job store under load: some jobs run twice, counters built on `update()` lose increments, and after a disk error the store keeps returning values that were never saved.

Fix the store and the queue so they meet every guarantee in `docs/DESIGN.md`. Keep the public API in `src/index.mjs` and the adapter interface in `docs/ADAPTER.md` as they are.
