-- Development Database Initialization Script
-- This script runs when the PostgreSQL container starts for the first time

-- Enable useful PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create auth schema for Supabase compatibility
CREATE SCHEMA IF NOT EXISTS auth;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO dev_user;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO dev_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO dev_user;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA auth TO dev_user;

-- Create some development-specific helper functions
CREATE OR REPLACE FUNCTION generate_random_uuid()
RETURNS uuid AS $$
BEGIN
    RETURN gen_random_uuid();
END;
$$ LANGUAGE plpgsql;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Ready Set Development Database initialized successfully!';
    RAISE NOTICE 'Database: ready_set_dev';
    RAISE NOTICE 'User: dev_user';
    RAISE NOTICE 'Extensions enabled: uuid-ossp, pgcrypto';
END $$; 