/**
 * POST /api/vendor/calculator/quote
 *
 * Vendor-facing delivery cost estimator. A logged-in VENDOR can estimate
 * their own delivery cost against their own pricing configuration.
 *
 * The config ID is resolved server-side from the caller's profile
 * (company_name → resolveConfigId → DB-first config chain).
 *
 * Returns customer-facing fields ONLY — never exposes driver pay, margin,
 * RS fee, or any internal breakdown.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { resolveConfigId } from '@/lib/calculator/vendor-config-mapping';
import {
  calculateDeliveryCost,
  validateDeliveryCostInput,
} from '@/lib/calculator/delivery-cost-calculator';
import {
  getConfiguration,
  READY_SET_FOOD_STANDARD,
} from '@/lib/calculator/client-configurations';
import type { ClientDeliveryConfiguration } from '@/lib/calculator/client-configurations';
import { addSentryBreadcrumb, captureException } from '@/lib/monitoring/sentry';

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const quoteRequestSchema = z.object({
  headcount: z.number().int().nonnegative(),
  foodCost: z.number().nonnegative(),
  totalMileage: z.number().nonnegative(),
  numberOfDrives: z.number().int().min(1).optional().default(1),
  numberOfStops: z.number().int().min(1).optional().default(1),
  requiresBridge: z.boolean().optional().default(false),
});

type QuoteRequest = z.infer<typeof quoteRequestSchema>;

// ---------------------------------------------------------------------------
// Response type (customer-safe only)
// ---------------------------------------------------------------------------

interface VendorQuoteResponse {
  deliveryCost: number;
  mileageSurcharge: number;
  multiDriveDiscount: number;
  extraStopsCharge: number;
  bridgeToll: number;
  totalDeliveryFee: number;
  pricingProfileLabel: string;
  isFallbackPricing: boolean;
  requiresCustomQuote: boolean;
}

// ---------------------------------------------------------------------------
// Config resolution helpers
// ---------------------------------------------------------------------------

/**
 * Load a delivery configuration using the DB-first chain identical to
 * `GET /api/calculator/config`. Queries `delivery_configurations` table
 * first, merging boolean flags from in-memory defaults. Falls back to
 * the in-memory registry when no DB record exists.
 */
