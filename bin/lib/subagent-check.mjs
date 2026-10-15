// The comparison of today's sub-agent launches with the rules in force (odd/tasks/honesty-audit.md, JH 15 T13):
// the INFO row of `check --subagents` says whether each writer and reader ran on the model and at the effort
// the rules give. Pure: the launches are the ones launchesOf returns and the rules are handed in, so a test never
// reads the project's rules. Nothing here fails a launch: an off value is reported, not refused.

/** The roles that a writer rule covers; the others are compared against the reader rule. */
const READER_ROLES = new Set(['explorer', 'reviewer', 'verifier']);

/**
 * A model rule as { value, alias }, or null when the rule names neither (then nothing is compared with it).
 * @param {unknown} rule the rule as the rules text gives it
 * @returns {{ value: string | null, alias: string | null } | null}
 */
function modelRule(rule) {
  if (rule === null || typeof rule !== 'object') return null;
  const value = typeof rule.value === 'string' && rule.value !== '' ? rule.value : null;
  const alias = typeof rule.alias === 'string' && rule.alias !== '' ? rule.alias : null;
  return value === null && alias === null ? null : { value, alias };
}

/**
 * The effort a rule asks for, or null when it asks for none.
 * @param {unknown} effort the effort rule, e.g. 'high'
 * @returns {string | null}
 */
function effortRule(effort) {
  return typeof effort === 'string' && effort !== '' ? effort : null;
}

/** Counts `name` into `tally`, a Map from name to count. */
function bump(tally, name) {
  tally.set(name, (tally.get(name) ?? 0) + 1);
}

/**
 * The tally as `[{ [key]: name, count }]`, sorted by count descending and then by name.
 * @param {Map<string, number>} tally
 * @param {string} key the field the name is stored under
 */
function sortedTally(tally, key) {
  return [...tally]
    .map(([name, count]) => ({ [key]: name, count }))
    .sort((a, b) => b.count - a.count || a[key].localeCompare(b[key]));
}

/**
 * Compares the started launches with the rules. A launch of role other is counted and not compared. A launch
 * whose model or effort did not run is counted as unknown, never as off. A rule that is null is skipped.
 * @param {Array<{ role: string, modelRan: string | null, effortRan: string | null, started: boolean }>} launches
 *   the launches launchesOf returns; only those with `started === true` are compared
 * @param {{ writerModel: { value: string | null, alias: string | null } | null,
 *   readerModel: { value: string | null, alias: string | null } | null, effort: string | null } | null} expected
 *   the rules in force, each one possibly null
 * @returns {{ launches: number, compared: number,
 *   byRole: { writer: RoleCount, reader: RoleCount },
 *   offModel: number, offEffort: number, unknownModel: number, unknownEffort: number, other: number }}
 *   launches: the started launches; compared: the started writer and reader launches compared on at least one rule;
 *   byRole: per role, its started launches and the off models and efforts with their counts; offModel and offEffort:
 *   the totals of off values; unknownModel and unknownEffort: launches whose model or effort did not run; other:
 *   the launches of role other
 *   (RoleCount is { launches: number, offModel: Array<{ modelRan, count }>, offEffort: Array<{ effortRan, count }> })
 */
