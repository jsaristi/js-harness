import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CODEX_TEMPLATE_KIND, DEFAULT_MIN_LOGIN_HOURS_LEFT, DESKTOP_APP, assertLogin, assertLoginFresh, buildCodexTemplate, codexHomeOf, copyLogin,
  removeCodexTemplate, removeLogin, seedCodexHome, seedFromCodexTemplate, withEngramEnv, withoutDesktopApp,
} from './codex-home.mjs';
import { buildTemplate, removeTemplate, seedHome } from './home.mjs';

const PORT = 41234;
const WINDOWS = process.platform === 'win32';

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-codex-home-test-'));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));
let counter = 0;
const tmp = (name) => {
  const dir = path.join(scratch, `${name}-${counter++}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

// ---- a fake real home --------------------------------------------------------------------------------
// No test reads the machine's own `~/.codex`: everything below is built in the scratch directory.

const NEVER = 'SENTINEL-NEVER-COPIED';
const LOGIN = '{"auth_mode":"chatgpt","tokens":{"id_token":"SENTINEL-DUMMY-LOGIN"}}\n';
const HEADER = 'SENTINEL-DUMMY-HEADER';
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

// The three ways a config file spells one path: a TOML basic or JSON string doubles each backslash, a TOML
// literal string keeps it, and a path inside a JSON value a tool wrote may use `/`. On POSIX the three agree.
const escaped = (value) => JSON.stringify(value).slice(1, -1);
const slashed = (value) => value.replaceAll('\\', '/');

// The desktop app's pieces, which the current arm leaves out. The tests hold their own copy of the list, as
// they do for every boundary: a name dropped from the module by accident fails here.
const DESKTOP_PLUGINS = ['unified-computer-use@openai-bundled', 'computer-use@openai-bundled', 'browser@openai-bundled', 'chrome@openai-bundled', 'codex-app-tools@openai-bundled'];
const DESKTOP_DIRS = ['unified-computer-use', 'computer-use', 'browser', 'chrome', 'codex-app-tools'].map((name) => `.codex/plugins/cache/openai-bundled/${name}`);

/** The `config.toml` of the fake home: every shape the real one holds a home path in. The paths inside
 * `.codex` must end up in the trial's own; the ones elsewhere in the home (a program installed in the user
 * profile) are left as they are. With `desktop: false` it is the same file without the desktop app's
 * pieces (the `notify` key, the `node_repl` server and the five plugins), which is what a template keeps. */
function configToml(home, { desktop = true, eol = '\n' } = {}) {
  const codex = path.join(home, '.codex');
  const local = path.join(home, 'AppData', 'Local');
  const only = (...lines) => (desktop ? lines : []);
  const plugin = (id) => only(`[plugins."${id}"]`, 'enabled = true', '');
  return [
    `# engram-windows-hook-command-v1: "${escaped(path.join(local, 'engram', 'bin', 'engram.exe'))}"`,
    ...only(`notify = [ "${escaped(path.join(local, 'OpenAI', 'codex-computer-use.exe'))}", "turn-ended" ]`),
    `model_instructions_file = "${escaped(path.join(codex, 'engram-instructions.md'))}"`,
    `experimental_compact_prompt_file = "${escaped(path.join(codex, 'engram-compact-prompt.md'))}"`,
    'model = "some-model"',
    '',
    '[marketplaces.bundled]',
    'source_type = "local"',
    `source = '\\\\?\\${path.join(codex, '.tmp', 'bundled-marketplaces', 'bundled')}'`,
    '',
    ...plugin(DESKTOP_PLUGINS[0]),
    '[plugins."demo@bundled"]',
    'enabled = true',
    '',
    ...DESKTOP_PLUGINS.slice(1, 4).flatMap(plugin),
    '[plugins."code-review@openai-bundled"]',
    'enabled = true',
    '',
    ...plugin(DESKTOP_PLUGINS[4]),
    ...only(
      '[mcp_servers.node_repl]',
      'args = []',
      `command = '${path.join(local, 'OpenAI', 'node_repl.exe')}'`,
      '',
      '[mcp_servers.node_repl.env]',
      `CODEX_HOME = '${codex}'`,
      'SKY_CUA_NATIVE_PIPE = "1"',
      '',
    ),
    '[mcp_servers.tools]',
    `command = '${path.join(local, 'OpenAI', 'tools.exe')}'`,
    '',
    '[mcp_servers.tools.env]',
    `CODEX_HOME = '${codex}'`,
    `TRUSTED_SERVICES = '{"browser":"${slashed(path.join(codex, 'plugins', 'cache', 'bundled', 'demo', '1.0.0', 'service.mjs'))}"}'`,
    `TRUSTED_PATHS = '${codex};${path.join(local, 'OpenAI', 'modules')}'`,
    '',
    `[hooks.state.'${path.join(codex, 'hooks.json')}:session_start:0:0']`,
    'trusted_hash = "sha256:0123"',
    '',
    '[mcp_servers.context7.http_headers]',
    `Authorization = "Bearer ${HEADER}"`,
    '',
    `[projects.'${home.toLowerCase()}']`,
    'trust_level = "trusted"',
    '',
    '[mcp_servers.engram]',
    'command = "engram"',
    'args = ["mcp", "--tools=agent"]',
    '',
  ].join(eol);
}

const hooksJson = (home) => `${JSON.stringify({
  hooks: {
    SessionStart: [{ hooks: [{ type: 'command', command: `powershell -File "${path.join(home, '.codex', 'herdr-agent-state.ps1')}" session`, timeout: 10 }] }],
    Stop: [{ hooks: [{ type: 'command', command: 'gentle-ai telemetry runtime codex --json', timeout: 4 }] }],
  },
}, null, 2)}\n`;

/** What is copied, relative to the home, and what never is (each of those holds the sentinel, so a copy of
 * it anywhere is found by content as well as by name). */
const COPIED = [
  '.codex/config.toml', '.codex/AGENTS.md', '.codex/hooks.json', '.codex/engram-instructions.md', '.codex/engram-compact-prompt.md',
  '.codex/herdr-agent-state.ps1', '.codex/skills/demo/SKILL.md', '.codex/skills/.system/.codex-system-skills.marker',
  '.codex/plugins/cache/bundled/demo/1.0.0/.codex-plugin/plugin.json', '.codex/plugins/cache/bundled/demo/1.0.0/.mcp.json',
  '.codex/plugins/cache/bundled/demo/1.0.0/service.mjs', '.codex/plugins/cache/openai-bundled/code-review/1.0.0/plugin.json', '.gentle-ai/state.json',
];
const PLUGIN_MCP = '.codex/plugins/cache/bundled/demo/1.0.0/.mcp.json';
const REWRITTEN = ['.codex/config.toml', '.codex/hooks.json', PLUGIN_MCP];
const EXCLUDED = [
  '.codex/state_5.sqlite', '.codex/state_5.sqlite-shm', '.codex/state_5.sqlite-wal', '.codex/logs_2.sqlite', '.codex/memories_1.sqlite', '.codex/goals_1.sqlite',
  '.codex/queue_1.sqlite', '.codex/sessions/2026/rollout.jsonl', '.codex/cache/c.json', '.codex/.tmp/bundled-marketplaces/bundled/marketplace.json', '.codex/.sandbox/s.txt',
  '.codex/app-server-control/c.json', '.codex/app-server-daemon/d.json', '.codex/.codex-global-state.json', '.codex/.codex-global-state.json.bak', '.codex/config.toml.bak',
  '.codex/plugins/.plugin-appserver/codex.exe', '.codex/plugins/.remote-plugin-install-staging/x.json', '.codex/models_cache.json', '.codex/installation_id',
  '.codex/version.json', '.codex/stray.txt', '.engram/engram.db', '.gentle-ai/telemetry.json', 'notes.txt',
  // The profiles `-p <name>` layers: no trial passes `-p`, and a copy would go through none of the edits
  // `config.toml` gets, so it would carry the desktop app's pieces and the real engram into a trial home.
  '.codex/sdd-cheap.config.toml', '.codex/sdd-strong.config.toml',
  // The desktop app's plugins, each with the MCP server it would declare.
  ...DESKTOP_DIRS.flatMap((dir) => [`${dir}/1.0.0/.mcp.json`, `${dir}/1.0.0/.codex-plugin/plugin.json`]), `${DESKTOP_DIRS[3]}/latest/.mcp.json`,
];

