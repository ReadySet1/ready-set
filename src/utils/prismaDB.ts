/**
 * Unified Prisma Client Export
 *
 * This module now re-exports the optimized pooled client to fix connection issues.
 * All existing imports from '@/utils/prismaDB' will now use the connection-pooled client.
 */
// Re-export the optimized pooled client as the main export
export { prismaPooled as prisma, queryMetrics, healthCheck } from '@/lib/db/prisma-pooled';
// For backward compatibility, also export as default
export { default } from '@/lib/db/prisma-pooled';
// Legacy function exports for backward compatibility
import { prismaPooled } from '@/lib/db/prisma-pooled';
import { prismaLogger } from './logger';
// Environment configuration
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
// Import PrismaClient for type definitions
import { PrismaClient } from '@prisma/client';
// Create function to make a new Prisma client
const createPrismaClient = (): PrismaClient => {
    // Use environment variable to control detailed logging  
    const enableDetailedLogs = process.env.PRISMA_LOG_LEVEL?.split(',') || process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug';
    let logConfig: any[];
    if (enableDetailedLogs && Array.isArray(enableDetailedLogs)) {
        logConfig = enableDetailedLogs;
    }
    else if (enableDetailedLogs === true || process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
        logConfig = ['query', 'error', 'warn', 'info'];
    }
    else if (isDevelopment) {
        logConfig = ['warn', 'error']; // Quieter development logs
    }
    else {
        logConfig = ['error', 'warn'];
    }
    return new PrismaClient({
        log: logConfig,
    });
};
// Enhanced connection management with retry logic
export async function connectPrisma(retries = 3): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await prismaPooled.$connect();
            return;
        }
        catch (error) {
            console.error(`❌ Database connection failed on attempt ${attempt}:`, error);
            if (attempt === retries) {
                throw new Error(`Failed to connect to database after ${retries} attempts: ${error}`);
            }
            // Wait before retrying (exponential backoff)
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}
export async function disconnectPrisma(): Promise<void> {
    try {
        await prismaPooled.$disconnect();
    }
    catch (error) {
        console.error('❌ Database disconnection failed:', error);
    }
}
// Health check function with automatic reconnection
export async function checkDatabaseHealth(autoReconnect = true): Promise<boolean> {
    try {
        await prismaPooled.$queryRaw `SELECT 1`;
        return true;
    }
    catch (error) {
        console.error('💔 Database health check failed:', error);
        if (autoReconnect) {
            try {
                await disconnectPrisma();
                await connectPrisma();
                // Test again after reconnection
                await prismaPooled.$queryRaw `SELECT 1`;
                return true;
            }
            catch (reconnectError) {
                console.error('❌ Failed to reconnect:', reconnectError);
            }
        }
        return false;
    }
}
// Check if error is related to prepared statements
function isPreparedStatementError(error: any): boolean {
    return error?.code === '42P05' || // prepared statement already exists
        error?.code === '26000' || // prepared statement does not exist
        error?.message?.includes('prepared statement') ||
        error?.message?.includes('already exists') ||
        error?.message?.includes('does not exist');
}
// Global flag to prevent concurrent connection resets
let isResettingConnection = false;
// Declare global type for the Prisma client
declare global {
    // eslint-disable-next-line no-var
    var __prisma: PrismaClient | undefined;
}
// Reset Prisma connection to clear prepared statements
export async function resetPrismaConnection(): Promise<void> {
    // If already resetting, wait for it to complete
    if (isResettingConnection) {
        prismaLogger.debug('⏳ Connection reset already in progress, waiting...');
        let waitCount = 0;
        while (isResettingConnection && waitCount < 100) { // Max 10 seconds wait
            await new Promise(resolve => setTimeout(resolve, 100));
            waitCount++;
        }
        return;
    }
    isResettingConnection = true;
    try {
        prismaLogger.debug('🔄 Resetting Prisma connection to clear prepared statements...');
        // In development, recreate the global client to clear all state
        if (isDevelopment && global.__prisma) {
            try {
                await global.__prisma.$disconnect();
            }
            catch (disconnectError) {
                console.warn('⚠️ Error during disconnect, continuing with reset:', disconnectError);
            }
            global.__prisma = undefined;
            prismaLogger.debug('🔄 Cleared global Prisma client in development');
            // Wait for the connection to fully close
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Recreate the client
            global.__prisma = createPrismaClient();
            // Test the new connection with retry
            let testRetries = 3;
            while (testRetries > 0) {
                try {
                    await global.__prisma.$queryRaw `SELECT 1`;
                    break;
                }
                catch (testError) {
                    testRetries--;
                    if (testRetries === 0)
                        throw testError;
                    prismaLogger.debug(`🔄 Connection test failed, retrying... (${testRetries} attempts left)`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        else {
            // For production, just disconnect and reconnect
            try {
                await prismaPooled.$disconnect();
            }
            catch (disconnectError) {
                console.warn('⚠️ Error during disconnect, continuing with reset:', disconnectError);
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
            await prismaPooled.$connect();
            await prismaPooled.$queryRaw `SELECT 1`;
        }
        prismaLogger.debug('✅ Prisma connection reset successfully');
    }
    catch (error) {
        console.error('❌ Failed to reset Prisma connection:', error);
        // Don't throw here to prevent cascade failures
    }
    finally {
        isResettingConnection = false;
    }
}
// Wrapper function for database operations with automatic retry
export async function withDatabaseRetry<T>(operation: () => Promise<T>, maxRetries = 3, operationName = 'database operation'): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            return await operation();
        }
        catch (error: any) {
            lastError = error;
            const isConnectionError = error?.code === 'P2028' ||
                error?.message?.includes('Engine is not yet connected') ||
                error?.message?.includes('Connection refused') ||
                error?.message?.includes('Response from the Engine was empty') ||
                error?.message?.includes('Connection terminated');
            const isPreparedStmtError = isPreparedStatementError(error);
            // Log the specific error details
            console.error(`❌ ${operationName} failed on attempt ${attempt}:`, {
                code: error?.code,
                message: error?.message?.substring(0, 200),
                isPreparedStmtError,
                isConnectionError
            });
            if ((isConnectionError || isPreparedStmtError) && attempt <= maxRetries) {
                // For prepared statement errors, reset the connection
                if (isPreparedStmtError) {
                    try {
                        await resetPrismaConnection();
                    }
                    catch (resetError) {
                        console.error('❌ Connection reset failed:', resetError);
                        // Continue to retry even if reset fails
                    }
                }
                else {
                    // Attempt to reconnect for connection errors
                    try {
                        await disconnectPrisma();
                        await connectPrisma();
                    }
                    catch (reconnectError) {
                        console.error('❌ Reconnection failed:', reconnectError);
                        // Continue to retry even if reconnection fails
                    }
                }
                // Exponential backoff with jitter
                const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 1000, 5000);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            // If we're here, either it's not a retryable error or we've exhausted retries
            console.error(`💥 ${operationName} failed after ${attempt} attempts. Final error:`, error);
            throw error;
        }
    }
    throw lastError || new Error('Unreachable code in withDatabaseRetry');
}
// Graceful shutdown for serverless
process.on('beforeExit', async () => {
    await disconnectPrisma();
});
// Types for better TypeScript support
export type PrismaClientInstance = typeof prismaPooled;
export type PrismaTransaction = Parameters<Parameters<typeof prismaPooled.$transaction>[0]>[0];
