// Hidden grader of `house-rules`. Copied into the workspace as `.eval-grader/` after the agent exits, so
// `..` is the workspace. Every test imports the project itself, so a broken module fails tests one by one
// and the score stays fractional. Each test names the sentence of the prompt or the section of
// CONTRIBUTING.md it checks. Commands are driven through `main(argv, ctx)` with a fake context.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { BY_ID, HEADER, NOW, csvTasks, parseCsv, spyOnStdio, withEnv } from './fake-env.mjs';

const [seedTask] = BY_ID;

const load = () => import('../src/cli.mjs');
const loadRegistry = () => import('../src/commands/index.mjs');
const T = { timeout: 5000 };
// The commands the tool had before `export`, in registry order.
const EXISTING = ['add', 'done', 'list', 'remove'];
const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

const run = async (env, args) => {
  const { main } = await load();
  return main(args, env.ctx);
};
const ids = (list) => list.map((task) => task.id);
const section = (markdown, heading) => {
  const start = markdown.search(new RegExp(`^${heading}\\s*$`, 'm'));
  assert.notEqual(start, -1, `no "${heading}" heading`);
  const rest = markdown.slice(start).split('\n').slice(1);
  const next = rest.findIndex((line) => line.startsWith('## '));
  return (next === -1 ? rest : rest.slice(0, next)).join('\n');
};
const dirNames = (dir) => fs.readdirSync(dir).sort();
// A rejected input only means something for a command that exists: every rejection test starts from one
// valid invocation that must succeed.
const exportWorks = () =>
  withEnv({}, async (env) => {
    assert.equal(await run(env, ['export']), 0);
    assert.notEqual(env.out(), '');
  });

// ---- the prompt: what `tk export` does ---------------------------------------------------------------

// Prompt: "writes the tasks out as JSON (the default)"; "By default it prints to stdout"
test('export prints the tasks as JSON on stdout by default', T, () =>
  withEnv({}, async (env) => {
    assert.equal(await run(env, ['export']), 0);
    assert.equal(env.err(), '');
    assert.deepEqual([...JSON.parse(env.out())].sort((a, b) => a.id - b.id), BY_ID);
    assert.equal(await run(env, ['export', '--format', 'json']), 0);
  }));

// Prompt: "or CSV (`--format csv`)"
test('export --format csv prints the tasks as CSV on stdout', T, () =>
  withEnv({}, async (env) => {
    assert.equal(await run(env, ['export', '--format', 'csv']), 0);
    assert.equal(env.err(), '');
    assert.deepEqual(parseCsv(env.out())[0], HEADER.split(','));
    assert.deepEqual(csvTasks(env.out()).sort((a, b) => a.id - b.id), BY_ID);
  }));

// Prompt: "`--output <path>` writes to a file instead"
test('export --output writes the file and prints nothing', T, async () => {
  for (const format of ['json', 'csv']) {
    await withEnv({}, async (env) => {
      const file = env.outFile(`tasks.${format}`);
      assert.equal(await run(env, ['export', '--format', format, '--output', file]), 0);
      assert.equal(env.out(), '');
      assert.equal(env.err(), '');
      await withEnv({}, async (other) => {
        await run(other, ['export', '--format', format]);
        assert.equal(fs.readFileSync(file, 'utf8'), other.out());
      });
    });
  }
});

// Prompt: "it must not overwrite an existing file unless `--force` is given";
// CONTRIBUTING.md "Files": ConflictError, exit 3, the file is left as it was
test('export --output refuses to replace an existing file', T, () =>
  withEnv({}, async (env) => {
    const file = env.outFile('tasks.json');
    fs.writeFileSync(file, 'keep me');
    assert.equal(await run(env, ['export', '--output', file]), 3);
    assert.equal(fs.readFileSync(file, 'utf8'), 'keep me');
    assert.match(env.err(), /^tk export: /);
    assert.equal(env.out(), '');
  }));

// Prompt: "unless `--force` is given"
test('export --output --force replaces an existing file', T, () =>
  withEnv({}, async (env) => {
    const file = env.outFile('tasks.json');
    fs.writeFileSync(file, 'replace me');
    assert.equal(await run(env, ['export', '--output', file, '--force']), 0);
    assert.deepEqual(ids(JSON.parse(fs.readFileSync(file, 'utf8'))).sort(), [1, 2, 3, 4, 5, 6]);
  }));

