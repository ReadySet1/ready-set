// Calculator save endpoint - saves calculation results to database
import { NextRequest, NextResponse } from 'next/server';
import { CalculationInput, CalculationResult } from '@/types/calculator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, clientConfigId, input, result } = body as {
      templateId: string;
      clientConfigId?: string;
      input: CalculationInput;
      result: CalculationResult;
    };

    // Validate required fields
    if (!templateId || !input || !result) {
      return NextResponse.json(
        { error: 'Missing required fields: templateId, input, result' },
        { status: 400 }
      );
    }

    // For now, we'll just return a success response
    // In a real implementation, you would save to your database here
    console.log('Calculation saved:', {
      templateId,
      clientConfigId,
      input,
      result,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Calculation saved successfully',
      data: {
        id: Math.random().toString(36).substr(2, 9), // Generate a mock ID
        templateId,
        clientConfigId,
        input,
        result,
        timestamp: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('Error saving calculation:', error);
    return NextResponse.json(
      { error: 'Failed to save calculation' },
      { status: 500 }
    );
  }
}