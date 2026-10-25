<#
  FinTracker database backup (Neon Postgres) for Windows - one file does everything.
  See README.md in this folder.

  SETUP, once, in PowerShell opened as Administrator, from this folder:
      copy backup.env.example backup.env      (then fill in DATABASE_URL)
      powershell -ExecutionPolicy Bypass -File .\fintracker-backup.ps1

    - checks pg_dump 17+ is installed
    - installs this script and backup.env into BACKUP_DIR, readable only by
      SYSTEM and Administrators (backup.env is moved, not copied)
    - registers a task: 3 min after every boot + daily at DAILY_AT
      (a missed daily run happens as soon as the PC is back on)
    - runs the first backup through the task and shows the result

  The task then calls:   <BACKUP_DIR>\fintracker-backup.ps1 -Run
  Remove the task:       fintracker-backup.ps1 -Uninstall   (backups are kept)

  One .dump per day; files older than KEEP_DAYS are deleted automatically.
  Keep this file plain ASCII: Windows PowerShell 5.1 misreads UTF-8 without a BOM.
#>
param(
  [switch]$Run,
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$TaskName    = 'FinTracker DB Backup'
$DefaultRoot = 'C:\Backups\fintracker'
$MinPgMajor  = 17   # Neon runs Postgres 17; an older pg_dump refuses to dump it
$ScriptName  = 'fintracker-backup.ps1'
$ConfigName  = 'backup.env'

# ---------------------------------------------------------------- config ---
# Next to the script first (the source folder at setup, BACKUP_DIR once
# installed), then the default install folder for re-runs from elsewhere.
function Find-Config {
  foreach ($dir in @($PSScriptRoot, $DefaultRoot)) {
    $p = Join-Path $dir $ConfigName
    if (Test-Path $p) { return $p }
  }
  return $null
}

# KEY=VALUE lines; '#' comments and blanks skipped. Split on the first '=' only:
# the connection string's query (?sslmode=require&...) has '=' of its own.
function Read-Config([string]$path) {
  $cfg = @{}
  foreach ($line in Get-Content $path) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith('#')) { continue }
    $i = $t.IndexOf('=')
    if ($i -lt 1) { continue }
    $val = $t.Substring($i + 1).Trim()
    if ($val.Length -ge 2 -and (($val[0] -eq '"' -and $val[-1] -eq '"') -or ($val[0] -eq "'" -and $val[-1] -eq "'"))) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    $cfg[$t.Substring(0, $i).Trim()] = $val
  }
  return $cfg
}

function Get-Setting($cfg, [string]$key, [string]$default) {
  if ($cfg.ContainsKey($key) -and $cfg[$key]) { return $cfg[$key] }
  return $default
}

function Get-PgTool([string]$exe) {
  $found = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\$exe" -ErrorAction SilentlyContinue |
    Sort-Object { [int]($_.Directory.Parent.Name -replace '\D.*$', '') } -Descending |
    Select-Object -First 1
  if ($found) { return $found.FullName }
  $onPath = Get-Command $exe -ErrorAction SilentlyContinue
  if ($onPath) { return $onPath.Source }
  return $null
}

function Get-PgMajor([string]$pgDump) {
  $v = & $pgDump --version   # "pg_dump (PostgreSQL) 17.2"
  if ($v -match '(\d+)\.\d+') { return [int]$Matches[1] }
  return 0
}

# ---------------------------------------------------------------- backup ---
function Invoke-Backup([string]$root, [string]$url, [int]$keepDays) {
  $log = Join-Path $root 'backup.log'
  $tmp = $null
  try {
    $pgDump = Get-PgTool 'pg_dump.exe'
    if (-not $pgDump) { throw 'pg_dump.exe not found - install the PostgreSQL 17 Command Line Tools' }

    $file = Join-Path $root ('fintracker-{0}.dump' -f (Get-Date -Format 'yyyy-MM-dd'))

    # Boot and the daily trigger can both fire on one day; one file per day is enough.
    if (Test-Path $file) {
      "$(Get-Date -Format s)  skip: already have $(Split-Path $file -Leaf)" | Add-Content $log
      return 0
    }

    # Write to .partial first so a failed run never leaves a broken .dump behind.
    $tmp = "$file.partial"
    # PowerShell 5.1 turns a native tool's stderr into errors under 'Stop', so
    # relax it here and keep pg_dump's own message for the log instead.
    $ErrorActionPreference = 'Continue'
    $out = & $pgDump "--dbname=$url" --format=custom --no-owner --no-privileges "--file=$tmp" 2>&1 |
      ForEach-Object { "$_" }
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($code -ne 0) { throw "pg_dump exited with code ${code}: $($out -join ' ')" }
    Move-Item $tmp $file
    $tmp = $null
    ('{0}  ok: {1} ({2:N0} KB)' -f (Get-Date -Format s), (Split-Path $file -Leaf), ((Get-Item $file).Length / 1KB)) |
      Add-Content $log

    # Prune only after a successful backup, so the newest copy always exists.
    Get-ChildItem $root -Filter 'fintracker-*.dump' |
      Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$keepDays) } |
      ForEach-Object {
        Remove-Item $_.FullName
        "$(Get-Date -Format s)  pruned: $($_.Name)" | Add-Content $log
      }
    return 0
  }
  catch {
    "$(Get-Date -Format s)  FAILED: $_" | Add-Content $log
    if ($tmp -and (Test-Path $tmp)) { Remove-Item $tmp -Force }
    return 1
  }
}