// Prompt: "`--status open|done` keeps only tasks with that status"
test('export --status keeps the tasks with that status', T, () =>
  withEnv({}, async (env) => {
    assert.equal(await run(env, ['export', '--status', 'open']), 0);
    assert.deepEqual(ids(JSON.parse(env.out())).sort(), [1, 3, 5, 6]);
    const done = await withEnv({}, async (other) => {
      assert.equal(await run(other, ['export', '--status', 'done']), 0);
      return ids(JSON.parse(other.out())).sort();
    });
    assert.deepEqual(done, [2, 4]);
  }));

// Prompt: "`--since <duration>` (like `7d` or `12h`) keeps only tasks created within that window",
// measured from the clock of the context (CONTRIBUTING.md "Time"); 90m is a documented duration
test('export --since 12h and 90m keep the tasks created within that window of the clock', T, () =>
  withEnv({}, async (env) => {
    assert.equal(await run(env, ['export', '--since', '12h']), 0);
    assert.deepEqual(ids(JSON.parse(env.out())).sort(), [4, 5]);
    const recent = await withEnv({}, async (other) => {
      assert.equal(await run(other, ['export', '--since', '90m']), 0);
      return ids(JSON.parse(other.out()));
    });
    assert.deepEqual(recent, [5]);
  }));

// Prompt: "like `7d`"
test('export --since 7d keeps the tasks created within seven days of the clock', T, () =>
  withEnv({}, async (env) => {
    assert.equal(await run(env, ['export', '--since', '7d']), 0);
    assert.deepEqual(ids(JSON.parse(env.out())).sort(), [3, 4, 5, 6]);
  }));

// Prompt: both filters in one command
test('export --status and --since combine', T, () =>
  withEnv({}, async (env) => {
    assert.equal(await run(env, ['export', '--status', 'open', '--since', '7d']), 0);
    assert.deepEqual(ids(JSON.parse(env.out())).sort(), [3, 5, 6]);
  }));

// Prompt: "keeps only tasks ..." leaves none; CONTRIBUTING.md "Data formats": JSON pretty-printed with a
// final newline
test('export of no task is an empty JSON array', T, () =>
  withEnv({}, async (env) => {
    assert.equal(await run(env, ['export', '--since', '5m']), 0);
    assert.equal(env.out(), '[]\n');
  }));

// Prompt: "keeps only tasks ..." leaves none; CONTRIBUTING.md "Data formats": a CSV document has a header
// row, and every row ends with CRLF
test('export of no task is a CSV header row alone', T, () =>
  withEnv({}, async (env) => {
    assert.equal(await run(env, ['export', '--format', 'csv', '--since', '5m']), 0);
    assert.equal(env.out(), `${HEADER}\r\n`);
  }));

// ---- CONTRIBUTING.md "Errors and exit codes" ---------------------------------------------------------

// "Errors and exit codes": exit 2 for a usage error, and `flags.mjs`: a value outside `choices` is one
test('export rejects a format or status outside the allowed values with exit 2', T, async () => {
  await exportWorks();
  for (const args of [['--format', 'xml'], ['--status', 'pending']]) {
    await withEnv({}, async (env) => {
      assert.equal(await run(env, ['export', ...args]), 2, args.join(' '));
      assert.match(env.err(), /^tk export: /);
      assert.equal(env.out(), '');
    });
  }
});

// "Errors and exit codes" and "Time": a duration that is not 90m, 12h or 7d is a usage error
test('export rejects a duration it cannot read with exit 2', T, async () => {
  await exportWorks();
  for (const since of ['5x', 'soon', '7', '1.5h']) {
    await withEnv({}, async (env) => {
      assert.equal(await run(env, ['export', '--since', since]), 2, since);
      assert.match(env.err(), /^tk export: /);
      assert.equal(env.out(), '');
    });
  }
});

// "Errors and exit codes": an unknown flag is a usage error
test('export rejects an unknown flag with exit 2', T, () =>
  withEnv({}, async (env) => {
    await exportWorks();
    assert.equal(await run(env, ['export', '--verbose']), 2);
    assert.match(env.err(), /^tk export: /);
    assert.equal(env.out(), '');
  }));

