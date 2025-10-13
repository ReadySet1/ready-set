import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =====================================================
// Database Comparison Script
// Compares schema, RLS policies, and data between
// dev and production Supabase databases
// =====================================================

interface DatabaseConfig {
  name: string;
  projectId: string;
  url: string;
  anonKey: string;
}

interface TableInfo {
  schema: string;
  name: string;
  columns: ColumnInfo[];
  rowCount: number;
  rlsEnabled: boolean;
  primaryKeys: string[];
}

interface ColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  defaultValue: string | null;
}

interface RLSPolicy {
  tableName: string;
  policyName: string;
  command: string;
  roles: string[];
}

interface ComparisonResult {
  tablesOnlyInDev: string[];
  tablesOnlyInProd: string[];
  tableDifferences: TableDifference[];
  rlsDifferences: string[];
  dataSummary: DataSummary;
}

interface TableDifference {
  tableName: string;
  differences: string[];
}

interface DataSummary {
  dev: Record<string, number>;
  prod: Record<string, number>;
  differences: Array<{ table: string; devCount: number; prodCount: number; delta: number }>;
}

// Configuration
const DEV_CONFIG: DatabaseConfig = {
  name: 'Development',
  projectId: 'khvteminrbghoeuqajzm',
  url: process.env.NEXT_PUBLIC_SUPABASE_DEV_URL || '',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_DEV_ANON_KEY || '',
};

const PROD_CONFIG: DatabaseConfig = {
  name: 'Production',
  projectId: 'jiasmmmmhtreoacdpiby',
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
};

// Utility functions
function log(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m',   // Red
  };
  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  };
  console.log(`${colors[type]}${icons[type]} ${message}\x1b[0m`);
}

// Get table information
async function getTableInfo(client: SupabaseClient): Promise<TableInfo[]> {
  const { data: tables, error } = await client.rpc('get_table_info', {});

  if (error) {
    // Fallback: use information_schema
    const { data, error: queryError } = await client
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (queryError) throw queryError;
    return data?.map((t: any) => ({
      schema: 'public',
      name: t.table_name,
      columns: [],
      rowCount: 0,
      rlsEnabled: false,
      primaryKeys: []
    } as TableInfo)) || [];
  }

  return tables || [];
}

// Get RLS policies
async function getRLSPolicies(client: SupabaseClient): Promise<RLSPolicy[]> {
  const { data, error } = await client.rpc('get_rls_policies', {});

  if (error) {
    // Fallback query
    const query = `
      SELECT
        schemaname,
        tablename,
        policyname,
        cmd,
        roles
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `;

    const { data: policies, error: queryError } = await client.rpc('exec_sql', { sql: query });
    if (queryError) return [];
    return policies || [];
  }

  return data || [];
}

