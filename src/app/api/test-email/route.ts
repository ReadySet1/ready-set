// app/api/test-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import sendEmail from '@/app/actions/email';
import { withAuth } from '@/lib/auth-middleware';
import { devOnlyGuard } from '@/lib/auth/dev-only-guard';

export async function POST(request: NextRequest) {
  const blocked = devOnlyGuard();
  if (blocked) return blocked;

  const authResult = await withAuth(request, {
    allowedRoles: ['SUPER_ADMIN'],
    requireAuth: true,
  });
  if (!authResult.success || authResult.response) {
    return (
      authResult.response ??
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    );
  }

  try {
    const result = await sendEmail({
      name: 'Test User',
      email: 'info@ready-set.co',
      message: 'Test message',
      phone: '1234567890', // Optional
    });

    return NextResponse.json({ success: true, message: result });
  } catch (error) {
    console.error('Email test error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send email' },
      { status: 500 },
    );
  }
}
