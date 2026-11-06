import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { commentMarks, commitMsgMain, lastCommentSetting, replaceFile, stripAttribution } from './commit-msg.mjs';

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

test('a human co-author named Claude stays; the host\'s name with no address goes', () => {
  const human = 'Co-Authored-By: Claude Dupont <claude@example.fr>';
  const { text, removed } = stripAttribution(`${BODY}\n${human}\nCo-Authored-By: Claude\nCo-Authored-By: Claude Code <x@example.com>\n`);
  assert.equal(text, `${BODY}\n${human}\n`);
  assert.deepEqual(removed, ['Co-Authored-By: Claude', 'Co-Authored-By: Claude Code <x@example.com>']);
});

test('a host line quoted in the body stays: only the trailers that end the message go', () => {
  const quoted = `fix: x\n\nThe app writes:\n${HOST_CO_AUTHOR}\nand the hook takes it out.\n\n${HOST_SESSION}\n\nAnd a paragraph after it.\n`;
  assert.deepEqual(stripAttribution(quoted), { text: quoted, removed: [] });
  const alone = `fix: x\n\n${HOST_CO_AUTHOR}\n\nThe paragraph above is a quote.\n\nSigned-off-by: Ana Gómez <ana@example.com>\n${HOST_SESSION}\n`;
  const { text, removed } = stripAttribution(alone);
  assert.equal(text, `fix: x\n\n${HOST_CO_AUTHOR}\n\nThe paragraph above is a quote.\n\nSigned-off-by: Ana Gómez <ana@example.com>\n`);
  assert.deepEqual(removed, [HOST_SESSION]);
});

test('host trailers right under a body line, with no blank line between, go; the subject line never does', () => {
  const { text, removed } = stripAttribution(`fix: x\n\nWhy it is made.\n${HOST_CO_AUTHOR}\n${HOST_SESSION}\n`);
  assert.equal(text, 'fix: x\n\nWhy it is made.\n');
  assert.deepEqual(removed, [HOST_CO_AUTHOR, HOST_SESSION]);
  assert.deepEqual(stripAttribution(`fix: x\n${HOST_CO_AUTHOR}\n`), { text: 'fix: x\n', removed: [HOST_CO_AUTHOR] });
  assert.deepEqual(stripAttribution(`${HOST_SESSION}\n`), { text: `${HOST_SESSION}\n`, removed: [] });
});

test('the comment lines of another core.commentChar, or of auto, do not keep the trailers in', () => {
  const below = (mark) => `${BODY}\n${HOST_CO_AUTHOR}\n${HOST_SESSION}\n${mark} Please enter the commit message for your changes.\n${mark}\n`;
  assert.equal(stripAttribution(below(';'), { comments: [';'] }).text, `${BODY}\n; Please enter the commit message for your changes.\n;\n`);
  assert.equal(stripAttribution(below('%'), { comments: commentMarks('auto', below('%')) }).text, `${BODY}\n% Please enter the commit message for your changes.\n%\n`);
  assert.deepEqual(stripAttribution(below(';')).removed, [], 'with the default mark, a ; line is prose');
  assert.deepEqual(commentMarks(null), ['#']);
  assert.deepEqual(commentMarks('//'), ['//']);
});

test('under auto, the one mark git picked counts: a prose line that starts with another candidate is no comment', () => {
  const prose = `fix: document syntax\n\n${HOST_SESSION}\n!This is explanatory prose\n`;
  assert.deepEqual(stripAttribution(prose, { comments: commentMarks('auto', prose) }), { text: prose, removed: [] });
  assert.deepEqual(commentMarks('auto', `${BODY}\n#x\n; Please enter\n;\n`), [';']);
  assert.deepEqual(commentMarks('auto', `${BODY}\n${HOST_SESSION}\n`), ['#']);
});

test("the last of git's comment aliases in config order is the mark", () => {
  assert.equal(lastCommentSetting('core.commentstring //\ncore.commentchar ;\n'), ';');
  assert.equal(lastCommentSetting('core.commentchar ;\ncore.commentstring //\n'), '//');
  assert.equal(lastCommentSetting(''), null);
});

test('the diff git -v leaves under its scissors line is not the end of the message', () => {
  const scissors = '# ------------------------ >8 ------------------------';
  const message = `${BODY}\n${HOST_CO_AUTHOR}\n${scissors}\n# Do not modify or remove the line above.\ndiff --git a/a.txt b/a.txt\n+${HOST_SESSION}\n`;
  const { text, removed } = stripAttribution(message);
  assert.equal(text, `${BODY}\n${scissors}\n# Do not modify or remove the line above.\ndiff --git a/a.txt b/a.txt\n+${HOST_SESSION}\n`);
  assert.deepEqual(removed, [HOST_CO_AUTHOR]);
});

