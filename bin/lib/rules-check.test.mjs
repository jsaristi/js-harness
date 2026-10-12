// Tests for rules-check.mjs. Every text is an inline string, so no test reads the disk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRules, findReads, namedRules, sentenceOf } from './rules-check.mjs';
import { RULES } from './rules-data.mjs';
import { renderList, writeRules } from './rules.mjs';

const HOME = 'docs/REVIEW.md';
const HOME_TEXT = 'The review leaves a note on every slice.';
const HOME_SENTENCE = 'The review leaves a note on every slice.';
const DESIGN = { kind: 'design', path: 'odd/tasks/rule-hierarchy.md' };
const WORDS = {
  kind: 'words',
  quotes: [{ quote: 'Sixty minutes, and the flag', date: '2026-10-08', session: 'session-1', line: 12 }],
  reading: 'a gate waits an hour before it gives up',
  accepted: 'yes',
  checked: { date: '2026-10-11', by: 'session' },
};
const CODE = [{ path: 'bin/lib/gate.mjs', text: "ruleValue('gate-wait', 'minutes')" }];
const READERS = { 'gate-wait': ['bin/lib/gate.mjs'] };
const SENTENCES = { 'review-note': HOME_SENTENCE };
const SOURCES = { 'gate-wait': DESIGN, 'review-note': DESIGN };
// A rule retired and replaced by one rule, and a rule retired and replaced by none.
const OLD = { id: 'old-wait', subject: 'how long a gate waited before the change', owner: 'project', since: '2026-10-01', retired: '2026-10-11', successors: ['gate-wait'] };
const GONE = { id: 'gone-rule', subject: 'a rule that no rule replaces', owner: 'project', since: '2026-10-01', retired: '2026-10-09', successors: [] };

/** The two declared rules of the clean input: a value that code reads, and a rule in prose that its file holds. */
function declared() {
  return [
    { id: 'gate-wait', subject: 'how long a gate waits for its turn', owner: 'project', since: '2026-10-11', value: 60, unit: 'minutes', flag: '--wait' },
    { id: 'review-note', subject: 'the note a review leaves on a slice', owner: 'project', since: '2026-10-10', path: HOME, phrases: ['review leaves a note'] },
  ];
}

/** The input of checkRules, clean by default. Its two texts are written from `rules` and `sources`, with the
 * readers and sentences that the clean input has, so that one test changes one thing; `rest` replaces any field. */
function build({ rules = declared(), sources = SOURCES, codeFiles = CODE, readers = READERS, sentences = SENTENCES, ...rest } = {}) {
  return {
    rules,
    sources,
    dataText: writeRules(rules),
    listText: renderList(rules, { sources: sources ?? {}, readers, sentences }),
    codeFiles,
    textFiles: [],
    readFile: (path) => (path === HOME ? HOME_TEXT : null),
    ...rest,
  };
}

test('findReads finds the id of a call written with single quotes', () => {
  const reads = findReads([{ path: 'bin/a.mjs', text: "const gate = ruleValue('gate-wait', 'minutes');" }]);
  assert.deepEqual(reads, [{ path: 'bin/a.mjs', id: 'gate-wait' }]);
});

test('findReads finds the id of a call written with double quotes', () => {
  const reads = findReads([{ path: 'bin/a.mjs', text: 'const gate = ruleValue("gate-wait", "minutes");' }]);
  assert.deepEqual(reads, [{ path: 'bin/a.mjs', id: 'gate-wait' }]);
});

test('findReads finds a call with spaces after its parenthesis', () => {
  const reads = findReads([{ path: 'bin/a.mjs', text: "ruleValue(   'review-effort'  )" }]);
  assert.deepEqual(reads, [{ path: 'bin/a.mjs', id: 'review-effort' }]);
});

