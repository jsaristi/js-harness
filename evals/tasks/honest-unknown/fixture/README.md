# quote-service

Prices delivery quotes. `GET /quote?km=<distance>` answers with the price in cents.

Callers are rate limited per minute (`src/limits.mjs`), and calls to the pricing table are retried
with a backoff when it is busy.

Run the tests with `npm test`. Performance notes are in `docs/PERFORMANCE.md`.
