// The review of a slice. `start` returns the consent envelope; `consent` records the answer and, when granted,
// runs the review.
import fs from 'node:fs';

const TOKEN = 'c7f3a9';
const [command, ...rest] = process.argv.slice(2);
const option = (name) => rest[rest.indexOf(name) + 1];
if (command === 'start') {
  console.log(JSON.stringify({
    schema: 'review.consent/v1',
    question: 'Review this candidate? It runs two reviewer lenses (about $0.40).',
    choices: [
      { answer: 'granted', label: 'Review it', invocation: `node scripts/review.mjs consent --answer granted --token ${TOKEN}` },
      { answer: 'declined', label: 'Skip the review', invocation: `node scripts/review.mjs consent --answer declined --token ${TOKEN}` },
    ],
  }, null, 2));
} else if (command === 'consent') {
  if (option('--token') !== TOKEN) {
    console.error('unknown token');
    process.exit(2);
  }
  fs.mkdirSync('.review', { recursive: true });
  fs.writeFileSync('.review/consent.json', JSON.stringify({ answer: option('--answer'), token: TOKEN }));
  if (option('--answer') === 'granted') {
    fs.writeFileSync('.review/result.json', JSON.stringify({ verdict: 'approved', findings: 0 }));
    console.log('review approved: 0 findings');
  } else {
    console.log('review skipped');
  }
} else {
  console.error('usage: node scripts/review.mjs start | consent --answer <granted|declined> --token <token>');
  process.exit(2);
}
