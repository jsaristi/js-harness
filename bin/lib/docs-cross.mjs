// The cross index of `js-harness docs index` (odd/tasks/audit-pack.md, spec 3): why each capability of docs/SPEC.md is
// there, joined to the rules, the failure entries and the documents that say it. Explicit links are what a capability's
// own text cites and what the records declare; inferred links, from a file a capability and a rule or a failure both
// name, are kept apart with the file that made each, and a file too many name infers nothing. What no capability reaches
// is listed, since it is the first thing an auditor asks of an index. Pure: the command reads the files.
import { capabilityFiles } from './docs-plan.mjs';

/** The most rules, or Today lines, that may name one file before it is too shared to infer a link from. */
export const SHARED_LIMIT = 8;

/** How many of the inferred links read by hand were right, `{ right, of }`, or null before they were read: under
 * `INFERRED_BAR` of 20 right, an inferred link is printed as unverified (odd/tasks/audit-pack.md, spec 3). */
export const INFERRED_CHECK = { right: 10, of: 20 };
const INFERRED_BAR = 14 / 20;

/** What the index calls an inferred link: unverified until the hand check meets its bar. */
export const INFERRED_LABEL = INFERRED_CHECK !== null && INFERRED_CHECK.right / INFERRED_CHECK.of >= INFERRED_BAR ? 'inferred' : 'inferred, unverified';

/** The text in code marks of a line, in order. */
const ticked = (line) => [...line.matchAll(/`([^`]+)`/g)].map((match) => match[1]);

/** The rules of a list rendered by `js-harness rules render` (docs/RULES.md): each in force as `{ id, files, failure }`,
 * `files` being its Home and its Read by, `failure` the one its row guards against or null; each under `## Retired` as
 * `{ id, retired: true, successors }`. */
export function parseRules(markdown) {
  const rules = [];
  let retired = false;
  let rule = null;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^## /.test(line)) {
      retired = line.trim() === '## Retired';
      rule = null;
    } else if (/^### /.test(line)) {
      rule = retired ? { id: line.slice(4).trim(), retired: true, successors: [] } : { id: line.slice(4).trim(), files: [], failure: null };
      rules.push(rule);
    } else if (rule?.retired) {
      const successors = /Retired on [\d-]+: read (.*) instead\./.exec(line);
      if (successors) rule.successors = ticked(successors[1]);
    } else if (rule) {
      if (/^- (?:Home|Read by): /.test(line)) rule.files.push(...ticked(line));
      const failure = /against the failure `([^`]+)`/.exec(line);
      if (failure) rule.failure = failure[1];
    }
  }
  return rules;
}

// A document of the repository a capability cites, as the reading plan reads one; the quote that may follow it.
const CITED = /\b((?:odd|docs)\/[\w.-]+(?:\/[\w.-]+)*\.(?:md|html|json|txt))\b/g;
const QUOTED = /^`?,?\s*"([^"]+)"/;
const RULE_ID = /\brule:([a-z][a-z0-9-]*[a-z0-9])/g;
const FEATURE = /^odd\/tasks\/[^/]+\.md$/;

const sorted = (values) => [...new Set(values)].sort();

