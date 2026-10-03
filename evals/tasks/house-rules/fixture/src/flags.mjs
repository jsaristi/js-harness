import { UsageError } from './errors.mjs';

/**
 * Parses `argv` against a flag spec, `{ name: { type, description, choices?, default? } }`, where `type` is
 * 'boolean' or 'string'. Flags are written `--name`, and a string flag takes its value as the next argument
 * or after an equals sign. Returns `{ flags, positionals }`; a boolean flag is false unless given.
 * Throws a UsageError for an unknown flag, a missing value or a value outside `choices`.
 */
export function parseFlags(spec, argv) {
  const flags = {};
  for (const [name, def] of Object.entries(spec)) {
    flags[name] = def.type === 'boolean' ? false : def.default;
  }
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const equals = arg.indexOf('=');
    const name = equals === -1 ? arg.slice(2) : arg.slice(2, equals);
    const def = Object.hasOwn(spec, name) ? spec[name] : undefined;
    if (!def) throw new UsageError(`unknown flag --${name}`);
    if (def.type === 'boolean') {
      if (equals !== -1) throw new UsageError(`--${name} takes no value`);
      flags[name] = true;
      continue;
    }
    let value = equals === -1 ? undefined : arg.slice(equals + 1);
    if (value === undefined) {
      i += 1;
      value = argv[i];
      if (value === undefined || value.startsWith('--')) throw new UsageError(`--${name} needs a value`);
    }
    if (def.choices && !def.choices.includes(value)) {
      throw new UsageError(`--${name} must be one of: ${def.choices.join(', ')}`);
    }
    flags[name] = value;
  }
  return { flags, positionals };
}
