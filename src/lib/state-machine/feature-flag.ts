/**
 * Server-side kill-switch for the centralized order state machine.
 * Off by default. Set USE_STATE_MACHINE=true in .env.local to enable.
 *
 * Intentionally a plain env check — the larger feature-flags.ts system
 * is wired for client-side NEXT_PUBLIC_FF_* flags and pulls in realtime
 * config we don't need here.
 */
export function isStateMachineEnabled(): boolean {
  return process.env.USE_STATE_MACHINE === 'true';
}
