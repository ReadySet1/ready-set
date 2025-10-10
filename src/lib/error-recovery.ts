// src/lib/error-recovery.ts
import React from 'react';
import { ErrorSeverity, ErrorCategory } from './error-logging';
export interface RecoveryOptions {
    maxRetries?: number;
    retryDelay?: number;
    exponentialBackoff?: boolean;
    preserveState?: boolean;
    fallbackAction?: () => void;
    onRetry?: (attempt: number) => void;
    onMaxRetriesReached?: () => void;
    onRecoverySuccess?: () => void;
    onRecoveryFailure?: (error: Error) => void;
}
export interface RetryState {
    attempt: number;
    lastError?: Error;
    isRetrying: boolean;
    nextRetryAt?: number;
}
/**
 * Generic retry mechanism for recoverable operations
 */
export class RetryManager {
    private state: RetryState = {
        attempt: 0,
        isRetrying: false
    };
    constructor(private options: RecoveryOptions = {}) {
        this.options = {
            maxRetries: 3,
            retryDelay: 1000,
            exponentialBackoff: true,
            preserveState: true,
            ...options
        };
    }
    /**
     * Execute an operation with retry logic
     */
    async execute<T>(operation: () => Promise<T>, context?: string): Promise<T> {
        this.state.attempt = 0;
        this.state.isRetrying = false;
        while (this.state.attempt < (this.options.maxRetries || 3)) {
            try {
                this.state.attempt++;
                this.options.onRetry?.(this.state.attempt);
                const result = await operation();
                if (this.state.attempt > 1) {
                    this.options.onRecoverySuccess?.();
                }
                return result;
            }
            catch (error) {
                this.state.lastError = error as Error;
                console.warn(`❌ Attempt ${this.state.attempt} failed${context ? ` (${context})` : ''}:`, error);
                // Don't retry on the last attempt
                if (this.state.attempt >= (this.options.maxRetries || 3)) {
                    this.options.onMaxRetriesReached?.();
                    this.options.onRecoveryFailure?.(error as Error);
                    throw error;
                }
                // Wait before retrying
                await this.waitForRetry();
            }
        }
        throw this.state.lastError;
    }
    /**
     * Reset retry state
     */
    reset(): void {
        this.state = {
            attempt: 0,
            isRetrying: false
        };
    }
    /**
     * Get current retry state
     */
    getState(): RetryState {
        return { ...this.state };
    }
    private async waitForRetry(): Promise<void> {
        const delay = this.options.exponentialBackoff
            ? (this.options.retryDelay || 1000) * Math.pow(2, this.state.attempt - 1)
            : this.options.retryDelay || 1000;
        this.state.isRetrying = true;
        this.state.nextRetryAt = Date.now() + delay;
        await new Promise(resolve => setTimeout(resolve, delay));
        this.state.isRetrying = false;
    }
}
/**
 * Network error recovery with intelligent retry strategies
 */
export class NetworkRecoveryManager extends RetryManager {
    constructor(options?: RecoveryOptions) {
        super({
            maxRetries: 3,
            retryDelay: 1000,
            exponentialBackoff: true,
            ...options
        });
    }
    /**
     * Determine if error is network-related and recoverable
     */
    isRecoverableError(error: Error): boolean {
        const message = error.message?.toLowerCase();
        const name = error.name?.toLowerCase();
        // Network-related errors that are often transient
        const recoverableErrors = [
            'network error',
            'fetch error',
            'connection error',
            'timeout',
            'aborted',
            'cancelled',
            'offline',
            'no internet',
            'connection refused',
            'connection reset',
            'network timeout'
        ];
        // HTTP status codes that indicate temporary issues
        const recoverableStatuses = [408, 429, 500, 502, 503, 504];
        return recoverableErrors.some(err => message?.includes(err)) ||
            recoverableStatuses.some(status => message?.includes(status.toString())) ||
            name === 'typeerror' && message?.includes('fetch');
    }
    /**
     * Execute network operation with intelligent retry
     */
    async executeNetworkOperation<T>(operation: () => Promise<T>, context?: string): Promise<T> {
        try {
            return await this.execute(operation, context);
        }
        catch (error) {
            // For network errors, try one more time with a longer delay
            if (this.isRecoverableError(error as Error) && this.getState().attempt < 4) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                return await operation();
            }
            throw error;
        }
    }
}
/**
 * State preservation manager for error recovery
 */