/** A believable stand-in for the machine's real home. `config` replaces the `config.toml` text. */
function makeRealHome({ config } = {}) {
  const home = path.join(tmp('real'), 'Person');
  const codex = path.join(home, '.codex');
  write(path.join(codex, 'config.toml'), config ?? configToml(home));
  write(path.join(codex, 'AGENTS.md'), '# global instructions\n');
  write(path.join(codex, 'hooks.json'), hooksJson(home));
  write(path.join(codex, 'engram-instructions.md'), 'memory protocol\n');
  write(path.join(codex, 'engram-compact-prompt.md'), 'compact prompt\n');
  write(path.join(codex, 'herdr-agent-state.ps1'), 'exit 0\n');
  write(path.join(codex, 'skills', 'demo', 'SKILL.md'), '# demo skill\n');
  write(path.join(codex, 'skills', '.system', '.codex-system-skills.marker'), 'marker\n');
  write(path.join(codex, 'plugins', 'cache', 'bundled', 'demo', '1.0.0', '.codex-plugin', 'plugin.json'), '{"name":"demo"}\n');
  // A plugin declares its own MCP server, and hands it the home: the shape of the real computer-use plugin.
  const server = { command: path.join(home, 'AppData', 'Local', 'OpenAI', 'tools.exe'), env: { CODEX_HOME: codex } };
  write(path.join(home, ...PLUGIN_MCP.split('/')), `${JSON.stringify({ mcpServers: { demo: server } }, null, 2)}\n`);
  write(path.join(codex, 'plugins', 'cache', 'bundled', 'demo', '1.0.0', 'service.mjs'), 'export {};\n');
  write(path.join(codex, 'plugins', 'cache', 'openai-bundled', 'code-review', '1.0.0', 'plugin.json'), '{"name":"code-review"}\n');
  write(path.join(home, '.gentle-ai', 'state.json'), '{"rdd_mode":"on"}\n');
  write(path.join(codex, 'auth.json'), LOGIN);
  for (const rel of EXCLUDED) write(path.join(home, ...rel.split('/')), `${NEVER}\n`);
  return home;
}

/** Every entry below `root`, path to `sha256:size` (a directory is `dir`, a link `link:<target>`), walked
 * without following links: two equal trees are byte-identical. */
function hashTree(root) {
  const tree = new Map();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (entry.isSymbolicLink()) tree.set(rel, `link:${fs.readlinkSync(full)}`);
      else if (entry.isDirectory()) {
        tree.set(rel, 'dir');
        walk(full);
      } else {
        const bytes = fs.readFileSync(full);
        tree.set(rel, `${crypto.createHash('sha256').update(bytes).digest('hex')}:${bytes.length}`);
      }
    }
  };
  walk(root);
  return tree;
}

const filesOf = (root) => [...hashTree(root)].filter(([, hash]) => hash !== 'dir' && !hash.startsWith('link:')).map(([rel]) => rel).sort();
const read = (root, rel) => fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8');
/** How many times `text` names `target`, whatever the separators (one or two backslashes, or a slash) and,
 * on Windows, whatever the case. */
function mentions(text, target) {
  const fold = (value) => (process.platform === 'win32' ? value.toLowerCase() : value);
  const flat = (value) => fold(value.replace(/\\+/g, '/'));
  return flat(text).split(flat(target)).length - 1;
}

/** A template of a fresh fake real home, and a function that seeds a new trial home from it. */
function setup(options) {
  const realHome = makeRealHome(options);
  const templateDir = path.join(tmp('template'), 'tpl');
  const summary = buildCodexTemplate({ realHome, templateDir });
  const seed = (engramPort = PORT) => {
    const home = path.join(tmp('trial'), 'home');
    seedCodexHome(templateDir, home, { engramPort });
    return home;
  };
  return { realHome, templateDir, summary, seed };
}

// ---- buildCodexTemplate ------------------------------------------------------------------------------

test('buildCodexTemplate copies exactly the copy list of the real home into a template, and reports it', () => {
  const { realHome, templateDir, summary } = setup();
  assert.deepEqual(filesOf(templateDir), ['template.json', ...COPIED.map((rel) => `home/${rel}`)].sort(), 'a copy list, not a deny list: nothing else is there');
  for (const rel of COPIED.filter((file) => !REWRITTEN.includes(file))) assert.equal(read(path.join(templateDir, 'home'), rel), read(realHome, rel), rel);
  assert.equal(summary.templateDir, templateDir);
  assert.equal(summary.files, COPIED.length);
  assert.equal(summary.bytes, COPIED.reduce((total, rel) => total + fs.statSync(path.join(templateDir, 'home', ...rel.split('/'))).size, 0));
  assert.equal(JSON.parse(read(templateDir, 'template.json')).kind, CODEX_TEMPLATE_KIND);
});

test('the template holds no login, no state database, no session, cache or backup: neither by name nor by content', () => {
  const { templateDir } = setup();
  const files = filesOf(templateDir);
  const names = files.flatMap((rel) => rel.split('/'));
  for (const name of ['auth.json', 'sessions', '.tmp', '.sandbox', 'app-server-control', 'app-server-daemon', '.plugin-appserver', '.remote-plugin-install-staging', '.engram']) {
    assert.ok(!names.includes(name), `${name} is in the template`);
  }
  // `plugins/cache` is the plugins themselves; the `cache` of the home is Codex's own and stays behind.
  assert.deepEqual(files.filter((rel) => rel.startsWith('home/.codex/cache/')), []);
  assert.deepEqual(names.filter((name) => /sqlite|\.bak$|^\.codex-global-state|\.config\.toml$/.test(name)), [], 'no state, no backup, no profile');
  for (const rel of files) {
    const text = read(templateDir, rel);
    assert.ok(!text.includes(NEVER), `${rel} holds something that is never copied`);
    assert.ok(!text.includes('SENTINEL-DUMMY-LOGIN'), `${rel} holds the login`);
  }
});

test('buildCodexTemplate reads the real home without changing a byte of it', () => {
  const realHome = makeRealHome();
  const before = hashTree(realHome);
  buildCodexTemplate({ realHome, templateDir: path.join(tmp('template'), 'tpl') });
  assert.deepEqual(hashTree(realHome), before);
});

