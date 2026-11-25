# Disaster Recovery & Backup Runbook — Nimu

This runbook outlines the operational procedures, Recovery Point Objectives (RPO), Recovery Time Objectives (RTO), and step-by-step restoration protocols for Nimu production environments.

---

## 1. Objectives & SLAs

| Metric | Target | Description |
|---|---|---|
| **RPO (Recovery Point Objective)** | **1 Hour** | Maximum acceptable data loss window during a severe incident. Supported by continuous WAL archiving or hourly logical dumps. |
| **RTO (Recovery Time Objective)** | **< 15 Minutes** | Maximum acceptable duration to restore database instances and bring services back online. |
| **Availability Target** | **99.9%** | Less than 43 minutes of unscheduled downtime per month. |

---

## 2. Backup Strategy

### A. Automated Daily & Hourly Snapshots
- **Logical Database Dumps**: Managed via PostgreSQL `pg_dump` with gzip compression.
- **Retention Schedule**:
  - Hourly snapshots: Retained for 24 hours.
  - Daily backups: Retained for 30 days.
  - Monthly archives: Retained for 12 months.

### B. Execution Commands
```bash
# Cross-platform CLI runner
npm run db:backup --workspace=@nimu/api

# Automated Linux/Docker script
./scripts/backup-db.sh
```

---

## 3. Disaster Scenarios & Recovery Protocols

### Scenario A: Accidental Data Deletion or Soft-Delete Corruption
1. **Identify the Incident**: Check `AuditLog` table for malicious or accidental batch mutations.
2. **Retrieve Latest Clean Backup**:
   ```bash
   ls -la backups/
   ```
3. **Execute Selective Restore into Staging**:
   ```bash
   createdb nimu_recovery
   psql -d nimu_recovery -f backups/nimu-backup-YYYY-MM-DD.sql
   ```
4. **Extract Target User Rows**: Copy recovered notes or transactions back into production with preserving original UUIDs.

---

### Scenario B: Complete Production Database Outage / Corruption
1. **Stop Incoming Traffic**:
   Temporarily put the Web UI in maintenance mode or route to a static 503 maintenance page.
2. **Verify Database Connectivity**:
   ```bash
   pg_isready -d $DATABASE_URL
   ```
3. **Run Restore Protocol**:
   ```bash
   # Unix environments
   ./scripts/restore-db.sh backups/nimu_backup_YYYYMMDD_HHMMSS.sql.gz

   # Or via cross-platform Node script
   npm run db:restore --workspace=@nimu/api backups/nimu-backup-YYYYMMDD.sql
   ```
4. **Verify Schema & Migrations**:
   ```bash
   npm run prisma:push --workspace=@nimu/api
   ```
5. **Run Sanity Tests**:
   ```bash
   curl -f http://localhost:4000/healthz
   ```
6. **Resume Traffic**: Re-enable frontend routing.

---

## 4. Media Asset Replication & S3 Recovery

1. All media uploads (images, vector drawings, GIFs) are stored with immutable SHA-256 storage keys.
2. **S3 Bucket Versioning**: Enabled on the `nimu-assets` bucket to safeguard against accidental overwrites or deletes.
3. **Cross-Region Replication (CRR)**: Enabled from primary region (`bom`) to secondary region (`del` or `sin`).

---

## 5. Verification Drills & Validation
- **Quarterly Disaster Recovery Simulation**: The database restore protocol must be executed and validated in a staging sandbox every 90 days.
- **Integrity Verification**: Backups are routinely decompressed and validated with `pg_restore --list` to guarantee non-corrupted archives.