// "Errors and exit codes": a missing value is a usage error
test('export rejects a flag without its value with exit 2', T, async () => {
  await exportWorks();
  for (const flag of ['--format', '--output', '--since', '--status']) {
    await withEnv({}, async (env) => {
      assert.equal(await run(env, ['export', flag]), 2, flag);
      assert.match(env.err(), /^tk export: /);
    });
  }
});

// "Errors and exit codes": a command checks its arguments before it touches any file
test('a failing export writes no file', T, async () => {
  await exportWorks();
  for (const args of [['--since', 'soon'], ['--format', 'xml'], ['--status', 'pending']]) {
    await withEnv({}, async (env) => {
      assert.equal(await run(env, ['export', '--output', env.outFile('tasks.json'), ...args]), 2);
      assert.deepEqual(dirNames(env.outDir), []);
    });
  }
});

// "Errors and exit codes": exit 5 when the task store cannot be read
test('export of a store that is not JSON is a store error', T, () =>
  withEnv({}, async (env) => {
    fs.writeFileSync(env.storePath, '{ not json');
    assert.equal(await run(env, ['export']), 5);
    assert.match(env.err(), /^tk export: /);
    assert.equal(env.out(), '');
  }));

// ---- CONTRIBUTING.md "Output" ------------------------------------------------------------------------

// "Output": commands never use `console`, `process.stdout` or `process.stderr`
test('export prints through ctx.io and never to the process streams or the console', T, () =>
  withEnv({}, async (env) => {
    const { value: codes, written } = await spyOnStdio(async () => [
      await run(env, ['export']),
      await run(env, ['export', '--format', 'csv', '--status', 'open']),
      await run(env, ['export', '--output', env.outFile('a.json')]),
      await run(env, ['export', '--output', env.outFile('a.json')]),
      await run(env, ['export', '--format', 'xml']),
    ]);
    assert.deepEqual(codes, [0, 0, 0, 3, 2]);
    assert.deepEqual(written, []);
    assert.match(env.out(), /Buy milk/);
    assert.match(env.err(), /^tk export: /m);
  }));

// ---- CONTRIBUTING.md "Data formats" ------------------------------------------------------------------

// "Data formats", CSV: the first row is a header, and the columns of a task are
// `id,title,status,created,completed` in that order
test('export --format csv starts with the header of the task columns', T, () =>
  withEnv({}, async (env) => {
    await run(env, ['export', '--format', 'csv']);
    assert.match(env.out(), /^id,title,status,created,completed\r?\n/);
  }));

// "Data formats", CSV: rows end with CRLF, the last row included; a field with no comma, quote, CR or LF is
// written bare; the `completed` of an open task is an empty field
test('export --format csv ends every row with CRLF and writes plain fields bare', T, () =>
  withEnv({}, async (env) => {
    assert.equal(await run(env, ['export', '--format', 'csv', '--since', '90m']), 0);
    assert.equal(env.out(), `${HEADER}\r\n5,Plain,open,2031-04-20T11:30:00.000Z,\r\n`);
  }));

// "Data formats", CSV: a field that contains a comma is wrapped in double quotes
test('export --format csv quotes a title with a comma', T, () =>
  withEnv({}, async (env) => {
    await run(env, ['export', '--format', 'csv']);
    assert.ok(env.out().includes('2,"Call Ann, then Bob",done,2031-04-11T12:00:00.000Z,2031-04-12T12:00:00.000Z\r\n'));
  }));

// "Data formats", CSV: a field that contains a double quote is quoted and the quote is doubled
test('export --format csv doubles the quotes inside a quoted title', T, () =>
  withEnv({}, async (env) => {
    await run(env, ['export', '--format', 'csv']);
    assert.ok(env.out().includes('3,"Say ""hello""",open,2031-04-17T12:00:00.000Z,\r\n'));
  }));

// "Data formats", CSV: a field that contains an LF is wrapped in double quotes
test('export --format csv quotes a title with a line break', T, () =>
  withEnv({}, async (env) => {
    await run(env, ['export', '--format', 'csv']);
    assert.ok(env.out().includes('4,"Line one\nLine two",done,2031-04-20T01:00:00.000Z,2031-04-20T10:00:00.000Z\r\n'));
  }));