test('in the template every path into the real .codex is a placeholder, whatever its spelling; the rest of the home is left and reported', () => {
  const { realHome, templateDir, summary } = setup();
  const codex = path.join(realHome, '.codex');
  for (const rel of REWRITTEN) assert.equal(mentions(read(path.join(templateDir, 'home'), rel), codex), 0, `${rel} still names the real .codex`);
  const config = read(path.join(templateDir, 'home'), '.codex/config.toml');
  // Six values and one table key in config.toml, in three spellings (on POSIX the three are one: `/`).
  const count = (style) => config.split(`@@TRIAL_CODEX_HOME:${style}@@`).length - 1;
  assert.deepEqual([count('escaped'), count('plain'), count('slash')], WINDOWS ? [2, 4, 1] : [0, 0, 7]);
  // Programs installed in the user profile: a trial home holds no copy of them, so the value is kept.
  assert.equal(mentions(config, path.join(realHome, 'AppData', 'Local')), 3);
  assert.ok(config.includes(`[projects.'${realHome.toLowerCase()}']`));

  const about = (file) => summary.warnings.filter((warning) => warning.startsWith(`${file}:`));
  assert.equal(about('config.toml').length, 2, summary.warnings.join('\n'));
  // Three programs (the desktop app's two are gone with their tables), and on Windows (where a path matches
  // in any case) the trusted home of `[projects]`.
  assert.match(about('config.toml')[0], new RegExp(`outside \\.codex in ${WINDOWS ? 4 : 3} place\\(s\\)`));
  assert.match(about('config.toml')[1], /1 path\(s\).*does not hold.*\.tmp/, 'the marketplace source lives in .tmp, which is never copied');
  assert.deepEqual(about('hooks.json'), []);
  assert.equal(about(PLUGIN_MCP.slice('.codex/'.length)).length, 1, 'a plugin\'s own config is reported under its path');
  assert.deepEqual(JSON.parse(read(templateDir, 'template.json')).rewritten, ['.codex/config.toml', '.codex/hooks.json', PLUGIN_MCP], 'the files a seed has to finish');
  for (const warning of summary.warnings) {
    assert.ok(!warning.includes(HEADER), 'a warning never carries a value');
    assert.equal(mentions(warning, realHome), 0, 'nor a path of the real machine');
  }
});

test('a copied file that is not rewritten and names the real home is reported, by item and count', () => {
  const realHome = makeRealHome();
  write(path.join(realHome, '.codex', 'AGENTS.md'), `read ${path.join(realHome, '.codex', 'skills', 'demo', 'SKILL.md')} first\n`);
  write(path.join(realHome, '.codex', 'skills', 'demo', 'SKILL.md'), `see ${escaped(path.join(realHome, 'notes.txt'))} and ${slashed(realHome)}/x\n`);
  const summary = buildCodexTemplate({ realHome, templateDir: path.join(tmp('template'), 'tpl') });
  assert.ok(summary.warnings.some((warning) => /^AGENTS\.md: names the real home in 1 place\(s\)/.test(warning)), summary.warnings.join('\n'));
  assert.ok(summary.warnings.some((warning) => /^skills: names the real home in 2 place\(s\)/.test(warning)), summary.warnings.join('\n'));
});

test('buildCodexTemplate takes only what exists, and refuses a home with no .codex directory', () => {
  const realHome = path.join(tmp('sparse'), 'person');
  write(path.join(realHome, '.codex', 'config.toml'), 'model = "m"\n');
  const templateDir = path.join(tmp('template'), 'tpl');
  assert.equal(buildCodexTemplate({ realHome, templateDir }).files, 1);
  assert.deepEqual(filesOf(templateDir), ['home/.codex/config.toml', 'template.json']);
  assert.throws(() => buildCodexTemplate({ realHome: tmp('empty-home'), templateDir: path.join(tmp('template'), 'tpl') }), /\.codex/);
  assert.throws(() => buildCodexTemplate({ realHome: path.join(scratch, 'does-not-exist'), templateDir: path.join(tmp('template'), 'tpl') }), /real home/);
});

test('buildCodexTemplate keeps the guards of the Claude template: never inside the real home, never into a directory in use', () => {
  const realHome = makeRealHome();
  assert.throws(() => buildCodexTemplate({ realHome, templateDir: path.join(realHome, 'tpl') }), /inside the real home/);
  assert.throws(() => buildCodexTemplate({ realHome, templateDir: 'relative/tpl' }), /absolute/);
  const used = tmp('used');
  write(path.join(used, 'mine.txt'), 'keep\n');
  assert.throws(() => buildCodexTemplate({ realHome, templateDir: used }), /not empty/);
  assert.deepEqual(fs.readdirSync(used), ['mine.txt']);
});

test('an engram server written in a shape that cannot be pointed at the trial fails the build, and nothing is left behind', () => {
  for (const config of ['[mcp_servers.engram]\ncommand = "engram"\nenv = { ENGRAM_PORT = "7437" }\n', '[mcp_servers]\nengram = { command = "engram" }\n', 'mcp_servers.engram.command = "engram"\n']) {
    const realHome = makeRealHome({ config });
    const parent = tmp('template');
    assert.throws(() => buildCodexTemplate({ realHome, templateDir: path.join(parent, 'tpl') }), /engram/);
    assert.deepEqual(fs.readdirSync(parent), [], 'a failed build is rolled back');
  }
});

// ---- the desktop app's pieces ------------------------------------------------------------------------

test('the excluded set is the notify key, the node_repl server and the five plugins of the desktop app', () => {
  assert.deepEqual(DESKTOP_APP, { keys: ['notify'], servers: ['node_repl'], plugins: DESKTOP_PLUGINS });
});

test('the template\'s config.toml has no notify, no node_repl table or sub-table and none of the five plugin tables; everything else is byte for byte', () => {
  for (const eol of ['\n', '\r\n']) {
    const realHome = makeRealHome();
    const configFile = path.join(realHome, '.codex', 'config.toml');
    fs.writeFileSync(configFile, configToml(realHome, { eol }));
    const withDesktop = path.join(tmp('template'), 'tpl');
    buildCodexTemplate({ realHome, templateDir: withDesktop });
    const config = read(path.join(withDesktop, 'home'), '.codex/config.toml');
    for (const gone of ['notify', 'node_repl', 'SKY_CUA_NATIVE_PIPE', 'codex-computer-use.exe', ...DESKTOP_PLUGINS]) assert.ok(!config.includes(gone), `${gone} is still in config.toml`);
    for (const kept of ['[plugins."demo@bundled"]', '[plugins."code-review@openai-bundled"]', '[mcp_servers.tools]', '[mcp_servers.tools.env]', '[mcp_servers.engram]', '[hooks.state.']) {
      assert.ok(config.includes(kept), `${kept} was taken out`);
    }
    // The same home, with a config that never had those pieces: the two templates hold the same bytes.
    fs.writeFileSync(configFile, configToml(realHome, { desktop: false, eol }));
    const without = path.join(tmp('template'), 'tpl');
    buildCodexTemplate({ realHome, templateDir: without });
    assert.equal(config, read(path.join(without, 'home'), '.codex/config.toml'), `with ${JSON.stringify(eol)} line endings`);
  }
});

test('the five plugin directories are not in the copied cache, while a kept plugin of the same marketplace is', () => {
  const { templateDir, seed } = setup();
  const copied = (root) => filesOf(root).filter((rel) => rel.includes('.codex/plugins/cache/'));
  for (const root of [templateDir, seed()]) {
    const files = copied(root);
    for (const dir of DESKTOP_DIRS) assert.deepEqual(files.filter((rel) => rel.includes(`${dir}/`)), [], `${dir} was copied`);
    assert.equal(files.filter((rel) => rel.includes('.codex/plugins/cache/openai-bundled/code-review/')).length, 1);
    assert.ok(!fs.existsSync(path.join(root, root === templateDir ? 'home' : '', ...DESKTOP_DIRS[0].split('/'))), 'not even as an empty directory');
  }
});

