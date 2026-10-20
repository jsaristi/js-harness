import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advisedProfile, areaLines, checklistLines, kindLines, kindsLines, parseKind, parseSize, setupValues, shapeFindings } from './profiles.mjs';

/** A small set of profiles: two kinds that share an area and a target, and one common area. */
const AREA = (id, extra = {}) => ({
  id,
  title: id.toUpperCase(),
  decides: `what ${id} decides`,
  teach: { new: `${id} for a beginner`, some: `${id} with some practice`, experienced: `${id} at depth` },
  pitfalls: [`a ${id} pitfall`],
  after: [],
  default: `${id} default`,
  alternatives: [],
  ...extra,
});
const TARGET = (id, area, extra = {}) => ({ id, area, target: `${id} target`, measured: 'lab', command: `${id} command`, source: 'https://example.org', ...extra });
const DATA = {
  AREAS: [
    AREA('ci', { common: true, core: true, after: ['host'] }),
    AREA('team', { common: true }),
    AREA('host', { after: ['ui'] }),
    AREA('ui', { default: null }),
  ],
  TARGETS: [TARGET('gate', 'ci'), TARGET('speed', 'ui', { measured: 'field' }), TARGET('deploys', 'host', { measured: 'review' })],
  KINDS: [
    {
      id: 'site', title: 'Site', default: 'a site', why: 'it is fast', elseWhen: 'it is an app',
      areas: [{ id: 'ui', core: true, default: 'site ui', alternatives: ['plain html'] }, { id: 'host', core: false }],
      bar: [{ id: 'gate', core: true }, { id: 'speed', core: false }],
    },
    {
      id: 'app', title: 'App', default: 'an app', why: 'it has accounts', elseWhen: 'it is a site',
      areas: [{ id: 'ui', core: false, default: 'app ui' }, { id: 'host', core: true, default: 'app host' }],
      bar: [{ id: 'gate', core: true }, { id: 'deploys', core: true }],
    },
    { id: 'other', title: 'Other', default: 'the nearest', why: 'every project', elseWhen: 'never', areas: [], bar: [{ id: 'gate', core: true }] },
  ],
};

test('parseKind reads every Kind form of D6, with or without its Log line', () => {
  assert.deepEqual(parseKind('site', DATA), { kinds: ['site'], label: 'site' });
  assert.deepEqual(parseKind('site, app (L4)', DATA), { kinds: ['site', 'app'], label: 'site, app' });
  assert.deepEqual(parseKind('other (nearest: app)', DATA), { kinds: ['app'], label: 'other (nearest: app)' });
  assert.deepEqual(parseKind('other (nearest: none)', DATA), { kinds: ['other'], label: 'other (nearest: none)' });
  assert.deepEqual(parseKind('site,app', DATA), { kinds: ['site', 'app'], label: 'site, app' });
  assert.deepEqual(parseKind('shop', DATA), { error: 'shop is not a kind of the profiles; js-harness onboard profile lists them' });
  assert.deepEqual(parseKind('other (nearest: shop)', DATA), { error: 'shop is not a kind of the profiles; js-harness onboard profile lists them' });
  assert.deepEqual(parseKind('site, other', DATA), { error: 'other is written alone, as other (nearest: <kind>) or other (nearest: none)' });
  assert.deepEqual(parseKind('site, site', DATA), { error: 'site is named twice' });
  assert.deepEqual(parseKind('other (nearest: other)', DATA), { error: 'other cannot be its own nearest kind: name a kind with a profile, or none' });
});

