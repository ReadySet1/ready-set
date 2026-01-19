#!/usr/bin/env tsx

/**
 * Update test order coordinates
 * Run: pnpm tsx scripts/update-test-order-coords.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Test orders that need coordinates
const testOrders = [
  {
    orderNumber: 'SV-9837465',
    // San Mateo, CA - Camino Real Ave area
    coords: { lat: 37.5630, lng: -122.3255 },
  },
  {
    orderNumber: 'CC-34213',
    // San Jose, CA - general downtown area
    coords: { lat: 37.3382, lng: -121.8863 },
  },
  {
    orderNumber: 'SV-1232323',
    // San Francisco, CA - general area
    coords: { lat: 37.7749, lng: -122.4194 },
  },
];

async function updateOrderCoords(orderNumber: string, coords: { lat: number; lng: number }) {
  // Try catering order first
  let order = await prisma.cateringRequest.findFirst({
    where: { orderNumber },
    select: { id: true, deliveryAddressId: true, deliveryAddress: { select: { street1: true, city: true } } },
  });

  if (!order) {
    // Try on-demand order
    order = await prisma.onDemand.findFirst({
      where: { orderNumber },
      select: { id: true, deliveryAddressId: true, deliveryAddress: { select: { street1: true, city: true } } },
    });
  }

  if (!order) {
    console.log(`❌ Order not found: ${orderNumber}`);
    return false;
  }

  console.log(`📦 ${orderNumber}: ${order.deliveryAddress.street1}, ${order.deliveryAddress.city}`);

  await prisma.address.update({
    where: { id: order.deliveryAddressId },
    data: {
      latitude: coords.lat,
      longitude: coords.lng,
    },
  });

  console.log(`   ✅ Updated to: ${coords.lat}, ${coords.lng}`);
  return true;
}

async function main() {
  console.log('🔧 Updating test order coordinates...\n');

  for (const order of testOrders) {
    await updateOrderCoords(order.orderNumber, order.coords);
  }

  console.log('\n✅ Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
