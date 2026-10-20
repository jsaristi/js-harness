// The shape test of odd/tasks/onboarding.md, D9: every kind holds the same parts as the static site's, so a profile
// written later cannot ship thinner than the first one (L11).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AREAS, KINDS, TARGETS } from './profiles-data.mjs';
import { shapeFindings } from './profiles.mjs';

test('the profiles hold their shape: unique IDs, ordered areas, common areas everywhere, sourced and measured targets', () => {
  assert.deepEqual(shapeFindings({ AREAS, KINDS, TARGETS }), []);
});

test('the build ships the kinds of slices 3a and 3b, other included', () => {
  for (const id of ['static-site', 'platform', 'multiplatform-app', 'data-analysis', 'research', 'pre-project', 'other']) {
    assert.ok(KINDS.some((kind) => kind.id === id), `missing kind ${id}`);
  }
});

test('the common areas are the eight of D9, and architecture, cost, legal and CI are core', () => {
  const common = AREAS.filter((area) => area.common);
  assert.deepEqual(common.map((area) => area.id).sort(), ['analytics', 'architecture', 'ci', 'cost', 'i18n', 'legal', 'maintenance', 'team']);
  assert.deepEqual(common.filter((area) => area.core).map((area) => area.id).sort(), ['architecture', 'ci', 'cost', 'legal']);
});
