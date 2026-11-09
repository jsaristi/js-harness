// The diet's ten contradiction pairs (docs/proposals/harness-diet.md, section 3), each held closed by its own evidence
// (F8 S4b, odd/tasks/f8-s4b-contradictions.md, spec 2 and L4): "If two instructions contradict each other, Claude may
// pick one arbitrarily", and the diet found that a check drops the sightings and prose that states its own precedence
// mostly wins. So a pair is closed by a check, exercised here with a planted violation; by the sentence that states
// which side wins, which must stay in its home; by his decision, whose register entry must stay; and where its losing
// side was a phrase, that phrase must stay out of every text the harness ships or sends to an agent: the text sources of
// ./rules-sources.mjs and the modules it names as building a message at run time. A pair still open names the question
// that asks him, and holds both of its sides as they stand until his answer changes one.
//
// How to comply: a change that brings back a losing phrase, takes out a winning sentence or breaks a control turns its
// pair red; restore it, or close the pair again another way and change its row here in the same commit, saying why.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CUT_MESSAGE_SOURCES, MESSAGE_SOURCES, textSources } from './rules-sources.mjs';
import { depthPassJudge } from './depth-pass.mjs';
import { stripAttribution } from '../commit-msg.mjs';
import { noteRefusal } from './memory-feedback-guard.mjs';

const REPO = path.join(import.meta.dirname, '..', '..');
const read = (file) => {
  try {
    return fs.readFileSync(path.join(REPO, file), 'utf8');
  } catch {
    return null;
  }
};

// Every text the harness ships or sends: the text sources, and the producers whose messages are built at run time,
// read whole as source code, since a phrase in a template literal reaches the agent as written.
const SHIPPED = [
  ...textSources('0.0.0', read).map(({ id, text }) => ({ id, text })),
  ...[...MESSAGE_SOURCES, ...Object.keys(CUT_MESSAGE_SOURCES)].map((file) => ({ id: file, text: read(file) })),
];
const textOf = (id) => SHIPPED.find((source) => source.id === id)?.text ?? null;

/** The faults of one pair's evidence: `absent` phrases found in a shipped text, `present` sentences missing from their
 * home, and the `control` that no longer refuses its planted violation. */
function faultsOf({ absent = [], present = [], control = null }) {
  const faults = [];
  for (const phrase of absent) {
    for (const { id, text } of SHIPPED) if (phrase.test(text)) faults.push(`${id} holds the losing side ${phrase}`);
  }
  for (const [home, sentence] of present) {
    if (!(textOf(home) ?? read(home) ?? '').replace(/\s+/g, ' ').includes(sentence)) faults.push(`${home} no longer says "${sentence}"`);
  }
  if (control && !control()) faults.push('its control no longer refuses the planted violation');
  return faults;
}

