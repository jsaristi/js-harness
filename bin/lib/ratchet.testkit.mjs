// The ratchet every convention test of this repository uses (odd/tasks/conventions.md, S8). A convention that
// does not hold everywhere yet carries an explicit legacy list, each entry with why it is there; the check fails
// for a file off the list that breaks the rule, and for a listed file that already complies or that the check no
// longer finds, so the list only shrinks and a fixed file cannot drift back unseen. Pure: the caller hands in what
// it checked and what broke the rule.

/** The problems of one check, each a line that says how to fix it; `[]` when the convention holds.
 * `checked` and `broken` are names (files or commands); `legacy` maps each listed name to why it is listed. */
export function ratchet({ checked, broken, legacy }) {
  const seen = new Set(checked);
  const breaking = new Set(broken);
  const problems = [];
  for (const name of broken) {
    if (!Object.hasOwn(legacy, name)) problems.push(`${name} breaks the convention and is not on the legacy list: make it comply; the list only shrinks`);
  }
  for (const [name, why] of Object.entries(legacy)) {
    if (!seen.has(name)) problems.push(`${name} is on the legacy list but was not checked: take it off the list`);
    else if (!breaking.has(name)) problems.push(`${name} complies now: take it off the legacy list ("${why}")`);
  }
  return problems;
}
