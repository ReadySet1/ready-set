import { NextRequest, NextResponse } from 'next/server';

interface TestResult {
  url: string;
  method: string;
  headers: Record<string, string>;
  connectivity: {
    connected: boolean;
    latencyMs?: number;
    error?: string;
    httpStatus?: number;
    responseBody?: string;
  };
  postTest?: {
    success: boolean;
    httpStatus?: number;
    responseBody?: string;
    error?: string;
  };
}

/**
 * Test CaterValley webhook connectivity and endpoint availability
 * GET /api/test/catervalley-webhook
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const webhookUrl = process.env.CATERVALLEY_WEBHOOK_URL || 'https://api.catervalley.com/api/operation/order/update-order-status';
  const apiKey = process.env.CATERVALLEY_API_KEY;

  const testHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'partner': 'ready-set',
  };

  if (apiKey) {
    testHeaders['x-api-key'] = apiKey;
  }

  const result: TestResult = {
    url: webhookUrl,
    method: 'POST',
    headers: testHeaders,
    connectivity: {
      connected: false,
    },
  };

  // Test 1: Basic connectivity with OPTIONS request
  console.log(`Testing CaterValley webhook connectivity to: ${webhookUrl}`);
  
  try {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const optionsResponse = await fetch(webhookUrl, {
        method: 'OPTIONS',
        headers: {
          'partner': 'ready-set',
          ...(apiKey && { 'x-api-key': apiKey }),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      result.connectivity = {
        connected: true,
        latencyMs,
        httpStatus: optionsResponse.status,
      };

      // Try to read response body for debugging
      try {
        const responseText = await optionsResponse.text();
        if (responseText) {
          result.connectivity.responseBody = responseText;
        }
      } catch (e) {
        // Ignore if we can't read the body
      }

      console.log(`OPTIONS request successful: ${optionsResponse.status} in ${latencyMs}ms`);
    } catch (error) {
      clearTimeout(timeoutId);
      result.connectivity = {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      console.error('OPTIONS request failed:', error);
    }
  } catch (error) {
    result.connectivity = {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Test 2: Actual POST request with test payload
  console.log('Testing POST request with test payload...');
  
  try {
    const testPayload = {
      orderNumber: 'TEST123',
      status: 'CONFIRM',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const postResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: testHeaders,
        body: JSON.stringify(testPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let responseBody = '';
      try {
        responseBody = await postResponse.text();
      } catch (e) {
        responseBody = 'Could not read response body';
      }

      result.postTest = {
        success: postResponse.ok,
        httpStatus: postResponse.status,
        responseBody,
      };

      console.log(`POST request result: ${postResponse.status}, Body: ${responseBody}`);
    } catch (error) {
      clearTimeout(timeoutId);
      result.postTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      console.error('POST request failed:', error);
    }
  } catch (error) {
    result.postTest = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

/**
 * Test sending a real webhook update
 * POST /api/test/catervalley-webhook
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { orderNumber, status } = body;

    if (!orderNumber || !status) {
      return NextResponse.json(
        { error: 'Missing orderNumber or status in request body' },
        { status: 400 }
      );
    }

    console.log(`Testing real webhook for order ${orderNumber} with status ${status}`);

    const webhookUrl = process.env.CATERVALLEY_WEBHOOK_URL || 'https://api.catervalley.com/api/operation/order/update-order-status';
    const apiKey = process.env.CATERVALLEY_API_KEY;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'partner': 'ready-set',
    };

    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    const payload = {
      orderNumber: orderNumber.replace(/^CV-/, ''), // Remove CV- prefix if present
      status,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let responseBody = '';
      try {
        responseBody = await response.text();
      } catch (e) {
        responseBody = 'Could not read response body';
      }

      const result = {
        success: response.ok,
        httpStatus: response.status,
        httpStatusText: response.statusText,
        responseBody,
        sentPayload: payload,
        sentHeaders: headers,
        webhookUrl,
      };

      console.log('Real webhook test result:', result);

      return NextResponse.json(result);
    } catch (error) {
      clearTimeout(timeoutId);
      
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        sentPayload: payload,
        sentHeaders: headers,
        webhookUrl,
      };

      console.error('Real webhook test failed:', errorResult);
      
      return NextResponse.json(errorResult, { status: 500 });
    }
  } catch (error) {
    console.error('Error processing webhook test request:', error);
    return NextResponse.json(
      { error: 'Invalid request body or processing error' },
      { status: 400 }
    );
  }
} 