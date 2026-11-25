#!/usr/bin/env bash
# Nimu Database Backup Script
# Creates a compressed, timestamped PostgreSQL dump and removes backups older than 7 days.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/nimu_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

mkdir -p "${BACKUP_DIR}"

echo "📦 Starting Nimu PostgreSQL backup..."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ Error: DATABASE_URL is not set."
  exit 1
fi

pg_dump "${DATABASE_URL}" --clean --if-exists --no-owner --no-privileges | gzip > "${BACKUP_FILE}"

FILESIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')
echo "✅ Backup completed successfully: ${BACKUP_FILE} (${FILESIZE})"

# Prune old backups
echo "🧹 Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "nimu_backup_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -delete
echo "✨ Pruning complete."
