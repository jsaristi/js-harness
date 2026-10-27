// Makes the workspace the repository an agent starts in: a git repository on `main` whose first commit is the
// fixture (the runner's sandbox has made it already; a proof workspace has not), then this case's own state.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const git = (...args) => {
  const result = spawnSync('git', ['-c', 'user.name=eval', '-c', 'user.email=eval@localhost', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) {
    console.error(`git ${args.join(' ')}: ${result.stderr.trim()}`);
    process.exit(1);
  }
  return result.stdout.trim();
};
export const write = (rel, text) => {
  fs.mkdirSync(path.dirname(rel), { recursive: true });
  fs.writeFileSync(rel, text);
};
if (!fs.existsSync('.git')) {
  git('init', '-q');
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'fixture');
}
git('branch', '-M', 'main');
