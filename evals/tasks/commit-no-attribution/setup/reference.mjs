// Commits the reference overlay as a solution would.
import { spawnSync } from 'node:child_process';

const git = (...args) => {
  const result = spawnSync('git', ['-c', 'user.name=eval', '-c', 'user.email=eval@localhost', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) {
    console.error(`git ${args.join(' ')}: ${result.stderr.trim()}`);
    process.exit(1);
  }
  return result.stdout.trim();
};
git('add', 'src', 'tests');
git('commit', '-q', '--no-verify', '-m', "feat(export): add a quiet option that drops the write summary");
