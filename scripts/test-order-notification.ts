/**
 * Local harness: fire an admin order notification for an existing order.
 *
 * Skips the UI entirely and calls the dispatcher against a real order already
 * in the dev database. Requires ORDER_NOTIFICATION_RECIPIENTS in .env.local
 * (the NODE_ENV guard blocks sends without it).
 *
 * Usage:
 *   pnpm test:order-notification <orderId> [catering|on_demand]
 *
 * Grab an order id from Prisma Studio (`pnpm studio`) or:
 *   psql $DATABASE_URL -c 'SELECT id, "orderNumber" FROM "CateringRequest" ORDER BY "createdAt" DESC LIMIT 5;'
 */
import { notifyOrderCreated } from "../src/services/orders/notifyOrderCreated";

async function main(): Promise<void> {
  const [orderId, orderType = "catering"] = process.argv.slice(2);
  if (!orderId) {
    console.error(
      "Usage: pnpm test:order-notification <orderId> [catering|on_demand]",
    );
    process.exit(1);
  }

  if (orderType !== "catering" && orderType !== "on_demand") {
    console.error('Order type must be "catering" or "on_demand"');
    process.exit(1);
  }

  console.log(`Sending admin notification for ${orderType} order ${orderId}...`);

  const result = await notifyOrderCreated({
    orderId,
    orderType,
    source: "admin_dashboard",
  });

  console.log("Result:", result);
  process.exit(result.sent ? 0 : 1);
}

void main();
