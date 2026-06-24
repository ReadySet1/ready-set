-- Update bridge toll from $8.00 to $8.50 across all delivery configurations.
-- Only touches the defaultTollAmount key inside the bridge_toll_settings JSON
-- column; all other config fields are left intact. Idempotent.

UPDATE delivery_configurations
SET bridge_toll_settings = jsonb_set(
      bridge_toll_settings::jsonb,
      '{defaultTollAmount}',
      '8.5'::jsonb
    ),
    updated_at = now()
WHERE (bridge_toll_settings::jsonb ->> 'defaultTollAmount')::numeric < 8.50;
