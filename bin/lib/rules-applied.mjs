// The pure part of `js-harness rules applied`. It compares what the session
// records of a project hold (the launches of sub-agents and the last answer of
// each session) with the declared rules that carry an alias, engine by engine.
// An engine is an entry point and a version together. The module imports
// nothing and reads no file, clock or environment: everything it needs is
// passed in, and no argument is changed.

const MS_PER_DAY = 86400000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_SUFFIX = /-\d{8}$/;
const SYNTHETIC = '<synthetic>';

/** Gives true when a value is a text that is not blank. */
function isText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/** Gives a list argument as it is when it is an array, and an empty array otherwise. */
function listOf(value) {
  return Array.isArray(value) ? value : [];
}

/** Gives the id of a model without the date at its end: claude-haiku-4-5-20251001 gives claude-haiku-4-5. */
function plainId(model) {
  return model.replace(DATE_SUFFIX, '');
}

/** Gives a day (YYYY-MM-DD) as a count of whole days since the epoch, in universal time. */
function dayNumber(day) {
  return Date.parse(`${day}T00:00:00Z`) / MS_PER_DAY;
}

/** Compares two texts in plain code order: -1, 0 or 1. */
function byText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Compares two parts of a version: two of digits as numbers, a part of digits before one that is not, and two that are not digits as text. The order is one order whatever the mix, so the sort does not depend on the input. */
function comparePart(a, b) {
  const digitsA = /^\d+$/.test(a);
  const digitsB = /^\d+$/.test(b);
  if (digitsA && digitsB) return Number(a) - Number(b);
  if (digitsA !== digitsB) return digitsA ? -1 : 1;
  return byText(a, b);
}

/** Orders two versions part by part on the dots, so 2.1.100 comes after 2.1.99; when every part is equal, the plain text decides. */
function compareVersions(a, b) {
  const x = a.split('.');
  const y = b.split('.');
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    if (x[i] === undefined) return -1;
    if (y[i] === undefined) return 1;
    const c = comparePart(x[i], y[i]);
    if (c !== 0) return c;
  }
  return byText(a, b);
}

/** Orders two kept entries oldest first: by the time, then by file, the greater file last. */
function oldestFirst(a, b) {
  return a.ms - b.ms || byText(a.file, b.file);
}

/** Orders agent types or aliases with null first, then by plain text. */
function nullFirst(a, b) {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return byText(a, b);
}

