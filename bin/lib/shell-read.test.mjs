// Tests of `readShell` (bin/lib/shell-read.mjs): the commands, words and heredoc bodies it reads out of a Bash command,
// and that what it cannot read whole is said broken (odd/tasks/advisor-use.md, T8). The acts the advisor gate reads from
// them are tested in bin/advisor-gate.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readShell } from './shell-read.mjs';

// The words of a source read whole: a fixture that reads broken fails here, so no expectation rests on a partial read.
const words = (source) => {
  const read = readShell(source);
  assert.equal(read.broken, false, `read whole: ${JSON.stringify(source)}`);
  return read.commands.map((c) => c.words.map((w) => w.text));
};

test('a command is split into its commands and words, quotes taken off', () => {
  assert.deepEqual(words(`a 'b c' "d $x" e\\ f && g | h; i\nj`), [['a', 'b c', 'd $x', 'e f'], ['g'], ['h'], ['i'], ['j']]);
  assert.deepEqual(words("echo $'it\\'s' x"), [['echo', "it's", 'x']]);
  assert.deepEqual(words('a # b c\nd'), [['a'], ['d']], 'a comment ends at its line');
  assert.deepEqual(words('a#b'), [['a#b']], 'a # inside a word is a character');
  const piped = readShell('cat <<EOF | bash\nx\nEOF');
  assert.equal(piped.broken, false);
  assert.deepEqual(piped.commands.map((c) => [c.words.map((w) => w.text), c.stdin]), [[['cat'], null], [['bash'], 'pipe']]);
  assert.equal(readShell('bash < s.sh').commands[0].stdin, 'file');
  assert.deepEqual(words('cmd 2>&1 >out <in'), [['cmd']], 'redirections and their targets are no words');
});

test('a substitution\'s commands are read, inside double quotes and heredoc bodies too', () => {
  assert.deepEqual(words('echo "$(a b)" `c d` <(e)'), [['a', 'b'], ['c', 'd'], ['e'], ['echo', '$(a b)', '`c d`', '<()']]);
  assert.deepEqual(words('cat <<EOF\n$(x y)\nEOF'), [['cat'], ['x', 'y']]);
  assert.deepEqual(words("cat <<'EOF'\n$(x y)\nEOF"), [['cat']], 'a quoted delimiter expands nothing');
  assert.deepEqual(words('echo $((1<<X))\nz\nX'), [['echo', '$((1<<X))'], ['z'], ['X']], 'an arithmetic shift opens no heredoc');
  // The lenses on ffe98caa.
  assert.deepEqual(words('echo $[1<<X]\nz\nX]'), [['echo', '$[1<<X]'], ['z'], ['X]']], 'nor does the old arithmetic $[…]');
  assert.deepEqual(words('(( y = $(a b) ))'), [['a', 'b']], 'an arithmetic command runs its substitutions');
  assert.deepEqual(words('cmds=(a "b c" $(d)) e'), [['d'], ['cmds=(a "b c" $(d))', 'e']], 'an array assignment is one word');
});

test('bash\'s blanks are a space and a tab alone, and a named descriptor is no word (the verifier, round 1)', () => {
  assert.deepEqual(words('true\r#; x'), [['true\r#'], ['x']], 'a carriage return is a character of its word');
  assert.deepEqual(words('true\f#; x'), [['true\f#'], ['x']]);
  assert.deepEqual(words('true #; x'), [['true #'], ['x']]);
  assert.deepEqual(words('cat <<EOF\r\r\nEOF\r\r\nx\nEOF\n').slice(1), [['x'], ['EOF']], 'the end line is compared whole, its carriage returns too');
  assert.deepEqual(words('cat <<EOF\r\nx\nEOF\r\r\ny\nEOF\r\n'), [['cat']], 'a line with one carriage return more stays in the body');
  assert.deepEqual(words('cat <<E\fOF\nE\fOF\nx\n'), [['cat'], ['x']]);
  assert.deepEqual(words('cat <<EOF\r\nx\r\nEOF\r\ny\r\n'), [['cat'], ['y']], 'a line ends at \\r\\n, as Git for Windows\' bash reads it');
  assert.deepEqual(words('cmd {x}>&2 a 2>/dev/null b'), [['cmd', 'a', 'b']]);
  const splits = readShell('x "$(a "b")" a$b "c"$d').commands.at(-1).words.map((v) => Boolean(v.splits));
  assert.deepEqual(splits, [false, false, true, true], 'an expansion outside double quotes splits');
  assert.deepEqual(words('echo "`a \\"b\\"`"'), [['a', 'b'], ['echo', '`a \\"b\\"`']], 'a double-quoted backtick takes the backslash off a quote');
});

test('ANSI-C quoting is decoded as bash decodes it', () => {
  assert.deepEqual(words("x $'\\x6aa\\n\\t\\101\\u0042\\'\\\\'"), [['x', "ja\n\tAB'\\"]]);
  assert.equal(readShell("cat <<$'E'\n$(x)\nE").commands.length, 1, "a $'…' delimiter is quoted");
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
  // The lenses on 9bc45aae.
  assert.deepEqual(words('echo $((`a b` + 1))'), [['a', 'b'], ['echo', '$((`a b` + 1))']], 'a backtick inside arithmetic runs');
  assert.equal(readShell("echo $((x+'y'))").broken, true, 'a quote inside arithmetic is not read as arithmetic');
  assert.equal(readShell('echo $((JS-HARNESS))').broken, true, 'the name, case aside');
  assert.equal(readShell("echo $'\\U00110000'").broken, true, 'an escape past the last code point is broken, never a throw');
  assert.deepEqual(words('$"a b" c'), [['a b', 'c']], 'locale quoting is double quoting');
  // The verifier, round 2.
  assert.equal(readShell('x=$(cat <<EOF\nhi\nEOF)\ny\nEOF\n)').broken, true, 'a delimiter line with a ) after it, inside a substitution');
  const globs = readShell('x "--lan"? \\--la? \'a\'[n] ~ "~" b {c,d} "{c,d}"').commands[0].words.map((v) => Boolean(v.globs));
  assert.deepEqual(globs, [false, true, true, true, true, false, false, true, false], 'a glob, brace or tilde character outside quotes');
  assert.equal(readShell('a "b" \'c\' $(d) `e`').broken, false);
  // Codex on 7bb1753..92695d2: forms whose commands this reading would lose are said broken, never read.
  for (const source of [
    'cat <<EOF\nx\nE\\\nOF\ny\nEOF', // a continued line of an unquoted body may join into its end line
    'x=${ a; }', 'x=${\ta; }', 'x=${\na; }', 'x=${| a; }', // bash 5.3's substitutions in the current shell
    'echo ${x:-{}; a }', // a literal brace in an operand
    'cat ${p:-<(a)}', 'cat ${p:->(a)}', // a process substitution in an operand
    "x $'a\\0b'", "x $'a\\x00b'", "x $'a\\u0000b'", // a decoded NUL, where bash cuts the word
  ]) assert.equal(readShell(source).broken, true, source);
  assert.deepEqual(words("cat <<'EOF'\nE\\\nOF\nEOF"), [['cat']], 'a quoted body joins no lines');
  assert.deepEqual(words('echo ${x:-y} ${#a[@]} ${x/a/b} "${y:-${z}}" ${x:-$(a)}'), [['a'], ['echo', '${x:-y}', '${#a[@]}', '${x/a/b}', '${y:-${z}}', '${x:-$(a)}']]);
});
