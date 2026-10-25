# Windows database backup

Daily `pg_dump` of the Neon database on a Windows PC. A Task Scheduler task
runs 3 minutes after every boot and daily at `DAILY_AT`. If the PC was off at
that time, the backup runs as soon as it's back on. Each run writes one
`fintracker-YYYY-MM-DD.dump` and deletes files older than `KEEP_DAYS`.

| File | |
|---|---|
| `fintracker-backup.ps1` | Setup, the scheduled backup (`-Run`), and `-Uninstall` |
| `backup.env.example` | Config template. Copy it to `backup.env`, which is gitignored |

No credentials are committed. `DATABASE_URL` lives only in `backup.env`, and
setup moves that file into `BACKUP_DIR`, which only SYSTEM and Administrators
can read.

## Setup (once)

1. Install **PostgreSQL 17**, ticking only **Command Line Tools**
   (<https://www.postgresql.org/download/windows/>). Neon runs Postgres 17, and
   an older `pg_dump` refuses to dump it.
2. In this folder, copy `backup.env.example` to `backup.env` and fill in
   `DATABASE_URL`. Use the same value as `packages/apps/fintracker/.env.local`,
   on the direct host (not `-pooler`).
3. Open **PowerShell as Administrator** in this folder and run:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\fintracker-backup.ps1
   ```

   It ends with `Done. fintracker-<date>.dump holds data for N tables.`
   That first backup ran through the scheduled task itself, so the schedule works.

## Day to day

| Task | How (Administrator PowerShell) |
|---|---|
| Check recent runs | `Get-Content C:\Backups\fintracker\backup.log -Tail 5` |
| Change time / retention / URL | Edit `C:\Backups\fintracker\backup.env`, then rerun setup from there: `C:\Backups\fintracker\fintracker-backup.ps1` |
| Back up right now | `Start-ScheduledTask 'FinTracker DB Backup'` (skipped if today's file exists) |
| Stop scheduling | `C:\Backups\fintracker\fintracker-backup.ps1 -Uninstall` (keeps backups) |

The paths assume the default `BACKUP_DIR`. If you changed it, use your folder instead.

## Restore

Restore into a new **Neon branch**, never over the live database. Check the
data there, then switch over:

```powershell
pg_restore --dbname="<branch connection string>" --no-owner --clean --if-exists `
  C:\Backups\fintracker\fintracker-YYYY-MM-DD.dump
```

To see what a file contains, without a database:
`pg_restore --list <file>.dump`

## Notes

- **All copies are on one disk.** Now and then, copy the newest `.dump` to
  OneDrive or a USB drive. Don't point `BACKUP_DIR` at OneDrive: the task runs
  as SYSTEM, which doesn't see your OneDrive.
- **Keep `fintracker-backup.ps1` plain ASCII.** Windows PowerShell 5.1 misreads
  UTF-8 files that have no BOM.
- Size is about 1-2 MB per dump for an 11 MB database, so 60 days is roughly 120 MB.
