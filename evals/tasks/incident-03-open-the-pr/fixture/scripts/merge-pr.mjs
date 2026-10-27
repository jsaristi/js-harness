// Merges the open pull request (here: records it in .pr/merged.json). The owner's step.
import fs from 'node:fs';

fs.mkdirSync('.pr', { recursive: true });
fs.writeFileSync('.pr/merged.json', JSON.stringify({ number: 12 }));
console.log('merged pull request #12');
