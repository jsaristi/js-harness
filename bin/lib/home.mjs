import os from 'node:os';
import path from 'node:path';

/** Whether `JS_HARNESS_HOME` names a home. A non-empty value does; an empty one is unset, as it is for every reader. */
export function homeIsSet(env) {
  return typeof env.JS_HARNESS_HOME === 'string' && env.JS_HARNESS_HOME !== '';
}

/** The value of `JS_HARNESS_HOME` when it is set and relative, else null: a reader that does not run in the writer's
 * working directory, such as the status line's program (bin/lib/status-line.ps1), cannot resolve it. */
export function relativeHome(env) {
  return homeIsSet(env) && !path.isAbsolute(env.JS_HARNESS_HOME) ? env.JS_HARNESS_HOME : null;
}

/** The harness home a command reads: the `--home` value `given` when it is set, else `env.JS_HARNESS_HOME` when it
 * is set, else `homedir()`. An empty value is unset at each step, so it never names the working directory. The
 * result is resolved against `cwd`, so a relative value means the same folder at every reader. */
export function harnessHome({ given, env = process.env, cwd = process.cwd(), homedir = os.homedir }) {
  const set = [given, env.JS_HARNESS_HOME].find((value) => typeof value === 'string' && value !== '');
  return path.resolve(cwd, set ?? homedir());
}