test('withoutDesktopApp removes each table from its header to the next one, whatever the header\'s spelling, and nothing else', () => {
  const kept = ['model = "m"', '', '[tui]', 'notify = true', '', '[plugins."demo@bundled"]', 'enabled = true', '', '[mcp_servers.other]', 'command = "other"', ''];
  const toml = [
    'notify = [ "C:\\\\x\\\\codex-computer-use.exe", "turn-ended" ] # a comment', ...kept.slice(0, 5),
    '[ mcp_servers . "node_repl" ]', 'command = "x"', '# a comment inside', '', '[mcp_servers.node_repl.env]', 'A = "1"', '',
    ...kept.slice(5, 8),
    "[plugins.'chrome@openai-bundled']", 'enabled = true', '', '[plugins."browser@openai-bundled".settings]', 'x = 1', '',
    ...kept.slice(8),
  ];
  for (const eol of ['\n', '\r\n']) assert.equal(withoutDesktopApp(toml.join(eol)), kept.join(eol));
  for (const same of ['', 'model = "m"', kept.join('\n'), '[plugins]\n"demo@bundled" = { enabled = true }\n', '[projects."D:\\\\js-harness"]\ntrust_level = "trusted"\n']) assert.equal(withoutDesktopApp(same), same);
});

// The scan that both edits share is a safety filter, so it fails closed: a line it cannot read with certainty
// stops the build, with the line named, rather than being let through.

test('a value that does not end on its line is refused with its line number: the scan could not tell where a table ends', () => {
  // The finding this pins: a continuation line that starts with `[` was read as a header, which ended the
  // desktop table early and wrote the rest of it back; and hid an inline engram env from the other edit.
  const desktop = '[mcp_servers.node_repl]\nargs = [\n  ["a", "b"],\n]\ncommand = "x"\n\n[kept]\na = 1\n';
  assert.throws(() => withoutDesktopApp(desktop), /config\.toml line 2 /);
  const engram = '[mcp_servers.engram]\ncommand = "engram"\nargs = [\n  ["mcp"],\n]\nenv = { ENGRAM_PORT = "7437" }\n';
  assert.throws(() => withEngramEnv(engram, ENV), /config\.toml line 3 /);
  for (const edit of [withoutDesktopApp, (toml) => withEngramEnv(toml, ENV)]) {
    for (const [toml, line] of [
      ['[other]\nx = [\n  1,\n]\n', 2],
      ['notify = [\n  "x.exe",\n  "turn-ended",\n]\n', 1],
      ['a = 1\nnotify = """\nx"""\n', 2],
      ["a = 1\nb = 2\nc = '''\nx'''\n", 3],
      ['["a", "b"],\n', 1],
      ['[table] trailing\n', 1],
      ['[table\n', 1],
      ['x = "unterminated\n', 1],
      ["x = 'unterminated\n", 1],
      ['x =\n', 1],
      ['x = { a = 1\n', 1],
      ['just some words\n', 1],
      ['[mcp_servers.engram.env]\nENGRAM_URL = """\nhttp://127.0.0.1:7437\n"""\n', 2],
    ]) assert.throws(() => edit(toml), new RegExp(`config\\.toml line ${line} `), toml);
  }
});

test('a value that does end on its line is read, whatever brackets and quotes its strings and its comment hold', () => {
  const toml = ['x = [ "a]", \'b[\', ["c"] ] # d [', 'y = { a = "}", b = \'{\' } # it\'s', 'z = "it\'s \\" [" # "', '  # a comment [', '', '[ table . "a b" ] # c', '[[array]]', 'k = 1', ''].join('\n');
  assert.equal(withoutDesktopApp(toml), toml);
  assert.equal(withEngramEnv(toml, ENV), toml);
});

test('a quoted key is read as TOML reads it: an escape cannot hide a desktop piece or the engram server', () => {
  const kept = '[kept."a\\\\b"]\na = 1\n';
  for (const hidden of [
    '[mcp_servers."node\\u005frepl"]\ncommand = "x"\n\n',
    '[plugins."brows\\u0065r@openai-bundled"]\nenabled = true\n\n',
    '["mcp\\U0000005Fservers".node_repl.env]\nA = "1"\n\n',
    '"not\\u0069fy" = [ "x.exe" ]\n',
  ]) assert.equal(withoutDesktopApp(hidden + kept), kept, hidden);
  assert.throws(() => withoutDesktopApp('[mcp_servers]\n"node\\u005frepl" = { command = "x" }\n'), /cannot take out/);
  // An escape TOML does not define: the key cannot be read, so the line is refused.
  assert.throws(() => withoutDesktopApp('a = 1\n[plugins."x\\q"]\n'), /config\.toml line 2 /);

  const appended = ['', '[mcp_servers.engram.env]', ...OURS, ''].join('\n');
  assert.equal(withEngramEnv('[mcp_servers."eng\\u0072am"]\ncommand = "engram"\n', ENV), `[mcp_servers."eng\\u0072am"]\ncommand = "engram"\n${appended}`);
  const env = '[mcp_servers.engram]\ncommand = "engram"\n\n[mcp_servers.engram."en\\u0076"]\n"ENGRAM\\u005fURL" = "http://127.0.0.1:7437"\nKEEP = "yes"\n';
  assert.equal(withEngramEnv(env, ENV), ['[mcp_servers.engram]', 'command = "engram"', '', '[mcp_servers.engram."en\\u0076"]', ...OURS, 'KEEP = "yes"', ''].join('\n'));
  assert.throws(() => withEngramEnv('[mcp_servers]\n"eng\\u0072am" = { command = "engram" }\n', ENV), /cannot point at a trial/);
});

test('an inline table that could hold a piece is refused whatever it holds: its keys are not read', () => {
  for (const toml of ['plugins = { "demo@bundled" = { enabled = true } }\n', 'mcp_servers = { other = { command = "x" } }\n', 'mcp_servers = { "node\\u005frepl" = { command = "x" } }\n']) {
    assert.throws(() => withoutDesktopApp(toml), /cannot take out/, toml);
  }
  for (const toml of ['mcp_servers = { other = { command = "x" } }\n', 'mcp_servers = { "eng\\u0072am" = { command = "engram" } }\n', '[[mcp_servers.engram]]\ncommand = "engram"\n']) {
    assert.throws(() => withEngramEnv(toml, ENV), /cannot point at a trial/, toml);
  }
});

test('a config with a line the scan cannot read fails the build with the line named, and nothing is left behind', () => {
  const config = '[mcp_servers.engram]\ncommand = "engram"\n\n[mcp_servers.engram.env]\nENGRAM_URL = """\nhttp://127.0.0.1:7437\n"""\n';
  const realHome = makeRealHome({ config });
  const parent = tmp('template');
  assert.throws(() => buildCodexTemplate({ realHome, templateDir: path.join(parent, 'tpl') }), /config\.toml line 5 /);
  assert.deepEqual(fs.readdirSync(parent), [], 'a failed build is rolled back');
});