/** Whether `text` holds `id` as a whole word, so `gate-max` is not read inside `gate-max-two`. */
const holdsWord = (text, id) => new RegExp(`(?<![\\w-])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(text);

/** How many rules and Today lines name each file, and the files more than `SHARED_LIMIT` of either name. */
function sharedFiles(rules, claims) {
  const counts = new Map();
  const at = (file) => counts.get(file) ?? counts.set(file, { file, rules: 0, todays: 0 }).get(file);
  for (const rule of rules) for (const file of new Set(rule.files)) at(file).rules += 1;
  for (const claim of claims) for (const file of claim.today) at(file).todays += 1;
  return [...counts.values()].filter((one) => one.rules > SHARED_LIMIT || one.todays > SHARED_LIMIT).sort((a, b) => a.file.localeCompare(b.file));
}

/** The cross index of `capabilities` (as `parseSpec` gives them) against `rules` (`parseRules`), `failures`
 * (`{ id, control }`, the file of each entry's control or null) and the `tracked` files with their `texts`:
 * `{ capabilities, shared, unreached, broken }`. Each capability is `{ title, line, explicit, inferred }`: `explicit`
 * holds the `documents`, `rules` and `failures` its text names, with the failure each named rule declares; `inferred`
 * the `rules` and `failures` (`{ id, via }`) reached through a file of its Today line, or of its Proof for a failure,
 * that is not too shared. `broken` says each explicit link that does not resolve. */
export function crossIndex({ capabilities, rules, failures, tracked, texts }) {
  const inForce = new Map(rules.filter((rule) => !rule.retired).map((rule) => [rule.id, rule]));
  const retired = new Map(rules.filter((rule) => rule.retired).map((rule) => [rule.id, rule]));
  const claims = capabilities.map((one) => capabilityFiles(one, tracked));
  const shared = sharedFiles([...inForce.values()], claims);
  const tooShared = new Set(shared.map((one) => one.file));
  const broken = [];

  const linked = capabilities.map((one, i) => {
    const where = `"${one.title}" (line ${one.line})`;
    const text = Object.values(one.fields ?? {}).join('\n');
    const documents = [];
    for (const match of text.matchAll(CITED)) {
      const [, file] = match;
      if (!tracked.has(file)) {
        broken.push(`${where} cites ${file}, which is not a tracked file`);
        continue;
      }
      documents.push(file);
      const quote = QUOTED.exec(text.slice(match.index + file.length))?.[1];
      if (quote !== undefined && !(texts.get(file) ?? '').includes(quote)) broken.push(`${where} quotes "${quote}" of ${file}, which that file does not hold`);
    }
    const named = [];
    for (const [, id] of text.matchAll(RULE_ID)) {
      if (inForce.has(id)) named.push(id);
      else if (retired.has(id)) broken.push(`${where} names rule:${id}, retired: read ${retired.get(id).successors.join(', ')} instead`);
      else broken.push(`${where} names rule:${id}, which is no rule`);
    }
    const explicitRules = sorted(named);
    const explicitFailures = sorted([
      ...failures.filter((entry) => holdsWord(text, entry.id)).map((entry) => entry.id),
      ...explicitRules.map((id) => inForce.get(id).failure).filter((id) => id !== null),
    ]);

    const { today, proof } = claims[i];
    const usable = (file) => !tooShared.has(file);
    const inferredRules = [...inForce.values()]
      .filter((rule) => !explicitRules.includes(rule.id))
      .flatMap((rule) => {
        const via = rule.files.find((file) => today.includes(file) && usable(file));
        return via === undefined ? [] : [{ id: rule.id, via }];
      });
    const inferredFailures = failures
      .filter((entry) => !explicitFailures.includes(entry.id) && entry.control !== null)
      .flatMap((entry) => ([...today, ...proof].includes(entry.control) && usable(entry.control) ? [{ id: entry.id, via: entry.control }] : []));
    return {
      title: one.title,
      line: one.line,
      explicit: { documents: sorted(documents), rules: explicitRules, failures: explicitFailures },
      inferred: { rules: inferredRules, failures: inferredFailures },
    };
  });

  const reached = (kind) => new Set(linked.flatMap((one) => [...one.explicit[kind], ...one.inferred[kind].map((link) => link.id)]));
  const reachedRules = reached('rules');
  const reachedFailures = reached('failures');
  const cited = new Set(linked.flatMap((one) => one.explicit.documents));
  const unreached = {
    rules: [...inForce.values()].filter((rule) => !reachedRules.has(rule.id)).map((rule) => {
      const file = rule.files.find((one) => tooShared.has(one));
      return file === undefined ? { id: rule.id } : { id: rule.id, shared: file };
    }),
    failures: sorted(failures.map((entry) => entry.id).filter((id) => !reachedFailures.has(id))),
    features: [...tracked].filter((file) => FEATURE.test(file) && !cited.has(file)).sort(),
  };
  return { capabilities: linked, shared, unreached, broken };
}