async function resolveConfig(
  configId: string,
): Promise<{ config: ClientDeliveryConfiguration; fromDb: boolean }> {
  try {
    const dbConfig = await prisma.deliveryConfiguration.findFirst({
      where: { configId, isActive: true },
    });

    if (dbConfig) {
      const inMemoryConfig = getConfiguration(configId);
      const dbDriverPay = dbConfig.driverPaySettings as Record<string, unknown>;
      const inMemoryDriverPay = inMemoryConfig?.driverPaySettings;

      // Merge boolean flags from in-memory defaults (same pattern as config/route.ts)
      const mergedDriverPaySettings = {
        ...dbDriverPay,
        readySetFeeMatchesDeliveryFee:
          dbDriverPay.readySetFeeMatchesDeliveryFee ??
          inMemoryDriverPay?.readySetFeeMatchesDeliveryFee,
        requiresManualReview:
          dbDriverPay.requiresManualReview ??
          inMemoryDriverPay?.requiresManualReview,
        includeDirectTipInReadySetTotal:
          dbDriverPay.includeDirectTipInReadySetTotal ??
          inMemoryDriverPay?.includeDirectTipInReadySetTotal,
      };

      const config: ClientDeliveryConfiguration = {
        id: dbConfig.configId,
        clientName: dbConfig.clientName,
        vendorName: dbConfig.vendorName,
        description: dbConfig.description ?? undefined,
        isActive: dbConfig.isActive,
        pricingTiers: dbConfig.pricingTiers as ClientDeliveryConfiguration['pricingTiers'],
        mileageRate: parseFloat(dbConfig.mileageRate.toString()),
        distanceThreshold: parseFloat(dbConfig.distanceThreshold.toString()),
        dailyDriveDiscounts:
          dbConfig.dailyDriveDiscounts as ClientDeliveryConfiguration['dailyDriveDiscounts'],
        driverPaySettings:
          mergedDriverPaySettings as ClientDeliveryConfiguration['driverPaySettings'],
        bridgeTollSettings:
          dbConfig.bridgeTollSettings as ClientDeliveryConfiguration['bridgeTollSettings'],
        zeroOrderSettings:
          (dbConfig.zeroOrderSettings as ClientDeliveryConfiguration['zeroOrderSettings']) ??
          undefined,
        createdAt: dbConfig.createdAt,
        updatedAt: dbConfig.updatedAt,
      };

      return { config, fromDb: true };
    }
  } catch (dbError) {
    // Log but don't fail — fall through to in-memory fallback
    console.warn(
      '[vendor-quote] DB lookup failed for config, falling back to in-memory:',
      dbError,
    );
  }

  // In-memory fallback
  const inMemoryConfig = getConfiguration(configId);
  if (inMemoryConfig) {
    return { config: inMemoryConfig, fromDb: false };
  }

  // Should not happen if configId came from resolveConfigId, but guard anyway
  return { config: READY_SET_FOOD_STANDARD, fromDb: false };
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Authenticate — VENDOR only
  const auth = await withAuth(request, {
    allowedRoles: ['VENDOR'],
    requireAuth: true,
  });

  if (!auth.success) {
    return auth.response;
  }

  try {
    // 2. Parse & validate request body
    const body: unknown = await request.json();
    const parsed = quoteRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const input: QuoteRequest = parsed.data;

    // 3. Check for TBD-tier inputs BEFORE calling the engine
    //    (300+ headcount or $2,500+ food cost → requiresCustomQuote)
    const validation = validateDeliveryCostInput({
      headcount: input.headcount,
      foodCost: input.foodCost,
      totalMileage: input.totalMileage,
      numberOfDrives: input.numberOfDrives,
      numberOfStops: input.numberOfStops,
      requiresBridge: input.requiresBridge,
    });

    if (!validation.valid) {
      // Distinguish TBD-tier from actual validation errors
      const isTbdTier = validation.errors.some((e) => e.includes('TBD'));

      if (isTbdTier) {
        // TBD tier — return 200 with requiresCustomQuote flag, not a 500
        return NextResponse.json<VendorQuoteResponse>({
          deliveryCost: 0,
          mileageSurcharge: 0,
          multiDriveDiscount: 0,
          extraStopsCharge: 0,
          bridgeToll: 0,
          totalDeliveryFee: 0,
          pricingProfileLabel: 'Custom Quote Required',
          isFallbackPricing: false,
          requiresCustomQuote: true,
        });
      }

      // Genuine validation error
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 },
      );
    }

    // 4. Load the caller's profile to get company_name
    const userId = auth.context.user.id;
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { companyName: true },
    });

    // 5. Resolve config from company name
    let configId: string | null = null;
    let isFallbackPricing = false;

    if (profile?.companyName) {
      configId = resolveConfigId(profile.companyName);
    }

    if (!configId) {
      // Fallback to READY_SET_FOOD_STANDARD
      configId = READY_SET_FOOD_STANDARD.id;
      isFallbackPricing = true;

      addSentryBreadcrumb(
        'Vendor calculator: falling back to standard config',
        {
          userId,
          companyName: profile?.companyName ?? '(none)',
          resolvedConfigId: configId,
        },
        'warning',
      );
    }

    // 6. DB-first config resolution
    const { config } = await resolveConfig(configId);

    // 7. Calculate delivery cost via the shared engine
    const breakdown = calculateDeliveryCost({
      headcount: input.headcount,
      foodCost: input.foodCost,
      totalMileage: input.totalMileage,
      numberOfDrives: input.numberOfDrives,
      numberOfStops: input.numberOfStops,
      requiresBridge: input.requiresBridge,
      configOverride: config,
    });

    // 8. CAL-08 guardrails (applied in vendor layer — do NOT modify the engine)
    //    a) Cap multiDriveDiscount so it can't exceed deliveryCost + mileageSurcharge
    const cappedMultiDriveDiscount = Math.min(
      breakdown.dailyDriveDiscount,
      breakdown.deliveryCost + breakdown.totalMileagePay,
    );

    //    b) Clamp totalDeliveryFee to >= 0
    const rawFee =
      breakdown.deliveryCost +
      breakdown.totalMileagePay -
      cappedMultiDriveDiscount +
      breakdown.extraStopsCharge +
      breakdown.bridgeToll;

    const totalDeliveryFee = Math.max(0, rawFee);

    // 9. Build customer-safe response
    const response: VendorQuoteResponse = {
      deliveryCost: breakdown.deliveryCost,
      mileageSurcharge: breakdown.totalMileagePay,
      multiDriveDiscount: cappedMultiDriveDiscount,
      extraStopsCharge: breakdown.extraStopsCharge,
      bridgeToll: breakdown.bridgeToll,
      totalDeliveryFee,
      pricingProfileLabel: config.clientName,
      isFallbackPricing,
      requiresCustomQuote: false,
    };

    return NextResponse.json(response);
  } catch (error) {
    captureException(error, {
      action: 'vendor_calculator_quote',
      feature: 'vendor-calculator',
      userId: auth.context.user.id,
    });

    // If the engine throws due to a config issue (e.g., manual review required),
    // surface it as a custom-quote scenario rather than a 500
    if (error instanceof Error && error.message.includes('manual review')) {
      return NextResponse.json<VendorQuoteResponse>({
        deliveryCost: 0,
        mileageSurcharge: 0,
        multiDriveDiscount: 0,
        extraStopsCharge: 0,
        bridgeToll: 0,
        totalDeliveryFee: 0,
        pricingProfileLabel: 'Custom Quote Required',
        isFallbackPricing: false,
        requiresCustomQuote: true,
      });
    }

    console.error('[vendor-quote] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
