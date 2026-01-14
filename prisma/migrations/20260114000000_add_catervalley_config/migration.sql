-- Add CaterValley configuration to delivery_configurations table
-- This enables CaterValley to appear as a vendor option in the calculator UI

INSERT INTO "delivery_configurations" (
    "id",
    "config_id",
    "client_name",
    "vendor_name",
    "description",
    "is_active",
    "pricing_tiers",
    "mileage_rate",
    "distance_threshold",
    "daily_drive_discounts",
    "driver_pay_settings",
    "bridge_toll_settings",
    "custom_settings",
    "created_at",
    "updated_at",
    "notes"
) VALUES (
    gen_random_uuid(),
    'cater-valley',
    'CaterValley',
    'CaterValley',
    'CaterValley delivery pricing with $42.50 minimum delivery fee',
    true,
    '[
        {"headcountMin": 0, "headcountMax": 25, "foodCostMin": 0, "foodCostMax": 300, "regularRate": 85, "within10Miles": 42.50},
        {"headcountMin": 26, "headcountMax": 49, "foodCostMin": 300.01, "foodCostMax": 599.99, "regularRate": 90, "within10Miles": 52.50},
        {"headcountMin": 50, "headcountMax": 74, "foodCostMin": 600, "foodCostMax": 899.99, "regularRate": 110, "within10Miles": 62.50},
        {"headcountMin": 75, "headcountMax": 99, "foodCostMin": 900, "foodCostMax": 1199.99, "regularRate": 120, "within10Miles": 72.50},
        {"headcountMin": 100, "headcountMax": null, "foodCostMin": 1200, "foodCostMax": null, "regularRate": 0, "within10Miles": 0, "regularRatePercent": 0.10, "within10MilesPercent": 0.10}
    ]'::jsonb,
    3.00,
    10.00,
    '{"twoDrivers": 5, "threeDrivers": 10, "fourPlusDrivers": 15}'::jsonb,
    '{"maxPayPerDrop": null, "basePayPerDrop": 18, "driverMileageRate": 0.70, "bonusPay": 10, "readySetFee": 70}'::jsonb,
    '{"defaultTollAmount": 8.00, "autoApplyForAreas": ["San Francisco", "Oakland", "Marin County"]}'::jsonb,
    '{"tollPaidByReadySet": true}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'CaterValley pricing with $42.50 minimum delivery fee. Driver pay: $18 base + $10 bonus + ($0.70/mile). Bridge toll ($8) is driver compensation paid by Ready Set, NOT charged to customer.'
)
ON CONFLICT ("config_id") DO UPDATE SET
    "client_name" = EXCLUDED."client_name",
    "vendor_name" = EXCLUDED."vendor_name",
    "description" = EXCLUDED."description",
    "is_active" = EXCLUDED."is_active",
    "pricing_tiers" = EXCLUDED."pricing_tiers",
    "mileage_rate" = EXCLUDED."mileage_rate",
    "distance_threshold" = EXCLUDED."distance_threshold",
    "daily_drive_discounts" = EXCLUDED."daily_drive_discounts",
    "driver_pay_settings" = EXCLUDED."driver_pay_settings",
    "bridge_toll_settings" = EXCLUDED."bridge_toll_settings",
    "custom_settings" = EXCLUDED."custom_settings",
    "notes" = EXCLUDED."notes",
    "updated_at" = CURRENT_TIMESTAMP;
