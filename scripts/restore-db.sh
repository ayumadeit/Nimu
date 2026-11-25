#!/usr/bin/env bash
# Nimu Database Restore Script
# Restores a compressed PostgreSQL dump into the target database.

set -euo pipefail

BACKUP_FILE="${1:-}"

if [ -z "${BACKUP_FILE}" ]; then
  echo "Usage: $0 <path_to_backup_file.sql.gz>"
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "❌ Error: File not found: ${BACKUP_FILE}"
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ Error: DATABASE_URL is not set."
  exit 1
fi

echo "⚠️  WARNING: Restoring will overwrite existing data in the database!"
read -p "Are you sure you want to proceed with restore? (y/N): " -r CONFIRM
if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
  echo "Operation cancelled."
  exit 0
fi

echo "🔄 Restoring ${BACKUP_FILE} into database..."
gunzip -c "${BACKUP_FILE}" | psql "${DATABASE_URL}"

echo "✅ Database restored successfully!"
