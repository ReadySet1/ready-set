/**
 * TypeScript Type Augmentation for Supabase Realtime
 *
 * Supabase Realtime is built on Phoenix Channels, which provides additional
 * methods not exposed in the official @supabase/supabase-js type definitions.
 *
 * This file augments the RealtimeChannel interface to include the `off()` method
 * for properly removing event listeners and preventing memory leaks.
 *
 * @see https://hexdocs.pm/phoenix/js/ - Phoenix Channels Documentation
 * @see https://supabase.com/docs/guides/realtime - Supabase Realtime Documentation
 */

declare module '@supabase/supabase-js' {
  /**
   * Extended RealtimeChannel interface with Phoenix Channel methods
   */
  export interface RealtimeChannel {
    /**
     * Remove an event listener from the channel
     *
     * This method is provided by Phoenix Channels (the underlying library for Supabase Realtime)
     * but is not exposed in the official TypeScript definitions.
     *
     * @param event - Event type (e.g., 'broadcast', 'presence', 'postgres_changes')
     * @param filter - Event filter object (e.g., { event: 'location:updated' })
     * @param callback - The specific callback function to remove
     *
     * @example
     * ```typescript
     * const channel = supabase.channel('my-channel');
     * const listener = (payload) => console.log(payload);
     *
     * // Add listener
     * channel.on('broadcast', { event: 'my-event' }, listener);
     *
     * // Remove listener
     * channel.off('broadcast', { event: 'my-event' }, listener);
     * ```
     */
    off(
      event: string,
      filter: Record<string, unknown>,
      callback: (...args: unknown[]) => void
    ): void;
  }
}

// Ensure this file is treated as a module
export {};
