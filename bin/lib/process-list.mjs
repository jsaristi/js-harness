// The machine's processes whose command line matches a pattern, as the board (`js-harness sessions`) and `quiet` read
// them: one PowerShell CIM query on Windows, `ps` elsewhere. Moved out of bin/sessions.mjs so both read one listing the
// same way. Zero dependencies.

import { POWERSHELL_ROW_FUNCTION } from './process-tree.mjs';
import { parseProcessList, parsePsList } from './sessions.mjs';

// One row of the shared listing (`Format-ProcessRow`, ./process-tree.mjs) and one `C` line per process whose command
// line matches the pattern, which is a .NET regular expression inside single quotes, so it holds none. The last line is
// `OK` with the number of `C` lines written, which `parseProcessList` compares with the lines it read: a listing that
// stopped half way, or lost a line, is refused. Tabs and line breaks in a command line become spaces, so a line of
// output is always one fact. Progress output is off: under `-EncodedCommand` it would arrive as CLIXML. The output is
// UTF-8 because that is what `run` reads: left alone PowerShell writes in the code page of its console, 850 or 437 on
// most machines, and a letter outside ASCII in a path would arrive as another. No byte order mark, which would be read
// as the start of the first row.
export function listingScript(pattern) {
  if (pattern.includes("'")) throw new Error('the pattern of a process listing holds no single quote');
  return String.raw`
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
${POWERSHELL_ROW_FUNCTION}
try {
  [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
  $written = 0
  foreach ($process in @(Get-CimInstance Win32_Process)) {
    $line = $process.CommandLine
    if (-not $line -or $line -notmatch '${pattern}') { continue }
    Format-ProcessRow $process
    'C' + [char]9 + $process.ProcessId + [char]9 + ($line -replace '\s+', ' ')
    $written += 1
  }
  'OK' + [char]9 + $written
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
`;
}

/** The processes whose command line matches `pattern`, `[{ pid, createdAt, commandLine }]`; on POSIX every process
 * `ps` lists, for the caller to pick from. `run(command, args, options)` is `spawnSync`'s shape. Throws when the
 * listing could not run or did not finish: "none runs" must never be read from "could not look". */
export function listCommandLines(run, platform, pattern) {
  const windows = platform === 'win32';
  const result = windows
    ? run('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(listingScript(pattern), 'utf16le').toString('base64')], {})
    : run('ps', ['-A', '-o', 'pid=,args='], {});
  if (result.error) throw new Error(result.error.message);
  if (result.status !== 0) throw new Error(String(result.stderr ?? '').trim().split(/\r?\n/)[0] || `exit ${result.status}`);
  return windows ? parseProcessList(result.stdout) : parsePsList(result.stdout);
}
