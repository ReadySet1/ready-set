// scripts/apply-migration.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

const execAsync = promisify(exec);

async function applyMigration(migrationFile: string) {
  try {
    console.log(`🔄 Applying migration: ${migrationFile}`);
    
    const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not found in environment variables');
    }

    // Read migration file
    const migrationContent = await readFile(migrationFile, 'utf-8');
    console.log(`📋 Migration content loaded (${migrationContent.length} characters)`);

    // Apply migration using psql
    const command = `echo "${migrationContent.replace(/"/g, '\\"')}" | psql "${databaseUrl}"`;
    
    const { stdout, stderr } = await execAsync(command);
    
    if (stdout) {
      console.log('✅ Migration output:', stdout);
    }
    
    if (stderr) {
      console.log('⚠️ Migration warnings:', stderr);
    }
    
    console.log('✅ Migration applied successfully!');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  }
}

// Get migration file from command line argument
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: tsx scripts/apply-migration.ts <migration-file>');
  process.exit(1);
}

applyMigration(migrationFile);