// What `js-harness onboard profile` reads from the profiles (odd/tasks/onboarding.md, D9): the kinds a project may
// be, the areas a set of kinds is advised in and their order, the lines the onboarding pastes, and the shape every
// profile is held to. The data is ./profiles-data.mjs; each function takes it as `data`, so a test passes its own.
import { AREAS, KINDS, TARGETS } from './profiles-data.mjs';

export const PROFILES = { AREAS, KINDS, TARGETS };

const LOG_SUFFIX = /\s*\(L\d+\)$/;
const NEAREST = /^other \(nearest: ([^)]+)\)$/;
const SETUP_LINE = /^- (Kind|Size|Level|Teaching|Mode): (.+)$/;
const WHERE = { lab: 'in CI', field: 'in production', review: 'at each release review' };
const TEACH_LEVELS = ['new', 'some', 'experienced'];

const byId = (list) => new Map(list.map((item) => [item.id, item]));
const notAKind = (id) => ({ error: `${id} is not a kind of the profiles; js-harness onboard profile lists them` });

/** The kinds a `## Setup` Kind value names (D6), as `{ kinds, label }`, or `{ error }`. `other (nearest: <kind>)`
 * is advised as that kind; `other (nearest: none)`, or `other` alone, through the common areas only. */
export function parseKind(value, data = PROFILES) {
  const kinds = byId(data.KINDS);
  const text = value.trim().replace(LOG_SUFFIX, '');
  const nearest = NEAREST.exec(text);
  if (nearest || text === 'other') {
    const near = nearest ? nearest[1].trim() : 'none';
    if (near === 'none') return { kinds: ['other'], label: 'other (nearest: none)' };
    if (!kinds.has(near) || near === 'other') return notAKind(near);
    return { kinds: [near], label: `other (nearest: ${near})` };
  }
  const ids = text.split(',').map((id) => id.trim());
  const seen = new Set();
  for (const id of ids) {
    if (id === 'other') return { error: 'other is written alone, as other (nearest: <kind>) or other (nearest: none)' };
    if (!kinds.has(id)) return notAKind(id);
    if (seen.has(id)) return { error: `${id} is named twice` };
    seen.add(id);
  }
  return { kinds: ids, label: ids.join(', ') };
}

/** `small` or `large` from a Size value, or `null`. */
export function parseSize(value) {
  const match = /^(small|large)$/.exec(value.trim().replace(LOG_SUFFIX, ''));
  return match ? match[1] : null;
}

/** The values of the `## Setup` section of an onboarding document, by key. */
export function setupValues(text) {
  const values = {};
  let inSetup = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (line.startsWith('## ')) inSetup = line.trim() === '## Setup';
    else if (inSetup) {
      const match = SETUP_LINE.exec(line);
      if (match) values[match[1]] = match[2].trim();
    }
  }
  return values;
}

/** Each area once, after the areas it names that are in `ids`; base order first. A cycle, which the shape test
 * refuses, is cut where it closes. */
function ordered(ids, areas) {
  const out = [];
  const done = new Set();
  const visiting = new Set();
  const visit = (id) => {
    if (done.has(id) || visiting.has(id)) return;
    visiting.add(id);
    for (const before of areas.get(id)?.after ?? []) {
      if (ids.includes(before)) visit(before);
    }
    visiting.delete(id);
    done.add(id);
    out.push(id);
  };
  for (const id of ids) visit(id);
  return out;
}

/** What a set of kinds is advised in: their areas, the common ones added, in advice order, each core when a kind
 * says so and with every kind's advice for it; and their bar targets, ordered by area. */
