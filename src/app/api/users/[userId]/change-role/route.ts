import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prismaDB';
import { createClient } from '@/utils/supabase/server';
import { UserType } from "@/types/prisma";
import { UserAuditService } from '@/services/userAuditService';
import { AuditAction } from '@/types/audit';


export async function POST(request: NextRequest, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const { userId } = params;

  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requesterProfile = await prisma.profile.findUnique({
      where: { id: authUser.id },
      select: { type: true },
    });

    if (requesterProfile?.type !== UserType.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Forbidden: Only Super Admins can change user roles.' },
        { status: 403 }
      );
    }

    if (authUser.id === userId) {
        return NextResponse.json(
            { error: 'Cannot change your own role via this endpoint.' },
            { status: 403 }
        );
    }

    const { newRole } = await request.json();

    // Convert incoming role to uppercase for validation and DB update
    const upperCaseNewRole = typeof newRole === 'string' ? newRole.toUpperCase() : null;

    if (!upperCaseNewRole || !Object.values(UserType).includes(upperCaseNewRole as UserType)) {
      return NextResponse.json(
        { error: 'Invalid role provided' },
        { status: 400 }
      );
    }

    // Get current user role before update
    const currentUser = await prisma.profile.findUnique({
      where: { id: userId },
      select: { type: true }
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Use transaction for update + audit logging
    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.profile.update({
        where: { id: userId },
        data: { type: upperCaseNewRole as UserType },
        select: {
          id: true,
          email: true,
          type: true,
          name: true,
          status: true,
        }
      });

      // Create audit entry for role change
      const auditService = new UserAuditService();
      await auditService.createAuditEntry(tx, {
        userId,
        action: AuditAction.ROLE_CHANGE,
        performedBy: authUser.id,
        before: { type: currentUser.type },
        after: { type: upperCaseNewRole },
        reason: `Role changed from ${currentUser.type} to ${upperCaseNewRole}`,
      });

      return updated;
    });

    return NextResponse.json(
      { message: 'User role updated successfully', user: updatedUser },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error changing user role:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}