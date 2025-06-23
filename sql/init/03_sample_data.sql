-- Sample data for testing the driver tracking system

-- Insert sample drivers
INSERT INTO public.drivers (
    id, 
    employee_id, 
    vehicle_number, 
    license_number, 
    phone_number, 
    is_active, 
    is_on_duty,
    last_known_location,
    last_location_update,
    metadata
) VALUES 
(
    gen_random_uuid(),
    'EMP001',
    'VEH001',
    'DL123456789',
    '+1234567890',
    true,
    true,
    ST_GeogFromText('POINT(-97.7431 30.2672)'), -- Austin, TX
    NOW(),
    '{"vehicle_type": "van", "capacity": "medium"}'::jsonb
),
(
    gen_random_uuid(),
    'EMP002', 
    'VEH002',
    'DL987654321',
    '+1987654321',
    true,
    false,
    ST_GeogFromText('POINT(-122.4194 37.7749)'), -- San Francisco, CA
    NOW() - INTERVAL '15 minutes',
    '{"vehicle_type": "truck", "capacity": "large"}'::jsonb
),
(
    gen_random_uuid(),
    'EMP003',
    'VEH003', 
    'DL456789123',
    '+1456789123',
    true,
    true,
    ST_GeogFromText('POINT(-97.7431 30.2672)'), -- Austin, TX
    NOW() - INTERVAL '5 minutes',
    '{"vehicle_type": "car", "capacity": "small"}'::jsonb
);

-- Insert sample deliveries
WITH driver_data AS (
    SELECT id, employee_id FROM public.drivers WHERE employee_id IN ('EMP001', 'EMP002', 'EMP003')
)
INSERT INTO public.deliveries (
    id,
    driver_id,
    invoice_ninja_invoice_id,
    status,
    pickup_location,
    delivery_location,
    assigned_at,
    estimated_arrival,
    metadata
)
SELECT 
    gen_random_uuid(),
    d.id,
    'INV-' || d.employee_id || '-' || EXTRACT(EPOCH FROM NOW())::text,
    CASE 
        WHEN d.employee_id = 'EMP001' THEN 'in_progress'
        WHEN d.employee_id = 'EMP002' THEN 'assigned'
        ELSE 'completed'
    END,
    ST_GeogFromText('POINT(-97.7431 30.2672)'), -- Austin pickup
    ST_GeogFromText('POINT(-97.7431 30.2672)'), -- Austin delivery (slightly different coordinates)
    NOW() - INTERVAL '30 minutes',
    NOW() + INTERVAL '45 minutes',
    ('{"priority": "high", "customer_name": "Test Customer ' || d.employee_id || '", "order_value": 150.00}')::jsonb
FROM driver_data d;

-- Insert sample location history
WITH driver_data AS (
    SELECT id, employee_id FROM public.drivers WHERE employee_id = 'EMP001'
)
INSERT INTO public.driver_locations (
    driver_id,
    location,
    accuracy,
    speed,
    heading,
    is_moving,
    activity_type,
    recorded_at
)
SELECT 
    d.id,
    ST_GeogFromText('POINT(' || 
        (-97.7431 + (random() - 0.5) * 0.01)::text || ' ' || 
        (30.2672 + (random() - 0.5) * 0.01)::text || 
    ')'),
    5.0 + random() * 10,
    CASE WHEN random() > 0.3 THEN 25 + random() * 35 ELSE 0 END,
    random() * 360,
    random() > 0.3,
    CASE 
        WHEN random() > 0.7 THEN 'driving'
        WHEN random() > 0.4 THEN 'stationary'
        ELSE 'walking'
    END,
    NOW() - INTERVAL '1 hour' + (random() * INTERVAL '1 hour')
FROM driver_data d, generate_series(1, 20);

-- Insert sample tracking events
WITH delivery_data AS (
    SELECT d.id as delivery_id, dr.id as driver_id 
    FROM public.deliveries d 
    JOIN public.drivers dr ON d.driver_id = dr.id 
    WHERE dr.employee_id = 'EMP001'
    LIMIT 1
)
INSERT INTO public.tracking_events (
    delivery_id,
    driver_id,
    event_type,
    location,
    metadata
)
SELECT 
    dd.delivery_id,
    dd.driver_id,
    event_type,
    ST_GeogFromText('POINT(-97.7431 30.2672)'),
    ('{"timestamp": "' || (NOW() - interval_offset)::text || '", "details": "' || event_type || ' event"}')::jsonb
FROM delivery_data dd,
LATERAL (VALUES 
    ('delivery_assigned', INTERVAL '30 minutes'),
    ('driver_departed', INTERVAL '25 minutes'),
    ('arrived_at_pickup', INTERVAL '15 minutes'),
    ('pickup_completed', INTERVAL '10 minutes'),
    ('en_route_to_delivery', INTERVAL '8 minutes')
) AS events(event_type, interval_offset);

-- Insert sample geofences
INSERT INTO public.geofences (
    name,
    type,
    polygon,
    metadata
) VALUES 
(
    'Austin Downtown Delivery Zone',
    'delivery',
    ST_GeogFromText('POLYGON((-97.7631 30.2472, -97.7231 30.2472, -97.7231 30.2872, -97.7631 30.2872, -97.7631 30.2472))'),
    '{"zone_id": "ATX_DT_01", "priority": "high", "max_delivery_time": 30}'::jsonb
),
(
    'Restaurant Pickup Zone - Central',
    'pickup', 
    ST_GeogFromText('POLYGON((-97.7531 30.2572, -97.7331 30.2572, -97.7331 30.2772, -97.7531 30.2772, -97.7531 30.2572))'),
    '{"zone_id": "ATX_PU_01", "restaurant_count": 25, "avg_prep_time": 15}'::jsonb
); 