// "Data formats": timestamps are ISO 8601 UTC with milliseconds, and `completed` is empty (CSV) or null
// (JSON) while a task is open
test('export keeps timestamps in ISO 8601 UTC and leaves completed empty for an open task', T, () =>
  withEnv({}, async (env) => {
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    await run(env, ['export']);
    const json = JSON.parse(env.out());
    for (const task of json) {
      assert.match(task.created, iso);
      assert.ok(task.completed === null || iso.test(task.completed));
      assert.equal(task.completed === null, task.status === 'open');
    }
    const csv = await withEnv({}, async (other) => {
      await run(other, ['export', '--format', 'csv']);
      return csvTasks(other.out());
    });
    for (const task of csv) assert.equal(task.completed === null, task.status === 'open');
    assert.equal(csv.find((task) => task.id === 1).created, '2031-04-10T12:00:00.000Z');
    assert.equal(csv.find((task) => task.id === 4).completed, '2031-04-20T10:00:00.000Z');
  }));

// CONTRIBUTING.md "Data formats": the store is `{ nextId, tasks }`
test('export reads a store in the current format', T, () =>
  withEnv({ store: { nextId: 9, tasks: [seedTask] } }, async (env) => {
    assert.equal(await run(env, ['export']), 0);
    assert.deepEqual(JSON.parse(env.out()), [seedTask]);
  }));