test('withoutDesktopApp refuses every spelling it cannot take out whole, rather than leave a piece in', () => {
  for (const toml of [
    'mcp_servers.node_repl.command = "x"\n',
    '[mcp_servers]\nnode_repl = { command = "x" }\n',
    '[mcp_servers]\nnode_repl.command = "x"\n',
    'mcp_servers = { node_repl = { command = "x" } }\n',
    '[[mcp_servers.node_repl]]\ncommand = "x"\n',
    'plugins = { "browser@openai-bundled" = { enabled = true } }\n',
    '[plugins]\n"chrome@openai-bundled" = { enabled = true }\n',
    '[plugins]\n"chrome@openai-bundled".enabled = true\n',
    'plugins."computer-use@openai-bundled".enabled = true\n',
    '# see node_repl below\nmodel = "m"\n',
  ]) assert.throws(() => withoutDesktopApp(toml), /cannot take out/, toml);
});

test('a config whose desktop pieces cannot be taken out fails the build, and nothing is left behind', () => {
  const realHome = makeRealHome({ config: '[mcp_servers]\nnode_repl = { command = "x" }\n' });
  const parent = tmp('template');
  assert.throws(() => buildCodexTemplate({ realHome, templateDir: path.join(parent, 'tpl') }), /node_repl.*cannot take out/);
  assert.deepEqual(fs.readdirSync(parent), [], 'a failed build is rolled back');
});

test('a Codex template and a Claude template are different kinds: neither is seeded from, or removed as, the other', () => {
  const { templateDir } = setup();
  assert.throws(() => seedHome(templateDir, path.join(tmp('trial'), 'home'), { engramPort: PORT }), /not a js-harness eval home template/);
  assert.throws(() => removeTemplate(templateDir), /not a js-harness eval home template/);
  const claudeHome = path.join(tmp('real'), 'person');
  write(path.join(claudeHome, '.claude', 'settings.json'), '{}\n');
  const claudeTemplate = path.join(tmp('template'), 'tpl');
  buildTemplate({ realHome: claudeHome, templateDir: claudeTemplate });
  assert.throws(() => seedCodexHome(claudeTemplate, path.join(tmp('trial'), 'home'), { engramPort: PORT }), /not a js-harness eval Codex home template/);
  assert.throws(() => removeCodexTemplate(claudeTemplate), /not a js-harness eval Codex home template/);
  assert.ok(fs.existsSync(claudeTemplate) && fs.existsSync(templateDir));
  removeCodexTemplate(templateDir);
  assert.ok(!fs.existsSync(templateDir));
  removeCodexTemplate(templateDir);
});

// ---- seedCodexHome -----------------------------------------------------------------------------------

test('seedCodexHome copies the template and writes every placeholder as the trial\'s own .codex, in the spelling the value had', () => {
  const { realHome, seed } = setup();
  const home = seed();
  const codex = path.join(home, '.codex');
  assert.deepEqual(filesOf(home), [...COPIED].sort(), 'the copy list, and no login: that is a separate step');
  for (const rel of COPIED.filter((file) => !REWRITTEN.includes(file))) assert.equal(read(home, rel), read(realHome, rel), rel);

  const config = read(home, '.codex/config.toml');
  for (const rel of REWRITTEN) {
    assert.ok(!read(home, rel).includes('@@TRIAL_CODEX_HOME'), `${rel} still holds a placeholder`);
    assert.equal(mentions(read(home, rel), path.join(realHome, '.codex')), 0, `${rel} names the real .codex`);
  }
  const lines = config.split('\n');
  const line = (start) => lines.find((candidate) => candidate.startsWith(start));
  assert.equal(line('model_instructions_file'), `model_instructions_file = "${escaped(path.join(codex, 'engram-instructions.md'))}"`);
  assert.equal(line('source ='), `source = '\\\\?\\${path.join(codex, '.tmp', 'bundled-marketplaces', 'bundled')}'`);
  assert.equal(line('CODEX_HOME'), `CODEX_HOME = '${codex}'`);
  assert.equal(line('TRUSTED_SERVICES'), `TRUSTED_SERVICES = '{"browser":"${slashed(path.join(codex, 'plugins', 'cache', 'bundled', 'demo', '1.0.0', 'service.mjs'))}"}'`);
  assert.equal(line('TRUSTED_PATHS'), `TRUSTED_PATHS = '${codex};${path.join(realHome, 'AppData', 'Local', 'OpenAI', 'modules')}'`, 'the first path moves, the program beside it stays');
  assert.equal(line('[hooks.state'), `[hooks.state.'${path.join(codex, 'hooks.json')}:session_start:0:0']`, 'the key a hook\'s trust is stored under follows the file');
  assert.equal(line('command = \''), `command = '${path.join(realHome, 'AppData', 'Local', 'OpenAI', 'tools.exe')}'`);
  assert.equal(line('Authorization'), `Authorization = "Bearer ${HEADER}"`, 'what is not a path is not touched');

  const hooks = JSON.parse(read(home, '.codex/hooks.json'));
  assert.equal(hooks.hooks.SessionStart[0].hooks[0].command, `powershell -File "${path.join(codex, 'herdr-agent-state.ps1')}" session`);
  assert.ok(fs.existsSync(path.join(codex, 'herdr-agent-state.ps1')), 'and the script it runs is there');
  // A plugin's MCP server would otherwise be handed the real CODEX_HOME, and write there.
  const { demo } = JSON.parse(read(home, PLUGIN_MCP)).mcpServers;
  assert.deepEqual(demo, { command: path.join(realHome, 'AppData', 'Local', 'OpenAI', 'tools.exe'), env: { CODEX_HOME: codex } });
});

test('seedCodexHome points the engram server of config.toml at the trial\'s own store and port', () => {
  const { seed } = setup();
  const home = seed(45678);
  const config = read(home, '.codex/config.toml');
  const tail = ['', '[mcp_servers.engram]', 'command = "engram"', 'args = ["mcp", "--tools=agent"]', '', '[mcp_servers.engram.env]', `ENGRAM_DATA_DIR = "${escaped(path.join(home, '.engram'))}"`, 'ENGRAM_PORT = "45678"', ''];
  assert.ok(config.endsWith(tail.join('\n')), config);
  assert.ok(!config.includes('7437'));
});

test('seedCodexHome needs the trial\'s engram port and refuses the real one before anything is copied', () => {
  const { templateDir } = setup();
  for (const [engramPort, pattern] of [[undefined, /engram port/], [7437, /7437/], ['41234', /engram port/]]) {
    const home = path.join(tmp('trial'), 'home');
    assert.throws(() => seedCodexHome(templateDir, home, { engramPort }), pattern);
    assert.ok(!fs.existsSync(home));
  }
  assert.throws(() => seedCodexHome(templateDir, 'relative/home', { engramPort: PORT }), /absolute/);
  assert.throws(() => seedCodexHome(templateDir, path.join(tmp('trial'), "it's"), { engramPort: PORT }), /quote/);
});

test('two trials seeded from one template share nothing, and seeding changes neither the template nor the real home', () => {
  const { realHome, templateDir, seed } = setup();
  const before = { real: hashTree(realHome), template: hashTree(templateDir) };
  const first = seed(41001);
  const second = seed(41002);
  fs.writeFileSync(path.join(first, '.codex', 'plugins', 'cache', 'bundled', 'demo', '1.0.0', 'service.mjs'), 'changed by the first trial\n');
  assert.equal(read(second, '.codex/plugins/cache/bundled/demo/1.0.0/service.mjs'), 'export {};\n', 'a copy, not a link to a shared one');
  assert.ok(read(first, '.codex/config.toml').includes('ENGRAM_PORT = "41001"') && read(second, '.codex/config.toml').includes('ENGRAM_PORT = "41002"'));
  assert.equal(mentions(read(second, '.codex/config.toml'), first), 0);
  assert.deepEqual(hashTree(templateDir), before.template);
  assert.deepEqual(hashTree(realHome), before.real);
});

