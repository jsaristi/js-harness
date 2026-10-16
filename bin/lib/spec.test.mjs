import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SPEC_PATH, checkSpec, parseSpec, specFindings } from './spec.mjs';

/** The lines of one capability: its heading and the six fields, each given or the default text. */
function capability(title, fields = {}) {
  const given = {
    Problem: 'A reply closed with no state, and the user could not tell what came next.',
    Requirement: 'A reply that ends a turn closes with one of the declared states.',
    Reason: 'The user reads the last line from a phone.',
    Proof: '`node --test bin/lib/reply.test.mjs`',
    Discarded: 'A rule in prose alone: replies kept closing without a state.',
    Today: '`bin/lib/reply.mjs`, `js-harness reply`',
    ...fields,
  };
  return [`### ${title}`, '', ...Object.entries(given).filter(([, text]) => text !== null).map(([name, text]) => `**${name}:** ${text}`), ''];
}

/** A specification whose capabilities are `entries`, each a list of lines. */
function spec(...entries) {
  return ['# The specification', '', 'The problem and the bet.', '', '## Capabilities', '', ...entries.flat()].join('\n');
}

const files = new Set(['bin/lib/reply.mjs', 'bin/reply.mjs', 'docs/SPEC.md']);
const exists = (file) => files.has(file);
/** What a project's own specification is held to: no list of the harness's commands or entries. */
const plain = { exists };
/** What the harness's own specification is held to. */
const own = { exists, commands: ['reply'], entries: ['claude-reply-hook'], homeFiles: ['~/.js-harness/manifest.json'] };
const claimsAll = '`bin/lib/reply.mjs`, `js-harness reply`, `claude-reply-hook`, `~/.js-harness/manifest.json`';

test('parseSpec reads each capability under "## Capabilities" with its fields and the line of its heading', () => {
  const { capabilities, errors } = parseSpec(spec(capability('The reply check', { Requirement: 'It closes with a state,\nwritten on two lines.' })));
  assert.deepEqual(errors, []);
  assert.equal(capabilities.length, 1);
  assert.equal(capabilities[0].title, 'The reply check');
  assert.equal(capabilities[0].line, 7);
  assert.equal(capabilities[0].fields.Requirement, 'It closes with a state,\nwritten on two lines.');
  assert.equal(capabilities[0].fields.Proof, '`node --test bin/lib/reply.test.mjs`');
});

test('a capability that lacks one of the six fields is a finding naming it and the field', () => {
  const { findings } = specFindings(spec(capability('The reply check', { Discarded: null })), plain);
  assert.deepEqual(findings, ['"The reply check" (line 7) has no **Discarded:** field']);
});

test('a capability whose proof names no command in backticks is a finding', () => {
  const { findings } = specFindings(spec(capability('The reply check', { Proof: 'the tests of the reply check' })), plain);
  assert.deepEqual(findings, ['"The reply check" (line 7) has no command in backticks in its **Proof:** field']);
});

test('a file the today line names that does not exist is a finding; a path:line is read as its path', () => {
  const kept = specFindings(spec(capability('The reply check', { Today: '`bin/reply.mjs:12`, `bin/lib/reply.mjs`' })), plain);
  assert.deepEqual(kept.findings, []);
  const gone = specFindings(spec(capability('The reply check', { Today: '`bin/lib/replies.mjs`' })), plain);
  assert.deepEqual(gone.findings, ['"The reply check" (line 7) names bin/lib/replies.mjs in **Today:**, which does not exist']);
});

test('a today item that is no file, command, entry or home path is a finding', () => {
  const { findings } = specFindings(spec(capability('The reply check', { Today: '`the reply hook`' })), plain);
  assert.deepEqual(findings, ['"The reply check" (line 7) names "the reply hook" in **Today:**: an item there is a file of the repository, `js-harness <command>`, an id of the manifest or a path under `~/`']);
});

test('in the harness, a command of the dispatcher no capability claims is a finding, and so is a claimed one it lacks', () => {
  const unclaimed = specFindings(spec(capability('The reply check', { Today: '`bin/lib/reply.mjs`, `claude-reply-hook`, `~/.js-harness/manifest.json`' })), own);
  assert.deepEqual(unclaimed.findings, ['the command `js-harness reply` is claimed by no capability']);
  const unknown = specFindings(spec(capability('The reply check', { Today: `${claimsAll}, \`js-harness replies\`` })), own);
  assert.deepEqual(unknown.findings, ['"The reply check" (line 7) claims `js-harness replies`, which the dispatcher does not have']);
});

test('in the harness, an entry the manifest installs that no capability claims is a finding', () => {
  const { findings } = specFindings(spec(capability('The reply check', { Today: '`bin/lib/reply.mjs`, `js-harness reply`, `~/.js-harness/manifest.json`' })), own);
  assert.deepEqual(findings, ['the manifest entry `claude-reply-hook` is claimed by no capability']);
});

test('in the harness, a file written outside the repository that no capability claims is a finding', () => {
  const { findings } = specFindings(spec(capability('The reply check', { Today: '`bin/lib/reply.mjs`, `js-harness reply`, `claude-reply-hook`' })), own);
  assert.deepEqual(findings, ['the file `~/.js-harness/manifest.json`, written outside the repository, is claimed by no capability']);
});

test('in the harness, a specification that claims everything once has no finding, and claims may be spread over capabilities', () => {
  const one = specFindings(spec(capability('The reply check', { Today: claimsAll })), own);
  assert.deepEqual(one.findings, []);
  const spread = specFindings(spec(
    capability('The reply check', { Today: '`bin/lib/reply.mjs`, `js-harness reply`' }),
    capability('Install and undo', { Today: '`claude-reply-hook`, `~/.js-harness/manifest.json`' }),
  ), own);
  assert.deepEqual(spread.findings, []);
});

test('a specification with no capability is a finding', () => {
  const { findings } = specFindings('# The specification\n\nThe problem.\n', plain);
  assert.deepEqual(findings, [`${SPEC_PATH} holds no capability: each is a "### " heading under "## Capabilities"`]);
});

/** A folder holding `docs/SPEC.md` with `text`, removed after `body` runs. */
function withSpec(text, body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-spec-'));
  try {
    if (text !== null) {
      fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(dir, SPEC_PATH), text);
    }
    return body(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('checkSpec gives no row where the project keeps no docs/SPEC.md', () => {
  withSpec(null, (dir) => assert.deepEqual(checkSpec(dir, { own: false }), []));
});

test('checkSpec passes with the counts, and fails with one line per finding', () => {
  withSpec(spec(capability('The reply check', { Today: '`docs/SPEC.md`' })), (dir) => {
    assert.deepEqual(checkSpec(dir, { own: false }), [{ name: 'spec', pass: true, detail: '1 capability, each with its proof and its files' }]);
  });
  withSpec(spec(capability('The reply check', { Today: '`docs/SPEC.md`', Proof: 'none' })), (dir) => {
    assert.deepEqual(checkSpec(dir, { own: false }), [{
      name: 'spec', pass: false, detail: `1 finding in ${SPEC_PATH}`,
      lines: ['"The reply check" (line 7) has no command in backticks in its **Proof:** field'],
    }]);
  });
});

test('checkSpec holds the harness\'s own specification to its commands, entries and home files', () => {
  withSpec(spec(capability('The reply check', { Today: '`docs/SPEC.md`' })), (dir) => {
    const [row] = checkSpec(dir, { own: true, commands: ['reply'], entries: [], homeFiles: [] });
    assert.equal(row.pass, false);
    assert.deepEqual(row.lines, ['the command `js-harness reply` is claimed by no capability']);
  });
});
