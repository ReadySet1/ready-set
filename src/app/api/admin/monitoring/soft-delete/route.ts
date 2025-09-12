/**
 * Soft Delete Monitoring API
 * 
 * Provides endpoints for accessing soft delete monitoring data and alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { UserType } from '@/types/prisma';
import { SoftDeleteMonitoringService } from '@/lib/monitoring/softDeleteMonitoring';

/**
 * GET: Get monitoring dashboard data
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is ADMIN or SUPER_ADMIN
    const requesterProfile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { type: true }
    });

    if (!requesterProfile || ![UserType.ADMIN, UserType.SUPER_ADMIN].includes(requesterProfile.type)) {
      return NextResponse.json(
        { error: 'Forbidden: Only Admin or Super Admin can access monitoring data' },
        { status: 403 }
      );
    }

    // Get query parameters
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'dashboard';
    
    // Parse date range if provided
    const startTimeParam = url.searchParams.get('startTime');
    const endTimeParam = url.searchParams.get('endTime');
    
    let startTime: Date | undefined;
    let endTime: Date | undefined;
    
    if (startTimeParam) {
      startTime = new Date(startTimeParam);
      if (isNaN(startTime.getTime())) {
        return NextResponse.json(
          { error: 'Invalid startTime format. Use ISO 8601 format.' },
          { status: 400 }
        );
      }
    }
    
    if (endTimeParam) {
      endTime = new Date(endTimeParam);
      if (isNaN(endTime.getTime())) {
        return NextResponse.json(
          { error: 'Invalid endTime format. Use ISO 8601 format.' },
          { status: 400 }
        );
      }
    }

    let response: any;

    switch (type) {
      case 'dashboard':
        // Get comprehensive dashboard data
        response = await SoftDeleteMonitoringService.getDashboardData();
        break;
        
      case 'metrics':
        // Get metrics for specific time range
        if (!startTime || !endTime) {
          // Default to last 24 hours if no range specified
          endTime = new Date();
          startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
        }
        
        const metrics = await SoftDeleteMonitoringService.collectMetrics(startTime, endTime);
        response = {
          metrics,
          timeRange: {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
          },
          timestamp: new Date().toISOString(),
        };
        break;
        
      case 'alerts':
        // Run monitoring check and return alerts
        const monitoringResult = await SoftDeleteMonitoringService.runMonitoringCheck(startTime, endTime);
        response = {
          alerts: monitoringResult.alerts,
          metricsUsed: monitoringResult.metrics,
          timestamp: monitoringResult.timestamp,
        };
        break;
        
      case 'health':
        // Get system health summary
        const dashboardData = await SoftDeleteMonitoringService.getDashboardData();
        response = {
          systemHealth: dashboardData.systemHealth,
          summary: {
            last24Hours: {
              deletions: dashboardData.last24Hours.totalSoftDeletes,
              restores: dashboardData.last24Hours.totalRestores,
              complianceRate: dashboardData.last24Hours.retentionCompliance.percentageCompliant,
            },
            last7Days: {
              deletions: dashboardData.last7Days.totalSoftDeletes,
              restores: dashboardData.last7Days.totalRestores,
              complianceRate: dashboardData.last7Days.retentionCompliance.percentageCompliant,
            },
          },
          recentAlertsCount: dashboardData.recentAlerts.length,
          timestamp: new Date().toISOString(),
        };
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid type parameter. Use: dashboard, metrics, alerts, or health' },
          { status: 400 }
        );
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Soft delete monitoring API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get monitoring data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST: Trigger manual monitoring check
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is ADMIN or SUPER_ADMIN
    const requesterProfile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { type: true, email: true }
    });

    if (!requesterProfile || ![UserType.ADMIN, UserType.SUPER_ADMIN].includes(requesterProfile.type)) {
      return NextResponse.json(
        { error: 'Forbidden: Only Admin or Super Admin can trigger monitoring checks' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const {
      startTime: startTimeStr,
      endTime: endTimeStr,
      checkType = 'full', // 'full', 'metrics', 'alerts'
    } = body;

    // Parse dates if provided
    let startTime: Date | undefined;
    let endTime: Date | undefined;
    
    if (startTimeStr) {
      startTime = new Date(startTimeStr);
      if (isNaN(startTime.getTime())) {
        return NextResponse.json(
          { error: 'Invalid startTime format' },
          { status: 400 }
        );
      }
    }
    
    if (endTimeStr) {
      endTime = new Date(endTimeStr);
      if (isNaN(endTime.getTime())) {
        return NextResponse.json(
          { error: 'Invalid endTime format' },
          { status: 400 }
        );
      }
    }

    // Log the manual monitoring check
    console.log('Manual monitoring check initiated', {
      userId: user.id,
      userEmail: requesterProfile.email,
      checkType,
      startTime: startTime?.toISOString(),
      endTime: endTime?.toISOString(),
      timestamp: new Date().toISOString(),
    });

    // Create audit log
    await prisma.userAudit.create({
      data: {
        userId: user.id,
        action: 'MANUAL_MONITORING_CHECK',
        performedBy: user.id,
        changes: {
          operation: 'manual_monitoring_check',
          parameters: {
            checkType,
            startTime: startTime?.toISOString(),
            endTime: endTime?.toISOString(),
          },
        },
        reason: 'Manual monitoring check initiated by administrator',
        metadata: {
          operation: 'manual_monitoring_check',
          timestamp: new Date().toISOString(),
          userEmail: requesterProfile.email,
        },
      },
    });

    // Run the monitoring check
    let result: any;

    switch (checkType) {
      case 'metrics':
        const metrics = await SoftDeleteMonitoringService.collectMetrics(
          startTime || new Date(Date.now() - 24 * 60 * 60 * 1000),
          endTime || new Date()
        );
        result = {
          type: 'metrics',
          data: metrics,
        };
        break;
        
      case 'alerts':
        const alertCheck = await SoftDeleteMonitoringService.runMonitoringCheck(startTime, endTime);
        result = {
          type: 'alerts',
          data: {
            alerts: alertCheck.alerts,
            metrics: alertCheck.metrics,
          },
        };
        break;
        
      case 'full':
      default:
        const fullCheck = await SoftDeleteMonitoringService.getDashboardData();
        result = {
          type: 'full',
          data: fullCheck,
        };
        break;
    }

    // Log completion
    await prisma.userAudit.create({
      data: {
        userId: user.id,
        action: 'MANUAL_MONITORING_CHECK_COMPLETED',
        performedBy: user.id,
        changes: {
          operation: 'manual_monitoring_check',
          result: {
            checkType,
            alertsGenerated: result.data.recentAlerts?.length || result.data.alerts?.length || 0,
            success: true,
          },
        },
        reason: 'Manual monitoring check completed',
        metadata: {
          operation: 'manual_monitoring_check',
          timestamp: new Date().toISOString(),
          userEmail: requesterProfile.email,
        },
      },
    });

    return NextResponse.json({
      message: 'Manual monitoring check completed',
      result,
      performedBy: {
        id: user.id,
        email: requesterProfile.email,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Manual monitoring check API error:', error);
    return NextResponse.json(
      { 
        error: 'Manual monitoring check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
