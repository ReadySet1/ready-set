-- Enable required extensions for tracking system
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create schemas if needed
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS auth;

-- Grant permissions
GRANT ALL ON SCHEMA public TO tracking_user;
GRANT ALL ON SCHEMA auth TO tracking_user; 