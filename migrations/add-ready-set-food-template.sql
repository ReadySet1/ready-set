-- Ready Set Food Calculator Template Migration
-- Creates the standard Ready Set Food delivery compensation template with all required rules

-- 1. Create the Ready Set Food template
INSERT INTO calculator_templates (id, name, description, is_active)
VALUES (
  'ready-set-food-standard',
  'Ready Set Food Standard Delivery',
  'Standard compensation structure for Ready Set Food deliveries with tiered base fees and driver payments',
  true
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 2. Clear existing rules for this template (if any)
DELETE FROM pricing_rules WHERE template_id = 'ready-set-food-standard';

-- 3. Add customer charge rules
INSERT INTO pricing_rules (id, template_id, rule_type, rule_name, base_amount, per_unit_amount, threshold_value, threshold_type, priority, created_at, updated_at)
VALUES 
  -- Tiered base fee (customer pays)
  (gen_random_uuid(), 'ready-set-food-standard', 'customer_charge', 'tiered_base_fee', NULL, NULL, NULL, NULL, 100, NOW(), NOW()),
  
  -- Long distance charge for customers: $3/mile for miles > 10
  (gen_random_uuid(), 'ready-set-food-standard', 'customer_charge', 'long_distance', 0, 3.00, 10, 'above', 90, NOW(), NOW()),
  
  -- Bridge toll for customers: $8 flat fee when bridge required
  (gen_random_uuid(), 'ready-set-food-standard', 'customer_charge', 'bridge_toll', 8.00, NULL, NULL, NULL, 80, NOW(), NOW());

-- 4. Add driver payment rules  
INSERT INTO pricing_rules (id, template_id, rule_type, rule_name, base_amount, per_unit_amount, threshold_value, threshold_type, priority, created_at, updated_at)
VALUES
  -- Tiered base pay (driver gets) - includes first 10 miles
  (gen_random_uuid(), 'ready-set-food-standard', 'driver_payment', 'tiered_base_pay', NULL, NULL, NULL, NULL, 100, NOW(), NOW()),
  
  -- Mileage pay for drivers: $0.35/mile for miles > 10 only
  (gen_random_uuid(), 'ready-set-food-standard', 'driver_payment', 'mileage', 0, 0.35, 10, 'above', 90, NOW(), NOW()),
  
  -- Bridge toll reimbursement for drivers: $8 flat fee when bridge required
  (gen_random_uuid(), 'ready-set-food-standard', 'driver_payment', 'bridge_toll', 8.00, NULL, NULL, NULL, 80, NOW(), NOW()),
  
  -- Tip pass-through: 100% of tips go to driver (excludes bonus structure)
  (gen_random_uuid(), 'ready-set-food-standard', 'driver_payment', 'tips', NULL, NULL, NULL, NULL, 70, NOW(), NOW());

-- 5. Verify the migration
SELECT 
  t.name as template_name,
  r.rule_type,
  r.rule_name,
  r.base_amount,
  r.per_unit_amount,
  r.threshold_value,
  r.threshold_type,
  r.priority
FROM calculator_templates t
JOIN pricing_rules r ON t.id = r.template_id
WHERE t.id = 'ready-set-food-standard'
ORDER BY r.rule_type, r.priority DESC;
