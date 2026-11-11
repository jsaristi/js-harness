// The administrator install of the status line and its undo (`status-line-install.ps1`, `status-line-uninstall.ps1`):
// what can be held without writing to Program Files, the registry or Task Scheduler. Both ran end to end in scratch
// places (odd/tasks/status-line.md, L12); a test that registered a real task on every run would leave the machine
// changed when it failed halfway.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const INSTALL = path.join(import.meta.dirname, 'status-line-install.ps1');
const UNINSTALL = path.join(import.meta.dirname, 'status-line-uninstall.ps1');
const SCRIPTS = [INSTALL, UNINSTALL, path.join(import.meta.dirname, 'status-line.ps1')];
const textOf = (file) => fs.readFileSync(file, 'utf8');
const defaults = (file) => Object.fromEntries([...textOf(file).matchAll(/^\s*\[string\]\$(\w+) = (.+?),?$/gm)].map((match) => [match[1], match[2]]));

test('the scripts are ASCII, since Windows PowerShell 5.1 reads a script with no BOM as ANSI', () => {
  for (const file of SCRIPTS) assert.doesNotMatch(textOf(file), /[^\x00-\x7f]/, path.basename(file));
});

test('the undo removes what the install writes: the same folder, policy key, value name, task and home', () => {
  const install = defaults(INSTALL);
  const undo = defaults(UNINSTALL);
  for (const name of ['Folder', 'Policy', 'Task', 'LineHome']) assert.equal(undo[name], install[name], name);
  assert.match(install.Policy, /HKCU:\\SOFTWARE\\Policies\\Claude/);
  for (const file of [INSTALL, UNINSTALL]) {
    assert.match(textOf(file), /-Name sessionStatusLine\b/, path.basename(file));
    assert.match(textOf(file), /^\$ErrorActionPreference = 'Stop'$/m, `${path.basename(file)} stops at the first error`);
  }
});

// The audit's M35: the undo removed `sessionStatusLine` whatever it held, while the install refuses to write over a
// value that is not its own. Both now build the value the same way and compare what the key holds with it.
test('the undo removes the policy value only when it holds what the install writes, and says when it leaves another', () => {
  const valueOf = (file) => textOf(file).match(/^\$value = (.+)$/m)?.[1];
  const installedOf = (file) => textOf(file).match(/^\$installed = (.+)$/m)?.[1];
  assert.equal(valueOf(INSTALL), '@{ command = $installed } | ConvertTo-Json -Compress');
  assert.equal(valueOf(UNINSTALL), valueOf(INSTALL), 'the same value');
  assert.equal(installedOf(UNINSTALL), installedOf(INSTALL), 'of the same program');
  const undo = textOf(UNINSTALL);
  const removal = undo.split(/\r?\n/).findIndex((line) => line.includes('Remove-ItemProperty'));
  const guard = undo.split(/\r?\n/).slice(0, removal).reverse().find((line) => /^\s*(if|elseif)\b/.test(line));
  // One string, compared as the install compares it: a value of several strings that holds it among others is not
  // it, and `-eq` on a list would have said yes (the independent verifier on 62bb01f..db26cbd).
  assert.match(guard, /\(\$found -is \[string\]\) -and \(\$found -eq \$value\)/, 'the removal is under the comparison');
  assert.match(undo, /"policy value kept: \$Policy sessionStatusLine = \$found, which the install did not write"/);
});

test('the install runs the writer through the stable shim, unelevated, and registers again over its own task', () => {
  const install = textOf(INSTALL);
  assert.match(defaults(INSTALL).Shim, /pnpm\\bin\\js-harness\.cmd/, 'not the version folder import.meta.dirname resolves to');
  assert.match(install, /New-ScheduledTaskPrincipal .*-RunLevel Limited/);
  assert.match(install, /Register-ScheduledTask .*-Force/);
});

test('the install leaves its undo beside the program, and the undo removes it, so it outlives an uninstall of the package', () => {
  assert.match(textOf(INSTALL), /Copy-Item -LiteralPath \(Join-Path \$PSScriptRoot 'status-line-uninstall\.ps1'\) -Destination \(Join-Path \$Folder 'status-line-uninstall\.ps1'\)/);
  assert.match(textOf(UNINSTALL), /\(Join-Path \$Folder 'status-line-uninstall\.ps1'\)/);
});

test('Windows PowerShell parses each script with no error', { skip: process.platform !== 'win32' && 'Windows PowerShell runs on Windows only' }, () => {
  for (const file of SCRIPTS) {
    const command = `$e = $null; [void][Management.Automation.Language.Parser]::ParseFile('${file}', [ref]$null, [ref]$e); $e.Count`;
    const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.stdout.trim(), '0', `${path.basename(file)}: ${result.stdout}${result.stderr}`);
  }
});
