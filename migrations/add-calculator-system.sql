-- Calculator System Migration
-- Description: Adds flexible calculator system with templates, rules, and configurations

-- Calculator Templates (base configurations)
CREATE TABLE calculator_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pricing Rules (configurable rules for each template)
CREATE TABLE pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES calculator_templates(id) ON DELETE CASCADE,
  rule_type VARCHAR(50) NOT NULL, -- 'customer_charge' or 'driver_payment'
  rule_name VARCHAR(100) NOT NULL, -- 'base_fee', 'mileage', 'toll', etc.
  
  -- Rule configuration
  base_amount DECIMAL(10,2),
  per_unit_amount DECIMAL(10,2),
  threshold_value DECIMAL(10,2),
  threshold_type VARCHAR(50), -- 'above', 'below', 'between'
  
  -- Conditions
  applies_when TEXT, -- JSON string for complex conditions
  priority INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_template_rule UNIQUE(template_id, rule_type, rule_name)
);

-- Client-specific configurations
CREATE TABLE client_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES profiles(id),
  template_id UUID REFERENCES calculator_templates(id),
  client_name VARCHAR(255) NOT NULL,
  
  -- Override values (JSON for flexibility)
  rule_overrides JSONB DEFAULT '{}',
  
  -- Area-specific rules
  area_rules JSONB DEFAULT '[]',
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Calculation History
CREATE TABLE calculation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES calculator_templates(id),
  client_config_id UUID REFERENCES client_configurations(id),
  user_id UUID REFERENCES profiles(id),
  
  -- Input parameters
  input_data JSONB NOT NULL,
  
  -- Calculated results
  customer_charges JSONB NOT NULL,
  driver_payments JSONB NOT NULL,
  
  -- Totals
  customer_total DECIMAL(10,2) NOT NULL,
  driver_total DECIMAL(10,2) NOT NULL,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_pricing_rules_template ON pricing_rules(template_id);
CREATE INDEX idx_pricing_rules_type ON pricing_rules(rule_type);
CREATE INDEX idx_client_configs_client ON client_configurations(client_id);
CREATE INDEX idx_client_configs_template ON client_configurations(template_id);
CREATE INDEX idx_calculation_history_created ON calculation_history(created_at DESC);
CREATE INDEX idx_calculation_history_user ON calculation_history(user_id);
CREATE INDEX idx_calculation_history_template ON calculation_history(template_id);

-- Add comments for documentation
COMMENT ON TABLE calculator_templates IS 'Base calculator configurations that define pricing structures';
COMMENT ON TABLE pricing_rules IS 'Individual pricing rules that make up calculator templates';
COMMENT ON TABLE client_configurations IS 'Client-specific overrides and configurations for calculators';
COMMENT ON TABLE calculation_history IS 'Historical record of all calculations performed';

-- Insert default calculator template with standard rules
INSERT INTO calculator_templates (name, description) VALUES 
('Standard Delivery', 'Default delivery calculator with standard rates');

-- Get the template ID for inserting rules
WITH template AS (
  SELECT id FROM calculator_templates WHERE name = 'Standard Delivery'
)
-- Insert customer charge rules
INSERT INTO pricing_rules (template_id, rule_type, rule_name, base_amount, per_unit_amount, threshold_value, threshold_type, priority)
SELECT t.id, 'customer_charge', 'base_fee', 60.00, NULL, NULL, NULL, 100 FROM template t
UNION ALL
SELECT t.id, 'customer_charge', 'long_distance', NULL, 3.00, 10.00, 'above', 90 FROM template t
UNION ALL
SELECT t.id, 'customer_charge', 'bridge_toll', 8.00, NULL, NULL, NULL, 80 FROM template t
UNION ALL
SELECT t.id, 'customer_charge', 'extra_stops', NULL, 5.00, NULL, NULL, 70 FROM template t
UNION ALL
-- Insert driver payment rules
SELECT t.id, 'driver_payment', 'base_pay', 35.00, NULL, NULL, NULL, 100 FROM template t
UNION ALL
SELECT t.id, 'driver_payment', 'mileage', NULL, 0.70, NULL, NULL, 90 FROM template t
UNION ALL
SELECT t.id, 'driver_payment', 'bridge_toll', 8.00, NULL, NULL, NULL, 80 FROM template t
UNION ALL
SELECT t.id, 'driver_payment', 'extra_stops', NULL, 2.50, NULL, NULL, 70 FROM template t;
