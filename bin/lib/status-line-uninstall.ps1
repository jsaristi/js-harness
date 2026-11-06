# The undo of status-line-install.ps1, which copies it under Program Files beside the program (it also ships beside the
# install in js-harness), with the same parameters: in an elevated Windows PowerShell
# it stops and deletes the task, removes the sessionStatusLine value (and the policy key when nothing else is left in
# it), the program and its folder when it is empty, and last the line the writer kept. What is already gone is
# skipped, so it can run again.
param(
  [string]$Folder = (Join-Path $env:ProgramFiles 'js-harness'),
  [string]$Policy = 'HKCU:\SOFTWARE\Policies\Claude',
  [string]$Task = 'js-harness status-line',
  [string]$LineHome = $(if ($env:JS_HARNESS_HOME -and [IO.Path]::IsPathRooted($env:JS_HARNESS_HOME)) { $env:JS_HARNESS_HOME } else { $env:USERPROFILE })
)
$ErrorActionPreference = 'Stop'
if (Get-ScheduledTask -TaskName $Task -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $Task
  $waited = 0
  while ((Get-ScheduledTask -TaskName $Task).State -eq 'Running' -and $waited -lt 60) { Start-Sleep -Seconds 1; $waited += 1 }
  Unregister-ScheduledTask -TaskName $Task -Confirm:$false
  "task deleted: $Task"
}
if ((Test-Path $Policy) -and ((Get-Item $Policy).Property -contains 'sessionStatusLine')) {
  Remove-ItemProperty -Path $Policy -Name sessionStatusLine
  "policy value removed: $Policy sessionStatusLine"
}
if ((Test-Path $Policy) -and -not (Get-Item $Policy).Property -and -not (Get-ChildItem $Policy)) {
  Remove-Item $Policy
  "policy key removed, it held nothing else: $Policy"
}
# The install copies this file beside the program; PowerShell has read it whole, so it can remove itself.
foreach ($installed in @((Join-Path $Folder 'status-line.ps1'), (Join-Path $Folder 'status-line-uninstall.ps1'))) {
  if (Test-Path -LiteralPath $installed) { Remove-Item -LiteralPath $installed; "removed: $installed" }
}
if ((Test-Path -LiteralPath $Folder) -and -not (Get-ChildItem -LiteralPath $Folder -Force)) { Remove-Item -LiteralPath $Folder; "removed: $Folder" }
$line = Join-Path $LineHome '.js-harness\status-line'
if (Test-Path -LiteralPath $line) { Remove-Item -LiteralPath $line -Recurse; "removed: $line" }
