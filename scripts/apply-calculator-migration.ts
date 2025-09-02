// Script to apply the calculator system database migration
// Executes the SQL migration and sets up the database schema

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function applyCalculatorMigration() {
  console.log('🚀 Applying calculator system migration...');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../migrations/add-calculator-system.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error('Migration file not found: ' + migrationPath);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Reading migration file...');
    console.log(`   File: ${migrationPath}`);
    console.log(`   Size: ${(migrationSQL.length / 1024).toFixed(2)} KB`);

    // Check if tables already exist
    console.log('🔍 Checking existing database schema...');
    
    try {
      await prisma.$queryRaw`SELECT 1 FROM calculator_templates LIMIT 1`;
      console.log('⚠️  Calculator tables already exist. Skipping migration.');
      console.log('   Use --force flag to drop and recreate tables.');
      return;
    } catch (error) {
      // Tables don't exist, proceed with migration
      console.log('   ✓ Calculator tables do not exist, proceeding with migration');
    }

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📋 Executing ${statements.length} SQL statements...`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.trim()) {
        try {
          await prisma.$executeRawUnsafe(statement);
          console.log(`   ✓ Statement ${i + 1}/${statements.length} executed`);
        } catch (error) {
          console.error(`   ❌ Statement ${i + 1} failed:`, error);
          console.error(`   SQL: ${statement.substring(0, 100)}...`);
          throw error;
        }
      }
    }

    // Verify the migration
    console.log('🔬 Verifying migration...');
    
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'calculator_%' 
      OR table_name LIKE 'pricing_%' 
      OR table_name LIKE 'client_%'
      OR table_name LIKE 'calculation_%'
    `;

    console.log('   ✓ Created tables:', tables);

    // Check if default data was inserted
    const templateCount = await prisma.calculatorTemplate.count();
    const ruleCount = await prisma.pricingRule.count();

    console.log(`   ✓ Default templates created: ${templateCount}`);
    console.log(`   ✓ Default rules created: ${ruleCount}`);

    console.log('✅ Calculator migration completed successfully!');
    console.log('');
    console.log('🎯 Next steps:');
    console.log('   1. Run: pnpm prisma generate');
    console.log('   2. Run data migration: npm run migrate:calculator-data');
    console.log('   3. Test the calculator system');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function forceRecreate() {
  console.log('🔄 Force recreating calculator tables...');
  
  try {
    // Drop tables in correct order (respecting foreign keys)
    await prisma.$executeRaw`DROP TABLE IF EXISTS calculation_history CASCADE`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS client_configurations CASCADE`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS pricing_rules CASCADE`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS calculator_templates CASCADE`;
    
    console.log('   ✓ Dropped existing tables');
    
    // Run migration
    await applyCalculatorMigration();
  } catch (error) {
    console.error('❌ Force recreate failed:', error);
    throw error;
  }
}

async function checkMigrationStatus() {
  console.log('🔍 Checking migration status...');
  
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name, 
             CASE 
               WHEN table_name = 'calculator_templates' THEN 'Calculator Templates'
               WHEN table_name = 'pricing_rules' THEN 'Pricing Rules'
               WHEN table_name = 'client_configurations' THEN 'Client Configurations'
               WHEN table_name = 'calculation_history' THEN 'Calculation History'
               ELSE table_name
             END as description
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE 'calculator_%' 
           OR table_name LIKE 'pricing_%' 
           OR table_name LIKE 'client_%'
           OR table_name LIKE 'calculation_%')
      ORDER BY table_name
    `;

    if (Array.isArray(tables) && tables.length > 0) {
      console.log('✅ Calculator system tables found:');
      tables.forEach((table: any) => {
        console.log(`   • ${table.description} (${table.table_name})`);
      });

      // Get counts
      const templateCount = await prisma.calculatorTemplate.count();
      const ruleCount = await prisma.pricingRule.count();
      const configCount = await prisma.clientConfiguration.count();
      const historyCount = await prisma.calculationHistory.count();

      console.log('');
      console.log('📊 Data summary:');
      console.log(`   Templates: ${templateCount}`);
      console.log(`   Rules: ${ruleCount}`);
      console.log(`   Client Configs: ${configCount}`);
      console.log(`   History Records: ${historyCount}`);
    } else {
      console.log('❌ No calculator system tables found');
      console.log('   Run migration with: npm run migrate:calculator');
    }
  } catch (error) {
    console.log('❌ Unable to check migration status:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const forceFlag = args.includes('--force');
  const statusFlag = args.includes('--status');

  try {
    if (statusFlag) {
      await checkMigrationStatus();
    } else if (forceFlag) {
      await forceRecreate();
    } else {
      await applyCalculatorMigration();
    }
  } catch (error) {
    console.error('Migration script failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute if run directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { applyCalculatorMigration, forceRecreate, checkMigrationStatus };