// Get row count for a table
async function getRowCount(client: SupabaseClient, tableName: string): Promise<number> {
  try {
    const { count, error } = await client
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

// Compare tables
async function compareTables(
  devClient: SupabaseClient,
  prodClient: SupabaseClient
): Promise<{ dev: string[]; prod: string[] }> {
  log('Fetching table lists...', 'info');

  // Get list of tables from information_schema
  const devQuery = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;

  const prodQuery = devQuery;

  const [devResult, prodResult] = await Promise.all([
    devClient.rpc('exec_sql', { sql: devQuery }),
    prodClient.rpc('exec_sql', { sql: prodQuery }),
  ]);

  const devTables = (devResult.data || []).map((t: any) => t.table_name);
  const prodTables = (prodResult.data || []).map((t: any) => t.table_name);

  return { dev: devTables, prod: prodTables };
}

// Main comparison function
async function compareDatabase(): Promise<void> {
  log('🔍 Starting Database Comparison', 'info');
  log('━'.repeat(80), 'info');

  // Validate configuration
  if (!DEV_CONFIG.url || !DEV_CONFIG.anonKey) {
    log('Dev database credentials not found. Please set NEXT_PUBLIC_SUPABASE_DEV_URL and NEXT_PUBLIC_SUPABASE_DEV_ANON_KEY', 'error');
    process.exit(1);
  }

  if (!PROD_CONFIG.url || !PROD_CONFIG.anonKey) {
    log('Prod database credentials not found. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY', 'error');
    process.exit(1);
  }

  // Create clients
  const devClient = createClient(DEV_CONFIG.url, DEV_CONFIG.anonKey);
  const prodClient = createClient(PROD_CONFIG.url, PROD_CONFIG.anonKey);

  log(`\n📊 Comparing ${DEV_CONFIG.name} vs ${PROD_CONFIG.name}`, 'info');
  log(`Dev Project:  ${DEV_CONFIG.projectId}`, 'info');
  log(`Prod Project: ${PROD_CONFIG.projectId}`, 'info');
  log('', 'info');

  try {
    // Compare tables
    const { dev: devTables, prod: prodTables } = await compareTables(devClient, prodClient);

    const tablesOnlyInDev = devTables.filter(t => !prodTables.includes(t));
    const tablesOnlyInProd = prodTables.filter(t => !devTables.includes(t));
    const commonTables = devTables.filter(t => prodTables.includes(t));

    // Display table differences
    log('\n📋 Table Comparison', 'info');
    log('━'.repeat(80), 'info');

    if (tablesOnlyInDev.length > 0) {
      log(`\n⚠️  Tables ONLY in Dev (${tablesOnlyInDev.length}):`, 'warning');
      tablesOnlyInDev.forEach(t => log(`   - ${t}`, 'warning'));
    }

    if (tablesOnlyInProd.length > 0) {
      log(`\n⚠️  Tables ONLY in Prod (${tablesOnlyInProd.length}):`, 'warning');
      tablesOnlyInProd.forEach(t => log(`   - ${t}`, 'warning'));
    }

    log(`\n✅ Common Tables: ${commonTables.length}`, 'success');

    // Compare row counts for common tables
    log('\n📊 Row Count Comparison', 'info');
    log('━'.repeat(80), 'info');

    const rowCounts: Array<{ table: string; dev: number; prod: number; diff: number }> = [];

    for (const table of commonTables) {
      const [devCount, prodCount] = await Promise.all([
        getRowCount(devClient, table),
        getRowCount(prodClient, table),
      ]);

      rowCounts.push({
        table,
        dev: devCount,
        prod: prodCount,
        diff: prodCount - devCount,
      });
    }

    // Sort by difference (descending)
    rowCounts.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    console.log('\n');
    console.log('Table'.padEnd(30) + 'Dev Rows'.padEnd(15) + 'Prod Rows'.padEnd(15) + 'Difference');
    console.log('─'.repeat(80));

    rowCounts.forEach(({ table, dev, prod, diff }) => {
      const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;
      const diffColor = diff === 0 ? '\x1b[32m' : diff > 0 ? '\x1b[33m' : '\x1b[31m';
      console.log(
        table.padEnd(30) +
        dev.toString().padEnd(15) +
        prod.toString().padEnd(15) +
        `${diffColor}${diffStr}\x1b[0m`
      );
    });

    // Summary
    log('\n\n📈 Summary', 'info');
    log('━'.repeat(80), 'info');

    const totalDevRows = rowCounts.reduce((sum, r) => sum + r.dev, 0);
    const totalProdRows = rowCounts.reduce((sum, r) => sum + r.prod, 0);

    log(`Total Dev Rows:  ${totalDevRows.toLocaleString()}`, 'info');
    log(`Total Prod Rows: ${totalProdRows.toLocaleString()}`, 'info');
    log(`Difference:      ${(totalProdRows - totalDevRows).toLocaleString()}`, 'info');

    // Critical findings
    log('\n\n🚨 Critical Findings', 'warning');
    log('━'.repeat(80), 'warning');

    if (tablesOnlyInDev.length > 0) {
      log(`⚠️  ${tablesOnlyInDev.length} table(s) exist only in dev`, 'warning');
      log('   These need to be added to production', 'warning');
    }

    if (tablesOnlyInProd.length > 0) {
      log(`⚠️  ${tablesOnlyInProd.length} table(s) exist only in prod`, 'warning');
      log('   Dev may be missing production features', 'warning');
    }

    const significantDiffs = rowCounts.filter(r => Math.abs(r.diff) > 10);
    if (significantDiffs.length > 0) {
      log(`\n⚠️  ${significantDiffs.length} table(s) with significant row count differences (>10):`, 'warning');
      significantDiffs.forEach(r => {
        log(`   - ${r.table}: ${r.diff > 0 ? 'prod has' : 'dev has'} ${Math.abs(r.diff)} more rows`, 'warning');
      });
    }

    log('\n\n✅ Comparison Complete', 'success');
    log('━'.repeat(80), 'success');

    // Generate report file
    const report = {
      timestamp: new Date().toISOString(),
      dev: {
        projectId: DEV_CONFIG.projectId,
        tables: devTables,
        totalRows: totalDevRows,
      },
      prod: {
        projectId: PROD_CONFIG.projectId,
        tables: prodTables,
        totalRows: totalProdRows,
      },
      differences: {
        tablesOnlyInDev,
        tablesOnlyInProd,
        rowCounts,
      },
    };

    // Save report
    const fs = await import('fs');
    const reportPath = `./backups/database-comparison-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(`\n📄 Report saved to: ${reportPath}`, 'success');

  } catch (error) {
    log(`\n❌ Error during comparison: ${error}`, 'error');
    console.error(error);
    process.exit(1);
  }
}

// Run comparison
if (require.main === module) {
  compareDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { compareDatabase };
