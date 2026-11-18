// Tests of `readShell` (bin/lib/shell-read.mjs): the commands, words and heredoc bodies it reads out of a Bash command,
// and that what it cannot read whole is said broken (odd/tasks/advisor-use.md, T8). The acts the advisor gate reads from
// them are tested in bin/advisor-gate.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readShell } from './shell-read.mjs';

const words = (source) => readShell(source).commands.map((c) => c.words.map((w) => w.text));

test('a command is split into its commands and words, quotes taken off', () => {
  assert.deepEqual(words(`a 'b c' "d $x" e\\ f && g | h; i\nj`), [['a', 'b c', 'd $x', 'e f'], ['g'], ['h'], ['i'], ['j']]);
  assert.deepEqual(words("echo $'it\\'s' x"), [['echo', "it's", 'x']]);
  assert.deepEqual(words('a # b c\nd'), [['a'], ['d']], 'a comment ends at its line');
  assert.deepEqual(words('a#b'), [['a#b']], 'a # inside a word is a character');
  assert.equal(readShell('cat <<EOF | bash').commands[1].stdin, 'pipe');
  assert.equal(readShell('bash < s.sh').commands[0].stdin, 'file');
  assert.deepEqual(words('cmd 2>&1 >out <in'), [['cmd']], 'redirections and their targets are no words');
});

test('a substitution\'s commands are read, inside double quotes and heredoc bodies too', () => {
  assert.deepEqual(words('echo "$(a b)" `c d` <(e)'), [['a', 'b'], ['c', 'd'], ['e'], ['echo', '$(a b)', '`c d`', '<()']]);
  assert.deepEqual(words('cat <<EOF\n$(x y)\nEOF'), [['cat'], ['x', 'y']]);
  assert.deepEqual(words("cat <<'EOF'\n$(x y)\nEOF"), [['cat']], 'a quoted delimiter expands nothing');
  assert.deepEqual(words('echo $((1<<X))\nz\nX'), [['echo', '$((1<<X))'], ['z'], ['X']], 'an arithmetic shift opens no heredoc');
});

test('a heredoc body is kept with the command it feeds, not read as commands', () => {
  const read = readShell("cat > f <<'EOF'\nit's here\nEOF\nnext 'x'");
  assert.equal(read.broken, false);
  assert.deepEqual(read.commands.map((c) => c.words.map((w) => w.text)), [['cat'], ['next', 'x']]);
  assert.deepEqual(read.commands[0].heredocs.map((h) => [h.text, h.quoted]), [["it's here", true]]);
  assert.equal(readShell('cat <<-E\n\tx\n\tE').commands[0].heredocs[0].text, 'x', '<<- takes the tabs off');
});

test('what cannot be read whole is broken', () => {
  for (const source of ['a "b', "a 'b", 'a $(b', 'a `b', 'cat <<EOF\nx', 'a ${b', 'cat <<EOF']) assert.equal(readShell(source).broken, true, source);
  assert.equal(readShell('echo $((cd x && js-harness y))').broken, true, 'a $(( that names js-harness is not trusted as arithmetic');
  assert.equal(readShell('echo "$(case x in x) y;; esac)"').broken, true, 'a case pattern\'s ) inside a substitution');
  assert.equal(readShell('case x in x) y;; esac').broken, false, 'a case outside one is read');
  assert.equal(readShell('a "b" \'c\' $(d) `e`').broken, false);
});
