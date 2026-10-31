# The program Claude Desktop's sessionStatusLine runs (odd/tasks/status-line.md): it prints the line that
# `js-harness status-line write` keeps in ~\.js-harness\status-line\line.txt, and nothing else. The board takes about
# 24 s and the host stops this program at 10 s, so it never runs the board. Windows PowerShell 5.1, no modules.
# Line 1 of the file is when it was written; a line older than 10 minutes is shown with its age in yellow. A missing or
# unreadable file prints nothing, so the host shows no line. Output is UTF-8.
[Console]::OutputEncoding = New-Object Text.UTF8Encoding $false
$file = Join-Path $env:USERPROFILE '.js-harness\status-line\line.txt'
try {
  $lines = [IO.File]::ReadAllLines($file, [Text.Encoding]::UTF8)
} catch {
  exit 0
}
if ($lines.Count -lt 2) { exit 0 }
$at = [DateTimeOffset]::MinValue
if (-not [DateTimeOffset]::TryParse($lines[0], [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AssumeUniversal, [ref]$at)) { exit 0 }
$minutes = [int][Math]::Floor(([DateTimeOffset]::UtcNow - $at).TotalMinutes)
$esc = [char]27
if ($minutes -gt 10) {
  [Console]::Out.Write("$esc[33mhace $minutes min$esc[0m " + [char]0x00B7 + ' ' + $lines[1] + "`n")
} else {
  [Console]::Out.Write($lines[1] + "`n")
}
