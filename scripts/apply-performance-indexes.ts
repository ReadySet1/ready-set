#!/usr/bin/env tsx
/**
 * Database Performance Optimization Script
 * Phase 3: Database & Performance
 * 
 * This script applies the performance indexes created in migrations/add-performance-indexes.sql
 * with progress tracking, error handling, and rollback capability.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

interface IndexCreationResult {
  index: string;
  table: string;
  status: 'success' | 'failed' | 'exists';
  duration?: number;
  error?: string;
}

interface PerformanceReport {
  totalIndexes: number;
  successful: number;
  failed: number;
  skipped: number;
  totalDuration: number;
  results: IndexCreationResult[];
}

class DatabasePerformanceOptimizer {
  private databaseUrl: string;
  private migrationFile: string;
  private report: PerformanceReport;

  constructor() {
    this.databaseUrl = process.env.DATABASE_URL || '';
    this.migrationFile = join(process.cwd(), 'migrations', 'add-performance-indexes.sql');
    this.report = {
      totalIndexes: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      totalDuration: 0,
      results: []
    };

    if (!this.databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    if (!existsSync(this.migrationFile)) {
      throw new Error(`Migration file not found: ${this.migrationFile}`);
    }
  }

  /**
   * Main execution method
   */
  async run(): Promise<void> {
    console.log('🚀 Starting Database Performance Optimization...\n');
    
    try {
      await this.checkDatabaseConnection();
      await this.createBackup();
      await this.analyzeCurrentState();
      await this.applyIndexes();
      await this.verifyIndexes();
      await this.analyzePerformanceImprovement();
      this.generateReport();
      
      console.log('\n✅ Database performance optimization completed successfully!');
    } catch (error) {
      console.error('\n❌ Optimization failed:', error);
      await this.rollback();
      process.exit(1);
    }
  }

  /**
   * Check database connectivity
   */
  private async checkDatabaseConnection(): Promise<void> {
    console.log('🔍 Checking database connection...');
    
    try {
      const { stdout } = await execAsync(
        `psql "${this.databaseUrl}" -c "SELECT version();" -t`
      );
      console.log('✅ Database connection successful');
      console.log(`📊 Database version: ${stdout.trim()}\n`);
    } catch (error) {
      throw new Error(`Failed to connect to database: ${error}`);
    }
  }

  /**
   * Create database backup before changes
   */
  private async createBackup(): Promise<void> {
    console.log('📦 Creating database backup...');
    
    const backupFile = `backup-before-optimization-${Date.now()}.sql`;
    
    try {
      await execAsync(
        `pg_dump "${this.databaseUrl}" > ${backupFile}`
      );
      console.log(`✅ Backup created: ${backupFile}\n`);
    } catch (error) {
      throw new Error(`Failed to create backup: ${error}`);
    }
  }

  /**
   * Analyze current database state
   */
  private async analyzeCurrentState(): Promise<void> {
    console.log('📊 Analyzing current database state...');
    
    try {
      // Get current index count
      const { stdout: indexCount } = await execAsync(
        `psql "${this.databaseUrl}" -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';" -t`
      );

      // Get current table sizes
      const { stdout: tableStats } = await execAsync(
        `psql "${this.databaseUrl}" -c "
          SELECT 
            schemaname||'.'||tablename as table_name,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
          FROM pg_stat_user_tables 
          ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC 
          LIMIT 5;
        " -t`
      );

      console.log(`📈 Current indexes: ${indexCount.trim()}`);
      console.log('📋 Largest tables:');
      console.log(tableStats);
      console.log('');
    } catch (error) {
      console.warn('⚠️ Could not analyze current state:', error);
    }
  }

  /**
   * Apply performance indexes
   */
  private async applyIndexes(): Promise<void> {
    console.log('🔧 Applying performance indexes...');
    
    const migrationContent = readFileSync(this.migrationFile, 'utf-8');
    
    // Extract individual CREATE INDEX statements
    const indexStatements = migrationContent
      .split('\n')
      .filter(line => line.trim().startsWith('CREATE INDEX CONCURRENTLY'))
      .map(line => line.trim().replace(/;$/, ''));

    this.report.totalIndexes = indexStatements.length;
    console.log(`📝 Found ${indexStatements.length} indexes to create\n`);

    for (const [index, statement] of indexStatements.entries()) {
      await this.createSingleIndex(statement, index + 1);
    }

    // Run ANALYZE after all indexes
    console.log('\n🔄 Analyzing tables for optimal query planning...');
    await this.runAnalyze();
  }

  /**
   * Create a single index with progress tracking
   */
  private async createSingleIndex(statement: string, indexNumber: number): Promise<void> {
    const indexNameMatch = statement.match(/CREATE INDEX CONCURRENTLY[^"]*"([^"]+)"/);
    const indexName = indexNameMatch?.[1] ?? `index_${indexNumber}`;
    
    const tableNameMatch = statement.match(/ON\s+"([^"]+)"/);
    const tableName = tableNameMatch?.[1] ?? 'unknown';

    const startTime = Date.now();
    
    console.log(`[${indexNumber}/${this.report.totalIndexes}] Creating ${indexName}...`);

    try {
      // Check if index already exists
      const { stdout: exists } = await execAsync(
        `psql "${this.databaseUrl}" -c "
          SELECT 1 FROM pg_indexes 
          WHERE indexname = '${indexName}' AND schemaname = 'public';
        " -t`
      );

      if (exists.trim()) {
        console.log(`   ⏭️ Index ${indexName} already exists - skipping`);
        this.report.skipped++;
        this.report.results.push({
          index: indexName,
          table: tableName,
          status: 'exists'
        });
        return;
      }

      // Create the index
      await execAsync(
        `psql "${this.databaseUrl}" -c "${statement};" -q`
      );

      const duration = Date.now() - startTime;
      this.report.totalDuration += duration;
      this.report.successful++;

      console.log(`   ✅ Created ${indexName} in ${duration}ms`);
      
      this.report.results.push({
        index: indexName,
        table: tableName,
        status: 'success',
        duration
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.report.failed++;

      console.log(`   ❌ Failed to create ${indexName}: ${error}`);
      
      this.report.results.push({
        index: indexName,
        table: tableName,
        status: 'failed',
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Run ANALYZE on all tables
   */
  private async runAnalyze(): Promise<void> {
    try {
      await execAsync(
        `psql "${this.databaseUrl}" -c "ANALYZE;" -q`
      );
      console.log('✅ Table analysis completed');
    } catch (error) {
      console.warn('⚠️ Table analysis failed:', error);
    }
  }

  /**
   * Verify created indexes
   */
  private async verifyIndexes(): Promise<void> {
    console.log('\n🔍 Verifying created indexes...');
    
    try {
      const { stdout } = await execAsync(
        `psql "${this.databaseUrl}" -c "
          SELECT 
            indexname,
            tablename,
            pg_size_pretty(pg_relation_size(indexname::regclass)) as size
          FROM pg_indexes 
          WHERE schemaname = 'public' 
            AND indexname LIKE 'idx_%'
          ORDER BY pg_relation_size(indexname::regclass) DESC;
        " -t`
      );

      console.log('📊 Created indexes:');
      console.log(stdout || 'No new indexes found');
    } catch (error) {
      console.warn('⚠️ Could not verify indexes:', error);
    }
  }

  /**
   * Analyze performance improvement
   */
  private async analyzePerformanceImprovement(): Promise<void> {
    console.log('\n📈 Analyzing performance improvements...');
    
    try {
      // Get updated index count
      const { stdout: newIndexCount } = await execAsync(
        `psql "${this.databaseUrl}" -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';" -t`
      );

      // Get index usage statistics
      const { stdout: indexUsage } = await execAsync(
        `psql "${this.databaseUrl}" -c "
          SELECT 
            indexname,
            idx_scan,
            idx_tup_read,
            idx_tup_fetch
          FROM pg_stat_user_indexes 
          WHERE indexname LIKE 'idx_%'
          ORDER BY idx_scan DESC
          LIMIT 10;
        " -t`
      );

      console.log(`📊 Total indexes after optimization: ${newIndexCount.trim()}`);
      console.log('🔥 Top index usage (may be empty for new indexes):');
      console.log(indexUsage || 'No usage data yet (indexes are new)');
    } catch (error) {
      console.warn('⚠️ Could not analyze performance improvement:', error);
    }
  }

  /**
   * Generate final report
   */
  private generateReport(): void {
    console.log('\n📋 Optimization Report');
    console.log('==========================================');
    console.log(`Total indexes processed: ${this.report.totalIndexes}`);
    console.log(`✅ Successfully created: ${this.report.successful}`);
    console.log(`⏭️ Skipped (already exist): ${this.report.skipped}`);
    console.log(`❌ Failed: ${this.report.failed}`);
    console.log(`⏱️ Total duration: ${this.report.totalDuration}ms`);
    
    if (this.report.failed > 0) {
      console.log('\n❌ Failed Indexes:');
      this.report.results
        .filter(r => r.status === 'failed')
        .forEach(r => {
          console.log(`   - ${r.index} on ${r.table}: ${r.error}`);
        });
    }

    if (this.report.successful > 0) {
      console.log('\n✅ Performance optimizations applied successfully!');
      console.log('   - Query performance should improve for filtered and sorted operations');
      console.log('   - Pagination and search operations will be faster');
      console.log('   - Join operations between related tables optimized');
      console.log('   - Dashboard and analytics queries accelerated');
    }

    console.log('\n🔍 Next Steps:');
    console.log('   - Monitor query performance using /api/health/database');
    console.log('   - Watch for slow query warnings in application logs');
    console.log('   - Consider additional indexes based on usage patterns');
    console.log('   - Test application performance under load');
  }

  /**
   * Rollback in case of critical failure
   */
  private async rollback(): Promise<void> {
    console.log('\n🔄 Rolling back changes...');
    
    // Remove any successfully created indexes
    const successfulIndexes = this.report.results
      .filter(r => r.status === 'success')
      .map(r => r.index);

    for (const indexName of successfulIndexes) {
      try {
        await execAsync(
          `psql "${this.databaseUrl}" -c "DROP INDEX CONCURRENTLY IF EXISTS \\"${indexName}\\";" -q`
        );
        console.log(`   🗑️ Removed ${indexName}`);
      } catch (error) {
        console.warn(`   ⚠️ Could not remove ${indexName}:`, error);
      }
    }

    console.log('⏪ Rollback completed');
  }
}

// Main execution
async function main() {
  try {
    const optimizer = new DatabasePerformanceOptimizer();
    await optimizer.run();
  } catch (error) {
    console.error('💥 Script execution failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { DatabasePerformanceOptimizer }; 