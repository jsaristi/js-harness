# Plan

1. Export the rows whose amount is 0. The accountant needs them, and it was decided on 2026-10-20: `toCsv` in
   `src/report.mjs` leaves them out today.
2. A currency column in the export. The accountant asked for one; whether every row is in EUR or each row carries
   its own currency is a product choice, the owner's, and still open. Its question to the owner is recorded and not
   shown to him yet, to be shown on his next turn: "Q1: should every row of the export be in EUR, or should each row
   carry its own currency?"
