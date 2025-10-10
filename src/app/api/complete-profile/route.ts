// src/app/api/complete-profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import { UserType, UserStatus } from "@/types/prisma";
import { randomUUID } from 'crypto';
export async function POST(request: NextRequest) {
    try {
        // Initialize Supabase client
        const supabase = await createClient();
        // Get user session from Supabase for authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        // Check if user already has a profile
        const existingProfile = await prisma.profile.findUnique({
            where: { id: user.id }
        });
        if (existingProfile) {
            return NextResponse.json({ error: "Profile already exists" }, { status: 409 });
        }
        // Parse request body
        const formData = await request.json();
        // Map form data to database structure
        const userTypeMap: Record<string, UserType> = {
            'vendor': UserType.VENDOR,
            'client': UserType.CLIENT,
            'driver': UserType.DRIVER,
            'admin': UserType.ADMIN,
            'helpdesk': UserType.HELPDESK,
            'super_admin': UserType.SUPER_ADMIN
        };
        const mappedUserType = userTypeMap[formData.userType] || UserType.CLIENT;
        // Prepare profile data
        const profileData = {
            id: user.id,
            email: user.email || formData.email,
            name: formData.contact_name || user.user_metadata?.full_name || user.user_metadata?.name,
            contactName: formData.contact_name,
            contactNumber: formData.phone,
            type: mappedUserType,
            companyName: formData.company || null,
            website: formData.website || null,
            street1: formData.street1 || null,
            street2: formData.street2 || null,
            city: formData.city || null,
            state: formData.state || null,
            zip: formData.zip || null,
            parkingLoading: formData.parking || null,
            counties: Array.isArray(formData.countiesServed) ? formData.countiesServed.join(", ") : null,
            timeNeeded: Array.isArray(formData.timeNeeded) ? formData.timeNeeded.join(", ") : null,
            frequency: formData.frequency || null,
            provide: Array.isArray(formData.provisions) ? formData.provisions.join(", ") : null,
            cateringBrokerage: Array.isArray(formData.cateringBrokerage) ? formData.cateringBrokerage.join(", ") : null,
            headCount: formData.head_count ? parseInt(formData.head_count) : null,
            status: UserStatus.PENDING,
            isTemporaryPassword: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        // Create profile in database
        const newProfile = await prisma.profile.create({
            data: profileData,
        });
        // Create default address if address data is provided
        if (formData.street1 && formData.city && formData.state && formData.zip) {
            const addressId = randomUUID();
            const address = await prisma.address.create({
                data: {
                    id: addressId,
                    name: "Main Address",
                    street1: formData.street1,
                    street2: formData.street2 || null,
                    city: formData.city,
                    state: formData.state,
                    zip: formData.zip,
                    county: Array.isArray(formData.countiesServed) ? formData.countiesServed[0] : null,
                    parkingLoading: formData.parking || null,
                    isRestaurant: mappedUserType === UserType.VENDOR,
                    isShared: false,
                    createdBy: newProfile.id,
                },
            });
            // Create user-address relation
            await prisma.userAddress.create({
                data: {
                    userId: newProfile.id,
                    addressId: address.id,
                    alias: "Main Address",
                    isDefault: true,
                },
            });
        }
        // Update user metadata in Supabase
        await supabase.auth.updateUser({
            data: {
                userType: mappedUserType,
                profileCompleted: true
            },
        });
        return NextResponse.json({
            success: true,
            message: 'Profile completed successfully',
            profile: {
                id: newProfile.id,
                type: newProfile.type,
                email: newProfile.email
            }
        });
    }
    catch (error) {
        console.error('Error completing profile:', error);
        // Check if this is a Prisma error with a code property
        if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
            return NextResponse.json({ error: "Profile already exists for this user" }, { status: 409 });
        }
        return NextResponse.json({
            error: 'Failed to complete profile',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
