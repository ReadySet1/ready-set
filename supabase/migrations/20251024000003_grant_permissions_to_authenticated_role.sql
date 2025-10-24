-- Grant necessary permissions to authenticated role
-- This allows RLS policies to work correctly by giving the authenticated role
-- base permissions on the tables before RLS policies filter the rows

-- Grant permissions on address_favorites to authenticated users
GRANT SELECT ON address_favorites TO authenticated;
GRANT INSERT ON address_favorites TO authenticated;
GRANT DELETE ON address_favorites TO authenticated;

-- Grant permissions on address_usage_history to authenticated users
GRANT SELECT ON address_usage_history TO authenticated;
GRANT INSERT ON address_usage_history TO authenticated;

-- Also grant SELECT on addresses since we're joining to it
GRANT SELECT ON addresses TO authenticated;
