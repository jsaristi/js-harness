import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { chainedPrsSkillContent, workUnitsSkillContent } from './ported-skills.mjs';

// F8 S10, T9 (odd/tasks/f8-s10-port.md, S9; the reverse-engineering document, 13.3 row 4): the two skills adapted from
// gentle-ai are text we ship, pinned like code, so a change to either is seen and changes its pin in the same commit.
const PINS = {
  'work units': [workUnitsSkillContent, 'b2cb9a1100f94ebc60d0b4a92836ecb4ced02e10bc955cff7211cb06b8e5535d'],
  'chained PRs': [chainedPrsSkillContent, 'd77410d65d1b310d20931891cc38fbd8cece7222045230d525cfde60728b4ddb'],
};

for (const [name, [content, pin]] of Object.entries(PINS)) {
  test(`the ${name} skill is the text its pin names`, () => {
    const sha256 = crypto.createHash('sha256').update(content()).digest('hex');
    assert.equal(sha256, pin, `the ${name} skill changed: review the change, then update its pin in the same commit`);
  });
}
