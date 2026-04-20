import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // Parse DATABASE_URL from .env.production
  const envContent = fs.readFileSync(
    path.resolve(__dirname, "../.env.production"),
    "utf-8"
  );
  const match = envContent.match(/^DATABASE_URL="([^"]+)"/m);
  if (!match) {
    console.error("ERROR: Could not find DATABASE_URL in .env.production");
    process.exit(1);
  }
  const databaseUrl = match[1];

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log("Connecting to production database...");
    const result = await pool.query(
      "SELECT * FROM public.delivery_configurations ORDER BY config_id"
    );

    const rows = result.rows;
    console.log(`Found ${rows.length} rows in delivery_configurations`);

    // Create backup directory
    const backupDir = path.resolve(__dirname, "../backups");
    fs.mkdirSync(backupDir, { recursive: true });

    // Generate timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    // Write JSON backup
    const jsonPath = path.join(
      backupDir,
      `prod-delivery-configurations-backup-${timestamp}.json`
    );
    fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2));

    // Write human-readable summary
    const txtPath = path.join(
      backupDir,
      `prod-delivery-configurations-backup-${timestamp}.txt`
    );
    let summary = `Production delivery_configurations backup\n`;
    summary += `Timestamp: ${new Date().toISOString()}\n`;
    summary += `Row count: ${rows.length}\n`;
    summary += `${"=".repeat(80)}\n\n`;

    for (const row of rows) {
      summary += `config_id: ${row.config_id}\n`;
      summary += `client_name: ${row.client_name}\n`;
      summary += `is_active: ${row.is_active}\n`;
      summary += `updated_at: ${row.updated_at}\n`;
      summary += `${"-".repeat(40)}\n`;
    }

    fs.writeFileSync(txtPath, summary);

    console.log(`\nBackup files created:`);
    console.log(`  JSON: ${jsonPath}`);
    console.log(`  TXT:  ${txtPath}`);
    console.log(`  Rows: ${rows.length}`);
  } catch (err) {
    console.error("ERROR:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
