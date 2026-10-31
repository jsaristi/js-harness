import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { commitMsgMain, stripAttribution } from './commit-msg.mjs';

// The planted messages of the brief (odd/tasks/strip-attribution.md, spec 3), the trailers as the Claude app asks a
// session to write them on 2026-10-31.
const HOST_CO_AUTHOR = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>';
const HOST_SESSION = 'Claude-Session: https://claude.ai/code/session_014UXmf7nXWHqnjZkbEUz5UB';
const HUMAN_CO_AUTHOR = 'Co-Authored-By: Ana Gómez <ana@example.com>';
const BODY = 'feat(x): a change\n\nWhy it is made, in a body.\n';

test('a message with both trailers of the host comes out without them, every other byte as it was', () => {
  const { text, removed } = stripAttribution(`${BODY}\n${HOST_CO_AUTHOR}\n${HOST_SESSION}\n`);
  assert.equal(text, `${BODY}\n`);
  assert.deepEqual(removed, [HOST_CO_AUTHOR, HOST_SESSION]);
});

test('a human Co-Authored-By line stays, beside the host lines that go', () => {
  const { text, removed } = stripAttribution(`${BODY}\n${HUMAN_CO_AUTHOR}\n${HOST_CO_AUTHOR}\n${HOST_SESSION}\n`);
  assert.equal(text, `${BODY}\n${HUMAN_CO_AUTHOR}\n`);
  assert.deepEqual(removed, [HOST_CO_AUTHOR, HOST_SESSION]);
});

test('a message with no attribution line is unchanged', () => {
  const message = `${BODY}\n${HUMAN_CO_AUTHOR}\nSigned-off-by: Ana Gómez <ana@example.com>\n`;
  assert.deepEqual(stripAttribution(message), { text: message, removed: [] });
});

test('the older trailer, any case of the key and an Anthropic address under another name all go', () => {
  const lines = [
    'Co-Authored-By: Claude <noreply@anthropic.com>',
    'co-authored-by: Claude Sonnet 4.5 <noreply@anthropic.com>',
    'Co-authored-by: A bot <bot@mail.anthropic.com>',
    'CLAUDE-SESSION: https://claude.ai/code/session_x',
  ];
  const { text, removed } = stripAttribution(`${BODY}\n${lines.join('\n')}\n`);
  assert.equal(text, `${BODY}\n`);
  assert.deepEqual(removed, lines);
});

test('only whole trailer lines go: a line that names them in its text, or a name that only holds "claude", stays', () => {
  const message = [
    'docs: say what the hook removes',
    '',
    '- it removes `Co-Authored-By: Claude ...` lines',
    '  Claude-Session: indented, so not a trailer',
    'Co-Authored-By: Claudette Ruiz <claudette@example.com>',
    'Co-Authored-By: Jo <jo@notanthropic.com>',
    'Co-Authored-By: Jo <jo@anthropic.com.example.org>',
    '',
  ].join('\n');
  assert.deepEqual(stripAttribution(message), { text: message, removed: [] });
});

test('a message written with CRLF keeps its line endings, and a last line with no ending goes whole', () => {
  const { text, removed } = stripAttribution(`feat: x\r\n\r\nbody\r\n\r\n${HOST_CO_AUTHOR}\r\n${HOST_SESSION}`);
  assert.equal(text, 'feat: x\r\n\r\nbody\r\n\r\n');
  assert.deepEqual(removed, [HOST_CO_AUTHOR, HOST_SESSION]);
});

test('the comment lines an editor leaves under the trailers do not keep the trailers in', () => {
  const message = `${BODY}\n${HOST_CO_AUTHOR}\n${HOST_SESSION}\n# Please enter the commit message for your changes.\n#\n`;
  assert.equal(stripAttribution(message).text, `${BODY}\n# Please enter the commit message for your changes.\n#\n`);
});

/** The seams of the command, with the message file held in memory. */
function seams(files) {
  const out = [];
  const err = [];
  const writes = [];
  return {
    out,
    err,
    writes,
    deps: {
      stdout: (text) => out.push(text),
      stderr: (text) => err.push(text),
      readFile: (file) => {
        if (!Object.hasOwn(files, file)) throw Object.assign(new Error(`ENOENT: no such file, open '${file}'`), { code: 'ENOENT' });
        return files[file];
      },
      writeFile: (file, text) => {
        writes.push(file);
        files[file] = text;
      },
    },
  };
}

