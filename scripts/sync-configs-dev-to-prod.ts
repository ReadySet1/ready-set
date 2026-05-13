import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

function getDbUrl(envFile: string): string {
  const envContent = fs.readFileSync(
    path.resolve(__dirname, "..", envFile),
    "utf-8"
  );
  const match = envContent.match(/^DATABASE_URL="([^"]+)"/m);
  if (!match || !match[1]) {
    throw new Error(`Could not find DATABASE_URL in ${envFile}`);
  }
  return match[1];
}

async function main() {
  const devUrl = getDbUrl(".env.local");
  const prodUrl = getDbUrl(".env.production");

  const devPool = new Pool({ connectionString: devUrl });
  const prodPool = new Pool({ connectionString: prodUrl });

  try {
    // Step 1: Read all rows from dev
    console.log("Connecting to development database...");
    const devResult = await devPool.query(
      "SELECT * FROM public.delivery_configurations ORDER BY config_id"
    );
    const devRows = devResult.rows;
    console.log(`Found ${devRows.length} rows in dev database.`);

    // Step 2: Upsert each dev row into prod
    console.log("\nConnecting to production database...");
    console.log("Upserting configurations...\n");

    for (const row of devRows) {
      const upsertQuery = `
        INSERT INTO public.delivery_configurations (
          id, config_id, client_name, vendor_name, description, is_active,
          pricing_tiers, mileage_rate, distance_threshold, daily_drive_discounts,
          driver_pay_settings, bridge_toll_settings, custom_settings,
          created_at, updated_at, created_by, notes, zero_order_settings
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15, $16, $17
        )
        ON CONFLICT (config_id) DO UPDATE SET
          client_name = EXCLUDED.client_name,
          vendor_name = EXCLUDED.vendor_name,
          description = EXCLUDED.description,
          is_active = EXCLUDED.is_active,
          pricing_tiers = EXCLUDED.pricing_tiers,
          mileage_rate = EXCLUDED.mileage_rate,
          distance_threshold = EXCLUDED.distance_threshold,
          daily_drive_discounts = EXCLUDED.daily_drive_discounts,
          driver_pay_settings = EXCLUDED.driver_pay_settings,
          bridge_toll_settings = EXCLUDED.bridge_toll_settings,
          custom_settings = EXCLUDED.custom_settings,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          created_by = EXCLUDED.created_by,
          notes = EXCLUDED.notes,
          zero_order_settings = EXCLUDED.zero_order_settings
      `;

      await prodPool.query(upsertQuery, [
        row.config_id,
        row.client_name,
        row.vendor_name,
        row.description,
        row.is_active,
        JSON.stringify(row.pricing_tiers),
        row.mileage_rate,
        row.distance_threshold,
        JSON.stringify(row.daily_drive_discounts),
        JSON.stringify(row.driver_pay_settings),
        JSON.stringify(row.bridge_toll_settings),
        JSON.stringify(row.custom_settings),
        row.created_at,
        row.updated_at,
        row.created_by,
        row.notes,
        row.zero_order_settings ? JSON.stringify(row.zero_order_settings) : null,
      ]);

      console.log(`  ✅ Upserted: ${row.config_id} (${row.client_name})`);
    }

    // Step 3: Verification query
    console.log("\n--- Verification ---");
    const verifyResult = await prodPool.query(
      "SELECT config_id, client_name, is_active, updated_at FROM delivery_configurations ORDER BY config_id"
    );
    console.log(`\nProduction now has ${verifyResult.rows.length} rows:\n`);
    console.log(
      "config_id".padEnd(30) +
        "client_name".padEnd(30) +
        "is_active".padEnd(12) +
        "updated_at"
    );
    console.log("-".repeat(100));
    for (const row of verifyResult.rows) {
      console.log(
        row.config_id.padEnd(30) +
          row.client_name.padEnd(30) +
          String(row.is_active).padEnd(12) +
          row.updated_at
      );
    }

    // Check active/inactive counts
    const activeRows = verifyResult.rows.filter((r) => r.is_active);
    const inactiveRows = verifyResult.rows.filter((r) => !r.is_active);
    console.log(`\nActive (${activeRows.length}): ${activeRows.map((r) => r.config_id).join(", ")}`);
    console.log(`Inactive (${inactiveRows.length}): ${inactiveRows.map((r) => r.config_id).join(", ")}`);

    if (verifyResult.rows.length !== 7) {
      console.error(`\n❌ Expected 7 rows, got ${verifyResult.rows.length}`);
      process.exit(1);
    }
    if (activeRows.length !== 5) {
      console.error(`\n❌ Expected 5 active rows, got ${activeRows.length}`);
      process.exit(1);
    }

    // Step 4: Diff check for key JSON fields
    console.log("\n--- JSON Diff Check ---\n");
    const prodFullResult = await prodPool.query(
      "SELECT config_id, driver_pay_settings, pricing_tiers, zero_order_settings FROM delivery_configurations ORDER BY config_id"
    );
    const prodMap = new Map(prodFullResult.rows.map((r) => [r.config_id, r]));

    let allMatch = true;
    for (const devRow of devRows) {
      const prodRow = prodMap.get(devRow.config_id);
      if (!prodRow) {
        console.log(`❌ MISSING in prod: ${devRow.config_id}`);
        allMatch = false;
        continue;
      }

      const dpsMatch =
        JSON.stringify(devRow.driver_pay_settings) ===
        JSON.stringify(prodRow.driver_pay_settings);
      const ptMatch =
        JSON.stringify(devRow.pricing_tiers) ===
        JSON.stringify(prodRow.pricing_tiers);
      const zosMatch =
        JSON.stringify(devRow.zero_order_settings) ===
        JSON.stringify(prodRow.zero_order_settings);

      if (dpsMatch && ptMatch && zosMatch) {
        console.log(`✅ MATCH: ${devRow.config_id}`);
      } else {
        console.log(`❌ MISMATCH: ${devRow.config_id}`);
        if (!dpsMatch) console.log("   - driver_pay_settings differs");
        if (!ptMatch) console.log("   - pricing_tiers differs");
        if (!zosMatch) console.log("   - zero_order_settings differs");
        allMatch = false;
      }
    }

    if (allMatch) {
      console.log("\n✅ All configurations match between dev and prod!");
    } else {
      console.error("\n❌ Some configurations do not match. Review above.");
      process.exit(1);
    }
  } catch (err) {
    console.error("ERROR:", err);
    process.exit(1);
  } finally {
    await devPool.end();
    await prodPool.end();
  }
}

main();
