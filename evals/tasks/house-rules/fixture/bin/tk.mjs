#!/usr/bin/env node
import { main } from '../src/cli.mjs';
import { defaultContext } from '../src/context.mjs';

process.exitCode = await main(process.argv.slice(2), defaultContext());