test('the command writes the message back without the lines and says in one line what it removed', () => {
  const files = { MSG: `${BODY}\n${HOST_CO_AUTHOR}\n${HOST_SESSION}\n` };
  const { err, writes, deps } = seams(files);
  assert.equal(commitMsgMain(['MSG'], deps), 0);
  assert.equal(files.MSG, `${BODY}\n`);
  assert.deepEqual(writes, ['MSG']);
  assert.deepEqual(err, [`js-harness commit-msg: removed the host's attribution lines: ${HOST_CO_AUTHOR} | ${HOST_SESSION}`]);
});

test("the command writes nothing and says nothing when no line is the host's", () => {
  const files = { MSG: `${BODY}\n${HUMAN_CO_AUTHOR}\n` };
  const { out, err, writes, deps } = seams(files);
  assert.equal(commitMsgMain(['MSG'], deps), 0);
  assert.deepEqual([out, err, writes], [[], [], []]);
});

test('a message file it cannot read or write is said, and the commit goes on: exit 0', () => {
  const missing = seams({});
  assert.equal(commitMsgMain(['NOPE'], missing.deps), 0);
  assert.equal(missing.err.length, 1);
  assert.match(missing.err[0], /^js-harness commit-msg: the message was left as it is: NOPE could not be read \(ENOENT: no such file/);

  const files = { MSG: `${BODY}\n${HOST_SESSION}\n` };
  const locked = seams(files);
  locked.deps.writeFile = () => {
    throw Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
  };
  assert.equal(commitMsgMain(['MSG'], locked.deps), 0);
  assert.deepEqual(locked.err, ['js-harness commit-msg: the message was left as it is: MSG could not be written (EPERM: operation not permitted)']);
});

test('--help prints the usage and exits 0; a bad command line exits 2 with the usage', () => {
  const help = seams({});
  assert.equal(commitMsgMain(['--help'], help.deps), 0);
  assert.match(help.out.join('\n'), /^Usage: js-harness commit-msg <file>/);

  for (const [argv, why] of [[[], 'the message file is required'], [['--no-such-flag'], 'unknown argument: --no-such-flag'], [['A', 'B'], 'unknown argument: B']]) {
    const bad = seams({});
    assert.equal(commitMsgMain(argv, bad.deps), 2, argv.join(' '));
    assert.equal(bad.err[0], why);
    assert.match(bad.err.join('\n'), /Usage: js-harness commit-msg <file>/);
  }
});

// The hook is plain POSIX sh: it runs here in a scratch repository whose hooks path holds the real
// `.githooks/commit-msg`, beside the real `bin/commit-msg.mjs`, which imports nothing but node's own modules.
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const hasSh = spawnSync('sh', ['-c', 'true']).status === 0;
const skip = hasSh ? false : 'sh is not on PATH';
const made = [];
let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-commit-msg-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
after(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result;
}

/** A scratch repository whose hooks path is a copy of the real hook, with the command's file in its `bin/` or not. */
function scratch({ command }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-commit-msg-'));
  made.push(root);
  git(root, 'init', '-q');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'commit.gpgsign', 'false');
  fs.mkdirSync(path.join(root, 'hooks'));
  fs.copyFileSync(path.join(REPO, '.githooks', 'commit-msg'), path.join(root, 'hooks', 'commit-msg'));
  fs.chmodSync(path.join(root, 'hooks', 'commit-msg'), 0o755);
  git(root, 'config', 'core.hooksPath', 'hooks');
  if (command) {
    fs.mkdirSync(path.join(root, 'bin'));
    fs.copyFileSync(path.join(REPO, 'bin', 'commit-msg.mjs'), path.join(root, 'bin', 'commit-msg.mjs'));
  }
  fs.writeFileSync(path.join(root, 'a.txt'), 'a\n');
  git(root, 'add', 'a.txt');
  return root;
}

const message = `${BODY}\n${HUMAN_CO_AUTHOR}\n${HOST_CO_AUTHOR}\n${HOST_SESSION}`;

test("the repository's commit-msg hook makes the commit without the host's lines and says so", { skip }, () => {
  const root = scratch({ command: true });
  const commit = git(root, 'commit', '-q', '-m', message);
  assert.match(commit.stderr, /js-harness commit-msg: removed the host's attribution lines: Co-Authored-By: Claude Opus 5\.5/);
  assert.equal(git(root, 'log', '-1', '--format=%B').stdout, `${BODY}\n${HUMAN_CO_AUTHOR}\n\n`);
});

test('on a branch with no bin/commit-msg.mjs the hook lets the message be and the commit goes', { skip }, () => {
  const root = scratch({ command: false });
  git(root, 'commit', '-q', '-m', message);
  assert.equal(git(root, 'log', '-1', '--format=%B').stdout, `${message}\n\n`);
});
