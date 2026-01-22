#!/usr/bin/env tsx

/**
 * Geocode Order Addresses
 *
 * Updates orders with missing GPS coordinates by geocoding their delivery addresses
 * using the Mapbox Geocoding API.
 *
 * Run with: pnpm tsx scripts/geocode-order-addresses.ts [order_number]
 * Example: pnpm tsx scripts/geocode-order-addresses.ts SV-9837465
 *
 * Without an order number, it will list all orders missing coordinates.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || process.env.MAPBOX_ACCESS_TOKEN;

interface GeocodingResult {
  features: Array<{
    center: [number, number]; // [lng, lat]
    place_name: string;
    relevance: number;
  }>;
}

async function geocodeAddress(
  street: string,
  city: string,
  state: string,
  zip: string,
  country: string = 'US'
): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN) {
    console.error('❌ MAPBOX_ACCESS_TOKEN not configured');
    return null;
  }

  const address = `${street}, ${city}, ${state} ${zip}, ${country}`;
  const encodedAddress = encodeURIComponent(address);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${MAPBOX_TOKEN}&limit=1`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Geocoding API error: ${response.status}`);
      return null;
    }

    const data: GeocodingResult = await response.json();

    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      if (feature) {
        const [lng, lat] = feature.center;
        console.log(`  📍 Geocoded: ${feature.place_name}`);
        console.log(`     Coordinates: ${lat}, ${lng} (relevance: ${feature.relevance})`);
        return { lat, lng };
      }
    }

    console.warn(`  ⚠️  No geocoding results for: ${address}`);
    return null;
  } catch (error) {
    console.error(`  ❌ Geocoding error:`, error);
    return null;
  }
}

async function getOrdersWithMissingCoordinates() {
  // Get catering orders with missing coordinates
  const cateringOrders = await prisma.cateringRequest.findMany({
    where: {
      deletedAt: null,
      deliveryAddress: {
        OR: [
          { latitude: null },
          { longitude: null },
        ],
      },
    },
    select: {
      id: true,
      orderNumber: true,
      deliveryAddress: {
        select: {
          id: true,
          street1: true,
          city: true,
          state: true,
          zip: true,
          county: true,
          latitude: true,
          longitude: true,
        },
      },
      user: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Get on-demand orders with missing coordinates
  const onDemandOrders = await prisma.onDemand.findMany({
    where: {
      deletedAt: null,
      deliveryAddress: {
        OR: [
          { latitude: null },
          { longitude: null },
        ],
      },
    },
    select: {
      id: true,
      orderNumber: true,
      deliveryAddress: {
        select: {
          id: true,
          street1: true,
          city: true,
          state: true,
          zip: true,
          county: true,
          latitude: true,
          longitude: true,
        },
      },
      user: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return [
    ...cateringOrders.map(o => ({ ...o, type: 'catering' as const })),
    ...onDemandOrders.map(o => ({ ...o, type: 'on-demand' as const })),
  ];
}

async function geocodeOrderByNumber(orderNumber: string) {
  // Try catering first
  let order = await prisma.cateringRequest.findFirst({
    where: {
      orderNumber: orderNumber,
      deletedAt: null,
    },
    select: {
      id: true,
      orderNumber: true,
      deliveryAddress: {
        select: {
          id: true,
          street1: true,
          city: true,
          state: true,
          zip: true,
          county: true,
          latitude: true,
          longitude: true,
        },
      },
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  let orderType = 'catering';

  // If not found, try on-demand
  if (!order) {
    order = await prisma.onDemand.findFirst({
      where: {
        orderNumber: orderNumber,
        deletedAt: null,
      },
      select: {
        id: true,
        orderNumber: true,
        deliveryAddress: {
          select: {
            id: true,
            street1: true,
            city: true,
            state: true,
            zip: true,
            county: true,
            latitude: true,
            longitude: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
      },
    });
    orderType = 'on-demand';
  }

  if (!order) {
    console.error(`❌ Order not found: ${orderNumber}`);
    return null;
  }

  console.log(`\n📦 Found ${orderType} order: ${order.orderNumber}`);
  console.log(`   Customer: ${order.user?.name || 'Unknown'}`);
  console.log(`   Address: ${order.deliveryAddress.street1}, ${order.deliveryAddress.city}, ${order.deliveryAddress.state} ${order.deliveryAddress.zip}`);
  console.log(`   Current coordinates: ${order.deliveryAddress.latitude ?? 'null'}, ${order.deliveryAddress.longitude ?? 'null'}`);

  // Geocode the address
  const coords = await geocodeAddress(
    order.deliveryAddress.street1 || '',
    order.deliveryAddress.city || '',
    order.deliveryAddress.state || '',
    order.deliveryAddress.zip || ''
  );

  if (coords) {
    // Update the address with coordinates
    await prisma.address.update({
      where: { id: order.deliveryAddress.id },
      data: {
        latitude: coords.lat,
        longitude: coords.lng,
      },
    });
    console.log(`\n✅ Updated address coordinates for ${order.orderNumber}`);
    return coords;
  } else {
    console.log(`\n❌ Could not geocode address for ${order.orderNumber}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // List all orders with missing coordinates
    console.log('🔍 Finding orders with missing GPS coordinates...\n');
    const orders = await getOrdersWithMissingCoordinates();

    if (orders.length === 0) {
      console.log('✅ All orders have GPS coordinates!');
      return;
    }

    console.log(`Found ${orders.length} orders with missing coordinates:\n`);
    for (const order of orders) {
      console.log(`  📦 #${order.orderNumber} (${order.type})`);
      console.log(`     Customer: ${order.user?.name || 'Unknown'}`);
      console.log(`     Address: ${order.deliveryAddress.street1}, ${order.deliveryAddress.city}, ${order.deliveryAddress.state} ${order.deliveryAddress.zip}`);
      console.log('');
    }

    console.log('\nTo geocode a specific order, run:');
    console.log('  pnpm tsx scripts/geocode-order-addresses.ts <order_number>');
    console.log('\nTo geocode ALL orders, run:');
    console.log('  pnpm tsx scripts/geocode-order-addresses.ts --all');
  } else if (args[0] === '--all') {
    // Geocode all orders with missing coordinates
    console.log('🔍 Geocoding all orders with missing coordinates...\n');
    const orders = await getOrdersWithMissingCoordinates();

    if (orders.length === 0) {
      console.log('✅ All orders have GPS coordinates!');
      return;
    }

    let success = 0;
    let failed = 0;

    for (const order of orders) {
      const result = await geocodeOrderByNumber(order.orderNumber);
      if (result) {
        success++;
      } else {
        failed++;
      }
      // Rate limit: wait 200ms between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\n📊 Summary: ${success} geocoded, ${failed} failed`);
  } else {
    // Geocode specific order(s)
    for (const orderNumber of args) {
      await geocodeOrderByNumber(orderNumber);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
