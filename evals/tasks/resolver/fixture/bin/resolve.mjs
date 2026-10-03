#!/usr/bin/env node
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { parseLock, serializeLock } from '../src/lockfile.mjs';
import { createRegistry } from '../src/registry.mjs';
import { resolve } from '../src/resolve.mjs';

const USAGE = 'expected <manifest.json> --registry <file> [--lock <file>]';

/** What the command line names, read from disk: `{ manifest, registry, lockText }`; throws for a usage problem. */
function readInputs(argv) {
  const { values, positionals } = parseArgs({ args: argv, options: { registry: { type: 'string' }, lock: { type: 'string' } }, allowPositionals: true });
  if (positionals.length !== 1 || values.registry === undefined) throw new Error(USAGE);
  return {
    manifest: JSON.parse(fs.readFileSync(positionals[0], 'utf8')),
    registry: JSON.parse(fs.readFileSync(values.registry, 'utf8')),
    lockText: values.lock === undefined ? undefined : fs.readFileSync(values.lock, 'utf8'),
  };
}

/** Runs the command and returns its exit code: 0, 1 for an error of the resolver, 2 for a usage problem. */
function main(argv) {
  let inputs;
  try {
    inputs = readInputs(argv);
  } catch (error) {
    process.stderr.write(`resolve: ${error.message}\n`);
    return 2;
  }
  try {
    const lock = inputs.lockText === undefined ? undefined : parseLock(inputs.lockText);
    process.stdout.write(serializeLock(resolve(inputs.manifest, createRegistry(inputs.registry), { lock })));
    return 0;
  } catch (error) {
    if (typeof error.code !== 'string') throw error;
    process.stderr.write(`error ${error.code}: ${error.message}\n`);
    return 1;
  }
}

process.exitCode = main(process.argv.slice(2));
