import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * API endpoint to provide database information for development verification
 * This helps verify that we're connected to the correct local database
 */
export async function GET(request: NextRequest) {
  try {
    // Only allow this endpoint in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'This endpoint is only available in development' },
        { status: 403 }
      )
    }

    // Get database information
    const result = await prisma.$queryRaw`
      SELECT 
        current_database() as database,
        current_user as user,
        version() as version,
        current_setting('server_version') as server_version
    ` as any[]

    const databaseInfo = result[0]

    // Check if we have the expected development database
    const isDevelopmentDatabase = databaseInfo.database === 'ready_set_dev'
    const isLocalhost = process.env.DATABASE_URL?.includes('localhost')

    return NextResponse.json({
      success: true,
      database: databaseInfo.database,
      user: databaseInfo.user,
      version: databaseInfo.version,
      serverVersion: databaseInfo.server_version,
      isDevelopmentDatabase,
      isLocalhost,
      environment: process.env.NODE_ENV,
      databaseUrl: process.env.DATABASE_URL?.replace(/:[^:]*@/, ':***@'), // Hide password
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Database info error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get database information',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
} 