export function advisedProfile(kindIds, data = PROFILES) {
  const kinds = kindIds.map((id) => byId(data.KINDS).get(id));
  const areas = byId(data.AREAS);
  const found = new Map();
  for (const kind of kinds) {
    for (const entry of kind.areas) {
      const area = areas.get(entry.id);
      const item = found.get(entry.id) ?? { core: false, advice: [] };
      item.core ||= Boolean(entry.core);
      item.advice.push({
        kind: kind.id,
        default: entry.default ?? area.default,
        alternatives: entry.alternatives ?? (entry.default == null ? area.alternatives : []),
      });
      found.set(entry.id, item);
    }
  }
  for (const area of data.AREAS) {
    if (area.common && !found.has(area.id)) {
      found.set(area.id, { core: Boolean(area.core), advice: [{ kind: null, default: area.default, alternatives: area.alternatives }] });
    }
  }
  const order = ordered([...found.keys()], areas);
  const targets = new Map();
  for (const kind of kinds) {
    for (const entry of kind.bar) {
      const target = targets.get(entry.id) ?? { ...byId(data.TARGETS).get(entry.id), core: false };
      target.core ||= Boolean(entry.core);
      targets.set(entry.id, target);
    }
  }
  const rank = (target) => {
    const index = order.indexOf(target.area);
    return index < 0 ? order.length : index;
  };
  return {
    kinds,
    areas: order.map((id) => ({ ...areas.get(id), ...found.get(id) })),
    targets: [...targets.values()].sort((a, b) => rank(a) - rank(b)),
  };
}

const sized = (items, size) => (size === 'small' ? items.filter((item) => item.core) : items);
const barStep = (target) => `${target.target}; measured ${WHERE[target.measured]} by ${target.command}`;

/** The lines to paste: `advice` under the onboarding's `## Advice`, `bar` as steps of the roadmap (D5, D6). */
export function checklistLines(profile, which, size) {
  if (which === 'advice') return sized(profile.areas, size).map((area) => `- [ ] A:${area.id} ${area.title}`);
  return sized(profile.targets, size).map((target) => `- [ ] B:${target.id} ${barStep(target)}`);
}

const core = (item) => (item.core ? ' (core)' : '');

/** One or more kinds: each one's advice, then the areas and the bar of both sizes. */
export function kindLines(profile) {
  const lines = [];
  for (const kind of profile.kinds) {
    lines.push(`${kind.title} (${kind.id})`, `Default: ${kind.default}`, `Why: ${kind.why}`, `Something else when: ${kind.elseWhen}`, '');
  }
  lines.push('Areas (a small project keeps the core ones):');
  for (const area of profile.areas) lines.push(`  A:${area.id} ${area.title}${core(area)}`);
  lines.push('Bar (a small project keeps the core ones):');
  for (const target of profile.targets) lines.push(`  B:${target.id} ${target.target}${core(target)}`);
  lines.push('Next: js-harness onboard profile --area <id> explains one area; --checklist advice|bar prints the lines to paste.');
  return lines;
}

/** One area of the profile, with every kind's advice and its targets, or `null` when the profile has no such area. */
export function areaLines(profile, ref) {
  const id = ref.replace(/^A:/, '');
  const area = profile.areas.find((item) => item.id === id);
  if (!area) return null;
  const lines = [`A:${area.id} ${area.title}${core(area)}`, `Decides: ${area.decides}`];
  for (const level of TEACH_LEVELS) lines.push(`Teach, ${level}: ${area.teach[level]}`);
  lines.push(`Pitfalls: ${area.pitfalls.join('; ')}`);
  if (area.after.length > 0) lines.push(`After: ${area.after.map((before) => `A:${before}`).join(', ')}`);
  for (const advice of area.advice) {
    const of = advice.kind ? ` (${advice.kind})` : '';
    lines.push(`Default${of}: ${advice.default}`);
    if (advice.alternatives.length > 0) lines.push(`Alternatives${of}: ${advice.alternatives.join('; ')}`);
  }
  for (const target of profile.targets.filter((item) => item.area === id)) {
    lines.push(`Bar: B:${target.id} ${barStep(target)}; source: ${target.source}`);
  }
  lines.push('Read the current docs and release notes of what you recommend, and cite them in its ADR (D12).');
  return lines;
}

/** Every kind, and how `other` is written. */
export function kindsLines(data = PROFILES) {
  const width = Math.max(...data.KINDS.map((kind) => kind.id.length));
  return [
    'Kinds (js-harness onboard profile <kind>[,<kind>] prints one):',
    ...data.KINDS.map((kind) => {
      const how = kind.id === 'other' ? '; in ## Setup it is written other (nearest: <kind>) or other (nearest: none)' : '';
      return `  ${kind.id.padEnd(width)}  ${kind.title}${how}`;
    }),
  ];
}

const blank = (value) => typeof value !== 'string' || value.trim() === '';

