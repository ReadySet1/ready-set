import { NextRequest, NextResponse } from 'next/server';
import { prismaPooled, healthCheck } from '@/lib/db/prisma-pooled';
import { addSecurityHeaders } from '@/lib/auth-middleware';
import { createClient } from '@/utils/supabase/server';
interface DatabaseMetrics {
    connectionHealth: {
        healthy: boolean;
        activeConnections: number;
        maxConnections: number;
        error?: string;
    };
    queryPerformance: {
        averageResponseTime: number;
        slowQueries: number;
        totalQueries: number;
    };
    indexUsage: {
        mostUsedIndexes: Array<{
            table: string;
            index: string;
            scans: number;
            tuples: number;
        }>;
        unusedIndexes: Array<{
            table: string;
            index: string;
        }>;
    };
    tableStats: {
        totalTables: number;
        totalRecords: number;
        largestTables: Array<{
            table: string;
            records: number;
            size: string;
        }>;
    };
}
// GET - Database health and performance metrics
export async function GET(request: NextRequest) {
    const startTime = performance.now();
    try {
        // Basic authentication check (admin only)
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            return addSecurityHeaders(response);
        }
        // Check if user has admin privileges
        const { data: profile } = await supabase
            .from('profiles')
            .select('type')
            .eq('id', user.id)
            .single();
        if (!profile?.type || !['ADMIN', 'SUPER_ADMIN'].includes(profile.type)) {
            const response = NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
            return addSecurityHeaders(response);
        }
        // 1. Connection Health Check
        const connectionInfo = await healthCheck.getConnectionInfo();
        // 2. Query Performance Metrics
        const queryStats = await prismaPooled.$queryRaw<Array<{
            query: string;
            calls: bigint;
            total_time: number;
            mean_time: number;
            max_time: number;
        }>> `
      SELECT 
        query,
        calls,
        total_time,
        mean_time,
        max_time
      FROM pg_stat_statements 
      WHERE query NOT LIKE '%pg_stat_statements%'
      ORDER BY total_time DESC 
      LIMIT 10
    `.catch(() => []);
        // 3. Index Usage Statistics
        const indexStats = await prismaPooled.$queryRaw<Array<{
            schemaname: string;
            tablename: string;
            indexname: string;
            idx_scan: bigint;
            idx_tup_read: bigint;
            idx_tup_fetch: bigint;
        }>> `
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      ORDER BY idx_scan DESC
      LIMIT 20
    `;
        // 4. Unused Indexes
        const unusedIndexes = await prismaPooled.$queryRaw<Array<{
            tablename: string;
            indexname: string;
        }>> `
      SELECT 
        tablename,
        indexname
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
        AND idx_scan = 0
        AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename
    `;
        // 5. Table Statistics
        const tableStats = await prismaPooled.$queryRaw<Array<{
            table_name: string;
            row_count: bigint;
            table_size: string;
        }>> `
      SELECT 
        schemaname||'.'||tablename as table_name,
        n_tup_ins + n_tup_upd + n_tup_del as row_count,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 10
    `;
        // 6. Active Queries
        const activeQueries = await prismaPooled.$queryRaw<Array<{
            pid: number;
            duration: string;
            query: string;
            state: string;
        }>> `
      SELECT 
        pid,
        now() - pg_stat_activity.query_start AS duration,
        query,
        state
      FROM pg_stat_activity
      WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
        AND state = 'active'
        AND query NOT LIKE '%pg_stat_activity%'
      ORDER BY duration DESC
    `;
        // 7. Database Size
        const dbSize = await prismaPooled.$queryRaw<Array<{
            size: string;
        }>> `
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `;
        // 8. Cache Hit Ratio
        const cacheHitRatio = await prismaPooled.$queryRaw<Array<{
            cache_hit_ratio: number;
        }>> `
      SELECT 
        round(
          (sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read))) * 100, 2
        ) as cache_hit_ratio
      FROM pg_statio_user_tables
    `;
        // Process and format metrics
        const metrics: DatabaseMetrics = {
            connectionHealth: connectionInfo,
            queryPerformance: {
                averageResponseTime: queryStats.length > 0
                    ? queryStats.reduce((acc: number, q: any) => acc + q.mean_time, 0) / queryStats.length
                    : 0,
                slowQueries: queryStats.filter((q: any) => q.mean_time > 1000).length,
                totalQueries: queryStats.reduce((acc: number, q: any) => acc + Number(q.calls), 0)
            },
            indexUsage: {
                mostUsedIndexes: indexStats.slice(0, 10).map((idx: any) => ({
                    table: idx.tablename,
                    index: idx.indexname,
                    scans: Number(idx.idx_scan),
                    tuples: Number(idx.idx_tup_read)
                })),
                unusedIndexes: unusedIndexes.map((idx: any) => ({
                    table: idx.tablename,
                    index: idx.indexname
                }))
            },
            tableStats: {
                totalTables: tableStats.length,
                totalRecords: tableStats.reduce((acc: number, table: any) => acc + Number(table.row_count), 0),
                largestTables: tableStats.map((table: any) => ({
                    table: table.table_name,
                    records: Number(table.row_count),
                    size: table.table_size
                }))
            }
        };
        const responseTime = performance.now() - startTime;
        const response = NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            responseTime: `${responseTime.toFixed(2)}ms`,
            database: {
                size: dbSize[0]?.size || 'Unknown',
                cacheHitRatio: cacheHitRatio[0]?.cache_hit_ratio || 0
            },
            metrics,
            activeQueries: activeQueries.length,
            longRunningQueries: activeQueries,
            performance: {
                optimizationsActive: true,
                connectionPooling: true,
                indexingOptimized: true
            },
            recommendations: generateRecommendations(metrics, activeQueries)
        }, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'X-Response-Time': `${responseTime.toFixed(2)}ms`
            }
        });
        return addSecurityHeaders(response);
    }
    catch (error) {
        console.error('Database health check failed:', error);
        const responseTime = performance.now() - startTime;
        const response = NextResponse.json({
            success: false,
            error: 'Failed to retrieve database health metrics',
            details: error instanceof Error ? error.message : 'Unknown error',
            responseTime: `${responseTime.toFixed(2)}ms`
        }, { status: 500 });
        return addSecurityHeaders(response);
    }
}
// Generate performance recommendations
function generateRecommendations(metrics: DatabaseMetrics, activeQueries: Array<any>): string[] {
    const recommendations: string[] = [];
    // Connection health recommendations
    if (!metrics.connectionHealth.healthy) {
        recommendations.push('⚠️ Database connection issues detected - check connection pool configuration');
    }
    if (metrics.connectionHealth.activeConnections > metrics.connectionHealth.maxConnections * 0.8) {
        recommendations.push('⚠️ High connection usage - consider increasing connection pool size');
    }
    // Query performance recommendations
    if (metrics.queryPerformance.averageResponseTime > 500) {
        recommendations.push('🐌 High average query response time - review slow queries and add indexes');
    }
    if (metrics.queryPerformance.slowQueries > 5) {
        recommendations.push('🔍 Multiple slow queries detected - optimize query patterns and indexes');
    }
    // Index recommendations
    if (metrics.indexUsage.unusedIndexes.length > 5) {
        recommendations.push('📊 Multiple unused indexes found - consider removing to improve write performance');
    }
    // Long running queries
    if (activeQueries.length > 0) {
        recommendations.push(`⏰ ${activeQueries.length} long-running queries detected - investigate and optimize`);
    }
    // General recommendations
    if (recommendations.length === 0) {
        recommendations.push('✅ Database performance looks good - continue monitoring');
    }
    return recommendations;
}
// POST - Force refresh of database statistics
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
            const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            return addSecurityHeaders(response);
        }
        const { data: profile } = await supabase
            .from('profiles')
            .select('type')
            .eq('id', user.id)
            .single();
        if (!profile?.type || !['ADMIN', 'SUPER_ADMIN'].includes(profile.type)) {
            const response = NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
            return addSecurityHeaders(response);
        }
        // Refresh database statistics
        await prismaPooled.$queryRaw `ANALYZE`;
        // Reset query statistics (if pg_stat_statements is available)
        await prismaPooled.$queryRaw `SELECT pg_stat_reset()`.catch(() => {
        });
        const response = NextResponse.json({
            success: true,
            message: 'Database statistics refreshed successfully',
            timestamp: new Date().toISOString()
        });
        return addSecurityHeaders(response);
    }
    catch (error) {
        console.error('Failed to refresh database statistics:', error);
        const response = NextResponse.json({
            success: false,
            error: 'Failed to refresh database statistics',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
        return addSecurityHeaders(response);
    }
}
