// The arms of one component (G2 of `odd/tasks/future-model-protocol.md`): a config that differs from its base arm,
// `minimal` or `current`, by one component of the setup, or by a pair of them that may cover for each other. Zero
// deps, plain Node.
//
//   current-without-<id>          the current arm with <id> taken out
//   current-without-<id>_<id>     the same with a pair, its ids sorted
//   minimal-with-<id>             the minimal arm with <id> put in
//
// An arm's name is also part of a trial's key and of its raw logs' file names, so it holds only what the runner's
// name pattern takes (`evals/runner.mjs`): no `:` or `+`, ids joined by `_`.
//
// The components are what the current arm's home template seeds (`evals/home.mjs`, `evals/codex-home.mjs`), each
// agent its own. `plugin-<name>` and `mcp-<name>` are families: one id per installed plugin or MCP server.
//
// Minimal's flags (`evals/configs.mjs`) switch off the user settings, every MCP server and every skill, so most
// components cannot be put into it without changing more than one thing: those are measured by taking them out of
// current instead. Some could be put in with `--setting-sources user` and a home that holds only them; they stay
// refused until the isolation probe (`evals/isolation-probe.mjs`) shows an arm holds its component and its base not.

export class ArmError extends Error {}

const CLAUDE_FIXED = [
  'agents', 'claude-md', 'claude-md-own', 'gentle-ai-agent-routing', 'gentle-ai-codegraph-guidance', 'gentle-ai-engram-protocol',
  'gentle-ai-orchestrator', 'gentle-ai-persona', 'hooks', 'js-harness', 'output-style', 'project', 'skills',
];
const CODEX_FIXED = [
  'agents-md', 'gentle-ai-agent-routing', 'gentle-ai-codegraph-guidance', 'gentle-ai-engram-protocol', 'gentle-ai-orchestrator',
  'gentle-ai-persona', 'hooks', 'js-harness', 'project', 'skills',
];
const FAMILY = /^(plugin|mcp)-[a-z0-9][a-z0-9.-]*$/;
/** The components of each agent: a fixed list and the two families. */
const COMPONENTS = { claude: CLAUDE_FIXED, codex: CODEX_FIXED };

/** Why minimal cannot take a Claude component in, by component; `mcp-<name>` alone can, by `--mcp-config`. */
const SWITCHED_OFF = 'minimal\'s flags switch it off (--disable-slash-commands or --strict-mcp-config), so it is measured as current-without';
const NOT_YET = 'it could be put in with --setting-sources user, which the isolation probe has not shown to load it alone yet';
const MINIMAL_WITH = {
  skills: SWITCHED_OFF, 'js-harness': SWITCHED_OFF, project: SWITCHED_OFF,
  'claude-md': NOT_YET, 'claude-md-own': NOT_YET, agents: NOT_YET, 'output-style': NOT_YET, hooks: NOT_YET,
};
const minimalWithRefusal = (id) => (id.startsWith('mcp-') ? null : id.startsWith('plugin-') ? SWITCHED_OFF : MINIMAL_WITH[id] ?? NOT_YET);

const PREFIXES = [['current-without-', 'current', 'without'], ['minimal-with-', 'minimal', 'with']];

/** What the config `name` is for `agent`: `null` for a base arm or any name that is not an arm's; else
 * `{ base, direction, components }`. An arm that names an unknown component, a pair out of order or repeated, more
 * than two, or a component minimal cannot take in, throws an `ArmError` that says which and why. */
export function parseArm(name, agent) {
  const prefix = PREFIXES.find(([start]) => name.startsWith(start));
  if (prefix === undefined) return null;
  const [start, base, direction] = prefix;
  const components = name.slice(start.length).split('_');
  if (components.length > 2) throw new ArmError(`${name}: an arm takes out one component or two that may cover for each other, not ${components.length}`);
  if (components.length === 2 && components[0] === components[1]) throw new ArmError(`${name}: ${components[0]} is named twice`);
  if (components.length === 2 && components[0] > components[1]) throw new ArmError(`${name}: the pair is named sorted, ${[...components].sort().join('_')}, so one pair has one name`);
  for (const id of components) {
    if (!COMPONENTS[agent].includes(id) && !FAMILY.test(id)) {
      throw new ArmError(`${name}: ${id} is not a component of ${agent === 'codex' ? 'Codex' : 'Claude Code'} (${COMPONENTS[agent].join(', ')}, plugin-<name>, mcp-<name>)`);
    }
  }
  if (direction === 'with') {
    if (agent === 'codex') throw new ArmError(`${name}: Codex takes no minimal-with arm, since nothing shows what its minimal arm leaves loaded: measure it as current-without`);
    if (components.length > 1) throw new ArmError(`${name}: minimal-with puts in one component`);
    const why = minimalWithRefusal(components[0]);
    if (why !== null) throw new ArmError(`${name}: ${why}`);
  }
  return { base, direction, components };
}

/** Every arm of one fixed component an agent offers, for its usage and its tests; the families are left out, since
 * their members are the plugins and servers a machine has. */
export function armNames(agent) {
  return COMPONENTS[agent].map((id) => `current-without-${id}`);
}