export function compareLaunches(launches, expected) {
  const rules = expected ?? {};
  const rule = { writer: modelRule(rules.writerModel), reader: modelRule(rules.readerModel) };
  const effort = effortRule(rules.effort);
  const started = launches.filter((launch) => launch.started === true);

  const result = {
    launches: started.length,
    compared: 0,
    byRole: { writer: { launches: 0, offModel: [], offEffort: [] }, reader: { launches: 0, offModel: [], offEffort: [] } },
    offModel: 0,
    offEffort: 0,
    unknownModel: 0,
    unknownEffort: 0,
    other: 0,
  };
  const offModels = { writer: new Map(), reader: new Map() };
  const offEfforts = { writer: new Map(), reader: new Map() };

  for (const launch of started) {
    const side = launch.role === 'writer' ? 'writer' : READER_ROLES.has(launch.role) ? 'reader' : null;
    if (side === null) {
      result.other += 1;
      continue;
    }
    result.byRole[side].launches += 1;
    if (rule[side] === null && effort === null) continue;
    result.compared += 1;

    const ran = typeof launch.modelRan === 'string' ? launch.modelRan : null;
    if (rule[side] !== null) {
      if (ran === null) result.unknownModel += 1;
      else if (ran !== rule[side].value && ran !== rule[side].alias) {
        result.offModel += 1;
        bump(offModels[side], ran);
      }
    }

    if (effort !== null) {
      const effortRan = typeof launch.effortRan === 'string' ? launch.effortRan : null;
      if (effortRan === null) result.unknownEffort += 1;
      else if (effortRan !== effort) {
        result.offEffort += 1;
        bump(offEfforts[side], effortRan);
      }
    }
  }

  for (const side of ['writer', 'reader']) {
    result.byRole[side].offModel = sortedTally(offModels[side], 'modelRan');
    result.byRole[side].offEffort = sortedTally(offEfforts[side], 'effortRan');
  }
  return result;
}

/**
 * The lines of the `subagents` row: a detail for the row and one line per role that has an off value.
 * @param {ReturnType<typeof compareLaunches>} result what compareLaunches returned
 * @param {{ writerModel: { value: string | null, alias: string | null } | null,
 *   readerModel: { value: string | null, alias: string | null } | null, effort: string | null } | null} expected
 *   the same rules that were compared
 * @returns {{ detail: string, lines: string[] }}
 */
export function subagentRowLines(result, expected) {
  if (result.launches === 0) return { detail: 'no sub-agent launched today', lines: [] };

  const rules = expected ?? {};
  const effort = effortRule(rules.effort);
  const count = `${result.launches} ${result.launches === 1 ? 'launch' : 'launches'} today`;
  if (result.compared === 0) return { detail: `${count}, none compared with a rule`, lines: [] };

  const parts = [];
  if (result.offModel > 0) parts.push(`${result.offModel} on a model off the rules`);
  if (result.offEffort > 0) parts.push(`${result.offEffort} at an effort off subagent-effort (${effort})`);
  if (result.unknownModel > 0) parts.push(`${result.unknownModel} with an unknown model`);
  if (result.unknownEffort > 0) parts.push(`${result.unknownEffort} at an unknown effort`);

  let detail;
  if (parts.length > 0) {
    detail = `${count}: ${parts.join(', ')}`;
  } else {
    const checked = [];
    if ((result.byRole.writer.launches > 0 && modelRule(rules.writerModel) !== null)
      || (result.byRole.reader.launches > 0 && modelRule(rules.readerModel) !== null)) {
      checked.push("on the rules' models");
    }
    if (effort !== null) checked.push(`at ${effort}`);
    detail = `${count}, all ${checked.join(' and ')}`;
  }

  const lines = [];
  const ruleNames = { writer: 'subagent-writer-model', reader: 'subagent-reader-model' };
  for (const side of ['writer', 'reader']) {
    const role = result.byRole[side];
    const segments = [];
    if (role.offModel.length > 0) {
      const ran = role.offModel.map((entry) => entry.modelRan).join(', ');
      const total = role.offModel.reduce((sum, entry) => sum + entry.count, 0);
      const given = modelRule(rules[`${side}Model`]);
      segments.push(`${total} of ${role.launches} ran on ${ran} (${ruleNames[side]} gives ${given.alias ?? given.value})`);
    }
    if (role.offEffort.length > 0) {
      const ran = role.offEffort.map((entry) => entry.effortRan).join(', ');
      const total = role.offEffort.reduce((sum, entry) => sum + entry.count, 0);
      segments.push(`${total} of ${role.launches} ran at effort ${ran} (subagent-effort gives ${effort})`);
    }
    if (segments.length > 0) lines.push(`${side}: ${segments.join('; ')}`);
  }
  return { detail, lines };
}
