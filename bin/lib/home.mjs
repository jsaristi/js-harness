import os from 'node:os';
import path from 'node:path';

/** Whether `JS_HARNESS_HOME` names a home. A non-empty value does; an empty one is unset, as it is for every reader. */
export function homeIsSet(env) {
  return typeof env.JS_HARNESS_HOME === 'string' && env.JS_HARNESS_HOME !== '';
}

/** The harness home a command reads: the `--home` value `given` when it is set, else `env.JS_HARNESS_HOME` when it
 * is set, else `homedir()`. An empty value is unset at each step, so it never names the working directory. The
 * result is resolved against `cwd`, so a relative value means the same folder at every reader. */
export function harnessHome({ given, env = process.env, cwd = process.cwd(), homedir = os.homedir }) {
  const set = [given, env.JS_HARNESS_HOME].find((value) => typeof value === 'string' && value !== '');
  return path.resolve(cwd, set ?? homedir());
}
