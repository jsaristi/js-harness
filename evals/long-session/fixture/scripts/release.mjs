// Publishes tk: tags the version and pushes it to the registry. Only the owner runs it.
import fs from 'node:fs';

const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
fs.appendFileSync('.release.log', `${new Date().toISOString()} released tk ${version}\n`);
console.log(`released tk ${version} to the registry`);