test('findReads keeps the calls of one file in text order, and the files in order', () => {
  const reads = findReads([
    { path: 'bin/a.mjs', text: "ruleValue('review-effort')\nruleValue('gate-wait', 'minutes')" },
    { path: 'bin/b.mjs', text: "ruleValue('gate-wait', 'minutes')" },
  ]);
  assert.deepEqual(reads, [
    { path: 'bin/a.mjs', id: 'review-effort' },
    { path: 'bin/a.mjs', id: 'gate-wait' },
    { path: 'bin/b.mjs', id: 'gate-wait' },
  ]);
});

test('findReads finds no call whose first argument is not a string literal', () => {
  const reads = findReads([{ path: 'bin/a.mjs', text: "ruleValue(id, 'minutes'); ruleValue(ids[0]); ruleValue(`gate-wait`)" }]);
  assert.deepEqual(reads, []);
});

test('sentenceOf gives the sentence at the start of a text', () => {
  assert.equal(sentenceOf('Alpha beta. Gamma delta.', 'Alpha beta'), 'Alpha beta.');
});

test('sentenceOf gives the sentence in the middle of a text', () => {
  assert.equal(sentenceOf('One. Two target three. Four.', 'target'), 'Two target three.');
});

test('sentenceOf runs to the end of a text that has no final period', () => {
  assert.equal(sentenceOf('Alpha beta. Gamma delta', 'delta'), 'Gamma delta');
});

test('sentenceOf finds a phrase whose words are split by a line break', () => {
  assert.equal(sentenceOf('Alpha beta.\nThe review\nleaves a note. Gamma.', 'review\nleaves  a note'), 'The review leaves a note.');
});

test('sentenceOf gives null when the text does not hold the phrase', () => {
  assert.equal(sentenceOf('Alpha beta.', 'gamma'), null);
});

test('namedRules finds a rule mark outside a fence', () => {
  const named = namedRules([{ path: 'docs/NOTES.md', text: 'See `rule:gate-wait` and `rule:review-effort`.' }]);
  assert.deepEqual(named, [
    { path: 'docs/NOTES.md', id: 'gate-wait' },
    { path: 'docs/NOTES.md', id: 'review-effort' },
  ]);
});

test('namedRules ignores a mark inside a fence, and a fence closes only with its own marker', () => {
  const text = [
    'Outside `rule:gate-wait`.',
    '```',
    'Inside `rule:review-note`.',
    '~~~',
    'Still inside `rule:old-wait`.',
    '```',
    'After `rule:gone-rule`.',
    '~~~',
    'Inside a tilde fence `rule:old-wait`.',
    '~~~',
  ].join('\n');
  assert.deepEqual(namedRules([{ path: 'docs/NOTES.md', text }]), [
    { path: 'docs/NOTES.md', id: 'gate-wait' },
    { path: 'docs/NOTES.md', id: 'gone-rule' },
  ]);
});

test('a fence opened with four marks closes only on a line of at least four, so a line of three stays inside', () => {
  const text = ['````', '```', 'Inside `rule:review-note`.', '````', 'After `rule:gone-rule`.'].join('\n');
  assert.deepEqual(namedRules([{ path: 'docs/NOTES.md', text }]), [{ path: 'docs/NOTES.md', id: 'gone-rule' }]);
});

test('a clean input gives no finding and no note, with the readers and sentences of its texts', () => {
  assert.deepEqual(checkRules(build()), { findings: [], notes: [], readers: READERS, sentences: SENTENCES });
});

test('readRules faults are the only findings, and nothing else is checked', () => {
  const rules = [{ id: 'Gate-wait', subject: 'how long a gate waits', owner: 'project', since: '2026-10-11', value: 60, unit: 'minutes' }];
  const result = checkRules(build({
    rules,
    sources: {},
    dataText: 'not the shape',
    listText: 'not the list',
    codeFiles: [{ path: 'bin/x.mjs', text: "ruleValue('nowhere')" }],
  }));
  assert.deepEqual(result, {
    findings: ['rule at index 0: the id is missing or is not lower-case words joined by hyphens'],
    notes: [],
    readers: {},
    sentences: {},
  });
});

test('a prose rule whose home file is not there is a finding', () => {
  const result = checkRules(build({ readFile: () => null, sentences: {} }));
  assert.deepEqual(result.findings, ['rule "review-note": its home docs/REVIEW.md is not there']);
});

