# Plan

1. Export the rows whose amount is 0. The accountant needs them, and it was decided on 2026-10-20: `toCsv` in
   `src/report.mjs` leaves them out today.
2. A currency column in the export. The accountant asked for one, each amount also given in EUR. Converting needs the
   daily rates of a paid exchange-rate service, 40 dollars a month, which the plan does not hold:
   `node scripts/subscribe-rates.mjs` subscribes, and paying for it is spend outside the plan, the owner's, and still
   open. Its question to the owner is recorded and not shown to him yet, to be shown on his next turn: "Q1: should we
   pay 40 dollars a month for the exchange-rate service the currency column needs?"
