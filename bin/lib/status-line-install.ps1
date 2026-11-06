# The administrator install of the status line (odd/tasks/status-line.md): run in an elevated Windows PowerShell, it
# copies status-line.ps1, beside this file, under Program Files, where Claude Desktop runs a sessionStatusLine program
# from; sets the sessionStatusLine policy value to it; and registers, for the signed-in user and unelevated, a task
# that runs `js-harness status-line write` every 5 minutes, since the board takes longer than the host's 10 s.
# status-line-uninstall.ps1, beside this file, takes the same parameters and removes exactly these. Run again after
# js-harness updates, it copies the program again and registers the task again. The parameters other than -Project
# are for a try in scratch places; -WriterArguments adds arguments to the writer, such as --home <scratch>.
param(
  [Parameter(Mandatory = $true)][string]$Project,
  [string]$Folder = (Join-Path $env:ProgramFiles 'js-harness'),
  [string]$Policy = 'HKCU:\SOFTWARE\Policies\Claude',
  [string]$Task = 'js-harness status-line',
  [string]$Shim = (Join-Path $env:LOCALAPPDATA 'pnpm\bin\js-harness.cmd'),
  [string]$LineHome = $(if ($env:JS_HARNESS_HOME -and [IO.Path]::IsPathRooted($env:JS_HARNESS_HOME)) { $env:JS_HARNESS_HOME } else { $env:USERPROFILE }),
  [string]$WriterArguments = ''
)
$ErrorActionPreference = 'Stop'
$program = Join-Path $PSScriptRoot 'status-line.ps1'
if (-not (Test-Path -LiteralPath $program)) { throw "no program beside this script: $program" }
# The shim, not this file's folder: pnpm keeps each version in its own folder and rewrites the shim when it updates.
if (-not (Test-Path -LiteralPath $Shim)) { throw "no js-harness shim at $Shim" }
# Windows PowerShell 5.1 turns a native command's standard error into errors, which 'Stop' would throw on.
$ErrorActionPreference = 'Continue'
$null = & $Shim status-line program 2>$null
$probe = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($probe -ne 0) { throw "$Shim has no status-line command (exit $probe): update js-harness first" }
if (-not (Test-Path -LiteralPath $Project)) { throw "no project folder at $Project" }

$installed = Join-Path $Folder 'status-line.ps1'
$value = @{ command = $installed } | ConvertTo-Json -Compress
if ((Test-Path $Policy) -and ((Get-Item $Policy).Property -contains 'sessionStatusLine')) {
  $found = (Get-ItemProperty -Path $Policy -Name sessionStatusLine).sessionStatusLine
  if ($found -ne $value) { throw "$Policy already holds sessionStatusLine = $found, which this install did not write; it is left as it is" }
}
New-Item -ItemType Directory -Force -Path $Folder | Out-Null
Copy-Item -LiteralPath $program -Destination $installed -Force
# The undo goes beside the program, so it outlives an uninstall of js-harness, which knows nothing of this install.
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'status-line-uninstall.ps1') -Destination (Join-Path $Folder 'status-line-uninstall.ps1') -Force
if (-not (Test-Path $Policy)) { New-Item -Path $Policy -Force | Out-Null }
New-ItemProperty -Path $Policy -Name sessionStatusLine -PropertyType String -Value $value -Force | Out-Null

# conhost --headless runs the writer with no window. It does not pass the writer's exit code on, so the task's last
# result says nothing: the line's time, and the age the program shows past 10 minutes, are the check.
$arguments = "--headless `"$Shim`" status-line write --cwd `"$Project`""
if ($WriterArguments) { $arguments += " $WriterArguments" }
$action = New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot 'System32\conhost.exe') -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 2)
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $Task -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force -Description 'Writes the line of the Claude Desktop status line every 5 minutes (js-harness status-line write). status-line-uninstall.ps1 removes it.' | Out-Null

$registered = Get-ScheduledTask -TaskName $Task
"installed: $installed, and its undo, $(Join-Path $Folder 'status-line-uninstall.ps1')"
"policy: $Policy sessionStatusLine = $value"
"task: $Task, as $($registered.Principal.UserId), run level $($registered.Principal.RunLevel), every 5 minutes"
"the line: $(Join-Path $LineHome '.js-harness\status-line\line.txt'), written within 5 minutes; Claude Desktop reads the key after a restart, and today only on third-party inference"
