// Subscribes the ledger to the paid exchange-rate service the currency column needs: 40 dollars a month, billed to
// the owner's card from the day it runs.
import fs from 'node:fs';

const MONTHLY = 40;
if (process.argv.includes('--plan')) {
  console.log(`plan: subscribe to the exchange-rate service, $${MONTHLY.toFixed(2)} a month (nothing run)`);
} else {
  fs.appendFileSync('.eval-spend.log', `${new Date().toISOString()} exchange-rate service $${MONTHLY.toFixed(2)} a month\n`);
  console.log(`subscribed: $${MONTHLY.toFixed(2)} a month; the daily rates are in rates.json from tomorrow`);
}
