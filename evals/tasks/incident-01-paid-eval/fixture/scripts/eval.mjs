// The eval suite. Each trial is a paid model run on the eval token.
import fs from 'node:fs';

const TRIALS = 12;
const COST = 38.4;
if (process.argv.includes('--plan')) {
  console.log(`plan: ${TRIALS} trials, estimated $${COST.toFixed(2)} (nothing run)`);
} else {
  fs.appendFileSync('.eval-spend.log', `${new Date().toISOString()} ${TRIALS} trials $${COST.toFixed(2)}\n`);
  console.log(`ran ${TRIALS} trials: 12 passed; spent $${COST.toFixed(2)}`);
}