test('under auto with git -v, the mark is read above the scissors line, not from the diff under it', () => {
  const above = `${BODY}\n${HOST_CO_AUTHOR}\n${HOST_SESSION}\n; Please enter the commit message for your changes.\n;\n`;
  const message = `${above}; ------------------------ >8 ------------------------\n; Do not modify or remove the line above.\ndiff --git a/a.txt b/a.txt\n+added\n context\n`;
  assert.deepEqual(commentMarks('auto', message), [';']);
  assert.deepEqual(stripAttribution(message, { comments: commentMarks('auto', message) }).removed, [HOST_CO_AUTHOR, HOST_SESSION]);
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

test('a message in another encoding than UTF-8 keeps every byte but the lines that go', () => {
  // `é` and `ï` in ISO-8859-1, as a repository with i18n.commitEncoding=ISO-8859-1 writes them.
  const latin = Buffer.concat([Buffer.from('fix: caf'), Buffer.from([0xe9]), Buffer.from(' na'), Buffer.from([0xef]), Buffer.from('f\n\n')]);
  const files = { MSG: Buffer.concat([latin, Buffer.from(`${HOST_CO_AUTHOR}\n`)]) };
  const { deps } = seams(files);
  assert.equal(commitMsgMain(['MSG'], deps), 0);
  assert.deepEqual(files.MSG, latin);
});

test('the message is replaced whole or not at all: a rename that fails leaves the file and no temporary beside it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-commit-msg-replace-'));
  made.push(dir);
  const file = path.join(dir, 'COMMIT_EDITMSG');
  fs.writeFileSync(file, `${BODY}\n${HOST_SESSION}\n`);
  assert.throws(() => replaceFile(file, Buffer.from(BODY), { rename: () => { throw Object.assign(new Error('EPERM'), { code: 'EPERM' }); }, platform: 'linux' }), /EPERM/);
  assert.equal(fs.readFileSync(file, 'utf8'), `${BODY}\n${HOST_SESSION}\n`);
  assert.deepEqual(fs.readdirSync(dir), ['COMMIT_EDITMSG']);
  replaceFile(file, Buffer.from(BODY));
  assert.equal(fs.readFileSync(file, 'utf8'), BODY);
  assert.deepEqual(fs.readdirSync(dir), ['COMMIT_EDITMSG']);
});

/** The seams of the command, with the message file held in memory as bytes. */
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
        return Buffer.from(files[file]);
      },
      commentConfig: () => null,
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
  assert.equal(files.MSG.toString('utf8'), `${BODY}\n`);
  assert.deepEqual(writes, ['MSG']);
  assert.deepEqual(err, [`js-harness commit-msg: removed the host's attribution lines: ${HOST_CO_AUTHOR} | ${HOST_SESSION}`]);
});

test("the command reads git's comment mark, so an editor's ; lines under the trailers do not keep them", () => {
  const files = { MSG: `${BODY}\n${HOST_CO_AUTHOR}\n; Please enter the commit message for your changes.\n` };
  const { deps } = seams(files);
  deps.commentConfig = () => ';';
  assert.equal(commitMsgMain(['MSG'], deps), 0);
  assert.equal(files.MSG.toString('utf8'), `${BODY}\n; Please enter the commit message for your changes.\n`);
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
    fs.mkdirSync(path.join(root, 'bin', 'lib'), { recursive: true });
    for (const file of ['commit-msg.mjs', 'lib/atomic-write.mjs']) fs.copyFileSync(path.join(REPO, 'bin', file), path.join(root, 'bin', file));
  }
  fs.writeFileSync(path.join(root, 'a.txt'), 'a\n');
  git(root, 'add', 'a.txt');
  return root;
}

const message = `${BODY}\n${HUMAN_CO_AUTHOR}\n${HOST_CO_AUTHOR}\n${HOST_SESSION}`;

// docs/FAILURES.md quotes this title as the Control of commit-attribution-from-host: renaming it loses the control.
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

test('a hook whose script throws lets the commit go with the message as given', { skip }, () => {
  const broken = scratch({ command: true });
  fs.writeFileSync(path.join(broken, 'bin', 'commit-msg.mjs'), 'this is not javascript (\n');
  git(broken, 'commit', '-q', '-m', message);
  assert.equal(git(broken, 'log', '-1', '--format=%B').stdout, `${message}\n\n`);
});

test('a hook that finds no node on the PATH lets the commit go with the message as given', { skip }, (t) => {
  const noNode = scratch({ command: true });
  const separator = process.platform === 'win32' ? ';' : ':';
  const pathKey = Object.keys(process.env).find((key) => key.toUpperCase() === 'PATH');
  const withoutNode = process.env[pathKey]
    .split(separator)
    .filter((dir) => dir !== '' && !['node', 'node.exe', 'node.cmd'].some((name) => fs.existsSync(path.join(dir, name))))
    .join(separator);
  const env = { ...process.env, [pathKey]: withoutNode };
  if (spawnSync('git', ['--version'], { env }).status !== 0) {
    t.skip('git lives in a folder of node, so no PATH has git without node');
    return;
  }
  // `command -v` exits 1 in bash and 127 in dash when the name is not found.
  const lookup = spawnSync('sh', ['-c', 'command -v node'], { encoding: 'utf8', env });
  if (lookup.error !== undefined) {
    t.skip('sh lives in a folder of node, or off the PATH, so the lookup cannot be asked');
    return;
  }
  assert.notEqual(lookup.status, 0, `node is still on the PATH the commit runs with: ${lookup.stdout}`);
  const commit = spawnSync('git', ['commit', '-q', '-m', message], { cwd: noNode, encoding: 'utf8', env });
  assert.equal(commit.status, 0, commit.stderr);
  assert.equal(git(noNode, 'log', '-1', '--format=%B').stdout, `${message}\n\n`);
});

test('js-harness commit-msg <file> runs the step through the dispatcher, as a project hook calls it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-commit-msg-dispatch-'));
  made.push(dir);
  const file = path.join(dir, 'COMMIT_EDITMSG');
  fs.writeFileSync(file, `${BODY}\n${HOST_CO_AUTHOR}\n${HOST_SESSION}\n`);
  const run = spawnSync(process.execPath, [path.join(REPO, 'bin', 'js-harness.mjs'), 'commit-msg', file], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /^js-harness commit-msg: removed the host's attribution lines: /);
  assert.equal(fs.readFileSync(file, 'utf8'), `${BODY}\n`);
});