test('parseKind refuses a kind joined with one its joins list leaves out, in either order', () => {
  const pre = { id: 'pre', title: 'Pre', default: 'a plan', why: 'evidence first', elseWhen: 'decided', joins: ['site'], areas: [], bar: [{ id: 'gate', core: true }] };
  const data = { ...DATA, KINDS: [...DATA.KINDS, pre] };
  assert.deepEqual(parseKind('pre, site', data), { kinds: ['pre', 'site'], label: 'pre, site' });
  assert.deepEqual(parseKind('pre, app', data), { error: 'pre and app cannot be joined: pre joins only site' });
  assert.deepEqual(parseKind('app, pre', data), { error: 'pre and app cannot be joined: pre joins only site' });
  assert.deepEqual(parseKind('pre', data), { kinds: ['pre'], label: 'pre' });
  assert.deepEqual(parseKind('other (nearest: pre)', data), { kinds: ['pre'], label: 'other (nearest: pre)' });
  assert.deepEqual(shapeFindings({ ...data, KINDS: [...DATA.KINDS, { ...pre, joins: ['shop'] }] }), ['kind pre joins shop, which is no kind']);
});

test('parseSize reads small or large, with or without its Log line', () => {
  assert.equal(parseSize('small (L5)'), 'small');
  assert.equal(parseSize('large'), 'large');
  assert.equal(parseSize('medium'), null);
});

test('setupValues reads the lines of ## Setup only', () => {
  const doc = ['# x', '## Setup', '- Kind: site', '- Size: small (L5)', 'prose', '## Interview', '- Kind: app'].join('\n');
  assert.deepEqual(setupValues(doc), { Kind: 'site', Size: 'small (L5)' });
  assert.deepEqual(setupValues('# x\n'), {});
});

test('joined kinds take the union of their areas, core when either says so, ordered by after, common areas added', () => {
  const profile = advisedProfile(['site', 'app'], DATA);
  assert.deepEqual(profile.areas.map((area) => [area.id, area.core]), [['ui', true], ['host', true], ['ci', true], ['team', false]]);
  assert.deepEqual(profile.areas[0].advice, [
    { kind: 'site', default: 'site ui', alternatives: ['plain html'] },
    { kind: 'app', default: 'app ui', alternatives: [] },
  ]);
  // A kind with no advice of its own for an area takes the area's.
  assert.deepEqual(profile.areas[1].advice, [{ kind: 'site', default: 'host default', alternatives: [] }, { kind: 'app', default: 'app host', alternatives: [] }]);
  assert.deepEqual(profile.targets.map((target) => [target.id, target.core]), [['speed', false], ['deploys', true], ['gate', true]]);
});

test('other with no nearest kind takes the common areas only', () => {
  const profile = advisedProfile(['other'], DATA);
  assert.deepEqual(profile.areas.map((area) => area.id), ['ci', 'team']);
  assert.deepEqual(profile.targets.map((target) => target.id), ['gate']);
});

test('the checklists print the lines to paste: a small project keeps the core ones', () => {
  const profile = advisedProfile(['site'], DATA);
  assert.deepEqual(checklistLines(profile, 'advice', 'small'), ['- [ ] A:ui UI', '- [ ] A:ci CI']);
  assert.deepEqual(checklistLines(profile, 'advice', 'large'), ['- [ ] A:ui UI', '- [ ] A:host HOST', '- [ ] A:ci CI', '- [ ] A:team TEAM']);
  assert.deepEqual(checklistLines(profile, 'bar', 'small'), ['- [ ] B:gate gate target; measured by gate command']);
  // A target only real users can show is a step the first phase can finish: its measure wired before launch.
  assert.deepEqual(checklistLines(profile, 'bar', 'large'), [
    '- [ ] B:speed speed command wired before launch, so production shows: speed target',
    '- [ ] B:gate gate target; measured by gate command',
  ]);
});

test('kindLines prints each kind\'s advice, then the areas and the bar with their core marks', () => {
  const lines = kindLines(advisedProfile(['site'], DATA), 'site');
  assert.deepEqual(lines, [
    'Site (site)',
    'Default: a site',
    'Why: it is fast',
    'Something else when: it is an app',
    '',
    'Areas (a small project keeps the core ones):',
    '  A:ui UI (core)',
    '  A:host HOST',
    '  A:ci CI (core)',
    '  A:team TEAM',
    'Bar (a small project keeps the core ones):',
    '  B:speed speed target',
    '  B:gate gate target (core)',
    'Next: js-harness onboard profile site --area <id> explains one area; --checklist advice|bar --size small|large prints the lines to paste.',
  ]);
  // other (nearest: <kind>) says so before the nearest kind's advice, and its hint keeps the label.
  const near = kindLines(advisedProfile(['app'], DATA), 'other (nearest: app)');
  assert.equal(near[0], 'Kind: other (nearest: app). No profile of its own: it is advised as app, through the areas and bar of app.');
  assert.equal(near.at(-1), 'Next: js-harness onboard profile "other (nearest: app)" --area <id> explains one area; --checklist advice|bar --size small|large prints the lines to paste.');
});

