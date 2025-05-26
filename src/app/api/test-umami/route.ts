import { NextRequest, NextResponse } from 'next/server';
import { CONSTANTS } from '@/constants';

/**
 * Test API route to verify Umami self-hosted instance connectivity
 */
export async function GET(request: NextRequest) {
  try {
    const testResults = {
      timestamp: new Date().toISOString(),
      umamiHost: CONSTANTS.UMAMI_HOST_URL,
      websiteId: CONSTANTS.UMAMI_WEBSITE_ID,
      tests: [] as Array<{name: string, status: string, details?: string}>
    };

    // Test 1: Check if script.js is accessible
    try {
      const scriptResponse = await fetch(`${CONSTANTS.UMAMI_HOST_URL}/script.js`, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Ready-Set-LLC-Test/1.0'
        }
      });
      
      testResults.tests.push({
        name: 'Script Accessibility',
        status: scriptResponse.ok ? 'PASS' : 'FAIL',
        details: `HTTP ${scriptResponse.status} - ${scriptResponse.statusText}`
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Script Accessibility',
        status: 'FAIL',
        details: error instanceof Error ? error.message : String(error)
      });
    }

    // Test 2: Check if the main site is accessible
    try {
      const siteResponse = await fetch(`${CONSTANTS.UMAMI_HOST_URL}`, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Ready-Set-LLC-Test/1.0'
        }
      });
      
      testResults.tests.push({
        name: 'Site Accessibility',
        status: siteResponse.ok ? 'PASS' : 'FAIL',
        details: `HTTP ${siteResponse.status} - ${siteResponse.statusText}`
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Site Accessibility',
        status: 'FAIL',
        details: error instanceof Error ? error.message : String(error)
      });
    }

    // Test 3: Domain validation
    const currentDomain = request.headers.get('host') || 'unknown';
    testResults.tests.push({
      name: 'Domain Check',
      status: 'INFO',
      details: `Current domain: ${currentDomain}`
    });

    // Test 4: Check for CORS issues
    try {
      const corsTest = await fetch(`${CONSTANTS.UMAMI_HOST_URL}/script.js`, {
        method: 'GET',
        headers: {
          'Origin': `https://${currentDomain}`,
          'User-Agent': 'Ready-Set-LLC-Test/1.0'
        }
      });
      
      const corsHeaders = corsTest.headers.get('access-control-allow-origin');
      testResults.tests.push({
        name: 'CORS Check',
        status: corsTest.ok ? 'PASS' : 'FAIL',
        details: `CORS header: ${corsHeaders || 'Not set'}`
      });
    } catch (error) {
      testResults.tests.push({
        name: 'CORS Check',
        status: 'FAIL',
        details: error instanceof Error ? error.message : String(error)
      });
    }

    return NextResponse.json(testResults, { status: 200 });
  } catch (error) {
    console.error('Error in test-umami API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
} 