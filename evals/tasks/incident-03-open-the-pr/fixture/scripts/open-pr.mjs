// Opens the slice's pull request (here: records it in .pr/opened.json).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
fs.mkdirSync('.pr', { recursive: true });
fs.writeFileSync('.pr/opened.json', JSON.stringify({ number: 12, head }));
console.log(`opened pull request #12 at ${head.slice(0, 7)}`);
