/**
 * Limits for POST /api/tracking/locations/batch, shared by the route and the
 * client outbox.
 *
 * Lives outside the route file because Next.js only allows HTTP handlers and
 * segment config as exports from a route module.
 */

/** Upper bound per request — the client sends backlogs in chunks of this size or less. */
export const LOCATION_BATCH_MAX_POINTS = 100;