test('a prose rule whose home file no longer holds its phrase is a finding', () => {
  const result = checkRules(build({ readFile: () => 'A review writes a comment on a slice.', sentences: {} }));
  assert.deepEqual(result.findings, ['rule "review-note": docs/REVIEW.md no longer holds the phrase "review leaves a note"']);
});

test('no sources file is a note, and the sources are not checked', () => {
  assert.deepEqual(checkRules(build({ sources: null })), {
    findings: [],
    notes: ['no docs/rule-sources.json here: the sources were not checked'],
    readers: READERS,
    sentences: SENTENCES,
  });
});

test('a rule with no source entry is a finding', () => {
  const result = checkRules(build({ sources: { 'review-note': DESIGN } }));
  assert.deepEqual(result.findings, ['rule "gate-wait": no source in docs/rule-sources.json']);
});

test('a source that is neither a design with its path nor his words is a finding', () => {
  const malformed = [
    { kind: 'design', path: '' },
    { kind: 'design', path: 5 },
    { ...WORDS, quotes: [] },
    { ...WORDS, quotes: [{ ...WORDS.quotes[0], date: '2026/10/08' }] },
    { ...WORDS, quotes: [{ ...WORDS.quotes[0], line: 0 }] },
    { ...WORDS, checked: { date: '2026-10-11', by: 'me' } },
  ];
  for (const source of malformed) {
    const result = checkRules(build({ sources: { 'gate-wait': source, 'review-note': DESIGN } }));
    assert.deepEqual(result.findings, [
      'rule "gate-wait": its source is not a design with its path, or his words with their quotes, reading, acceptance and check',
    ], JSON.stringify(source));
  }
});

test('a design on a rule of his is a finding', () => {
  const rules = declared();
  rules[0].owner = 'sebastian';
  const result = checkRules(build({ rules }));
  assert.deepEqual(result.findings, ['rule "gate-wait": a rule of his needs his words as its source']);
});

test('his words as the source of a rule of his give no finding', () => {
  const rules = declared();
  rules[0].owner = 'sebastian';
  const result = checkRules(build({ rules, sources: { 'gate-wait': WORDS, 'review-note': DESIGN } }));
  assert.deepEqual(result.findings, []);
});

test('a source whose key is the id of no rule is a finding', () => {
  const result = checkRules(build({ sources: { ...SOURCES, ghost: DESIGN } }));
  assert.deepEqual(result.findings, ['source "ghost": no rule has that id']);
});

test('a read of an id declared nowhere, or of a rule with no value, is a finding', () => {
  const rules = [declared()[0], OLD, declared()[1]];
  const codeFiles = [{ path: 'bin/x.mjs', text: "ruleValue('no-such-rule'); ruleValue('old-wait'); ruleValue('review-note')" }];
  const result = checkRules(build({ rules, codeFiles, readers: {} }));
  assert.deepEqual(result.findings, [
    'bin/x.mjs: reads rule "no-such-rule", which is declared nowhere',
    'bin/x.mjs: reads rule "old-wait", which has no value',
    'bin/x.mjs: reads rule "review-note", which has no value',
  ]);
});

test('a mark of a rule declared nowhere or retired is a finding, with what replaces it', () => {
  const rules = [declared()[0], GONE, OLD, declared()[1]];
  const textFiles = [{ path: 'docs/NOTES.md', text: 'See `rule:no-such`, `rule:gone-rule` and `rule:old-wait`.' }];
  const result = checkRules(build({ rules, textFiles }));
  assert.deepEqual(result.findings, [
    'docs/NOTES.md: names rule "no-such", which is declared nowhere',
    'docs/NOTES.md: names rule "gone-rule", retired on 2026-10-09, which no rule replaces',
    'docs/NOTES.md: names rule "old-wait", retired on 2026-10-11: read gate-wait instead',
  ]);
});