function duplicates(list, what) {
  const seen = new Set();
  const findings = [];
  for (const item of list) {
    if (seen.has(item.id)) findings.push(`${what} ${item.id} is defined twice`);
    seen.add(item.id);
  }
  return findings;
}

/** The sets of areas that are after one another in a cycle, each sorted. */
function cycles(areas) {
  const found = new Map();
  const state = new Map();
  const stack = [];
  const visit = (id) => {
    state.set(id, 'visiting');
    stack.push(id);
    for (const next of areas.get(id).after ?? []) {
      if (!areas.has(next)) continue;
      if (state.get(next) === 'visiting') {
        const cycle = stack.slice(stack.indexOf(next)).sort();
        found.set(cycle.join(', '), cycle);
      } else if (!state.has(next)) visit(next);
    }
    stack.pop();
    state.set(id, 'done');
  };
  for (const id of areas.keys()) if (!state.has(id)) visit(id);
  return [...found.keys()];
}

/** What a profile misses against the shape of D9, one line each; none when it holds. */
export function shapeFindings(data = PROFILES) {
  const findings = [...duplicates(data.AREAS, 'area')];
  const areas = new Map();
  for (const area of data.AREAS) if (!areas.has(area.id)) areas.set(area.id, area);
  for (const area of data.AREAS) {
    for (const field of ['title', 'decides']) if (blank(area[field])) findings.push(`area ${area.id} misses ${field}`);
    for (const level of TEACH_LEVELS) if (blank(area.teach?.[level])) findings.push(`area ${area.id} misses teach.${level}`);
    if (!Array.isArray(area.pitfalls) || area.pitfalls.length === 0) findings.push(`area ${area.id} misses pitfalls`);
    for (const before of area.after ?? []) if (!areas.has(before)) findings.push(`area ${area.id} is after ${before}, which is no area`);
    if (area.common && blank(area.default)) findings.push(`common area ${area.id} has no default`);
  }
  for (const cycle of cycles(areas)) findings.push(`areas ${cycle} are after one another in a cycle`);

  findings.push(...duplicates(data.TARGETS, 'target'));
  const targets = byId(data.TARGETS);
  for (const target of data.TARGETS) {
    if (!areas.has(target.area)) findings.push(`target ${target.id} is about ${target.area}, which is no area`);
    if (blank(target.target)) findings.push(`target ${target.id} has no target`);
    if (blank(target.command)) findings.push(`target ${target.id} has no measuring command`);
    if (blank(target.source)) findings.push(`target ${target.id} has no source`);
    if (!Object.hasOwn(WHERE, target.measured)) findings.push(`target ${target.id} is measured ${target.measured}, not lab, field or review`);
  }

  findings.push(...duplicates(data.KINDS, 'kind'));
  for (const kind of data.KINDS) {
    for (const field of ['title', 'default', 'why', 'elseWhen']) if (blank(kind[field])) findings.push(`kind ${kind.id} misses ${field}`);
    const unknownArea = kind.areas.filter((entry) => !areas.has(entry.id));
    for (const entry of unknownArea) findings.push(`kind ${kind.id}: area ${entry.id} is no area`);
    for (const entry of kind.areas) {
      if (areas.has(entry.id) && blank(entry.default ?? areas.get(entry.id).default)) {
        findings.push(`kind ${kind.id}: area ${entry.id} has no default, of the kind or of the area`);
      }
    }
    const unknownTarget = kind.bar.filter((entry) => !targets.has(entry.id));
    for (const entry of unknownTarget) findings.push(`kind ${kind.id}: target ${entry.id} is no target`);
    if (!kind.bar.some((entry) => entry.core)) findings.push(`kind ${kind.id} has no core bar target`);
    if (unknownArea.length > 0 || unknownTarget.length > 0) continue;
    const profile = advisedProfile([kind.id], { ...data, AREAS: [...areas.values()] });
    const listed = new Map(profile.areas.map((area) => [area.id, area]));
    for (const target of profile.targets) {
      const area = listed.get(target.area);
      if (!area) findings.push(`kind ${kind.id}: target ${target.id} is about ${target.area}, which is not one of its areas`);
      else if (target.core && !area.core) findings.push(`kind ${kind.id}: target ${target.id} is core, but its area ${target.area} is not`);
    }
  }
  return findings;
}