if ($Run) {
  $configPath = Find-Config
  # No config means nowhere sensible to log either; the task's result code shows it.
  if (-not $configPath) { exit 2 }
  $cfg = Read-Config $configPath
  $root = Split-Path $configPath -Parent
  exit (Invoke-Backup $root (Get-Setting $cfg 'DATABASE_URL' '') ([int](Get-Setting $cfg 'KEEP_DAYS' '60')))
}

# ------------------------------------------------------------ admin check ---
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host 'Run this from PowerShell opened as Administrator (right-click > Run as administrator).' -ForegroundColor Red
  exit 1
}

# -------------------------------------------------------------- uninstall ---
if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Removed task '$TaskName'. Backups and backup.env are left where they are." -ForegroundColor Green
  exit 0
}

# ------------------------------------------------------------------ setup ---
Write-Host "`n== FinTracker backup setup ==`n" -ForegroundColor Cyan

$configPath = Find-Config
if (-not $configPath) {
  Write-Host "No $ConfigName found." -ForegroundColor Red
  Write-Host "Copy backup.env.example to $ConfigName next to this script, fill in DATABASE_URL, and run again."
  exit 1
}
$cfg = Read-Config $configPath

$url = Get-Setting $cfg 'DATABASE_URL' ''
if ($url -notmatch '^postgres(ql)?://') {
  Write-Host "DATABASE_URL in $configPath is empty or not a postgresql:// URL." -ForegroundColor Red
  exit 1
}
$root = Get-Setting $cfg 'BACKUP_DIR' $DefaultRoot
$keepDays = 0
if (-not [int]::TryParse((Get-Setting $cfg 'KEEP_DAYS' '60'), [ref]$keepDays) -or $keepDays -lt 1) {
  Write-Host 'KEEP_DAYS must be a whole number of days, 1 or more.' -ForegroundColor Red
  exit 1
}
$dailyAt = [datetime]::MinValue
if (-not [datetime]::TryParse((Get-Setting $cfg 'DAILY_AT' '21:00'), [ref]$dailyAt)) {
  Write-Host 'DAILY_AT must be a time like 21:00.' -ForegroundColor Red
  exit 1
}

$pgDump = Get-PgTool 'pg_dump.exe'
if (-not $pgDump) {
  Write-Host 'pg_dump.exe not found.' -ForegroundColor Red
  Write-Host 'Install PostgreSQL 17 from https://www.postgresql.org/download/windows/'
  Write-Host 'and tick only "Command Line Tools" on the components screen. Then run this again.'
  exit 1
}
$major = Get-PgMajor $pgDump
if ($major -lt $MinPgMajor) {
  Write-Host "Found pg_dump $major at $pgDump, but Neon needs $MinPgMajor or newer." -ForegroundColor Red
  Write-Host 'Install the PostgreSQL 17 Command Line Tools and run this again.'
  exit 1
}
Write-Host "pg_dump $major found: $pgDump"

New-Item -ItemType Directory -Force -Path $root | Out-Null
# backup.env holds the DB password: only SYSTEM (S-1-5-18) and Administrators (S-1-5-32-544).
& icacls $root /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null

$installedScript = Join-Path $root $ScriptName
$installedConfig = Join-Path $root $ConfigName
if ($PSCommandPath -ne $installedScript) { Copy-Item $PSCommandPath $installedScript -Force }
if ($configPath -ne $installedConfig) {
  # Moved, not copied, so the password doesn't also sit in the checkout.
  Copy-Item $configPath $installedConfig -Force
  Remove-Item $configPath -Force
  Write-Host "Moved $ConfigName into $root (edit it there from now on)."
}
Write-Host "Backup folder: $root (SYSTEM + Administrators only)"

$action   = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$installedScript`" -Run"
$onBoot   = New-ScheduledTaskTrigger -AtStartup
$onBoot.Delay = 'PT3M'   # let the network come up first
$daily    = New-ScheduledTaskTrigger -Daily -At $dailyAt
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
# SYSTEM, so it runs after a reboot even if nobody logs in.
$runAs    = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $onBoot, $daily `
  -Settings $settings -Principal $runAs -Force | Out-Null
Write-Host ("Task '{0}' registered: at boot (+3 min) and daily at {1:HH:mm}; keeping {2} days." -f $TaskName, $dailyAt, $keepDays)

# First backup through the real task, so the test covers exactly what runs later.
Write-Host "`nRunning the first backup..."
Start-ScheduledTask -TaskName $TaskName
$deadline = (Get-Date).AddMinutes(5)
Start-Sleep -Seconds 3
while ((Get-ScheduledTask -TaskName $TaskName).State -eq 'Running' -and (Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 2
}
$result = (Get-ScheduledTaskInfo -TaskName $TaskName).LastTaskResult

$log = Join-Path $root 'backup.log'
Write-Host "`nLast log lines:"
if (Test-Path $log) { Get-Content $log -Tail 3 | ForEach-Object { Write-Host "  $_" } }

$latest = Get-ChildItem $root -Filter 'fintracker-*.dump' | Sort-Object LastWriteTime | Select-Object -Last 1
$pgRestore = Get-PgTool 'pg_restore.exe'
if ($result -eq 0 -and $latest -and $pgRestore) {
  $tables = (& $pgRestore --list $latest.FullName | Select-String ' TABLE DATA ').Count
  Write-Host ("`nDone. {0} holds data for {1} tables." -f $latest.Name, $tables) -ForegroundColor Green
  Write-Host "Backups: $root   Log: $log"
} else {
  Write-Host "`nThe first backup did not succeed (task result $result). Check the log lines above." -ForegroundColor Red
  exit 1
}
