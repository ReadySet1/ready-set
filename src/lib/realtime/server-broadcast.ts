/**
 * Server-side Realtime broadcasts.
 *
 * API routes have no browser session, so they cannot use the RealtimeClient
 * singleton in ./client (it is built on the browser Supabase client and
 * requires a subscribed, authenticated channel). These helpers broadcast
 * through the Supabase admin client instead.
 *
 * Callers should defer them with runAfterResponse so a broadcast failure never
 * blocks or fails the request that triggered it.
 */

import { createAdminClient } from '@/utils/supabase/server';
import { REALTIME_CHANNELS, REALTIME_EVENTS } from './types';
import type { DeliveryStatusUpdatedPayload } from './schemas';

/**
 * Broadcast one delivery-status event on the `driver-status` channel
 * (subscribe → send → always release the channel). Order views subscribe via
 * useDeliveryStatusRealtime and update without a reload.
 */
export async function broadcastDeliveryStatus(payload: DeliveryStatusUpdatedPayload): Promise<void> {
  const adminSupabase = await createAdminClient();
  const channel = adminSupabase.channel(REALTIME_CHANNELS.DRIVER_STATUS);

  try {
    // Subscribe first (required to send)
    await new Promise<void>((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error(`Channel subscription failed: ${status}`));
        }
      });
    });

    const result = await channel.send({
      type: 'broadcast',
      event: REALTIME_EVENTS.DELIVERY_STATUS_UPDATED,
      payload,
    });

    if (result !== 'ok') {
      console.warn('Delivery status broadcast returned non-ok result:', result);
    }
  } finally {
    // Always release the channel, even on subscribe/send failure
    await adminSupabase.removeChannel(channel).catch((cleanupErr) => {
      console.warn('Failed to remove realtime channel during cleanup:', cleanupErr);
    });
  }
}
