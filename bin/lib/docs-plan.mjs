// The reading plan of a cold audit (odd/tasks/audit-pack.md, spec 2): every tracked file of the repository placed in
// exactly one slice that one context holds, in four tiers read in order, the source in the order of the
// specification's capabilities so an auditor reads each piece beside its reason. Pure: the command hands it the
// tracked files with their estimated tokens, the capabilities and the imports, all read beforehand, and prints what
// it returns; nothing here reads a file, so the plan is computed each time it is printed and no copy of it can rot.
import path from 'node:path';

/** The estimated tokens a slice may hold: 40% of a 1M window, so the auditor keeps room for its instructions, its
 * reasoning and its findings, and for `estimateTokens` undercounting code and Spanish by up to 1.5 times. */
export const SLICE_BUDGET = 400_000;

/** The tiers, in the order an auditor reads them. */
const TIERS = ['core', 'tests', 'feature documents', 'the rest'];

/** The documents that open the core tier, in this order: the entry document, the map, what loads every turn, the plan,
 * the rules, the failures, then the guides. The other files of the root and of `docs/` follow them by name. */
const ORIENTATION = ['docs/README.md', 'docs/SPEC.md', 'AGENTS.md', 'CLAUDE.md', 'docs/ROADMAP.md', 'docs/RULES.md', 'docs/FAILURES.md', 'docs/GUIDE.md', 'README.md'];

const isTest = (file) => /\.test\.[cm]?js$/.test(file) || /\.testkit\.mjs$/.test(file);

/** The tier of the tracked file `file`: `core` (the root's files, the files directly under `docs/` and the source of
 * `bin/`), `tests` (the tests and test kits of `bin/`), `feature documents` (`odd/` and the folders of `docs/`) or
 * `the rest` (`evals/`, `scripts/`, `templates/`, configuration and CI). */
export function tierOf(file) {
  const parts = file.split('/');
  if (parts[0] === 'bin') return isTest(file) ? 'tests' : 'core';
  if (parts.length === 1 || (parts[0] === 'docs' && parts.length === 2)) return 'core';
  if (parts[0] === 'odd' || parts[0] === 'docs') return 'feature documents';
  return 'the rest';
}

// A path of the repository inside a backtick span, with an optional `:line` or `:from-to`.
const TICKED_PATH = /^([\w.-]+(?:\/[\w.-]+)+|[\w-]+\.[\w]+)(?::\d+(?:-\d+)?)?$/;
// A feature document or a document of a `docs/` folder named in running text.
const CITED = /\b((?:odd|docs)\/[\w.-]+(?:\/[\w.-]+)*\.(?:md|html|json|txt))\b/g;

/** The tracked files a capability names: `today`, those its Today line names in backticks; `proof`, those its Proof
 * commands name; `cites`, the feature documents and `docs/` folder documents anywhere in its text. Each once, in the
 * order written; a path `tracked` does not hold is none of them. */
