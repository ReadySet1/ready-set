-- Final Ready Set Food Template Setup - Simple approach

-- 1. Insert the template
INSERT INTO calculator_templates (name, description, is_active)
VALUES ('Ready Set Food Standard Delivery', 'Standard compensation structure for Ready Set Food deliveries with tiered base fees and driver payments', true);

-- 2. Get the template ID we just created
-- We'll insert rules using a subquery to get the template ID

-- Customer charge rules
INSERT INTO pricing_rules (template_id, rule_type, rule_name, base_amount, per_unit_amount, threshold_value, threshold_type, priority)
SELECT id, 'customer_charge', 'tiered_base_fee', NULL, NULL, NULL, NULL, 100
FROM calculator_templates WHERE name = 'Ready Set Food Standard Delivery';

INSERT INTO pricing_rules (template_id, rule_type, rule_name, base_amount, per_unit_amount, threshold_value, threshold_type, priority)
SELECT id, 'customer_charge', 'long_distance', 0, 3.00, 10, 'above', 90
FROM calculator_templates WHERE name = 'Ready Set Food Standard Delivery';

INSERT INTO pricing_rules (template_id, rule_type, rule_name, base_amount, per_unit_amount, threshold_value, threshold_type, priority)
SELECT id, 'customer_charge', 'bridge_toll', 8.00, NULL, NULL, NULL, 80
FROM calculator_templates WHERE name = 'Ready Set Food Standard Delivery';

-- Driver payment rules
INSERT INTO pricing_rules (template_id, rule_type, rule_name, base_amount, per_unit_amount, threshold_value, threshold_type, priority)
SELECT id, 'driver_payment', 'tiered_base_pay', NULL, NULL, NULL, NULL, 100
FROM calculator_templates WHERE name = 'Ready Set Food Standard Delivery';

INSERT INTO pricing_rules (template_id, rule_type, rule_name, base_amount, per_unit_amount, threshold_value, threshold_type, priority)
SELECT id, 'driver_payment', 'mileage', 0, 0.35, 10, 'above', 90
FROM calculator_templates WHERE name = 'Ready Set Food Standard Delivery';

INSERT INTO pricing_rules (template_id, rule_type, rule_name, base_amount, per_unit_amount, threshold_value, threshold_type, priority)
SELECT id, 'driver_payment', 'bridge_toll', 8.00, NULL, NULL, NULL, 80
FROM calculator_templates WHERE name = 'Ready Set Food Standard Delivery';

INSERT INTO pricing_rules (template_id, rule_type, rule_name, base_amount, per_unit_amount, threshold_value, threshold_type, priority)
SELECT id, 'driver_payment', 'tips', NULL, NULL, NULL, NULL, 70
FROM calculator_templates WHERE name = 'Ready Set Food Standard Delivery';

-- 3. Show the result
SELECT 
  t.name as template_name,
  t.id,
  r.rule_type,
  r.rule_name,
  r.base_amount,
  r.per_unit_amount,
  r.threshold_value,
  r.threshold_type,
  r.priority
FROM calculator_templates t
LEFT JOIN pricing_rules r ON t.id = r.template_id
WHERE t.name = 'Ready Set Food Standard Delivery'
ORDER BY r.rule_type, r.priority DESC;
