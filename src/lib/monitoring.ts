import { NextRequest } from 'next/server';
import { CONSTANTS } from '../constants';

/**
 * Monitoring initialization utilities compatible with both Edge Runtime and Node.js
 * Safely detects the runtime environment and initializes monitoring accordingly
 */

// Track initialization state to avoid duplicate setup
let edgeMonitoringInitialized = false;
let nodeMonitoringInitialized = false;

/**
 * Initialize monitoring for Edge Runtime
 * Called from Edge API routes and middleware
 */
export function initializeEdgeMonitoring(): void {
  // Prevent multiple initializations
  if (edgeMonitoringInitialized) return;
  
  try {
    // Only initialize if in a runtime that supports it
    // Edge Runtime differs from Node.js in what global objects are available
    if (typeof globalThis.Response !== 'undefined') {
      // We're in an Edge-compatible environment
      
      // Only log during development
      if (process.env.NODE_ENV === 'development') {
              }
      
      // Any edge-specific monitoring setup would go here
      // This currently just logs initialization, but can be expanded
      
      edgeMonitoringInitialized = true;
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Attempted to initialize Edge monitoring in non-Edge environment');
      }
    }
  } catch (error) {
    console.error('Failed to initialize Edge monitoring:', error);
  }
}

/**
 * Initialize monitoring for Node.js Runtime
 * Called from Node.js API routes and server components
 */
export function initializeNodeMonitoring(): void {
  // Prevent multiple initializations
  if (nodeMonitoringInitialized) return;
  
  try {
    // Check for Node.js environment
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      // We're in a Node.js environment
      
      // Only log during development
      if (process.env.NODE_ENV === 'development') {
              }
      
      // Any Node.js-specific monitoring setup would go here
      
      nodeMonitoringInitialized = true;
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Attempted to initialize Node.js monitoring in non-Node environment');
      }
    }
  } catch (error) {
    console.error('Failed to initialize Node.js monitoring:', error);
  }
}

/**
 * Auto-detect environment and initialize appropriate monitoring
 * Can be called from any environment
 */
export function initializeMonitoring(): void {
  // Detect if we're in Edge or Node.js and initialize accordingly
  try {
    if (typeof globalThis.Response !== 'undefined') {
      initializeEdgeMonitoring();
    } else if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      initializeNodeMonitoring();
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Unknown environment, monitoring initialization skipped');
      }
    }
  } catch (error) {
    console.error('Error initializing monitoring:', error);
  }
}

/**
 * Client-side monitoring initialization for browser environments
 */
export function initializeClientMonitoring() {
  // Only log during development
  if (process.env.NODE_ENV === 'development') {
      }
} 