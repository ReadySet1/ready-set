/**
 * Supabase Realtime - Main Export
 *
 * Centralized exports for Supabase Realtime functionality.
 */

// Client
export {
  RealtimeClient,
  getRealtimeClient,
  getSupabaseClient,
} from './client';

// Channels
export {
  DriverLocationChannel,
  DriverStatusChannel,
  AdminCommandsChannel,
  createDriverLocationChannel,
  createDriverStatusChannel,
  createAdminCommandsChannel,
} from './channels';

// Types
export * from './types';
