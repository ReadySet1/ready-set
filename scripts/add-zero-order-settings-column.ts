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
  if (!match || !match[1]) {
    console.error("ERROR: Could not find DATABASE_URL in .env.production");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: match[1] as string });

  try {
    console.log("Connecting to production database...");

    // Add the column
    console.log(
      "Adding zero_order_settings column (IF NOT EXISTS)..."
    );
    await pool.query(
      "ALTER TABLE public.delivery_configurations ADD COLUMN IF NOT EXISTS zero_order_settings JSONB"
    );
    console.log("Column added successfully.");

    // Verify
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'delivery_configurations' AND column_name = 'zero_order_settings'
    `);

    if (result.rows.length === 1) {
      const col = result.rows[0];
      console.log(
        `\nVerification: column_name=${col.column_name}, data_type=${col.data_type}, is_nullable=${col.is_nullable}`
      );
      if (col.data_type === "jsonb" && col.is_nullable === "YES") {
        console.log("✅ Column verified correctly.");
      } else {
        console.error("❌ Column exists but has unexpected properties.");
        process.exit(1);
      }
    } else {
      console.error("❌ Column not found after ALTER TABLE.");
      process.exit(1);
    }
  } catch (err) {
    console.error("ERROR:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
