import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import { restoreDatabaseBackup } from '../src/lib/backup.js';

describe('Phase 6: Database Backup & Recovery Utilities', () => {
  it('restoreDatabaseBackup throws an error if backup file does not exist', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    expect(() => {
      restoreDatabaseBackup('non-existent-backup.sql');
    }).toThrow('Backup file not found');
  });
});
