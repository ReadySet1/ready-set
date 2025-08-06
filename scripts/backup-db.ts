// src/scripts/backup-db.ts

import { exec } from "child_process";
import { join } from "path";
import { mkdir, readdir, stat, unlink, readFile } from "fs/promises";

// Load environment variables from .env file
import { config } from "dotenv";
config();

const BACKUP_DIR = "./backups";
const MAX_BACKUPS = 5;

// Promisify exec for Bun
const execAsync = (
  command: string,
): Promise<{ stdout: string; stderr: string }> => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve({ stdout, stderr });
    });
  });
};

// Clean database URL for psql compatibility
function cleanDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  
  // Remove pgbouncer parameter if present
  url.searchParams.delete('pgbouncer');
  
  // Keep essential parameters
  const essentialParams = ['sslmode', 'connect_timeout'];
  const cleanParams = new URLSearchParams();
  
  essentialParams.forEach(param => {
    if (url.searchParams.has(param)) {
      cleanParams.append(param, url.searchParams.get(param)!);
    }
  });
  
  // Reconstruct clean URL
  const cleanUrl = new URL(url.toString());
  cleanUrl.search = cleanParams.toString();
  
  return cleanUrl.toString();
}

async function getDatabaseStats() {
  const databaseUrl =
    process.env.DIRECT_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) {
    throw new Error("Database URL not found in environment variables");
  }

  const cleanUrl = cleanDatabaseUrl(databaseUrl);
  const url = new URL(cleanUrl);
  process.env.PGPASSWORD = url.password;

  try {
    // Check for PostGIS extension
    const { stdout: postgisCheck } = await execAsync(`
      psql "${cleanUrl}" -t -c "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'postgis');"
    `);

    // Get table count including tracking tables
    const { stdout: tableCount } = await execAsync(`
      psql "${cleanUrl}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
    `);

    // Get total database size
    const { stdout: dbSize } = await execAsync(`
      psql "${cleanUrl}" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()));"
    `);

    // Get table sizes with special handling for geography columns
    const { stdout: tableSizes } = await execAsync(`
      psql "${cleanUrl}" -t -c "
        SELECT 
          t.table_name, 
          pg_size_pretty(pg_total_relation_size(quote_ident(t.table_name))),
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM information_schema.columns c 
              WHERE c.table_schema = 'public' 
              AND c.table_name = t.table_name 
              AND c.udt_name = 'geography'
            ) THEN 'PostGIS'
            ELSE 'Regular'
          END as table_type
        FROM information_schema.tables t
        WHERE t.table_schema = 'public'
        ORDER BY pg_total_relation_size(quote_ident(t.table_name)) DESC;
      "
    `);

    // Check for tracking tables specifically
    const { stdout: trackingTables } = await execAsync(`
      psql "${cleanUrl}" -t -c "
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('drivers', 'driver_locations', 'driver_shifts', 'shift_breaks', 'deliveries', 'tracking_events', 'geofences')
        ORDER BY table_name;
      "
    `);

    return {
      tableCount: parseInt(tableCount.trim()),
      databaseSize: dbSize.trim(),
      hasPostGIS: postgisCheck.trim() === 't',
      trackingTables: trackingTables
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => line.trim()),
      tables: tableSizes
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.trim().split("|");
          const name = parts[0]?.trim() || '';
          const size = parts[1]?.trim() || '';
          const type = parts[2]?.trim() || 'Regular';
          return { name, size, type };
        }),
    };
  } finally {
    delete process.env.PGPASSWORD;
  }
}

