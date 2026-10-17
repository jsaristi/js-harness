// The two arms of the eval on the Codex CLI: the same sandbox as Claude Code's arms (`configs.mjs`), with
// what Codex needs in place of what only Claude Code reads. Zero deps, plain Node. The plan and the facts
// this is built on (`codex exec --help` of codex-cli 0.159.1) are in `odd/tasks/codex-parity.md` (T2).
import path from 'node:path';
import { readCodexOutput } from './agent-output.mjs';
import { assertLogin, codexHomeOf, copyLogin, removeLogin } from './codex-home.mjs';
import { SANDBOX_ALLOWLIST, sandboxEnv, sandboxLifecycle } from './configs.mjs';

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

/** What a Codex trial inherits: the sandbox allowlist without Claude Code's credential. Codex's login is a
 * file in `CODEX_HOME` (`codex-home.mjs`), so no credential rides the environment at all, and the other
 * host's token has no business in a process whose model can read its own env. */
export const CODEX_ALLOWLIST = SANDBOX_ALLOWLIST.filter((name) => name !== 'CLAUDE_CODE_OAUTH_TOKEN');

/** The switches of `SANDBOX_SWITCHES` that something in a Codex trial reads: gentle-ai (its hooks run
 * `gentle-ai telemetry` at every stop) and codegraph (an MCP server of the setup) are the same programs
 * under both hosts, and `DO_NOT_TRACK` is the convention any tool may honor. The rest are Claude Code's own
 * (its updater, auto memory, telemetry, survey and claude.ai connectors) and would only claim something
 * about Codex that no code enforces. Codex has no environment switch for the same things: its update check
 * and analytics are `config.toml` keys, and setting them would change the configuration under test. */
export const CODEX_SWITCHES = { DO_NOT_TRACK: '1', GENTLE_AI_TELEMETRY: '0', CODEGRAPH_TELEMETRY: '0' };

/** The env overrides of a Codex trial: `sandboxEnv` (every writer moved into `home`, the trial's engram port,
 * an allowlist of what is inherited) with Codex's allowlist and switches, and `CODEX_HOME` in the trial's
 * home. The moved paths stay whole, `CLAUDE_CONFIG_DIR` included: a tool an agent starts must find the
 * sandbox wherever it looks for a home. An inherited `CODEX_HOME`, or any other `CODEX_*` variable of a
 * live session, is replaced or removed like everything outside the allowlist. */
export function codexSandboxEnv({ home, engramPort, inherited, platform }) {
  const paths = typeof home === 'string' && path.isAbsolute(home) ? { CODEX_HOME: codexHomeOf(home) } : {};
  return sandboxEnv({ home, engramPort, inherited, platform, allowlist: CODEX_ALLOWLIST, switches: CODEX_SWITCHES, paths });
}

/** Throws unless `command` can be spawned as an agent: an absolute path (no PATH lookup is made, which could
 * find another install) that is not a `.cmd`, `.bat` or `.ps1` shim (the runner spawns without a shell, and
 * `codex` on PATH is one: a pnpm shim that runs `node <...>/@openai/codex/bin/codex.js`, which starts the
 * native `codex.exe` of the platform package). `label` names the option in the message. */
export function assertAgentCommand(command, label = 'the agent command') {
  if (!isNonEmptyString(command)) throw new Error(`${label} is required: the absolute path of the agent's real binary`);
  if (!path.isAbsolute(command)) throw new Error(`${label} must be an absolute path, got ${JSON.stringify(command)}: no PATH lookup is made`);
  if (/\.(cmd|bat|ps1)$/i.test(command)) throw new Error(`${label} ${command} is a shim: agents are spawned without a shell, so point at the real binary`);
}

/** The runner config both Codex arms share. `command` is the real binary (`assertAgentCommand`) and
 * `commandArgs` what must come before Codex's own arguments when the command is a launcher (`node` and the
 * path of `codex.js`); `model` is required with no default, as for Claude Code; `authFile` is the real
 * login, an absolute path, which is only ever copied.
 *
 * The argv is `exec --json --ephemeral --skip-git-repo-check -m <model> -c model_reasoning_effort="<effort>"
 * --dangerously-bypass-approvals-and-sandbox -C <workspace>`, then `extraArgs`. The prompt is not in it: the
 * runner writes it to stdin, which `codex exec` reads when it is given no prompt argument. `--ephemeral` keeps
 * the session out of `CODEX_HOME/sessions`; the bypass flag is the decided equivalent of the
 * `bypassPermissions` the Claude arms ran under, inside a throwaway home and workspace; the effort is a
 * config override because `codex exec` has no flag for it, and it is the only thing that varies with the
 * trial besides the workspace.
 *
 * `prepare` is the sandbox's (`sandboxLifecycle`: the engram port, the directories, the fixture commit),
 * then the arm's `seed`, then the login, LAST: a step that fails before it leaves a home that never held a
 * credential. `cleanup` deletes that copy before anything else, then frees the port. */
