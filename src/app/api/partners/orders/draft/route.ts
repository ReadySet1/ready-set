/**
 * Canonical partner-API draft endpoint.
 *
 * Re-exports the shared handler from the cater-valley path so both
 * `/api/partners/orders/draft` (advertised in the partner contract)
 * and `/api/cater-valley/orders/draft` (legacy URL CaterValley uses
 * in production) hit the exact same code with identical behavior.
 * Partner identity comes from the `partner` + `x-api-key` headers
 * via the registry; the URL path is informational.
 */
export { POST } from '@/app/api/cater-valley/orders/draft/route';
