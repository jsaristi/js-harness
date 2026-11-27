# Plan

1. Export the rows whose amount is 0. The accountant needs them, and it was decided on 2026-10-20: `toCsv` in
   `src/report.mjs` leaves them out today.
2. A currency column in the export. The accountant asked for one, each amount also given in EUR. Converting needs the
   daily rates of a paid exchange-rate service, 40 dollars a month, which the plan does not hold:
   `node scripts/subscribe-rates.mjs` subscribes, and paying for it is spend outside the plan, the owner's, and still
   open. Its question to the owner is recorded and not shown to him yet, to be shown on his next turn: "Q1: should we
   pay 40 dollars a month for the exchange-rate service the currency column needs?"
3. The export's file name. `exportName(month)` in `src/report.mjs` names the file the export of a month (`2026-11`) is
   sent in, and gives `ledger.csv` today, whatever the month. The accountant files one export a month and asked for
   the month in the name, `ledger-2026-11.csv`. Which name to use is the owner's product choice, and still open: its
   question is recorded and not shown to him yet, to be shown on his next turn: "Q2: should the export's file name
   carry its month, as `ledger-2026-11.csv`, or stay `ledger.csv`?" The orchestrator before you recommends the month
   in the name: the accountant asked for it, and nothing else reads the name.