test('seedFromCodexTemplate seeds the home, then initializes the workspace under the trial\'s own CODEX_HOME', async () => {
  const { templateDir } = setup();
  assert.throws(() => seedFromCodexTemplate(tmp('not-a-template')), /not a js-harness eval Codex home template/);
  const calls = [];
  const seed = seedFromCodexTemplate(templateDir, { runInit: (call) => (calls.push(call), { status: 0, stdout: '', stderr: '' }) });
  const home = path.join(tmp('trial'), 'home');
  const workspace = tmp('workspace');
  const saved = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  process.env.CLAUDE_CODE_OAUTH_TOKEN = 'sekrit-claude-token-0123456789';
  try {
    await seed({ home, workspace, engramPort: PORT });
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    else process.env.CLAUDE_CODE_OAUTH_TOKEN = saved;
  }
  assert.equal(calls.length, 1);
  assert.equal(calls[0].workspace, workspace);
  assert.equal(calls[0].env.CODEX_HOME, path.join(home, '.codex'));
  assert.equal(calls[0].env.HOME, home);
  assert.ok(!('CLAUDE_CODE_OAUTH_TOKEN' in calls[0].env), 'the other host\'s credential is not handed to a Codex trial\'s init');
  assert.ok(fs.existsSync(path.join(home, '.codex', 'config.toml')), 'the home was seeded before init ran');
});

test('a Codex seed without components takes them out of the trial\'s home, and without project skips init (G2, C3a)', async () => {
  const { templateDir } = setup();
  assert.throws(() => seedFromCodexTemplate(templateDir, { without: ['agents'] }), /agents is not a component/);
  const calls = [];
  const runInit = (call) => (calls.push(call), { status: 0, stdout: '', stderr: '' });
  const home = path.join(tmp('trial'), 'home');
  await seedFromCodexTemplate(templateDir, { runInit, without: ['agents-md', 'project'] })({ home, workspace: tmp('workspace'), engramPort: PORT });
  assert.equal(fs.existsSync(path.join(home, '.codex', 'AGENTS.md')), false);
  assert.ok(fs.existsSync(path.join(home, '.codex', 'config.toml')), 'the rest of the home is seeded, its engram server set');
  assert.match(fs.readFileSync(path.join(home, '.codex', 'config.toml'), 'utf8'), new RegExp(`ENGRAM_PORT = "${PORT}"`));
  assert.equal(calls.length, 0, 'an arm without project does not run js-harness init');
});

// ---- withEngramEnv -----------------------------------------------------------------------------------

const ENV = { dataDir: path.join(scratch, 'trial home', '.engram'), port: 45678 };
const OURS = [`ENGRAM_DATA_DIR = "${escaped(ENV.dataDir)}"`, 'ENGRAM_PORT = "45678"'];

test('withEngramEnv leaves a config with no engram server alone', () => {
  for (const toml of ['', 'model = "m"\n', '[mcp_servers.other]\ncommand = "engram-like"\n\n[mcp_servers.other.env]\nENGRAM_PORT = "7437"\n', '[plugins."engram@engram"]\nenabled = true\n']) {
    assert.equal(withEngramEnv(toml, ENV), toml);
  }
});

test('withEngramEnv rewrites an existing env table: its own keys replaced, a URL or socket dropped, the rest kept', () => {
  const toml = [
    '[mcp_servers.engram]', 'command = "engram"', '', '[mcp_servers."engram".env] # the real one', 'ENGRAM_URL = "http://127.0.0.1:7437"', 'KEEP = "yes"', 'ENGRAM_SOCKET = "x"',
    ' ENGRAM_PORT="7437"', 'ENGRAM_DATA_DIR = "/real"', '', '[other]', 'ENGRAM_PORT = "7437"', '',
  ].join('\n');
  const expected = ['[mcp_servers.engram]', 'command = "engram"', '', '[mcp_servers."engram".env] # the real one', ...OURS, 'KEEP = "yes"', '', '[other]', 'ENGRAM_PORT = "7437"', ''];
  assert.equal(withEngramEnv(toml, ENV), expected.join('\n'));
});

test('withEngramEnv keeps the line endings of the file and appends one table, whatever the file ends with', () => {
  const appended = ['', '[mcp_servers.engram.env]', ...OURS, ''];
  assert.equal(withEngramEnv('[mcp_servers.engram]\r\ncommand = "engram"\r\n', ENV), ['[mcp_servers.engram]', 'command = "engram"', ...appended].join('\r\n'));
  assert.equal(withEngramEnv('[mcp_servers.engram]\ncommand = "engram"\n\n\n', ENV), ['[mcp_servers.engram]', 'command = "engram"', ...appended].join('\n'));
  assert.equal(withEngramEnv('[ mcp_servers . engram ]\ncommand = "engram"', ENV), ['[ mcp_servers . engram ]', 'command = "engram"', ...appended].join('\n'));
});

test('withEngramEnv refuses the real engram port, and every shape of server it cannot rewrite', () => {
  assert.throws(() => withEngramEnv('[mcp_servers.engram]\n', { dataDir: ENV.dataDir, port: 7437 }), /7437/);
  for (const toml of [
    '[mcp_servers.engram]\nenv = { ENGRAM_PORT = "7437" }\n',
    '[mcp_servers.engram]\nenv.ENGRAM_PORT = "7437"\n',
    '[mcp_servers]\nengram = { command = "engram" }\n',
    '[mcp_servers]\nengram.command = "engram"\n',
    'mcp_servers.engram.command = "engram"\n',
    'mcp_servers = { engram = { command = "engram" } }\n',
    '[mcp_servers]\n"engram".env.ENGRAM_PORT = "7437"\n',
  ]) assert.throws(() => withEngramEnv(toml, ENV), /cannot point at a trial/, toml);
});

// ---- the login ---------------------------------------------------------------------------------------

test('copyLogin puts a byte-identical copy of the login in the trial\'s CODEX_HOME and leaves the real one untouched', () => {
  const realHome = makeRealHome();
  const authFile = path.join(realHome, '.codex', 'auth.json');
  const bytes = Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x22, 0x00, 0xff, 0x0d, 0x0a, 0x7d]);
  fs.writeFileSync(authFile, bytes);
  const before = hashTree(realHome);
  const home = path.join(tmp('trial'), 'home');
  const target = copyLogin({ authFile, home });
  assert.equal(target, path.join(codexHomeOf(home), 'auth.json'));
  assert.deepEqual(fs.readFileSync(target), bytes, 'bytes, not text: nothing is decoded on the way');
  assert.deepEqual(hashTree(realHome), before);
  removeLogin({ authFile, home });
  assert.ok(!fs.existsSync(target));
  removeLogin({ authFile, home });
  assert.deepEqual(hashTree(realHome), before, 'removing the copy never removes the real one');
});

test('a missing login is an error that names `codex login`, and nothing is created for it', () => {
  const realHome = makeRealHome();
  const authFile = path.join(realHome, '.codex', 'auth.json');
  fs.rmSync(authFile);
  const home = path.join(tmp('trial'), 'home');
  assert.throws(() => copyLogin({ authFile, home }), /no Codex login at .*run `codex login`/);
  assert.throws(() => assertLogin(authFile), /codex login/);
  assert.ok(!fs.existsSync(home));
  assert.throws(() => assertLogin(path.join(realHome, '.codex')), /codex login/, 'a directory is not a login');
  assert.throws(() => assertLogin('auth.json'), /absolute/);
});

