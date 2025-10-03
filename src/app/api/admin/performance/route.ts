// app/api/admin/performance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getDashboardPerformanceReport, getCachePerformanceReport } from '@/lib/monitoring/dashboard-performance';

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, type')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.type) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const userType = profile.type as string;
    if (!['ADMIN', 'SUPER_ADMIN', 'HELPDESK'].includes(userType)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get performance reports
    const dashboardReport = getDashboardPerformanceReport();
    const cacheReport = getCachePerformanceReport();

    const performanceData = {
      timestamp: new Date().toISOString(),
      dashboard: dashboardReport,
      cache: cacheReport,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV
      }
    };

    return NextResponse.json(performanceData, {
      headers: {
        'Cache-Control': 'no-cache',
        'X-Response-Time': `${Date.now() - Date.parse(performanceData.timestamp)}ms`,
      },
    });

  } catch (error) {
    console.error('Failed to fetch performance metrics:', error);

    return NextResponse.json(
      { error: 'Failed to fetch performance metrics' },
      { status: 500 }
    );
  }
}

