import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

export function createDatabaseBackup(): string {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `nimu-backup-${timestamp}.sql`);

  logger.info({ backupPath }, 'Initiating database backup via pg_dump');

  try {
    execSync(`pg_dump "${env.DATABASE_URL}" --clean --if-exists --no-owner --no-privileges -f "${backupPath}"`, {
      stdio: 'inherit',
    });
    logger.info({ backupPath }, 'Database backup created successfully');
    return backupPath;
  } catch (err: any) {
    logger.error({ error: err.message }, 'pg_dump failed');
    throw err;
  }
}

export function restoreDatabaseBackup(backupPath: string): void {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  logger.info({ backupPath }, 'Initiating database restore via psql');

  try {
    execSync(`psql "${env.DATABASE_URL}" -f "${backupPath}"`, {
      stdio: 'inherit',
    });
    logger.info('Database restored successfully');
  } catch (err: any) {
    logger.error({ error: err.message }, 'psql restore failed');
    throw err;
  }
}

// CLI argument execution support
const action = process.argv[2];
if (action === 'backup') {
  createDatabaseBackup();
} else if (action === 'restore') {
  const file = process.argv[3];
  if (!file) {
    console.error('Please specify the backup file path to restore.');
    process.exit(1);
  }
  restoreDatabaseBackup(file);
}