function buildCodexConfig(name, { command, commandArgs = [], model, authFile, allocatePort, releasePort, killPort } = {}, extraArgs, seed) {
  assertAgentCommand(command, `${name} config: "command"`);
  if (!Array.isArray(commandArgs) || !commandArgs.every(isNonEmptyString)) throw new Error(`${name} config: "commandArgs" must be a list of arguments, got ${JSON.stringify(commandArgs)}`);
  if (!isNonEmptyString(model)) throw new Error(`${name} config: "model" is required and has no default`);
  if (!isNonEmptyString(authFile)) throw new Error(`${name} config: "authFile" is required, the absolute path of the Codex login (auth.json)`);
  if (!path.isAbsolute(authFile)) throw new Error(`${name} config: "authFile" must be an absolute path, got ${JSON.stringify(authFile)}`);
  const lifecycle = sandboxLifecycle({ allocatePort, releasePort, killPort }, async (context) => {
    // Checked before the arm's seed: a login that is missing should not cost the copy of a whole setup.
    assertLogin(authFile);
    if (seed) await seed(context);
    copyLogin({ authFile, home: context.home });
  });
  return {
    name,
    command,
    args: ({ effort, workspace }) => {
      // The effort is written inside a quoted TOML value, so it is a plain word or nothing.
      if (!isNonEmptyString(effort) || !/^[A-Za-z0-9_-]+$/.test(effort)) throw new Error(`${name} config: the trial has no usable effort, got ${JSON.stringify(effort)}`);
      if (!isNonEmptyString(workspace) || !path.isAbsolute(workspace)) throw new Error(`${name} config: the trial has no absolute workspace, got ${JSON.stringify(workspace)}`);
      return [
        ...commandArgs, 'exec', '--json', '--ephemeral', '--skip-git-repo-check', '-m', model, '-c', `model_reasoning_effort="${effort}"`,
        '--dangerously-bypass-approvals-and-sandbox', '-C', workspace, ...extraArgs,
      ];
    },
    versionArgs: [...commandArgs, '--version'],
    reader: readCodexOutput,
    env: ({ home, prepared }) => codexSandboxEnv({ home, engramPort: prepared?.engramPort }),
    prepare: lifecycle.prepare,
    cleanup: async (context) => {
      try {
        removeLogin({ authFile, home: context.home });
      } finally {
        await lifecycle.cleanup(context);
      }
    },
  };
}

/** The minimal arm: the model and its built-in tools, nothing else. Its `CODEX_HOME` holds the login and
 * nothing more (no `config.toml`, no global `AGENTS.md`, no hooks, no plugins, no MCP servers), and its
 * workspace gets no `js-harness init`. `--ignore-user-config` skips `CODEX_HOME/config.toml` while the login
 * is still read from there, and `--ignore-rules` skips user and project execpolicy `.rules`: neither file
 * exists in this home today, so the flags say what the arm is and keep it so if Codex ever writes one.
 * ASSUMED, for the real trials to settle: that Codex adds nothing to an empty home that changes a session
 * (it may install its bundled system skills there). */
export function codexMinimalConfig(options) {
  return buildCodexConfig('minimal', options, ['--ignore-user-config', '--ignore-rules']);
}

/** The current arm: the machine's Codex setup as it is used daily. The setup lives in the trial's home and
 * workspace, which `seed({ home, workspace, engramPort })` fills (`seedFromCodexTemplate`); without one the
 * home holds the login alone. Its one flag is `--dangerously-bypass-hook-trust`: Codex runs a hook only once
 * it is trusted, and keeps that trust in `config.toml` under the absolute path of the `hooks.json` that
 * declares it, so in a trial home, under another path, the same hooks would be new and skipped. The flag makes
 * them run as they do for him. ASSUMED, for the real trials to settle: that it runs nothing he has not
 * trusted (a plugin's hooks have no entry of that kind in the real `config.toml`). An arm of one component
 * (`evals/arms.mjs`) is this config under its own `name`, with a seed that takes its component out. */
export function codexCurrentConfig({ seed, name = 'current', ...options } = {}) {
  return buildCodexConfig(name, options, ['--dangerously-bypass-hook-trust'], seed);
}