test('the real home is never taken for a trial home: its login is neither overwritten nor removed', () => {
  const realHome = makeRealHome();
  const authFile = path.join(realHome, '.codex', 'auth.json');
  assert.throws(() => copyLogin({ authFile, home: realHome }), /never runs on the real one/);
  assert.throws(() => removeLogin({ authFile, home: realHome }), /never runs on the real one/);
  assert.equal(fs.readFileSync(authFile, 'utf8'), LOGIN);
});

// ---- the hours a login has left ----------------------------------------------------------------------

const HOUR = 3_600_000;
// A clock on the second: a JWT counts whole seconds, so every "hours left" below is exact.
const NOW = Date.UTC(2026, 9, 5, 12);
// Made up for these tests, and never to be seen again: in a message, in what is returned, anywhere.
const SIGNATURE = 'SENTINEL-ACCESS-TOKEN-SIGNATURE';
const CLAIM = 'SENTINEL-OTHER-CLAIM';
const REFRESH = 'SENTINEL-REFRESH-TOKEN';
const base64url = (text) => Buffer.from(text).toString('base64url');
const JWT_HEADER = base64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
/** A made-up access token in the shape of a JWT, `header.payload.signature`, whose payload is the JSON text
 * `payload` (a string, so that a payload no `JSON.stringify` would write can be spelled too). */
const fakeJwt = (payload) => `${JWT_HEADER}.${base64url(payload)}.${SIGNATURE}`;
/** The JSON text of the payload of a token that expires `hoursLeft` after `NOW`, among other claims. */
const claimsExpiringIn = (hoursLeft) => JSON.stringify({ sub: CLAIM, iat: 1, exp: (NOW + hoursLeft * HOUR) / 1000 });
/** The text of a login file that holds `accessToken`, beside the tokens a real one holds. */
const loginHolding = (accessToken) => `${JSON.stringify({ auth_mode: 'chatgpt', tokens: { id_token: 'SENTINEL-DUMMY-LOGIN', access_token: accessToken, refresh_token: REFRESH } })}\n`;
/** A fake home whose login file is `content`, last written `ageHours` before `NOW`; returns the file. */
function loginFile(content, { ageHours = 1 } = {}) {
  const authFile = path.join(makeRealHome(), '.codex', 'auth.json');
  fs.writeFileSync(authFile, content);
  const written = new Date(NOW - ageHours * HOUR);
  fs.utimesSync(authFile, written, written);
  return authFile;
}
/** A fake home whose login's access token expires `hoursLeft` after `NOW`. */
const loginExpiringIn = (hoursLeft, options) => loginFile(loginHolding(fakeJwt(claimsExpiringIn(hoursLeft))), options);

// Every login whose expiry cannot be read: what the file holds, and what the refusal says of it.
const UNREADABLE_LOGINS = [
  ['not JSON', `not json at all ${SIGNATURE}`, /is not JSON/],
  ['JSON that is no object', JSON.stringify(SIGNATURE), /holds no access token/],
  ['null', 'null', /holds no access token/],
  ['an API key and no tokens', JSON.stringify({ auth_mode: 'apikey', OPENAI_API_KEY: SIGNATURE }), /holds no access token/],
  ['tokens with no access token', JSON.stringify({ tokens: { id_token: 'SENTINEL-DUMMY-LOGIN', refresh_token: REFRESH } }), /holds no access token/],
  ['an access token that is not text', JSON.stringify({ tokens: { access_token: { exp: 9_999_999_999, sub: CLAIM } } }), /holds no access token/],
  ['an empty access token', loginHolding(''), /holds no access token/],
  ['a token of two parts', loginHolding(`${base64url(claimsExpiringIn(48))}.${SIGNATURE}`), /is not a JWT/],
  ['a token of four parts', loginHolding(`${fakeJwt(claimsExpiringIn(48))}.${SIGNATURE}`), /is not a JWT/],
  ['a payload that is not base64url JSON', loginHolding(`${JWT_HEADER}.${SIGNATURE}.${SIGNATURE}`), /payload is not a JSON object/],
  ['an empty payload', loginHolding(`${JWT_HEADER}..${SIGNATURE}`), /payload is not a JSON object/],
  ['a payload that is a list', loginHolding(fakeJwt(JSON.stringify([CLAIM]))), /payload is not a JSON object/],
  ['a payload that is text', loginHolding(fakeJwt(JSON.stringify(CLAIM))), /payload is not a JSON object/],
  ['a payload that is null', loginHolding(fakeJwt('null')), /payload is not a JSON object/],
  ['no exp', loginHolding(fakeJwt(JSON.stringify({ sub: CLAIM }))), /expiry \(`exp`\) is not a date/],
  ['an exp that is text', loginHolding(fakeJwt(JSON.stringify({ sub: CLAIM, exp: '9999999999' }))), /expiry \(`exp`\) is not a date/],
  ['an exp of zero', loginHolding(fakeJwt('{"exp":0}')), /expiry \(`exp`\) is not a date/],
  ['a negative exp', loginHolding(fakeJwt('{"exp":-1790000000}')), /expiry \(`exp`\) is not a date/],
  ['an exp no number holds', loginHolding(fakeJwt('{"exp":1e999}')), /expiry \(`exp`\) is not a date/],
  ['an exp past the last date', loginHolding(fakeJwt('{"exp":9e15}')), /expiry \(`exp`\) is not a date/],
];

/** Everything of the login file text `content` that must never be repeated: each string it holds as JSON, and
 * each dot-separated part of one (the three parts of a token), or the whole text when it is not JSON. Eight
 * characters and up, so that a word like `chatgpt` is not taken for a secret. */
function secretsOf(content) {
  const found = [SIGNATURE, CLAIM, REFRESH, 'SENTINEL-DUMMY-LOGIN'];
  const walk = (value) => {
    if (typeof value === 'string') found.push(value, ...value.split('.'));
    else if (value !== null && typeof value === 'object') Object.values(value).forEach(walk);
  };
  try {
    walk(JSON.parse(content));
  } catch {
    found.push(content);
  }
  return [...new Set(found)].filter((text) => text.length >= 8);
}
const assertNoSecret = (text, content, label) => {
  for (const secret of secretsOf(content)) assert.ok(!text.includes(secret), `${label}: it repeats ${secret.length} characters of the login`);
};

test('the least a login must have left is twelve hours', () => {
  assert.equal(DEFAULT_MIN_LOGIN_HOURS_LEFT, 12);
});

test('assertLoginFresh passes a login whose access token has the hours left, whatever the date of the file, and returns the expiry, the hours left and the age', () => {
  // What was observed on 2026-10-05: a file last written 192 hours before, whose token had two days left.
  const authFile = loginExpiringIn(48, { ageHours: 192 });
  const content = fs.readFileSync(authFile, 'utf8');
  const result = assertLoginFresh(authFile, { now: NOW });
  assert.deepEqual(Object.keys(result).sort(), ['ageHours', 'expiresAt', 'hoursLeft']);
  assert.equal(result.hoursLeft, 48);
  assert.equal(result.expiresAt, '2026-10-07T12:00:00.000Z');
  assert.ok(Math.abs(result.ageHours - 192) < 0.01, `${result.ageHours}`);
  assert.equal(fs.readFileSync(authFile, 'utf8'), content, 'the file is only read');
  assert.equal(fs.statSync(authFile).mtimeMs, NOW - 192 * HOUR, 'and keeps its date');
  assert.doesNotThrow(() => assertLoginFresh(loginExpiringIn(12), { now: NOW }), 'at least the minimum: exactly twelve hours is enough');
  // The date of the file decides nothing: one dated ahead of the clock is a login like any other, of age zero.
  const ahead = assertLoginFresh(loginExpiringIn(240, { ageHours: -2 }), { now: NOW });
  assert.deepEqual(ahead, { hoursLeft: 240, expiresAt: '2026-10-15T12:00:00.000Z', ageHours: 0 });
});

