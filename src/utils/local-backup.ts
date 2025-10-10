// src/utils/local-backup.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as cron from 'node-cron';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

const execAsync = promisify(exec);

async function createBackup(): Promise<void> {
  try {
    // Validate environment variables
    if (!process.env.POSTGRES_URL) {
      throw new Error('Missing POSTGRES_URL environment variable');
    }

    // Parse database URL more carefully
    const dbUrl = new URL(process.env.POSTGRES_URL);
    const connectionParams = {
      host: dbUrl.hostname,
      port: dbUrl.port || '5432',
      database: dbUrl.pathname.slice(1),
      user: dbUrl.username,
      password: dbUrl.password,
    };

    // Get current date for the filename
    const date = new Date().toISOString().split('T')[0];
    
    // Create backups directory in your home folder
    const homeDir = process.env.HOME || require('os').homedir();
    const backupDir = path.join(homeDir, 'db-backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }
    
    const backupPath = path.join(backupDir, `backup-${date}.sql`);

    // Construct pg_dump command with proper escaping
    const command = [
      'PGPASSWORD=' + connectionParams.password,
      'pg_dump',
      `-h "${connectionParams.host}"`,
      `-p ${connectionParams.port}`,
      `-U "${connectionParams.user}"`,
      `-d "${connectionParams.database}"`,
      '-F p',
      `> "${backupPath}"`
    ].join(' ');

    await execAsync(command);

    // Keep only last 7 backups
    const backupFiles = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
      
    if (backupFiles.length > 7 && backupFiles[0]) {
      const oldestFile = backupFiles[0];
      fs.unlinkSync(path.join(backupDir, oldestFile));
    }

    return;

  } catch (error) {
    console.error('❌ Backup failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'schedule':
    
    // Schedule weekly backup (runs every Sunday at 00:00)
    cron.schedule('0 0 * * 0', () => {
      createBackup();
    });
    break;

  default:
    // Run single backup and exit
    createBackup().then(() => {
      process.exit(0);
    });
    break;
}