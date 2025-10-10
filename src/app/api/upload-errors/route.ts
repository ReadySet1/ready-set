// src/app/api/upload-errors/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/prismaDB";
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { correlationId, errorType, message, userMessage, details, userId, timestamp, retryable } = body;
        // Validate required fields
        if (!correlationId || !errorType || !message) {
            return NextResponse.json({ error: "Missing required fields: correlationId, errorType, message" }, { status: 400 });
        }
        // Create error record in database
        const errorRecord = await prisma.uploadError.create({
            data: {
                correlationId,
                errorType,
                message,
                userMessage,
                details: details ? JSON.stringify(details) : null,
                userId,
                timestamp: new Date(timestamp),
                retryable: retryable || false,
                resolved: false
            }
        });
        return NextResponse.json({
            success: true,
            errorId: errorRecord.id,
            correlationId
        });
    }
    catch (error) {
        console.error("Error reporting upload error:", error);
        return NextResponse.json({ error: "Failed to report error" }, { status: 500 });
    }
}
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const correlationId = searchParams.get("correlationId");
        const limit = parseInt(searchParams.get("limit") || "100");
        const offset = parseInt(searchParams.get("offset") || "0");
        if (correlationId) {
            // Get specific error by correlation ID
            const errorRecord = await prisma.uploadError.findUnique({
                where: { correlationId }
            });
            if (!errorRecord) {
                return NextResponse.json({ error: "Error not found" }, { status: 404 });
            }
            return NextResponse.json({
                success: true,
                error: {
                    id: errorRecord.id,
                    correlationId: errorRecord.correlationId,
                    errorType: errorRecord.errorType,
                    message: errorRecord.message,
                    userMessage: errorRecord.userMessage,
                    details: errorRecord.details ? JSON.parse(errorRecord.details) : null,
                    userId: errorRecord.userId,
                    timestamp: errorRecord.timestamp,
                    retryable: errorRecord.retryable,
                    resolved: errorRecord.resolved
                }
            });
        }
        else {
            // Get list of errors with pagination
            const errors = await prisma.uploadError.findMany({
                orderBy: { timestamp: "desc" },
                take: limit,
                skip: offset
            });
            const totalCount = await prisma.uploadError.count();
            return NextResponse.json({
                success: true,
                errors: errors.map(error => ({
                    id: error.id,
                    correlationId: error.correlationId,
                    errorType: error.errorType,
                    message: error.message,
                    userMessage: error.userMessage,
                    userId: error.userId,
                    timestamp: error.timestamp,
                    retryable: error.retryable,
                    resolved: error.resolved
                })),
                pagination: {
                    total: totalCount,
                    limit,
                    offset,
                    hasMore: offset + limit < totalCount
                }
            });
        }
    }
    catch (error) {
        console.error("Error fetching upload errors:", error);
        return NextResponse.json({ error: "Failed to fetch errors" }, { status: 500 });
    }
}