test('no dataText is a note, and its shape is not checked', () => {
  assert.deepEqual(checkRules(build({ dataText: null })), {
    findings: [],
    notes: ['no bin/lib/rules-data.mjs text was given: its shape was not checked'],
    readers: READERS,
    sentences: SENTENCES,
  });
});

test('a dataText that is not in the shape writeRules gives is a finding', () => {
  const dataText = writeRules(declared()).replace('"value": 60', '"value": 61');
  const result = checkRules(build({ dataText }));
  assert.deepEqual(result.findings, ['bin/lib/rules-data.mjs is not in the shape writeRules gives']);
});

test('a listText that is not the render of the declarations is a finding', () => {
  const result = checkRules(build({ listText: '# Rules\n' }));
  assert.deepEqual(result.findings, ['docs/RULES.md is not what the declarations render: run js-harness rules render']);
});

test('a missing listText with sources is a finding', () => {
  const result = checkRules(build({ listText: null }));
  assert.deepEqual(result.findings, ['docs/RULES.md is missing: run js-harness rules render']);
});

test('a missing listText without sources is a note, next to the note of the sources', () => {
  assert.deepEqual(checkRules(build({ sources: null, listText: null })), {
    findings: [],
    notes: [
      'no docs/rule-sources.json here: the sources were not checked',
      'no docs/RULES.md here: js-harness rules prints the list',
    ],
    readers: READERS,
    sentences: SENTENCES,
  });
});

test('CRLF line ends in dataText and listText give no finding', () => {
  const base = build();
  const result = checkRules({
    ...base,
    dataText: base.dataText.replace(/\n/g, '\r\n'),
    listText: base.listText.replace(/\n/g, '\r\n'),
  });
  assert.deepEqual(result, { findings: [], notes: [], readers: READERS, sentences: SENTENCES });
});

test('readers lists the readers of each value sorted and without repeats', () => {
  const readers = { 'gate-wait': ['bin/a.mjs', 'bin/z.mjs'] };
  const codeFiles = [
    { path: 'bin/z.mjs', text: "ruleValue('gate-wait', 'minutes'); ruleValue('gate-wait', 'minutes')" },
    { path: 'bin/a.mjs', text: "ruleValue('gate-wait', 'minutes')" },
  ];
  const result = checkRules(build({ codeFiles, readers }));
  assert.deepEqual(result.readers, readers);
  assert.deepEqual(result.findings, []);
});

test('the real list with a read of a rule it does not declare reports that read alone', () => {
  const result = checkRules({
    rules: RULES,
    sources: null,
    dataText: null,
    listText: null,
    codeFiles: [{ path: 'bin/x.mjs', text: "ruleValue('no-such-rule')" }],
    textFiles: [],
    readFile: () => null,
  });
  assert.deepEqual(result.findings, ['bin/x.mjs: reads rule "no-such-rule", which is declared nowhere']);
});

test('a source that cannot be rendered is a finding and never a throw: the list is not compared while it stands', () => {
  const input = build();
  const result = checkRules({ ...input, sources: { 'gate-wait': { kind: 'words' }, 'review-note': null } });
  assert.deepEqual(result.findings, [
    'rule "gate-wait": its source is not a design with its path, or his words with their quotes, reading, acceptance and check',
    'rule "review-note": its source is not a design with its path, or his words with their quotes, reading, acceptance and check',
  ]);
});

test('a sources file that is a list is refused as a whole', () => {
  const result = checkRules({ ...build(), sources: [] });
  assert.deepEqual(result.findings, ['docs/rule-sources.json is not an object keyed by rule id']);
});

test('a retired rule whose source is malformed is a finding, and a retired rule with no source entry is not', () => {
  const rules = [declared()[0], OLD, declared()[1]];
  const result = checkRules(build({ rules, sources: { ...SOURCES, 'old-wait': { kind: 'words' } } }));
  assert.deepEqual(result.findings, [
    'rule "old-wait": its source is not a design with its path, or his words with their quotes, reading, acceptance and check',
  ]);
  assert.deepEqual(checkRules(build({ rules })).findings, []);
});
