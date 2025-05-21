import { initializeMonitoring, initializeEdgeMonitoring } from './src/lib/monitoring';

export async function register() {
  try {
    if (process.env.NEXT_RUNTIME === 'edge') {
      // Use the edge-compatible monitoring
      initializeEdgeMonitoring();
    } else {
      // Use the Node.js server monitoring
      initializeMonitoring();
    }
  } catch (error) {
    console.error('Failed to initialize monitoring:', error);
  }
} 