export function capabilityFiles(capability, tracked) {
  const ticked = (text) => [...(text ?? '').matchAll(/`([^`]+)`/g)]
    .flatMap((match) => match[1].split(/\s+/))
    .map((word) => TICKED_PATH.exec(word)?.[1])
    .filter((word) => word !== undefined && tracked.has(word));
  const text = Object.values(capability.fields ?? {}).join('\n');
  const cites = [...text.matchAll(CITED)].map((match) => match[1]).filter((one) => tracked.has(one) && tierOf(one) === 'feature documents');
  return {
    title: capability.title,
    today: [...new Set(ticked(capability.fields?.Today))],
    proof: [...new Set(ticked(capability.fields?.Proof))],
    cites: [...new Set(cites)],
  };
}

// A relative module named by `import ... from`, `export ... from`, a bare `import '...'` or a dynamic `import('...')`.
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.{1,2}\/[^'"]+)['"]/g;

/** The tracked modules the module `from` imports, read from its `text`, resolved from its folder, in order, each once. */
export function importsOf(from, text, tracked) {
  const folder = path.posix.dirname(from);
  const found = [...text.matchAll(IMPORT)].map((match) => path.posix.normalize(path.posix.join(folder, match[1])));
  return [...new Set(found)].filter((one) => tracked.has(one));
}

/** A group of files read together, with its estimated tokens. */
function group(name, files) {
  return { name, files, tokens: files.reduce((sum, one) => sum + one.tokens, 0) };
}

/** The groups of the core tier: the orientation documents, then each capability's source with what only its files
 * import, then the source no capability reaches. */
function coreGroups(byPath, files, capabilities, imports, placed) {
  const take = (paths) => [...new Set(paths)].filter((one) => byPath.has(one) && !placed.has(one) && tierOf(one) === 'core').map((one) => {
    placed.add(one);
    return byPath.get(one);
  });
  const docs = files.filter((one) => !one.path.startsWith('bin/') && tierOf(one.path) === 'core').map((one) => one.path);
  const orientation = take([...ORIENTATION, ...docs.filter((one) => !ORIENTATION.includes(one)).sort()]);
  const owned = capabilities.map((capability) => ({ capability, paths: take(capability.today).map((one) => one.path) }));
  // A module no Today line claims goes with the first capability whose files import it, followed through imports.
  for (let grew = true; grew;) {
    grew = false;
    for (const own of owned) {
      const reached = own.paths.flatMap((one) => imports[one] ?? []).filter((one) => byPath.has(one) && !placed.has(one) && tierOf(one) === 'core');
      if (reached.length === 0) continue;
      own.paths.push(...take(reached).map((one) => one.path));
      grew = true;
    }
  }
  const rest = take(files.map((one) => one.path).filter((one) => one.startsWith('bin/')));
  return [
    group('orientation', orientation),
    ...owned.map(({ capability, paths }) => group(capability.title, paths.map((one) => byPath.get(one)))),
    group('claimed by no capability', rest),
  ];
}

/** The groups of the tests tier: each capability's tests (its Proof's, then those beside its source), then the rest. */
function testGroups(byPath, files, capabilities, placed) {
  const take = (paths) => [...new Set(paths)].filter((one) => byPath.has(one) && !placed.has(one) && tierOf(one) === 'tests').map((one) => {
    placed.add(one);
    return byPath.get(one);
  });
  const beside = (one) => one.replace(/\.(m?js|cjs)$/, '.test.$1');
  return [
    ...capabilities.map((capability) => group(capability.title, take([...capability.proof, ...capability.today.map(beside)]))),
    group('named by no capability', take(files.map((one) => one.path).filter((one) => tierOf(one) === 'tests'))),
  ];
}

/** The groups of a tier whose files are read by folder: `first`, each capability's citations, then each folder by name. */
function folderGroups(byPath, files, tier, capabilities, placed, folderOf) {
  const cited = capabilities.map((capability) => group(capability.title, (capability.cites ?? [])
    .filter((one) => byPath.has(one) && !placed.has(one) && tierOf(one) === tier)
    .map((one) => {
      placed.add(one);
      return byPath.get(one);
    })));
  const folders = new Map();
  for (const one of files) {
    if (placed.has(one.path) || tierOf(one.path) !== tier) continue;
    placed.add(one.path);
    const folder = folderOf(one.path);
    folders.set(folder, [...(folders.get(folder) ?? []), one]);
  }
  const byFolder = [...folders.keys()].sort().map((folder) => group(folder, folders.get(folder).sort((a, b) => a.path.localeCompare(b.path))));
  return [...cited, ...byFolder];
}

/** The slices of one tier's `groups`, under `budget`: a group stays whole unless it alone is over the budget, then it
 * splits by file; one file over the budget is a slice of its own, `oversized`, never cut. A slice opens with
 * `preamble` (`{ path, tokens }`, or `null`), counted in its tokens, unless `first` and it is the tier's first: the
 * plan's first slice holds the preamble itself. */
function pack(groups, budget, preamble, first) {
  const slices = [];
  let current = null;
  const reserve = () => (preamble && !(first && slices.length === 0) ? preamble.tokens : 0);
  const open = () => {
    const tokens = reserve();
    return { tokens, groups: [], ...(tokens > 0 ? { opensWith: preamble.path } : {}) };
  };
  const close = () => {
    if (current) slices.push(current);
    current = null;
  };
  const add = (one) => {
    current ??= open();
    current.groups.push(one);
    current.tokens += one.tokens;
  };
  const fits = (tokens) => (current ? current.tokens : reserve()) + tokens <= budget;
  for (const one of groups.filter((candidate) => candidate.files.length > 0)) {
    if (reserve() + one.tokens <= budget) {
      if (!fits(one.tokens)) close();
      add(one);
      continue;
    }
    close();
    for (const piece of one.files) {
      if (reserve() + piece.tokens > budget) {
        close();
        const slice = open();
        slices.push({ ...slice, tokens: slice.tokens + piece.tokens, groups: [group(one.name, [piece])], oversized: true });
        continue;
      }
      if (!fits(piece.tokens)) close();
      add(group(one.name, [piece]));
    }
  }
  close();
  // Pieces of one group laid side by side in a slice read as one group.
  for (const slice of slices) {
    slice.groups = slice.groups.reduce((merged, one) => {
      const last = merged.at(-1);
      if (last && last.name === one.name) merged[merged.length - 1] = group(one.name, [...last.files, ...one.files]);
      else merged.push(one);
      return merged;
    }, []);
  }
  return slices;
}

/** The reading plan of `files` (`[{ path, tokens, state? }]`, every tracked file, a feature document with its state),
 * for `capabilities` (`capabilityFiles` of each, in the specification's order) and `imports` (`{ path: [path] }`):
 * `{ budget, files, tokens, tiers }`, each tier `{ name, tokens, slices }`, each slice `{ number, tokens, groups,
 * opensWith?, oversized? }`, numbered across the tiers. Every slice but the first opens with `preamble`, the path of
 * the entry document where it is tracked, so what one slice learns reaches the next. */
export function readingPlan({ files, capabilities, imports, budget = SLICE_BUDGET, preamble = null }) {
  const byPath = new Map(files.map((one) => [one.path, one]));
  const opening = byPath.get(preamble) ?? null;
  const placed = new Set();
  const groupsOf = {
    core: coreGroups(byPath, files, capabilities, imports, placed),
    tests: testGroups(byPath, files, capabilities, placed),
    'feature documents': folderGroups(byPath, files, 'feature documents', capabilities, placed, (one) => path.posix.dirname(one)),
    'the rest': folderGroups(byPath, files, 'the rest', [], placed, (one) => one.split('/')[0]),
  };
  let number = 0;
  const tiers = TIERS.map((name) => {
    const slices = pack(groupsOf[name], budget, opening, number === 0).map((slice) => ({ number: ++number, ...slice }));
    return { name, tokens: slices.reduce((sum, slice) => sum + slice.tokens, 0), slices };
  });
  return { budget, files: files.length, tokens: files.reduce((sum, one) => sum + one.tokens, 0), tiers };
}

/** What is wrong with `plan` against the tracked `files`: a slice over its budget that is not one file, a file in
 * more than one slice, a file in none. Empty for a plan `readingPlan` built, so it fails only on a bug of the packer:
 * the `docs` row of `check` runs it as that self-check. */
export function planFindings(plan, files) {
  const findings = [];
  const seen = new Map();
  for (const tier of plan.tiers) {
    for (const slice of tier.slices) {
      const inSlice = slice.groups.flatMap((one) => one.files);
      if (slice.tokens > plan.budget && inSlice.length !== 1) findings.push(`slice ${slice.number} holds ${slice.tokens} estimated tokens, over the budget of ${plan.budget}, and is not one file`);
      for (const one of inSlice) seen.set(one.path, [...(seen.get(one.path) ?? []), slice.number]);
    }
  }
  for (const [file, numbers] of seen) if (numbers.length > 1) findings.push(`${file} is in ${numbers.length} slices: ${numbers.join(', ')}`);
  for (const one of files) if (!seen.has(one.path)) findings.push(`${one.path} is in no slice`);
  return findings;
}
