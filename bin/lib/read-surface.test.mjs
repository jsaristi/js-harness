import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { firstStep } from './next-step.mjs';
import { READ_SURFACE_BUDGET, ROADMAP_READ_BUDGET, RESUME_LEGACY, STATE_HEAD_BUDGET, checkReadSurface, readSurface, resumeHead, sectionOf } from './read-surface.mjs';

const withProject = (run) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-read-surface-'));
  try {
    fs.mkdirSync(path.join(dir, 'docs'));
    fs.mkdirSync(path.join(dir, 'odd', 'tasks'), { recursive: true });
    return run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

/** A roadmap whose Next and Decided hold `next` and `decided` estimated tokens, headings included. */
const roadmapOf = (next, decided) => {
  const section = (title, tokens) => `## ${title}\n${'a'.repeat(tokens * 4 - `## ${title}\n`.length - 1)}\n`;
  return `# Roadmap\n\nintro\n\n${section('Decided', decided)}## Phases\nnot counted\n${section('Next', next)}## Risks\nnot counted\n`;
};

test('the budgets are the plan\'s: 10k for the roadmap\'s Next and Decided, 5k for a State head, 15k in all', () => {
  assert.equal(ROADMAP_READ_BUDGET, 10000);
  assert.equal(STATE_HEAD_BUDGET, 5000);
  assert.equal(READ_SURFACE_BUDGET, ROADMAP_READ_BUDGET + STATE_HEAD_BUDGET);
});

test('sectionOf gives a level-two section from its heading to the line before the next heading of level one or two', () => {
  const text = '# T\n## Next\none\n### Sub\ntwo\n```\n## Decided\n```\n## Decided\nthree\n# Other\n';
  assert.equal(sectionOf(text, 'Next'), '## Next\none\n### Sub\ntwo\n```\n## Decided\n```\n');
  assert.equal(sectionOf(text, 'Decided'), '## Decided\nthree\n');
  assert.equal(sectionOf(text, 'State'), null);
  assert.equal(sectionOf('## Next\r\none\r\n## B\r\n', 'Next'), '## Next\none\n', 'a CRLF checkout counts as its LF text');
});

test('resumeHead counts every section the resume hook names, together, and no other', () => {
  assert.equal(resumeHead(`## State\n${'s'.repeat(390)}\n## Goal\nx\n`), 100);
  assert.equal(resumeHead(`## Goal\nx\n## State for a resume\n${'s'.repeat(377)}\n## Next step\n${'s'.repeat(386)}\n`), 200);
  assert.equal(resumeHead(`## State\r\n${'s'.repeat(390)}\r\n## Goal\r\nx\r\n`), 100, 'a CRLF checkout counts as its LF text');
  assert.equal(resumeHead('## Goal\nno head\n## Next step, history\nold\n'), 0);
});

test('readSurface counts Next, Decided and the largest resume head, and leaves the legacy documents out of the head', () => {
  const documents = [
    { name: 'a.md', text: `## State\n${'s'.repeat(390)}\n## Goal\nx\n` },
    { name: 'b.md', text: '## Goal\nno head\n' },
    { name: 'c.md', text: `## Goal\nx\n## Next step\n${'s'.repeat(786)}\n` },
    { name: RESUME_LEGACY[0], text: `## State\n${'s'.repeat(99990)}\n` },
  ];
  assert.deepEqual(readSurface(roadmapOf(300, 200), documents, RESUME_LEGACY), { next: 300, decided: 200, state: { tokens: 200, name: 'c.md' }, total: 700, legacy: [RESUME_LEGACY[0]] });
  assert.equal(readSurface(roadmapOf(300, 200), documents).state.name, RESUME_LEGACY[0], 'with no legacy list given, every document counts');
  assert.deepEqual(readSurface(null, []), { next: 0, decided: 0, state: null, total: 0, legacy: [] });
});

test('checkReadSurface gives no row where the project has no roadmap section and no resume head', () => {
  withProject((dir) => {
    assert.deepEqual(checkReadSurface(dir), []);
    fs.writeFileSync(path.join(dir, 'docs', 'ROADMAP.md'), '# Roadmap\n\n## Phases\n');
    fs.writeFileSync(path.join(dir, 'odd', 'tasks', 'a.md'), '## Goal\nx\n');
    assert.deepEqual(checkReadSurface(dir), []);
  });
});

test('checkReadSurface passes with a head at exactly its limit and says each part', () => {
  withProject((dir) => {
    fs.writeFileSync(path.join(dir, 'docs', 'ROADMAP.md'), roadmapOf(5000, 4000).replace(/\n/g, '\r\n'));
    fs.writeFileSync(path.join(dir, 'odd', 'tasks', 'a.md'), `## State\n${'s'.repeat(STATE_HEAD_BUDGET * 4 - 10)}\n## Goal\nx\n`);
    assert.deepEqual(checkReadSurface(dir), [{
      name: 'read surface',
      pass: true,
      detail: `14000 estimated tokens (budget 15000): the roadmap's Next 5000 and Decided 4000 (budget 10000), the largest resume head 5000 in odd/tasks/a.md (budget 5000)`,
    }]);
  });
});

test('checkReadSurface passes a roadmap at exactly its limit, and says from 90% that the budget is near', () => {
  withProject((dir) => {
    fs.writeFileSync(path.join(dir, 'docs', 'ROADMAP.md'), roadmapOf(5001, 4000));
    const [near] = checkReadSurface(dir);
    assert.equal(near.pass, true);
    assert.deepEqual(near.lines, ['the roadmap\'s two sections are within 999 estimated tokens of their budget: move settled paragraphs of Next, or the history a row of Decided keeps after its decision, word for word to docs/roadmap-history.md before a commit is refused']);
    fs.writeFileSync(path.join(dir, 'docs', 'ROADMAP.md'), roadmapOf(6000, 4000));
    const [full] = checkReadSurface(dir);
    assert.equal(full.pass, true);
    assert.match(full.lines[0], /^the roadmap's two sections are within 0 estimated tokens/);
  });
});

test('checkReadSurface refuses a roadmap one token over, with the step that cuts it', () => {
  withProject((dir) => {
    fs.writeFileSync(path.join(dir, 'docs', 'ROADMAP.md'), roadmapOf(6001, 4000));
    const [row] = checkReadSurface(dir);
    assert.equal(row.pass, false);
    assert.equal(row.detail, `10001 estimated tokens (budget 15000): the roadmap's Next 6001 and Decided 4000 (budget 10000), no resume head`);
    assert.deepEqual(row.next, firstStep('move settled paragraphs of the Next or Decided of docs/ROADMAP.md, word for word, to docs/roadmap-history.md, from 10001 to 10000 estimated tokens or fewer'));
  });
});

test('checkReadSurface refuses a resume head one token over, under an older title too', () => {
  withProject((dir) => {
    fs.writeFileSync(path.join(dir, 'odd', 'tasks', 'a.md'), `## Next step\n${'s'.repeat(STATE_HEAD_BUDGET * 4 - 10)}\n## Goal\nx\n`);
    const [row] = checkReadSurface(dir);
    assert.equal(row.pass, false);
    assert.deepEqual(row.next, firstStep('rewrite the resume sections of odd/tasks/a.md from 5001 to 5000 estimated tokens or fewer: its State says what is done, what is next and what is open, and its history goes to the Log'));
  });
});

// The lenses' finding on the first slice (L7): a document left out in silence makes the row's total false.
test('checkReadSurface names each legacy document it leaves out, and leaves none out in another project', () => {
  withProject((dir) => {
    fs.writeFileSync(path.join(dir, 'odd', 'tasks', RESUME_LEGACY[0]), `## Next step\n${'s'.repeat(99990)}\n`);
    const [other] = checkReadSurface(dir);
    assert.equal(other.pass, false, 'a project that is not the harness has no legacy list: a document of the same name counts');
    const [own] = checkReadSurface(dir, { legacy: RESUME_LEGACY });
    assert.equal(own.pass, true);
    assert.equal(own.detail, `0 estimated tokens (budget 15000): the roadmap's Next 0 and Decided 0 (budget 10000), no resume head; not counted, the legacy documents whose resume sections are over that budget: ${RESUME_LEGACY[0]}`);
  });
});

test('checkReadSurface fails for a roadmap that is there and cannot be read, instead of counting it as nothing', () => {
  withProject((dir) => {
    fs.mkdirSync(path.join(dir, 'docs', 'ROADMAP.md'));
    assert.deepEqual(checkReadSurface(dir), [{
      name: 'read surface',
      pass: false,
      detail: 'could not read docs/ROADMAP.md, so what a session reads to start is not measured',
      next: firstStep('make docs/ROADMAP.md readable, then run this again'),
    }]);
  });
});

test('check runs the row: its list of rows holds checkReadSurface, and this repository passes it with its legacy named', () => {
  const root = path.join(import.meta.dirname, '..', '..');
  assert.ok(fs.readFileSync(path.join(root, 'bin', 'check.mjs'), 'utf8').includes('...checkReadSurface(cwd)'), 'bin/check.mjs no longer lists the row');
  const [row] = checkReadSurface(root);
  assert.equal(row.pass, true, row.detail);
  assert.match(row.detail, new RegExp(`not counted, the legacy documents whose resume sections are over that budget: ${RESUME_LEGACY.join(', ')}$`));
});

test('the legacy list names only documents this repository still holds over the budget, so it only shrinks', () => {
  const tasks = path.join(import.meta.dirname, '..', '..', 'odd', 'tasks');
  for (const name of RESUME_LEGACY) {
    assert.ok(resumeHead(fs.readFileSync(path.join(tasks, name), 'utf8')) > STATE_HEAD_BUDGET, `${name} is at or under the budget: take it off RESUME_LEGACY`);
  }
});