test('a login with under the hours left, or one that expired, is refused with when it expires, what is left, the minimum and what to do', () => {
  const authFile = loginExpiringIn(8);
  assert.throws(() => assertLoginFresh(authFile, { now: NOW }), (err) => {
    assert.ok(err.message.includes(authFile), 'which file');
    assert.match(err.message, /expires at 2026-10-05T20:00:00\.000Z, in 8\.0 hours/, 'when, and how long that is');
    assert.match(err.message, /at least 12 hours left/, 'the minimum');
    assert.match(err.message, /copy may leave the real login invalid/, 'why');
    assert.match(err.message, /Run `codex logout`, then `codex login`, then run again/);
    return true;
  });
  assert.doesNotThrow(() => assertLoginFresh(authFile, { now: NOW, minHoursLeft: 8 }), 'the minimum is the caller\'s to move');
  assert.throws(() => assertLoginFresh(authFile, { now: NOW, minHoursLeft: 24 }), /in 8\.0 hours.*at least 24 hours left/);
  // What is left is never rounded up to the minimum it is under.
  assert.throws(() => assertLoginFresh(loginExpiringIn(12), { now: NOW + 60_000 }), /in 11\.9 hours.*at least 12 hours left/);
  assert.throws(() => assertLoginFresh(loginExpiringIn(-3), { now: NOW }), (err) => {
    assert.match(err.message, /expired at 2026-10-05T09:00:00\.000Z, 3\.0 hours ago/);
    assert.match(err.message, /at least 12 hours left/);
    assert.match(err.message, /Run `codex logout`, then `codex login`, then run again/);
    return true;
  });
  assert.throws(() => assertLoginFresh(loginExpiringIn(0), { now: NOW, minHoursLeft: 0.001 }), /expired at 2026-10-05T12:00:00\.000Z, 0\.0 hours ago/, 'a token that expires this instant has expired');
});

test('a login whose expiry cannot be read is refused, whatever its date, and told to log in again', () => {
  for (const [label, content, pattern] of UNREADABLE_LOGINS) {
    const authFile = loginFile(content);
    assert.throws(() => assertLoginFresh(authFile, { now: NOW }), (err) => {
      assert.ok(err.message.includes(authFile), `${label}: which file`);
      assert.match(err.message, pattern, label);
      assert.match(err.message, /cannot be told.*run `codex logout`, then `codex login`, then run again/, `${label}: what to do`);
      return true;
    }, label);
    assert.equal(fs.readFileSync(authFile, 'utf8'), content, `${label}: the file is only read`);
  }
});

test('nothing of a login is repeated but its dates: no refusal and no result holds a token, a part of one, another claim or the text of the file', () => {
  const refused = (label, content, options) => {
    const authFile = loginFile(content);
    let message = null;
    try {
      assertLoginFresh(authFile, { now: NOW, ...options });
    } catch (err) {
      message = `${err.message}\n${err.stack}\n${JSON.stringify(err, Object.getOwnPropertyNames(err))}`;
    }
    assert.notEqual(message, null, `${label}: it was not refused`);
    assertNoSecret(message, content, label);
  };
  for (const [label, content] of UNREADABLE_LOGINS) refused(label, content);
  refused('too few hours left', loginHolding(fakeJwt(claimsExpiringIn(8))));
  refused('expired', loginHolding(fakeJwt(claimsExpiringIn(-3))));
  refused('a minimum that is no number', loginHolding(fakeJwt(claimsExpiringIn(48))), { minHoursLeft: 'twelve' });
  refused('a clock that is no time', loginHolding(fakeJwt(claimsExpiringIn(48))), { now: Number.NaN });
  // The helper does find what is there, or the loop above would prove nothing.
  const content = loginHolding(fakeJwt(claimsExpiringIn(48)));
  const [, payload] = JSON.parse(content).tokens.access_token.split('.');
  assert.ok(secretsOf(content).includes(payload) && secretsOf(content).includes(JSON.parse(content).tokens.access_token));
  assert.throws(() => assertNoSecret(`found ${payload} here`, content, 'a leak'), /it repeats \d+ characters of the login/);
  assertNoSecret(JSON.stringify(assertLoginFresh(loginFile(content), { now: NOW })), content, 'what is returned');
});

test('assertLoginFresh needs a login that is there, a minimum that is a positive number and a clock that is a time', () => {
  const authFile = loginExpiringIn(48);
  for (const [bad, shown] of [[0, '0'], [-1, '-1'], [Number.NaN, 'NaN'], [Number.POSITIVE_INFINITY, 'Infinity'], ['12', '"12"'], [null, 'null']]) {
    assert.throws(() => assertLoginFresh(authFile, { now: NOW, minHoursLeft: bad }), (err) => err.message === `the hours a Codex login must have left must be a positive number, got ${shown}`, shown);
  }
  // A clock that is not a finite number is refused: every comparison with the NaN it makes is false.
  for (const [bad, shown] of [[Number.NaN, 'NaN'], [Number.POSITIVE_INFINITY, 'Infinity'], [Number.NEGATIVE_INFINITY, '-Infinity'], [String(NOW), `"${NOW}"`], [null, 'null']]) {
    assert.throws(() => assertLoginFresh(authFile, { now: bad }), (err) => err.message === `the time the hours a Codex login has left are measured from must be a finite number of milliseconds, got ${shown}`, shown);
  }
  fs.rmSync(authFile);
  assert.throws(() => assertLoginFresh(authFile), /no Codex login at .*run `codex login`/);
});

// ---- the fingerprint of the setup (G6 of odd/tasks/future-model-protocol.md) ---------------------------

test('the fingerprint of a Codex template leaves out the projects and notices of config.toml, and moves with the rest of it', () => {
  const fingerprintOf = (config) => buildCodexTemplate({ realHome: makeRealHome({ config }), templateDir: path.join(tmp('template'), 'tpl') }).fingerprint;
  const home = path.join(tmp('real'), 'Person');
  const base = configToml(home);
  const first = fingerprintOf(base);
  assert.match(first.sha256, /^[0-9a-f]{64}$/);
  assert.ok(Object.keys(first.items).includes('.codex/config.toml'));
  const busy = fingerprintOf(`${base}\n[projects.'D:/work/repo']\ntrust_level = "trusted"\n\n[notice]\nhide_full_access_warning = true\n\n[notice.model_migrations]\n"a" = "b"\n`);
  assert.equal(busy.items['.codex/config.toml'], first.items['.codex/config.toml'], 'projects and notices are not the setup');
  const changed = fingerprintOf(`${base}\nmodel_verbosity = "high"\n`);
  assert.notEqual(changed.items['.codex/config.toml'], first.items['.codex/config.toml']);
  assert.notEqual(changed.sha256, first.sha256);
});