/** Counts entries under the key that `keyOf` gives, and gives one object per key: the fields `fieldsOf` gives, plus its count. */
function countBy(entries, keyOf, fieldsOf) {
  const groups = new Map();
  for (const entry of entries) {
    const key = JSON.stringify(keyOf(entry));
    const group = groups.get(key) ?? { ...fieldsOf(entry), count: 0 };
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Gives the kept form of a launch or a session, or null when it is skipped, adding the reason once to `skipped`. */
function keep(entry, kind, today, days, skipped) {
  if (entry === null || typeof entry !== 'object' || !isText(entry.version)) {
    skipped.noVersion += 1;
    return null;
  }
  if (!isText(entry.model) || entry.model === SYNTHETIC) {
    skipped.synthetic += 1;
    return null;
  }
  const ms = typeof entry.at === 'string' ? Date.parse(entry.at) : NaN;
  if (Number.isNaN(ms)) {
    skipped.noTime += 1;
    return null;
  }
  const day = new Date(ms).toISOString().slice(0, 10);
  if (dayNumber(today) - dayNumber(day) >= days) {
    skipped.old += 1;
    return null;
  }
  return {
    kind,
    entrypoint: isText(entry.entrypoint) ? entry.entrypoint : 'unknown',
    version: entry.version,
    model: entry.model,
    plain: plainId(entry.model),
    day,
    ms,
    file: typeof entry.file === 'string' ? entry.file : '',
    alias: kind === 'launch' && isText(entry.alias) ? entry.alias : null,
    agentType: kind === 'launch' && isText(entry.agentType) ? entry.agentType : null,
  };
}

/** Gives the engine items of one declared rule with an alias, and the failing item of each engine whose state is differs. */
function engineItemsOf(rule, launches, sessions) {
  const since = typeof rule.since === 'string' ? rule.since : '';
  const onOrAfter = (entry) => entry.day >= since;

  const engines = new Map();
  for (const entry of [...launches, ...sessions]) {
    if (!onOrAfter(entry)) continue;
    engines.set(JSON.stringify([entry.entrypoint, entry.version]), {
      entrypoint: entry.entrypoint,
      version: entry.version,
    });
  }
  const ordered = [...engines.values()].sort(
    (a, b) => byText(a.entrypoint, b.entrypoint) || compareVersions(a.version, b.version),
  );

  const mine = launches.filter((launch) => launch.alias === rule.alias && onOrAfter(launch));
  const items = [];
  const fails = [];
  for (const engine of ordered) {
    const onEngine = mine
      .filter((launch) => launch.entrypoint === engine.entrypoint && launch.version === engine.version)
      .sort(oldestFirst);
    const onEntry = mine.filter((launch) => launch.entrypoint === engine.entrypoint).sort(oldestFirst);
    // The latest launch on this entry point, over all its versions, decides `differs`.
    const latest = onEntry.length > 0 ? onEntry[onEntry.length - 1] : null;

    const differences = onEngine
      .filter((launch) => launch.plain !== rule.value)
      .map((launch) => ({ model: launch.model, file: launch.file, day: launch.day }));

    let state;
    if (onEngine.length === 0) {
      state = 'no launch yet';
    } else if (differences.length === 0) {
      state = 'agrees';
    } else if (latest !== null && latest.version === engine.version && latest.plain !== rule.value) {
      state = 'differs';
    } else {
      state = 'differed';
    }

    const models = countBy(onEngine, (launch) => launch.plain, (launch) => ({ model: launch.plain }))
      .sort((a, b) => b.count - a.count || byText(a.model, b.model));
    const last = onEngine.length > 0 ? onEngine[onEngine.length - 1].day : null;

    items.push({
      entrypoint: engine.entrypoint,
      version: engine.version,
      state,
      launches: onEngine.length,
      models,
      last,
      differences,
    });

    if (state === 'differs') {
      fails.push({
        id: rule.id,
        alias: rule.alias,
        value: rule.value,
        entrypoint: engine.entrypoint,
        version: engine.version,
        model: latest.model,
        file: latest.file,
        day: latest.day,
      });
    }
  }
  return { item: { id: rule.id, alias: rule.alias, value: rule.value, since: rule.since, engines: items }, fails };
}

/** Gives, for each declared rule that carries an alias and for the records a window keeps, the engine items, the failing engines, the exit code and the other counts. */
export function appliedOf(rules, launches, sessions, { today, days = 7 } = {}) {
  const todayMs = typeof today === 'string' && DAY.test(today) ? Date.parse(`${today}T00:00:00Z`) : NaN;
  if (Number.isNaN(todayMs) || new Date(todayMs).toISOString().slice(0, 10) !== today) {
    throw new Error('appliedOf needs today as a day');
  }
  if (!Number.isInteger(days) || days < 1) {
    throw new Error('appliedOf needs days as a whole number of 1 or more');
  }

  // The day of each entry is a UTC day, so `today` and the window are counted in UTC too.
  const skipped = { noVersion: 0, synthetic: 0, noTime: 0, old: 0 };
  const keptLaunches = listOf(launches)
    .map((entry) => keep(entry, 'launch', today, days, skipped))
    .filter((entry) => entry !== null);
  const keptSessions = listOf(sessions)
    .map((entry) => keep(entry, 'session', today, days, skipped))
    .filter((entry) => entry !== null);

  const declared = listOf(rules).filter((rule) => rule !== null && typeof rule === 'object');
  const aliased = declared.filter((rule) => isText(rule.alias));
  const aliases = new Set(aliased.map((rule) => rule.alias));
  const values = new Set(declared.map((rule) => rule.value));

  const ruleItems = [];
  const fails = [];
  for (const rule of aliased) {
    const found = engineItemsOf(rule, keptLaunches, keptSessions);
    ruleItems.push(found.item);
    fails.push(...found.fails);
  }

  const otherAliases = countBy(
    keptLaunches.filter((launch) => launch.alias !== null && !aliases.has(launch.alias)),
    (launch) => [launch.alias, launch.agentType],
    (launch) => ({ alias: launch.alias, agentType: launch.agentType }),
  ).sort((a, b) => byText(a.alias, b.alias) || nullFirst(a.agentType, b.agentType));

  const noModel = countBy(
    keptLaunches.filter((launch) => launch.alias === null),
    (launch) => [launch.agentType, launch.plain],
    (launch) => ({ agentType: launch.agentType, model: launch.plain }),
  ).sort((a, b) => nullFirst(a.agentType, b.agentType) || byText(a.model, b.model));

  const otherModels = countBy(
    [...keptLaunches, ...keptSessions].filter((entry) => !values.has(entry.plain)),
    (entry) => entry.plain,
    (entry) => ({ model: entry.plain }),
  ).sort((a, b) => byText(a.model, b.model));

  const allDays = [...keptLaunches, ...keptSessions].map((entry) => entry.day).sort(byText);

  return {
    rules: ruleItems,
    fails,
    exit: fails.length > 0 ? 1 : 0,
    otherAliases,
    noModel,
    otherModels,
    read: {
      launches: keptLaunches.length,
      sessions: keptSessions.length,
      firstDay: allDays.length > 0 ? allDays[0] : null,
      lastDay: allDays.length > 0 ? allDays[allDays.length - 1] : null,
    },
    skipped,
  };
}

// The closing note of the lines: what this command does not compare, and who holds it.
const NOT_COMPARED = 'Not compared here: a rule with no alias. A Codex review holds its own model and effort at every run; what a session runs on and the effort of a sub-agent are for the check of launches, which is not built.';

/** Gives the count with its noun: the noun is singular only for 1, so 1 launch, 2 launches and 0 launches. */
function countOf(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Gives the lines of the block "Left out", each only when its count is more than 0. */
function leftOutLines({ elsewhere, behind }) {
  const lines = [];
  if (elsewhere > 0) {
    lines.push(`Left out: ${countOf(elsewhere, 'rule', 'rules')} of the harness's own repository, not in force in this project`);
  }
  if (behind > 0) {
    lines.push(`Left out: ${countOf(behind, 'rule', 'rules')} of this repository, because the copy that runs holds another list than this project's: run the project's own bin/js-harness.mjs`);
  }
  return lines;
}

/** Gives the line of an engine: its state, its launches, the day of the last one and its models, or no launch yet when it has none. */
function engineLineOf(engine) {
  const head = `  ${engine.entrypoint} ${engine.version}`;
  if (engine.launches === 0) {
    return `${head}: no launch yet`;
  }
  const models = engine.models.map((item) => `${item.model} x ${item.count}`).join(', ');
  return `${head}: ${engine.state}, ${countOf(engine.launches, 'launch', 'launches')}, the last on ${engine.last} (${models})`;
}

/** Gives the lines that `js-harness rules applied` prints for a result of appliedOf and the facts of the run in `context`, as texts. It reads nothing and prints nothing. */
export function appliedLines(result, context) {
  const { project, main, recordsDir, exists, files, capped, maxFiles, unreadable, days, leftOut } = context;
  const lines = [
    `Rules applied: what each alias gave in the records of the last ${days} days`,
    `  project: ${project}`,
    `  records: ${recordsDir} (of ${main})`,
  ];
  if (!exists) {
    return [...lines, '  no records there: nothing was read', ...leftOutLines(leftOut), NOT_COMPARED];
  }

  const { launches, sessions, firstDay, lastDay } = result.read;
  if (launches === 0 && sessions === 0) {
    lines.push('  read: no launch and no session in the window');
  } else {
    lines.push(`  read: ${countOf(launches, 'launch', 'launches')} and ${countOf(sessions, 'session', 'sessions')}, from ${firstDay} to ${lastDay}`);
  }
  const more = capped ? `; more than ${maxFiles} were recent, and the oldest were left out` : '';
  lines.push(`  files: ${files.launches} of launches, ${files.sessions} of sessions${more}`);

  const { noVersion, synthetic, noTime, old } = result.skipped;
  if ([noVersion, synthetic, noTime, old].some((count) => count > 0)) {
    lines.push(`  skipped: ${noVersion} with no version, ${synthetic} with no model that answered, ${noTime} with no time, ${old} older than the window`);
  }
  if (unreadable.length > 0) {
    lines.push(`  could not read ${countOf(unreadable.length, 'file', 'files')}:`);
    for (const { file, reason } of unreadable) {
      lines.push(`    ${file}: ${reason}`);
    }
  }
  lines.push('');

  if (result.rules.length === 0) {
    lines.push('no rule with an alias is in force here');
  }
  for (const rule of result.rules) {
    lines.push(`${rule.id}: ${rule.value}, passed as \`${rule.alias}\`, since ${rule.since}`);
    if (rule.engines.length === 0) {
      lines.push('  no engine has an entry in the window since that day');
    }
    for (const engine of rule.engines) {
      lines.push(engineLineOf(engine));
      for (const difference of engine.differences) {
        lines.push(`      ${difference.model} on ${difference.day}: ${difference.file}`);
      }
    }
  }

  if (result.otherAliases.length > 0) {
    lines.push('', "Short names that no rule's alias names:");
    for (const { alias, agentType, count } of result.otherAliases) {
      lines.push(`  ${alias}, ${agentType === null ? 'no agent type' : agentType}: ${count}`);
    }
  }
  if (result.noModel.length > 0) {
    lines.push('', 'Launches that passed no model:');
    for (const { agentType, model, count } of result.noModel) {
      lines.push(`  ${agentType === null ? 'no agent type' : agentType}, answered by ${model}: ${count}`);
    }
  }
  if (result.otherModels.length > 0) {
    lines.push('', "Models that no rule's value names:");
    for (const { model, count } of result.otherModels) {
      lines.push(`  ${model}: ${count}`);
    }
  }

  lines.push('', ...leftOutLines(leftOut), NOT_COMPARED);
  for (const fail of result.fails) {
    lines.push(`FAIL  ${fail.id}: \`${fail.alias}\` gave ${fail.model} on ${fail.entrypoint} ${fail.version} (${fail.day}, ${fail.file}), and the rule says ${fail.value}`);
  }
  if (result.fails.length > 0) {
    const ids = [...new Set(result.fails.map((fail) => fail.id))].join(' and ');
    lines.push(`To the lead: the short name of ${ids} no longer gives the declared model on the engine in use; the alias or the way of launching changes, by a reading.`);
  } else if (result.rules.some((rule) => rule.engines.some((engine) => engine.launches > 0))) {
    lines.push('PASS  rules applied');
  } else if (result.rules.length > 0) {
    // A window in which no launch passed a declared alias proves nothing: it is not written as a pass.
    lines.push('Nothing compared: no launch passed a declared alias in the window');
  }
  return lines;
}