test('areaLines prints one area: what it decides, the three levels, pitfalls, each kind\'s advice and its targets', () => {
  const profile = advisedProfile(['site', 'app'], DATA);
  assert.deepEqual(areaLines(profile, 'A:ui'), [
    'A:ui UI (core)',
    'Decides: what ui decides',
    'Teach, new: ui for a beginner',
    'Teach, some: ui with some practice',
    'Teach, experienced: ui at depth',
    'Pitfalls: a ui pitfall',
    'Default (site): site ui',
    'Alternatives (site): plain html',
    'Default (app): app ui',
    'Bar: B:speed speed command wired before launch, so production shows: speed target; source: https://example.org',
    'Read the current docs and release notes of what you recommend, and cite them in its ADR (D12).',
  ]);
  assert.deepEqual(areaLines(profile, 'ci').slice(0, 1), ['A:ci CI (core)']);
  assert.deepEqual(areaLines(profile, 'A:nope'), null);
});

test('kindsLines lists every kind and how other is written', () => {
  assert.deepEqual(kindsLines(DATA), [
    'Kinds (js-harness onboard profile <kind>[,<kind>] prints one):',
    '  site   Site',
    '  app    App',
    '  other  Other; written other (nearest: <kind>) or other (nearest: none), quoted on the command line',
  ]);
});

test('shapeFindings names each part a profile misses', () => {
  assert.deepEqual(shapeFindings(DATA), []);
  const broken = structuredClone(DATA);
  broken.AREAS.push(AREA('ci'));
  broken.AREAS[2].after = ['ci', 'ghost'];
  broken.TARGETS[1].source = '';
  broken.TARGETS[2].measured = 'guess';
  broken.KINDS[0].bar = [{ id: 'speed', core: false }];
  broken.KINDS[1].areas = [{ id: 'ui', core: true }];
  assert.deepEqual(shapeFindings(broken), [
    'area ci is defined twice',
    'area host is after ghost, which is no area',
    'areas ci, host are after one another in a cycle',
    'target speed has no source',
    'target deploys is measured guess, not lab, field or review',
    'kind site has no core bar target',
    'kind app: area ui has no default, of the kind or of the area',
    'kind app: target deploys is about host, which is not one of its areas',
  ]);

  const coreOnLoose = structuredClone(DATA);
  coreOnLoose.KINDS[0].bar.push({ id: 'deploys', core: true });
  assert.deepEqual(shapeFindings(coreOnLoose), ['kind site: target deploys is core, but its area host is not']);

  const loose = structuredClone(DATA);
  loose.KINDS[0].areas.push({ id: 'ci', core: false }, { id: 'ui', core: true, default: 'again' });
  loose.KINDS[0].bar.push({ id: 'gate', core: true });
  loose.AREAS.push(AREA('Bad_Id'));
  assert.deepEqual(shapeFindings(loose), [
    'area Bad_Id is not an ID of lowercase letters, digits and hyphens',
    'kind site lists area ui twice',
    'kind site lists target gate twice',
    'kind site makes the common core area ci non-core',
    'kind site: target gate is core, but its area ci is not',
  ]);

  const thin = structuredClone(DATA);
  delete thin.AREAS[1].teach.some;
  thin.AREAS[1].default = null;
  delete thin.KINDS[2].why;
  assert.deepEqual(shapeFindings(thin), ['area team misses teach.some', 'common area team has no default', 'kind other misses why']);
});