const PAIRS = [
  {
    pair: 1,
    sides: 'the ODD header with Specs, Tasks and Log, against the contract first',
    closed: 'check: the depth-pass control refuses a document opened since the day with no contract',
    present: [['CLAUDE.md', 'in this order: the task contract; `## Depth pass`; `## Specs`']],
    control: () => depthPassJudge({ since: '2026-11-01', today: '2026-11-08', opened: new Map(), branch: null, staged: [], onTrunk: () => null, trail: () => [], version: () => null })('odd/tasks/x.md', '# X\n\n## Specs\n1. a spec\n').some((fault) => fault.startsWith('not a contract')),
  },
  {
    pair: 2,
    sides: 'a consent relayed as a Lossless Blocking Prompt, against a granted invocation run unasked',
    closed: 'text: both sides left with the old stack at S2',
    absent: [/Lossless Blocking/i, /--consent\b/],
  },
  {
    pair: 3,
    sides: '"Ask at most one question ... STOP", against "keep moving"',
    closed: 'text: both sides now say keep moving',
    absent: [/\bSTOP\b/],
    present: [['rules-block', 'One question at a time; keep doing what does not depend on the answer.'], ['CLAUDE.md', 'Everything else, keep moving']],
  },
  {
    pair: 4,
    sides: 'his rule against attribution, against the app\'s attribution reminder',
    closed: 'check: the commit-msg hook strips the host\'s attribution lines',
    present: [['rules-block', 'Never add "Co-Authored-By" or AI attribution to commits.']],
    control: () => {
      const { removed } = stripAttribution('feat: x\n\nWhy.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n');
      return removed.length === 1;
    },
  },
  {
    pair: 5,
    sides: 'review only for high-risk work, against a review of every candidate',
    closed: 'text and check: every slice with code is reviewed, held by the pre-push refusal; high risk gets a verifier only',
    absent: [/review only (?:for|when|on) high[- ]risk/i],
    present: [['CLAUDE.md', 'every slice with code goes through Codex and the Claude lenses']],
  },
  {
    pair: 6,
    sides: 'push and pull request as his decisions, against the lead\'s charter',
    closed: 'precedence: the protocols say the gate, the push and the pull request are not his, and the push goes by its switch',
    present: [
      ['protocols-skill', 'its own gate, push and pull request, none of which was the user\'s to decide'],
      ['protocols-skill', 'A push goes unasked where the project\'s `pushUnasked` switch reads on'],
    ],
  },
  {
    pair: 7,
    sides: 'the orchestrator never selects lenses, against picking every lens pertinent',
    closed: 'text: the first side left with the old stack at S2',
    absent: [/never select(?:s)? (?:the )?lens/i],
    present: [['CLAUDE.md', '--lenses <pertinent>']],
  },
  {
    pair: 8,
    sides: 'mem_save proactively, against the committed record and four other stores',
    closed: 'precedence and check: the feature document and the roadmap are the handoff and engram mirrors them; the guard refuses a feedback note with no home',
    absent: [/PROACTIVE/],
    present: [['CLAUDE.md', 'The two are the handoff, and nothing else is']],
    control: () => noteRefusal('feedback_x.md', '---\nname: x\ndescription: a rule he stated\nmetadata:\n  type: feedback\n---\nAlways do X.\n', '', 'a value', []) !== null,
  },
  {
    pair: 9,
    sides: 'three ways to ask, against one place for every question',
    closed: 'open: question 229 asks him which wins; wrap_up and the plain-text STOP are gone',
    absent: [/wrap_up/],
    present: [
      ['orchestrator-skill', 'Only where the host has no question tool is a question written out'],
      ['protocols-skill', 'Question: an open question of the conversation that the user answers in writing, not with buttons'],
    ],
  },
  {
    pair: 10,
    sides: '"never for size" and the model guide\'s advice against self-verification, against the double review',
    closed: 'his decision: rule:double-review, from his words',
    present: [['docs/RULES.md', '### double-review'], ['docs/RULES.md', 'Source: his words of 2026-10-31, 2026-10-31, 2026-11-01']],
  },
];

test('the shipped texts are all read: the text sources and every message producer', () => {
  assert.ok(SHIPPED.length >= 32, `only ${SHIPPED.length} texts were read`);
  for (const { id, text } of SHIPPED) assert.equal(typeof text, 'string', `${id} could not be read`);
});

test('the table holds the diet\'s ten pairs, each saying how it is closed and holding some evidence', () => {
  assert.deepEqual(PAIRS.map(({ pair }) => pair), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const row of PAIRS) {
    assert.match(row.closed, /^(check|text|precedence|his decision|open: question \d+)/, `pair ${row.pair}`);
    assert.ok((row.absent?.length ?? 0) + (row.present?.length ?? 0) + (row.control ? 1 : 0) > 0, `pair ${row.pair} holds no evidence`);
  }
});

for (const row of PAIRS) {
  test(`pair ${row.pair}, ${row.sides}: ${row.closed}`, () => {
    assert.deepEqual(faultsOf(row), []);
  });
}

test('a planted losing phrase or a missing winning sentence turns its pair red', () => {
  const planted = { absent: [/a phrase no text holds/] };
  assert.deepEqual(faultsOf(planted), []);
  SHIPPED.push({ id: 'planted', text: 'relay it as a Lossless Blocking Prompt' });
  try {
    assert.deepEqual(faultsOf(PAIRS[1]), ['planted holds the losing side /Lossless Blocking/i']);
  } finally {
    SHIPPED.pop();
  }
  assert.deepEqual(faultsOf({ present: [['CLAUDE.md', 'a sentence CLAUDE.md never held']] }), ['CLAUDE.md no longer says "a sentence CLAUDE.md never held"']);
  assert.deepEqual(faultsOf({ control: () => false }), ['its control no longer refuses the planted violation']);
});