export class StatePreservationManager {
    private static instance: StatePreservationManager;
    private storage = new Map<string, any>();
    private listeners = new Map<string, Set<(state: any) => void>>();
    static getInstance(): StatePreservationManager {
        if (!StatePreservationManager.instance) {
            StatePreservationManager.instance = new StatePreservationManager();
        }
        return StatePreservationManager.instance;
    }
    /**
     * Save state for potential recovery
     */
    saveState(key: string, state: any): void {
        this.storage.set(key, {
            data: state,
            timestamp: Date.now(),
            expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes
        });
        // Notify listeners
        this.listeners.get(key)?.forEach(listener => listener(state));
    }
    /**
     * Get saved state
     */
    getState(key: string): any | null {
        const saved = this.storage.get(key);
        if (!saved)
            return null;
        // Check if expired
        if (Date.now() > saved.expiresAt) {
            this.storage.delete(key);
            return null;
        }
        return saved.data;
    }
    /**
     * Clear saved state
     */
    clearState(key: string): void {
        this.storage.delete(key);
    }
    /**
     * Clear all saved states
     */
    clearAllStates(): void {
        this.storage.clear();
    }
    /**
     * Subscribe to state changes
     */
    subscribe(key: string, listener: (state: any) => void): () => void {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key)!.add(listener);
        // Return unsubscribe function
        return () => {
            this.listeners.get(key)?.delete(listener);
            if (this.listeners.get(key)?.size === 0) {
                this.listeners.delete(key);
            }
        };
    }
    /**
     * Auto-save form state
     */
    saveFormState(formId: string, formData: Record<string, any>): void {
        this.saveState(`form_${formId}`, {
            formData,
            timestamp: Date.now()
        });
    }
    /**
     * Get saved form state
     */
    getFormState(formId: string): Record<string, any> | null {
        const state = this.getState(`form_${formId}`);
        return state?.formData || null;
    }
    /**
     * Save component state
     */
    saveComponentState(componentId: string, state: any): void {
        this.saveState(`component_${componentId}`, state);
    }
    /**
     * Get saved component state
     */
    getComponentState(componentId: string): any | null {
        return this.getState(`component_${componentId}`);
    }
}
/**
 * Error recovery strategies based on error type and context
 */
export function getRecoveryStrategy(error: Error, context?: string): RecoveryOptions {
    const errorMessage = error.message?.toLowerCase();
    const errorName = error.name?.toLowerCase();
    // Network errors - aggressive retry with backoff
    if (errorMessage?.includes('network') || errorMessage?.includes('fetch') || errorMessage?.includes('timeout')) {
        return {
            maxRetries: 5,
            retryDelay: 1000,
            exponentialBackoff: true,
            preserveState: true
        };
    }
    // Authentication errors - redirect to login
    if (errorMessage?.includes('unauthorized') || errorMessage?.includes('authentication')) {
        return {
            maxRetries: 1,
            retryDelay: 0,
            fallbackAction: () => {
                if (typeof window !== 'undefined') {
                    window.location.href = '/sign-in?error=Authentication+required';
                }
            }
        };
    }
    // Validation errors - no retry, show error message
    if (errorMessage?.includes('validation') || errorMessage?.includes('invalid')) {
        return {
            maxRetries: 0,
            preserveState: true
        };
    }
    // Chunk loading errors - clear cache and reload
    if (errorMessage?.includes('chunk') || errorName === 'chunkloaderror') {
        return {
            maxRetries: 2,
            retryDelay: 2000,
            fallbackAction: () => {
                if (typeof window !== 'undefined') {
                    // Clear cache and reload
                    if ('caches' in window) {
                        caches.keys().then(names => {
                            names.forEach(name => caches.delete(name));
                        });
                    }
                    window.location.reload();
                }
            }
        };
    }
    // Default strategy
    return {
        maxRetries: 3,
        retryDelay: 1000,
        exponentialBackoff: true,
        preserveState: true
    };
}
/**
 * React hook for error recovery
 */
export function useErrorRecovery(options?: RecoveryOptions) {
    const retryManager = React.useMemo(() => new RetryManager(options), [options]);
    const stateManager = React.useMemo(() => StatePreservationManager.getInstance(), []);
    const executeWithRecovery = React.useCallback(async <T>(operation: () => Promise<T>, context?: string): Promise<T> => {
        return retryManager.execute(operation, context);
    }, [retryManager]);
    const saveState = React.useCallback((key: string, state: any) => {
        stateManager.saveState(key, state);
    }, [stateManager]);
    const getState = React.useCallback((key: string) => {
        return stateManager.getState(key);
    }, [stateManager]);
    return {
        executeWithRecovery,
        saveState,
        getState,
        retryState: retryManager.getState(),
        reset: () => retryManager.reset()
    };
}
/**
 * Utility to determine if an error should trigger a retry
 */
export function shouldRetryError(error: Error): boolean {
    const message = error.message?.toLowerCase();
    const name = error.name?.toLowerCase();
    // Don't retry these types of errors
    const nonRetryableErrors = [
        'validation error',
        'invalid input',
        'unauthorized',
        'forbidden',
        'not found',
        'bad request',
        'payment required',
        'conflict',
        'unprocessable entity'
    ];
    return !nonRetryableErrors.some(err => message?.includes(err));
}
/**
 * Auto-retry decorator for functions
 */
export function withAutoRetry<T extends (...args: any[]) => Promise<any>>(fn: T, options?: RecoveryOptions): T {
    const retryManager = new RetryManager(options);
    return (async (...args: Parameters<T>) => {
        try {
            return await retryManager.execute(() => fn(...args), fn.name);
        }
        catch (error) {
            // If retry failed, execute fallback if provided
            if (options?.fallbackAction) {
                options.fallbackAction();
            }
            throw error;
        }
    }) as T;
}