async function backupDatabase() {
  try {
    // Get database stats before backup
    console.log("📊 Analyzing database...");
    const dbStats = await getDatabaseStats();
    console.log(`Database size: ${dbStats.databaseSize}`);
    console.log(`Number of tables: ${dbStats.tableCount}`);
    console.log(`PostGIS extension: ${dbStats.hasPostGIS ? '✅ Enabled' : '❌ Not found'}`);
    
    if (dbStats.trackingTables.length > 0) {
      console.log(`Driver tracking tables found: ${dbStats.trackingTables.join(', ')}`);
    } else {
      console.log("⚠️  No driver tracking tables found");
    }
    
    console.log("\nTable sizes:");
    dbStats.tables.forEach((table) => {
      const typeIcon = table.type === 'PostGIS' ? '🗺️' : '📊';
      console.log(`${typeIcon} ${table.name}: ${table.size} (${table.type})`);
    });

    // Ensure backup directory exists
    await mkdir(BACKUP_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup-${timestamp}.sql`;
    const filepath = join(BACKUP_DIR, filename);

    console.log("\n📦 Creating database backup...");

    const databaseUrl =
      process.env.DIRECT_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
    if (!databaseUrl) {
      throw new Error(
        "No database URL found in environment variables. Check DATABASE_URL, DIRECT_URL, POSTGRES_PRISMA_URL, or POSTGRES_URL",
      );
    }

    const cleanUrl = cleanDatabaseUrl(databaseUrl);
    const url = new URL(cleanUrl);
    
    const command = [
      "pg_dump",
      `--schema=public`,
      `-h ${url.hostname}`,
      url.port ? `-p ${url.port}` : "",
      `-U ${url.username}`,
      `-d ${url.pathname.slice(1)}`,
      `-f "${filepath}"`,
      "--format=p",
      "--no-owner",
      "--verbose",
      // Include both schema and data (default behavior)
      // Note: --extension flag is not valid for pg_dump, PostGIS will be included automatically if present
    ]
      .filter(Boolean)
      .join(" ");

    process.env.PGPASSWORD = url.password;

    const { stderr } = await execAsync(command);
    if (stderr) console.log("Backup process output:", stderr);

    delete process.env.PGPASSWORD;

    await rotateBackups();

    // Verify backup file
    const stats = await stat(filepath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`\n✅ Backup created: ${filename}`);
    console.log(`📊 Backup size: ${sizeMB} MB`);

    // Quick backup verification
    const backupContent = await readFile(filepath, "utf-8");
    const tableCount = (backupContent.match(/CREATE TABLE/g) || []).length;
    const extensionCount = (backupContent.match(/CREATE EXTENSION/g) || []).length;
    const geographyColumns = (backupContent.match(/geography\(/g) || []).length;
    
    console.log(`📋 Tables in backup: ${tableCount}`);
    console.log(`🔧 Extensions in backup: ${extensionCount}`);
    
    if (geographyColumns > 0) {
      console.log(`🗺️ PostGIS geography columns: ${geographyColumns}`);
    }
    
    // Check for specific tracking tables in backup
    const trackingTablesInBackup = dbStats.trackingTables.filter(table => 
      backupContent.includes(`CREATE TABLE public.${table}`)
    );
    
    if (dbStats.trackingTables.length > 0) {
      console.log(`🚚 Tracking tables in backup: ${trackingTablesInBackup.length}/${dbStats.trackingTables.length}`);
      if (trackingTablesInBackup.length < dbStats.trackingTables.length) {
        const missingTables = dbStats.trackingTables.filter(table => !trackingTablesInBackup.includes(table));
        console.warn(`⚠️  Missing tracking tables: ${missingTables.join(', ')}`);
      }
    }

    if (tableCount !== dbStats.tableCount) {
      console.warn(
        `⚠️  Warning: Number of tables in backup (${tableCount}) differs from database (${dbStats.tableCount})`,
      );
    }

    if (stats.size < 1000) {
      // Less than 1KB
      console.warn(
        "⚠️  Warning: Backup file seems unusually small. Please verify its contents.",
      );
    }
  } catch (error) {
    console.error("❌ Error creating backup:", error);
    process.exit(1);
  }
}

async function rotateBackups() {
  try {
    const files = await readdir(BACKUP_DIR);
    const backupFiles = files
      .filter((file) => file.endsWith(".sql"))
      .map(async (file) => ({
        name: file,
        path: join(BACKUP_DIR, file),
        created: (await stat(join(BACKUP_DIR, file))).mtimeMs,
      }));

    const backups = await Promise.all(backupFiles);
    backups.sort((a, b) => b.created - a.created);

    for (const backup of backups.slice(MAX_BACKUPS)) {
      console.log(`🗑️ Removing old backup: ${backup.name}`);
      await unlink(backup.path);
    }
  } catch (error) {
    console.error("⚠️ Error rotating backups:", error);
  }
}

export { backupDatabase };

if (process.argv[1] === import.meta.url.substring(7)) {
  backupDatabase();
}
