// Calculator save endpoint - saves calculation results to database
import { NextRequest, NextResponse } from 'next/server';
import { CalculationInput, CalculationResult } from '@/types/calculator';
import { CalculatorService } from '@/lib/calculator/calculator-service';
import { createClient } from '@/utils/supabase/server';
export async function POST(request: NextRequest) {
    try {
        // Get authenticated user
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized - Please sign in' }, { status: 401 });
        }
        const body = await request.json();
        const { templateId, clientConfigId, input, result } = body as {
            templateId: string;
            clientConfigId?: string;
            input: CalculationInput;
            result: CalculationResult;
        };
        // Validate required fields
        if (!templateId || !input || !result) {
            return NextResponse.json({ error: 'Missing required fields: templateId, input, result' }, { status: 400 });
        }
        // Save calculation to database using the existing service
        await CalculatorService.saveCalculationHistory(supabase, templateId, input, result, clientConfigId, user.id);
        return NextResponse.json({
            success: true,
            message: 'Calculation saved successfully',
            data: {
                templateId,
                clientConfigId,
                userId: user.id,
                timestamp: new Date().toISOString(),
            }
        });
    }
    catch (error) {
        console.error('❌ Error saving calculation:', error);
        return NextResponse.json({ error: 'Failed to save calculation to database' }, { status: 500 });
    }
}