// "Data formats": JSON output is pretty-printed with two spaces and ends with a newline
test('export JSON is indented with two spaces and ends with a newline', T, () =>
  withEnv({}, async (env) => {
    await run(env, ['export']);
    assert.equal(env.out(), `${JSON.stringify(JSON.parse(env.out()), null, 2)}\n`);
    assert.match(env.out(), /^\[\n {2}\{\n {4}"/);
  }));

// "Data formats": records are sorted by id, ascending, in every output (the store holds them out of order)
test('export lists the tasks by ascending id in JSON and in CSV', T, () =>
  withEnv({}, async (env) => {
    await run(env, ['export']);
    assert.deepEqual(ids(JSON.parse(env.out())), [1, 2, 3, 4, 5, 6]);
    const csv = await withEnv({}, async (other) => {
      await run(other, ['export', '--format', 'csv']);
      return ids(csvTasks(other.out()));
    });
    assert.deepEqual(csv, [1, 2, 3, 4, 5, 6]);
  }));

// ---- CONTRIBUTING.md "Adding a command" and "Files" --------------------------------------------------

// "Adding a command" 1 and 2: the registry holds `export`, in alphabetical order of command name
test('the registry holds export in alphabetical order', T, async () => {
  const { commands } = await loadRegistry();
  const names = commands.map((command) => command.name);
  assert.ok(names.includes('export'));
  assert.deepEqual(names, [...names].sort());
  const command = commands.find((candidate) => candidate.name === 'export');
  assert.equal(typeof command.summary, 'string');
  assert.equal(typeof command.usage, 'string');
  assert.equal(typeof command.run, 'function');
});

// "Adding a command" 3: enumerated values are declared as `choices` in the flag spec, which is keyed by
// flag name (`flags.mjs`)
test('export declares its enumerated flags as choices', T, async () => {
  const { commands } = await loadRegistry();
  const { flags } = commands.find((command) => command.name === 'export');
  assert.deepEqual([...flags.format.choices].sort(), ['csv', 'json']);
  assert.deepEqual([...flags.status.choices].sort(), ['done', 'open']);
});

// "Adding a command" 2 and "Docs": `tk help` is generated from the registry, in registry order
test('tk help lists export with its summary, in registry order', T, () =>
  withEnv({}, async (env) => {
    const { commands } = await loadRegistry();
    assert.equal(await run(env, ['help']), 0);
    const lines = env.out().split('\n');
    const line = lines.findIndex((text) => /^\s*export\b/.test(text));
    assert.notEqual(line, -1, 'no line for export');
    const summary = commands.find((command) => command.name === 'export').summary;
    assert.ok(lines[line].includes(summary));
    const order = commands.map((command) => lines.findIndex((text) => new RegExp(`^\\s*${command.name}\\b`).test(text)));
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
  }));

// "Adding a command" 1: `usage` is the synopsis `tk help <name>` shows, and its flags come from the spec
test('tk help export shows its flags', T, () =>
  withEnv({}, async (env) => {
    assert.equal(await run(env, ['help', 'export']), 0);
    assert.ok(env.out().includes('--format'));
    assert.ok(env.out().includes('--output'));
    assert.equal(env.err(), '');
  }));

// "Files": the file is written to a temporary file next to the target and renamed over it
test('export --output writes through a temporary file renamed over the target', T, () =>
  withEnv({}, async (env) => {
    const file = env.outFile('tasks.json');
    const renames = [];
    const original = fs.renameSync;
    fs.renameSync = (from, to) => {
      renames.push([String(from), String(to)]);
      return original(from, to);
    };
    try {
      assert.equal(await run(env, ['export', '--output', file]), 0);
    } finally {
      fs.renameSync = original;
    }
    const rename = renames.find(([, to]) => to === file);
    assert.ok(rename, 'no temporary file was renamed over the target');
    assert.notEqual(rename[0], file);
    assert.equal(path.dirname(rename[0]), path.dirname(file));
  }));

// "Files": a temporary file is renamed over the target and no temporary file stays behind
test('export --output leaves no temporary file next to the file it writes', T, () =>
  withEnv({}, async (env) => {
    const file = env.outFile('tasks.json');
    assert.equal(await run(env, ['export', '--output', file]), 0);
    assert.deepEqual(dirNames(env.outDir), ['tasks.json']);
    assert.equal(await run(env, ['export', '--output', file]), 3);
    assert.equal(await run(env, ['export', '--format', 'csv', '--output', file, '--force']), 0);
    assert.deepEqual(dirNames(env.outDir), ['tasks.json']);
  }));

// ---- CONTRIBUTING.md "Docs" --------------------------------------------------------------------------

// "Docs": a `## tk <name>` section in docs/COMMANDS.md with every flag
test('docs/COMMANDS.md has a section for export that names every flag', T, () => {
  const text = section(read('../docs/COMMANDS.md'), '## tk export');
  for (const flag of ['--format', '--output', '--force', '--status', '--since']) {
    assert.ok(text.includes(flag), `missing ${flag}`);
  }
});

// "Docs": its name is in the `commands=` line of completions/tk.bash
test('completions/tk.bash lists export', T, () => {
  const line = read('../completions/tk.bash').split('\n').find((text) => /^\s*(local\s+)?commands=/.test(text));
  assert.ok(line, 'no commands= line');
  assert.ok((line.match(/[\w-]+/g) ?? []).includes('export'));
});

// "Docs": a line naming it under `## Unreleased` in CHANGELOG.md
test('CHANGELOG.md names export under Unreleased', T, () => {
  assert.match(section(read('../CHANGELOG.md'), '## Unreleased'), /\bexport\b/i);
});

// ---- regression guards: behaviour that is right today and must stay right -----------------------------

// CONTRIBUTING.md "Data formats", "Time"; docs/COMMANDS.md "tk add"
test('guard: add stores an open task stamped with the clock and the next id', T, () =>
  withEnv({}, async (env) => {
    assert.equal(await run(env, ['add', 'Write', 'docs']), 0);
    assert.deepEqual(env.stored().find((task) => task.id === 7), {
      id: 7,
      title: 'Write docs',
      status: 'open',
      created: NOW,
      completed: null,
    });
    assert.equal(await run(env, ['add']), 2);
    assert.match(env.err(), /^tk add: /);
  }));

// CONTRIBUTING.md "Data formats": "Ids are integers that only increase": the id of a removed task is never
// used again, even when the highest task, or every task, was removed
test('guard: add never reuses the id of a removed task', T, () =>
  withEnv({}, async (env) => {
    assert.equal(await run(env, ['remove', '6']), 0);
    assert.equal(await run(env, ['add', 'Sweep']), 0);
    assert.deepEqual(ids(env.stored()), [1, 2, 3, 4, 5, 7]);
    for (const id of ids(env.stored())) assert.equal(await run(env, ['remove', String(id)]), 0);
    assert.equal(await run(env, ['add', 'Fresh']), 0);
    assert.deepEqual(ids(env.stored()), [8]);
  }));

// CONTRIBUTING.md "Data formats": "Records are sorted by id, ascending, in every output" (the store holds
// them out of order)
test('guard: list shows the tasks by ascending id', T, () =>
  withEnv({}, async (env) => {
    assert.equal(await run(env, ['list', '--all']), 0);
    const rows = env.out().trimEnd().split('\n').slice(1);
    const shown = rows.map((line) => Number(line.split(/\s+/)[0]));
    assert.deepEqual(shown, [1, 2, 3, 4, 5, 6]);
  }));

// docs/COMMANDS.md "tk list": the open tasks, and `--all` adds the finished ones
test('guard: list shows the open tasks and --all the done ones', T, () =>
  withEnv({}, async (env) => {
    assert.equal(await run(env, ['list']), 0);
    assert.ok(env.out().includes('Buy milk') && env.out().includes('Plain'));
    assert.ok(!env.out().includes('Call Ann'));
    const all = await withEnv({}, async (other) => {
      assert.equal(await run(other, ['list', '--all']), 0);
      return other.out();
    });
    assert.ok(all.includes('Call Ann, then Bob'));
  }));

// docs/COMMANDS.md "tk done"; CONTRIBUTING.md "Errors and exit codes"
test('guard: done marks a task, and fails with 3, 4 and 2 as documented', T, () =>
  withEnv({}, async (env) => {
    assert.equal(await run(env, ['done', '1']), 0);
    const task = env.stored().find((entry) => entry.id === 1);
    assert.equal(task.status, 'done');
    assert.equal(task.completed, NOW);
    assert.equal(await run(env, ['done', '1']), 3);
    assert.equal(await run(env, ['done', '99']), 4);
    assert.equal(await run(env, ['done', 'one']), 2);
  }));

// docs/COMMANDS.md "tk remove"; CONTRIBUTING.md "Errors and exit codes"
test('guard: remove deletes a task and fails with 4 for an unknown one', T, () =>
  withEnv({}, async (env) => {
    assert.equal(await run(env, ['remove', '2']), 0);
    assert.deepEqual(ids(env.stored()), [1, 3, 4, 5, 6]);
    assert.equal(await run(env, ['remove', '2']), 4);
  }));

// README.md "Usage"; CONTRIBUTING.md "Errors and exit codes": `tk help` lists the commands, an unknown
// command is a usage error
test('guard: help lists the commands and an unknown command is a usage error', T, () =>
  withEnv({}, async (env) => {
    assert.equal(await run(env, ['help']), 0);
    for (const name of EXISTING) assert.match(env.out(), new RegExp(`^\\s*${name}\\b`, 'm'));
    assert.equal(await run(env, ['frobnicate']), 2);
    assert.match(env.err(), /^tk frobnicate: /);
    assert.equal(await run(env, ['list', '--nope']), 2);
    assert.match(env.err(), /tk list: /);
  }));

// CONTRIBUTING.md "Errors and exit codes": exit 5 when the task store cannot be read
test('guard: a store that is not JSON is a store error for the existing commands', T, () =>
  withEnv({}, async (env) => {
    fs.writeFileSync(env.storePath, '{ not json');
    for (const command of ['list', 'done 1', 'remove 1', 'add Water']) {
      assert.equal(await run(env, command.split(' ')), 5, command);
    }
    assert.match(env.err(), /^tk list: /);
  }));

// CONTRIBUTING.md "Adding a command" 1 and 2: the registry is an alphabetical array of command modules
test('guard: the registry holds the existing commands in the documented shape', T, async () => {
  const { commands } = await loadRegistry();
  const names = commands.map((command) => command.name).filter((name) => EXISTING.includes(name));
  assert.deepEqual(names, EXISTING);
  for (const command of commands.filter((candidate) => EXISTING.includes(candidate.name))) {
    assert.deepEqual(Object.keys(command).sort(), ['flags', 'name', 'run', 'summary', 'usage']);
  }
});

// CONTRIBUTING.md "Docs": every existing command keeps its three entries
test('guard: the existing commands keep their docs, completion and changelog heading', T, () => {
  const docs = read('../docs/COMMANDS.md');
  for (const name of EXISTING) assert.match(docs, new RegExp(`^## tk ${name}\\s*$`, 'm'));
  const line = read('../completions/tk.bash').split('\n').find((text) => /^\s*(local\s+)?commands=/.test(text));
  for (const name of EXISTING) assert.ok((line.match(/[\w-]+/g) ?? []).includes(name), name);
  assert.match(read('../CHANGELOG.md'), /^## Unreleased\s*$/m);
});

// Definition of done: the project's own tests are green when the work ends
test("the project's own test suite passes", { timeout: 30000 }, () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_TEST_CONTEXT'));
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/**/*.spec.mjs'], {
    cwd: new URL('..', import.meta.url),
    env,
    encoding: 'utf8',
    timeout: 25000,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /^# tests [1-9]\d*$/m);
});
