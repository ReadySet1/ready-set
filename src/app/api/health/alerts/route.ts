// src/app/api/health/alerts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { 
  getActiveAlerts, 
  getRecentAlerts, 
  resolveAlert, 
  getAlertsByType, 
  getAlertsBySeverity,
  getAlertStatistics,
  AlertType,
  AlertSeverity 
} from '@/lib/alerting';
import { addSecurityHeaders } from '@/lib/auth-middleware';
import { createClient } from '@/utils/supabase/server';

/**
 * GET - Get alerts with optional filtering
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = performance.now();
  
  try {
    // Check authentication and admin access
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user?.id) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter'); // 'active', 'recent', 'type', 'severity'
    const type = searchParams.get('type') as AlertType;
    const severity = searchParams.get('severity') as AlertSeverity;
    const limit = parseInt(searchParams.get('limit') || '50');

    let alerts: any[] = [];
    let filterDescription = '';

    // Apply filters
    switch (filter) {
      case 'active':
        alerts = getActiveAlerts();
        filterDescription = 'Active alerts';
        break;
      case 'type':
        if (type && Object.values(AlertType).includes(type)) {
          alerts = getAlertsByType(type);
          filterDescription = `Alerts of type: ${type}`;
        } else {
          alerts = getRecentAlerts(limit);
          filterDescription = 'Recent alerts (invalid type filter)';
        }
        break;
      case 'severity':
        if (severity && Object.values(AlertSeverity).includes(severity)) {
          alerts = getAlertsBySeverity(severity);
          filterDescription = `Alerts with severity: ${severity}`;
        } else {
          alerts = getRecentAlerts(limit);
          filterDescription = 'Recent alerts (invalid severity filter)';
        }
        break;
      default:
        alerts = getRecentAlerts(limit);
        filterDescription = 'Recent alerts';
    }

    // Get alert statistics
    const statistics = getAlertStatistics();

    const responseTime = performance.now() - startTime;

    const response = NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime.toFixed(2)}ms`,
      filter: {
        applied: filter || 'recent',
        type,
        severity,
        limit,
        description: filterDescription
      },
      statistics,
      count: alerts.length,
      alerts: alerts.map(alert => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        timestamp: alert.timestamp,
        resolved: alert.resolved,
        resolvedAt: alert.resolvedAt,
        resolvedBy: alert.resolvedBy,
        source: alert.source,
        fingerprint: alert.fingerprint,
        data: alert.data
      }))
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Response-Time': `${responseTime.toFixed(2)}ms`
      }
    });

    return addSecurityHeaders(response);

  } catch (error) {
    const responseTime = performance.now() - startTime;
    
    const response = NextResponse.json({
      success: false,
      error: 'Failed to retrieve alerts',
      details: error instanceof Error ? error.message : 'Unknown error',
      responseTime: `${responseTime.toFixed(2)}ms`
    }, { status: 500 });

    return addSecurityHeaders(response);
  }
}

/**
 * POST - Resolve alerts or manage alert operations
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = performance.now();
  
  try {
    // Check authentication and admin access
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user?.id) {
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

    // Parse request body
    const body = await request.json();
    const { action, alertId, alertIds } = body;

    const resolvedBy = user.email || user.id;
    let result: any = {};

    switch (action) {
      case 'resolve':
        if (alertId) {
          // Resolve single alert
          const resolved = resolveAlert(alertId, resolvedBy);
          result = {
            action: 'resolve',
            alertId,
            resolved,
            resolvedBy,
            message: resolved ? 'Alert resolved successfully' : 'Alert not found or already resolved'
          };
        } else if (alertIds && Array.isArray(alertIds)) {
          // Resolve multiple alerts
          const results = alertIds.map(id => ({
            alertId: id,
            resolved: resolveAlert(id, resolvedBy)
          }));
          const resolvedCount = results.filter(r => r.resolved).length;
          
          result = {
            action: 'resolve',
            alertIds,
            results,
            resolvedCount,
            totalCount: alertIds.length,
            resolvedBy,
            message: `${resolvedCount}/${alertIds.length} alerts resolved successfully`
          };
        } else {
          const response = NextResponse.json({
            success: false,
            error: 'Missing alertId or alertIds for resolve action'
          }, { status: 400 });
          return addSecurityHeaders(response);
        }
        break;

      case 'statistics':
        // Get fresh statistics
        result = {
          action: 'statistics',
          statistics: getAlertStatistics(),
          timestamp: new Date().toISOString()
        };
        break;

      default:
        const response = NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: resolve, statistics'
        }, { status: 400 });
        return addSecurityHeaders(response);
    }

    const responseTime = performance.now() - startTime;

    const response = NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime.toFixed(2)}ms`,
      result
    });

    return addSecurityHeaders(response);

  } catch (error) {
    const responseTime = performance.now() - startTime;
    
    const response = NextResponse.json({
      success: false,
      error: 'Failed to process alert operation',
      details: error instanceof Error ? error.message : 'Unknown error',
      responseTime: `${responseTime.toFixed(2)}ms`
    }, { status: 500 });

    return addSecurityHeaders(response);
  }
}

/**
 * DELETE - Bulk operations or cleanup
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const startTime = performance.now();
  
  try {
    // Check authentication and admin access
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return addSecurityHeaders(response);
    }

    // Check if user has admin privileges (only SUPER_ADMIN can delete)
    const { data: profile } = await supabase
      .from('profiles')
      .select('type')
      .eq('id', user.id)
      .single();

    if (!profile?.type || profile.type !== 'SUPER_ADMIN') {
      const response = NextResponse.json({ error: "Insufficient permissions - Super Admin required" }, { status: 403 });
      return addSecurityHeaders(response);
    }

    // Parse request body
    const body = await request.json();
    const { operation } = body;

    let result: any = {};

    switch (operation) {
      case 'resolve_all_active':
        // Resolve all active alerts
        const activeAlerts = getActiveAlerts();
        const resolvedBy = user.email || user.id;
        
        let resolvedCount = 0;
        activeAlerts.forEach(alert => {
          if (resolveAlert(alert.id, resolvedBy)) {
            resolvedCount++;
          }
        });

        result = {
          operation: 'resolve_all_active',
          totalActive: activeAlerts.length,
          resolved: resolvedCount,
          resolvedBy,
          message: `${resolvedCount}/${activeAlerts.length} active alerts resolved`
        };
        break;

      default:
        const response = NextResponse.json({
          success: false,
          error: 'Invalid operation. Supported operations: resolve_all_active'
        }, { status: 400 });
        return addSecurityHeaders(response);
    }

    const responseTime = performance.now() - startTime;

    const response = NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime.toFixed(2)}ms`,
      result
    });

    return addSecurityHeaders(response);

  } catch (error) {
    const responseTime = performance.now() - startTime;
    
    const response = NextResponse.json({
      success: false,
      error: 'Failed to process bulk alert operation',
      details: error instanceof Error ? error.message : 'Unknown error',
      responseTime: `${responseTime.toFixed(2)}ms`
    }, { status: 500 });

    return addSecurityHeaders(response);
  }
} 