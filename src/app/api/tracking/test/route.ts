import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// Database connection for tracking system
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// GET - Test tracking system connectivity and data
export async function GET(request: NextRequest) {
  try {
    const tests = [];
    
    // Test 1: Database connectivity
    try {
      const dbTest = await pool.query('SELECT NOW() as current_time, version() as db_version');
      tests.push({
        name: 'Database Connectivity',
        status: 'PASS',
        data: dbTest.rows[0]
      });
    } catch (error) {
      tests.push({
        name: 'Database Connectivity',
        status: 'FAIL',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 2: PostGIS Extension
    try {
      const postgisTest = await pool.query('SELECT PostGIS_Version() as postgis_version');
      tests.push({
        name: 'PostGIS Extension',
        status: 'PASS',
        data: postgisTest.rows[0]
      });
    } catch (error) {
      tests.push({
        name: 'PostGIS Extension',
        status: 'FAIL',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 3: Tables exist
    try {
      const tablesTest = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('drivers', 'driver_locations', 'deliveries', 'tracking_events', 'geofences')
        ORDER BY table_name
      `);
      
      const expectedTables = ['deliveries', 'driver_locations', 'drivers', 'geofences', 'tracking_events'];
      const foundTables = tablesTest.rows.map(row => row.table_name);
      const missingTables = expectedTables.filter(table => !foundTables.includes(table));
      
      tests.push({
        name: 'Required Tables',
        status: missingTables.length === 0 ? 'PASS' : 'FAIL',
        data: {
          found: foundTables,
          missing: missingTables,
          expected: expectedTables
        }
      });
    } catch (error) {
      tests.push({
        name: 'Required Tables',
        status: 'FAIL',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 4: Sample data counts
    try {
      const countsTest = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM drivers) as drivers_count,
          (SELECT COUNT(*) FROM deliveries) as deliveries_count,
          (SELECT COUNT(*) FROM driver_locations) as locations_count,
          (SELECT COUNT(*) FROM tracking_events) as events_count,
          (SELECT COUNT(*) FROM geofences) as geofences_count
      `);
      
      tests.push({
        name: 'Sample Data',
        status: 'PASS',
        data: countsTest.rows[0]
      });
    } catch (error) {
      tests.push({
        name: 'Sample Data',
        status: 'FAIL',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 5: Geographic queries
    try {
      const geoTest = await pool.query(`
        SELECT 
          employee_id,
          ST_AsText(last_known_location) as location_text,
          ST_AsGeoJSON(last_known_location) as location_geojson
        FROM drivers 
        WHERE last_known_location IS NOT NULL
        LIMIT 1
      `);
      
      tests.push({
        name: 'Geographic Queries',
        status: 'PASS',
        data: geoTest.rows[0] || { message: 'No location data found' }
      });
    } catch (error) {
      tests.push({
        name: 'Geographic Queries',
        status: 'FAIL',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 6: Recent activity
    try {
      const activityTest = await pool.query(`
        SELECT 
          d.employee_id,
          d.is_on_duty,
          d.last_location_update,
          COUNT(dl.id) as recent_location_updates
        FROM drivers d
        LEFT JOIN driver_locations dl ON d.id = dl.driver_id 
          AND dl.recorded_at >= NOW() - INTERVAL '1 hour'
        WHERE d.is_active = true
        GROUP BY d.id, d.employee_id, d.is_on_duty, d.last_location_update
        ORDER BY d.last_location_update DESC NULLS LAST
        LIMIT 3
      `);
      
      tests.push({
        name: 'Recent Activity',
        status: 'PASS',
        data: activityTest.rows
      });
    } catch (error) {
      tests.push({
        name: 'Recent Activity',
        status: 'FAIL',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Overall status
    const failedTests = tests.filter(test => test.status === 'FAIL');
    const overallStatus = failedTests.length === 0 ? 'HEALTHY' : 'ISSUES_DETECTED';

    return NextResponse.json({
      success: true,
      overall_status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: {
        node_env: process.env.NODE_ENV,
        database_url: process.env.DATABASE_URL ? 'SET' : 'NOT_SET'
      },
      tests,
      summary: {
        total_tests: tests.length,
        passed: tests.filter(test => test.status === 'PASS').length,
        failed: failedTests.length
      }
    });

  } catch (error) {
    console.error('Error running tracking system tests:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to run tracking system tests',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST - Run performance tests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { test_type = 'basic' } = body;

    const performanceTests = [];

    if (test_type === 'basic' || test_type === 'all') {
      // Test location insert performance
      const startTime = Date.now();
      
      try {
        // Get a test driver
        const driverResult = await pool.query('SELECT id FROM drivers LIMIT 1');
        if (driverResult.rows.length === 0) {
          throw new Error('No test drivers available');
        }
        
        const driverId = driverResult.rows[0].id;
        
        // Insert 10 test locations
        const insertPromises = [];
        for (let i = 0; i < 10; i++) {
          const lat = 30.2672 + (Math.random() - 0.5) * 0.01;
          const lng = -97.7431 + (Math.random() - 0.5) * 0.01;
          
          insertPromises.push(
            pool.query(`
              INSERT INTO driver_locations (driver_id, location, accuracy, speed, is_moving, recorded_at)
              VALUES ($1, ST_GeogFromText($2), $3, $4, $5, NOW())
            `, [driverId, `POINT(${lng} ${lat})`, 5.0, 25.5, true])
          );
        }
        
        await Promise.all(insertPromises);
        const endTime = Date.now();
        
        performanceTests.push({
          name: 'Location Insert Performance',
          status: 'PASS',
          duration_ms: endTime - startTime,
          operations: 10,
          ops_per_second: Math.round(10 / ((endTime - startTime) / 1000))
        });
      } catch (error) {
        performanceTests.push({
          name: 'Location Insert Performance',
          status: 'FAIL',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (test_type === 'spatial' || test_type === 'all') {
      // Test spatial queries
      const startTime = Date.now();
      
      try {
        await pool.query(`
          SELECT 
            d.employee_id,
            ST_Distance(d.last_known_location, ST_GeogFromText('POINT(-97.7431 30.2672)')) as distance_meters
          FROM drivers d
          WHERE 
            d.last_known_location IS NOT NULL
            AND ST_DWithin(d.last_known_location, ST_GeogFromText('POINT(-97.7431 30.2672)'), 10000)
          ORDER BY distance_meters
        `);
        
        const endTime = Date.now();
        
        performanceTests.push({
          name: 'Spatial Query Performance',
          status: 'PASS',
          duration_ms: endTime - startTime,
          description: 'Find drivers within 10km of Austin downtown'
        });
      } catch (error) {
        performanceTests.push({
          name: 'Spatial Query Performance',
          status: 'FAIL',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      test_type,
      timestamp: new Date().toISOString(),
      performance_tests: performanceTests,
      summary: {
        total_tests: performanceTests.length,
        passed: performanceTests.filter(test => test.status === 'PASS').length,
        failed: performanceTests.filter(test => test.status === 'FAIL').length
      }
    });

  } catch (error) {
    console.error('Error running performance tests:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to run performance tests',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 