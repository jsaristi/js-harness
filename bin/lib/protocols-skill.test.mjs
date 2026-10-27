import { test } from 'node:test';
import assert from 'node:assert/strict';
import { protocolsSkillContent, PROTOCOLS } from './protocols-skill.mjs';
import { RULES } from './rules-data.mjs';
import { agentsTemplate } from './project.mjs';

const TEXT = protocolsSkillContent('0.1.0');

/** The sections of the skill: each `## ` heading with the lines under it, up to the next heading. */
function sections(text) {
  const found = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) found.push({ heading: line.slice(3), lines: [] });
    else if (found.length > 0) found.at(-1).lines.push(line);
  }
  return found;
}

test('section 3 gives a gentle-ai review a base on the first-parent line, and says what a timeout leaves', () => {
  const text = protocolsSkillContent();
  assert.ok(text.includes('a base on the head\'s first-parent line'));
  assert.ok(text.includes('`js-harness guard` refuses such a base'));
  assert.ok(text.includes('When a gentle-ai command ends with `operation_timeout`, run that same command once more'));
  assert.ok(text.includes('the words "not reviewed", and Codex reviews the range'));
});

test('the protocols skill has a one-line description a host can read, with the version', () => {
  const frontmatter = /^---\nname: js-harness-protocols\ndescription: (.+)\n---\n/.exec(TEXT);
  assert.ok(frontmatter, TEXT.slice(0, 200));
  // A colon followed by a space, or a hash after one, would end or break the YAML value a host parses.
  assert.doesNotMatch(frontmatter[1], /: | #/);
  assert.match(frontmatter[1], /\(js-harness v0\.1\.0\)/);
});

test('the protocols skill opens with an index of its eight situations, in the order of its sections', () => {
  assert.equal(PROTOCOLS.length, 8);
  const body = TEXT.split('\n---\n')[1];
  const index = body.split('\n').filter((line) => /^\d\. /.test(line)).slice(0, PROTOCOLS.length);
  assert.deepEqual(index, PROTOCOLS.map((title, i) => `${i + 1}. ${title}.`));
  assert.ok(body.indexOf(index.at(-1)) < body.indexOf('\n## '), 'the index is above the first section');
  assert.deepEqual(sections(TEXT).map((section) => section.heading), PROTOCOLS.map((title, i) => `${i + 1}. ${title}`));
});

// A section is kept for the incident it came for, so that it can be withdrawn when the incident has not come back
// (odd/tasks/rule-hierarchy.md, "Protocols" and the signal "No protocol without its incident").
test('every section of the protocols skill opens with the incident it came for and its date', () => {
  for (const section of sections(TEXT)) {
    const first = section.lines.find((line) => line.trim() !== '');
    const match = /^Incident \((\d{4}-\d{2}-\d{2})\): (.+)/.exec(first ?? '');
    assert.ok(match, `${section.heading}: ${first}`);
    const date = new Date(`${match[1]}T00:00:00Z`);
    assert.equal(date.toISOString().slice(0, 10), match[1], `${section.heading}: ${match[1]} is a day of the calendar`);
    assert.ok(match[2].length >= 40, `${section.heading}: the incident is told, not only named`);
  }
});

test('the protocols skill says how a section is withdrawn and that a missing one is proposed, never created', () => {
  assert.ok(TEXT.includes('A section whose incident has not come back is withdrawn when the user decides'));
  assert.ok(!TEXT.includes('nobody used'), 'a section is not withdrawn for going unused');
  assert.ok(TEXT.includes('reported and proposed to the user, never written as a protocol by the session that met it'));
});

test('a mistake is reported in its five parts, and a handoff always fills what was not checked and what failed', () => {
  const [, , , , mistake, handoff] = sections(TEXT);
  assert.equal(mistake.lines.filter((line) => /^\d\. /.test(line)).length, 5);
  assert.ok(handoff.lines.join('\n').includes('"Not checked" and "failed" are always filled, with "nothing" when that is true'));
});

// Letter H of the protocol for changing a rule (odd/tasks/rule-hierarchy.md, "One home for every rule (T16)", T16g):
// its home is this section, which opens with the incident of a stale 73 percent, carries its cost and a review date,
// and ends a change at one command that exits 0.
test('the protocol for changing a rule opens with the stale 73 percent, and its done is one command that exits 0', () => {
  const change = sections(TEXT)[3];
  const first = change.lines.find((line) => line.trim() !== '');
  assert.match(first, /^Incident \(2026-10-11\): .*73 percent/);
  assert.ok(change.lines.some((line) => /^- Cost: .+ Reviewed by \d{4}-\d{2}-\d{2}\.$/.test(line)), change.lines.join('\n'));
  assert.ok(change.lines.includes('- Done: `js-harness rules check` exits 0.'), change.lines.join('\n'));
});

// One home for every rule: the skill names a rule by its id and never restates its value, and every id it names is
// declared, so that a rule changed by `js-harness rules change` reaches this text with nothing to carry by hand.
test('protocol 3 sends every slice of code through Codex, whether gentle-ai reviewed it or not, as AGENTS.md says', () => {
  const protocol3 = sections(TEXT)[2].lines.join('\n');
  assert.match(protocol3, /every slice of code goes through Codex, whether gentle-ai reviewed it or not/);
  assert.doesNotMatch(protocol3, /each approved slice/, 'Codex does not wait for gentle-ai\'s approval');
});

test('protocol 1 pushes unasked only where the project\'s pushUnasked switch reads on, and asks before a push elsewhere', () => {
  const protocol1 = sections(TEXT)[0].lines.join('\n');
  assert.match(protocol1, /pushUnasked/, 'the switch is named');
  assert.match(protocol1, /`js-harness functions`/, 'a session reads the switch with the command that shows it');
  assert.match(protocol1, /[Aa] push goes unasked where[^.]*`pushUnasked`[^.]*reads on/, 'where the switch reads on, a push goes unasked');
  assert.match(protocol1, /where it is off, a push is asked first/, 'elsewhere a push is asked first, as any other decision');
});

test('every rule id the protocols skill names is declared, and none of their values is written in it', () => {
  const named = [...TEXT.matchAll(/`rule:([a-z0-9-]+)`/g)].map((match) => match[1]);
  assert.ok(named.length > 0, 'the skill names the rules it relies on');
  for (const id of named) {
    const rule = RULES.find((declared) => declared.id === id);
    assert.ok(rule, `${id} is declared`);
    // A value is restated with its unit ("7 days"); a bare digit would match every date of the text.
    if (rule.value !== undefined) assert.doesNotMatch(TEXT, new RegExp(`\\b${rule.value} ?${String(rule.unit ?? '').replace(/s$/, '')}`), `${id}'s value is not written in the skill`);
  }
});

// Section 7 (odd/tasks/throughput-review.md, S5): steps 4-7 of the throughput review only, since the measure, the
// trigger and the re-measure are commands, with the items section 4 asks of a new protocol.
test('the throughput review section holds its judgment steps, its five questions, its cost and the rules it reads by id', () => {
  const review = sections(TEXT)[6];
  const text = review.lines.join('\n').replace(/\s+/g, ' ');
  assert.match(review.lines.find((line) => line.trim() !== ''), /^Incident \(2026-10-16\): .*239 minutes.*flaky test/);
  for (const step of ['- Candidates: ', '- Readers: ', '- Stop rule: ', "- The user's decisions: ", '- Five questions: ', '- What leaves: ']) assert.ok(text.includes(step), step);
  assert.ok(review.lines.some((line) => /^- Cost: .+ Reviewed by 2026-11-16\.$/.test(line)), text);
  for (const id of ['throughput-quiet-runs', 'throughput-quiet-days', 'double-review']) assert.ok(text.includes(`\`rule:${id}\``), id);
  assert.ok(text.includes('js-harness throughput reviewed'), 'it says how a review is recorded');
  assert.ok(text.includes('no check, review or test is removed or weakened'), 'the hard limit is a candidate\'s condition');
});

// The double review (odd/tasks/rule-hierarchy.md, T18): its home is section 1, section 6 names it for what is handed
// on, and the template init writes keeps a copy that may not drift from it.
test('a session runs the installed js-harness, and its branch\'s copy only to test its own change', () => {
  const [, , costs] = sections(TEXT).map((section) => section.lines.join('\n').replace(/\s+/g, ' '));
  assert.ok(costs.includes('- Run the installed `js-harness`, not your branch\'s `node bin/js-harness.mjs`, except to test your own change: a branch\'s copy lacks what main gained since it was cut, and five ready notices were never sent because their branch\'s notify had no `--pr` (2026-10-17).'), costs);
});

test('a proposal reaches the user only after two readers, and a handoff names the rule', () => {
  const squash = (text) => text.replace(/\s+/g, ' ');
  const [asking, , , , , handoff] = sections(TEXT).map((section) => squash(section.lines.join('\n')));
  assert.match(asking, /A design before it is built, and a plan, a design, an analysis with figures, a protocol or a change of the charter that reaches the user, asked or reported, first passes two read-only readers that did not write it: one attacks its claims, one looks only for what is missing\./);
  assert.match(asking, /A second round reads only the first round's blockers; what is still open after it goes to the user as unguaranteed, never a third round\./);
  assert.match(asking, /Not for a question of fact \(a figure or an outcome looked up, nothing proposed\), nor for a step or a choice whose reviewed text the question names by path\./);
  assert.ok(handoff.includes('- A plan or a design handed on has passed its double review first (`rule:double-review`, section 1).'), handoff);
  assert.ok(handoff.includes('- What the user reads to understand or decide (research, a proposal, an audit, a map, a report) reaches them in their language as a visual, didactic page (`rule:reports-spanish-visual`)'), handoff);
  assert.ok(squash(agentsTemplate('project')).includes('one attacks its claims, one looks only for what is missing'));
});

test('the protocols skill ships to every user of the harness, so it speaks of the user', () => {
  assert.doesNotMatch(TEXT, /Sebasti/);
  assert.match(TEXT, /the user/);
});

// The trigger of odd/tasks/conventions.md, S7: before a new file is written, the session is pointed at the checks that
// hold the project's conventions, so it writes the way the rest is written instead of learning it from a red gate.
test('section 8 points a session writing a new command, module or document at the convention tests and the review', () => {
  const text = protocolsSkillContent('0.1.0');
  assert.match(text, /^description: .*writing a new command, module or document/m);
  const section = sections(text).find((found) => found.heading === '8. Writing a new command, module or document');
  assert.ok(section, 'section 8 exists');
  const body = section.lines.join('\n');
  assert.ok(body.includes('`bin/conventions-*.test.mjs`'), body);
  assert.ok(body.includes('legacy list'), body);
  assert.ok(body.includes('never a conventions document'), body);
  assert.ok(body.includes('reviewer'), body);
  // rule:reuse-first. Before a new command, module or document, a session searches for what already does it first.
  const bullets = body.split('\n').filter((line) => line.startsWith('- '));
  assert.ok(bullets[0].startsWith('- Before adding a command, an option, a function, a protocol, a rule or a document, search for one that already does it'), bullets[0]);
  assert.ok(bullets[0].includes('amend that one instead of adding a second, and say in the commit what was searched.'), bullets[0]);
  assert.ok(text.includes('can an existing one be amended, the search of `rule:reuse-first`;'), 'section 4 points to the rule by its name');
});
