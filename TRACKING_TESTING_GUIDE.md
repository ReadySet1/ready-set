# Driver Tracking System - Local Testing Guide

This guide walks you through setting up and testing the driver tracking system locally using Docker before deploying to production.

## Prerequisites

- Docker and Docker Compose installed
- Node.js and pnpm
- Your existing `.env.local` file with Supabase keys

## Quick Start

### Option 1: One-Command Setup (Recommended)
```bash
./scripts/start-tracking-dev.sh
```
This script will handle everything: Docker setup, dependencies, environment file, and start the dev server.

### Option 2: Manual Setup

1. **Set up the local tracking database:**
   ```bash
   ./scripts/setup-tracking-test.sh
   ```

2. **Copy environment variables:**
   ```bash
   cp env.tracking.template .env.local
   # Edit .env.local and add your actual API keys
   ```

3. **Install dependencies:**
   ```bash
   pnpm add pg @types/pg
   ```

4. **Start your Next.js app:**
   ```bash
   pnpm dev
   ```

5. **Test the system:**
   ```bash
   curl http://localhost:3000/api/tracking/test
   ```

## Architecture Overview

The local testing setup includes:

- **PostgreSQL with PostGIS** (Port 5434) - Geospatial database
- **Redis** (Port 6379) - Real-time data caching
- **Sample Data** - Pre-loaded test drivers and locations

## Database Schema

### Core Tables

1. **drivers** - Driver profiles and current status
2. **driver_locations** - Location history with timestamps
3. **deliveries** - Delivery assignments and status
4. **tracking_events** - Audit trail of delivery events
5. **geofences** - Delivery zones and restrictions

### Key Features

- **PostGIS Integration** - Geospatial queries and distance calculations
- **Real-time Tracking** - Location updates with timestamps
- **Performance Optimized** - Proper indexing for spatial queries
- **Audit Trail** - Complete tracking event history

## API Endpoints

### 1. Driver Management
```bash
# List all drivers
GET /api/tracking/drivers

# Create new driver
POST /api/tracking/drivers
{
  "employee_id": "EMP004",
  "vehicle_number": "VEH004", 
  "license_number": "DL123456789",
  "phone_number": "+1234567890",
  "metadata": {"vehicle_type": "van"}
}

# Update driver location/status
PUT /api/tracking/drivers
{
  "driver_id": "uuid-here",
  "location": {"latitude": 30.2672, "longitude": -97.7431},
  "is_on_duty": true
}
```

### 2. Location Tracking
```bash
# Record location
POST /api/tracking/locations
{
  "driver_id": "uuid-here",
  "latitude": 30.2672,
  "longitude": -97.7431,
  "accuracy": 5.0,
  "speed": 25.5,
  "is_moving": true,
  "activity_type": "driving"
}

# Get location history
GET /api/tracking/locations?driver_id=uuid-here&hours=24&limit=100
```

### 3. System Testing
```bash
# Health check
GET /api/tracking/test

# Performance tests
POST /api/tracking/test
{
  "test_type": "all"
}
```

## Testing Scenarios

### 1. Basic Connectivity Test
```bash
curl -X GET http://localhost:3000/api/tracking/test
```

Expected response:
```json
{
  "success": true,
  "overall_status": "HEALTHY",
  "tests": [
    {"name": "Database Connectivity", "status": "PASS"},
    {"name": "PostGIS Extension", "status": "PASS"},
    {"name": "Required Tables", "status": "PASS"}
  ]
}
```

### 2. Driver Creation Test
```bash
curl -X POST http://localhost:3000/api/tracking/drivers \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "TEST001",
    "vehicle_number": "TEST-VEH-001",
    "phone_number": "+1234567890",
    "metadata": {"test": true}
  }'
```

### 3. Location Update Test
```bash
# First get a driver ID from the drivers endpoint
DRIVER_ID=$(curl -s http://localhost:3000/api/tracking/drivers | jq -r '.data[0].id')

# Record a location
curl -X POST http://localhost:3000/api/tracking/locations \
  -H "Content-Type: application/json" \
  -d "{
    \"driver_id\": \"$DRIVER_ID\",
    \"latitude\": 30.2672,
    \"longitude\": -97.7431,
    \"accuracy\": 5.0,
    \"speed\": 35.0,
    \"is_moving\": true,
    \"activity_type\": \"driving\"
  }"
```

### 4. Geospatial Query Test
```bash
# Test spatial queries through the database
docker exec ready-set-tracking-db psql -U tracking_user -d ready_set_tracking -c "
SELECT 
  employee_id,
  ST_Distance(
    last_known_location, 
    ST_GeogFromText('POINT(-97.7431 30.2672)')
  ) as distance_meters
FROM drivers 
WHERE last_known_location IS NOT NULL
ORDER BY distance_meters;
"
```

## Performance Testing

### Location Insert Performance
```bash
curl -X POST http://localhost:3000/api/tracking/test \
  -H "Content-Type: application/json" \
  -d '{"test_type": "basic"}'
```

### Spatial Query Performance
```bash
curl -X POST http://localhost:3000/api/tracking/test \
  -H "Content-Type: application/json" \
  -d '{"test_type": "spatial"}'
```

## Environment Variables

Key variables needed in your `.env.local`:

```env
# Database (Local Testing)
DATABASE_URL="postgresql://tracking_user:tracking_pass@localhost:5434/ready_set_tracking?schema=public"

# Redis (Optional for caching)
REDIS_URL="redis://localhost:6379"

# External APIs (Add your keys)
GOOGLE_MAPS_API_KEY="your_key_here"
MAPBOX_ACCESS_TOKEN="your_token_here"

# Production Supabase (Keep existing)
NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_key"
```

## Monitoring and Debugging

### View Database Contents
```bash
# Connect to database
docker exec -it ready-set-tracking-db psql -U tracking_user -d ready_set_tracking

# Useful queries
SELECT COUNT(*) FROM drivers;
SELECT COUNT(*) FROM driver_locations;
SELECT employee_id, is_on_duty, last_location_update FROM drivers;
```

### View Container Logs
```bash
# Database logs
docker logs ready-set-tracking-db

# Redis logs  
docker logs ready-set-tracking-redis

# All tracking services
docker-compose -f docker-compose.tracking.yml logs -f
```

### Performance Monitoring
```bash
# Monitor location insert performance
docker exec ready-set-tracking-db psql -U tracking_user -d ready_set_tracking -c "
SELECT 
  DATE_TRUNC('minute', recorded_at) as minute,
  COUNT(*) as locations_per_minute
FROM driver_locations 
WHERE recorded_at >= NOW() - INTERVAL '1 hour'
GROUP BY minute 
ORDER BY minute DESC;
"
```

## Cleanup

### Stop Services
```bash
docker-compose -f docker-compose.tracking.yml down
```

### Remove Data (Complete Reset)
```bash
docker-compose -f docker-compose.tracking.yml down -v
```

### Clean Up Test Data
```bash
docker exec ready-set-tracking-db psql -U tracking_user -d ready_set_tracking -c "
DELETE FROM driver_locations WHERE driver_id IN (
  SELECT id FROM drivers WHERE employee_id LIKE 'TEST%'
);
DELETE FROM drivers WHERE employee_id LIKE 'TEST%';
"
```

## Production Migration

Once testing is complete, migrate to production:

1. **Update Environment Variables:**
   - Switch `DATABASE_URL` back to your production Supabase
   - Update API keys for production

2. **Run Supabase Migration:**
   ```bash
   # Copy the SQL files to your Supabase migration
   cp sql/init/02_driver_tracking_schema.sql supabase/migrations/
   ```

3. **Deploy API Endpoints:**
   Your tracking API endpoints will work with production Supabase

4. **Configure Real-time:**
   Enable real-time subscriptions in Supabase dashboard

## Troubleshooting

### Common Issues

1. **PostGIS Extension Error:**
   ```bash
   docker exec ready-set-tracking-db psql -U tracking_user -d ready_set_tracking -c "CREATE EXTENSION IF NOT EXISTS postgis;"
   ```

2. **Connection Refused:**
   - Check if Docker is running
   - Verify ports are not in use: `lsof -i :5434`

3. **Permission Errors:**
   ```bash
   docker exec ready-set-tracking-db psql -U tracking_user -d ready_set_tracking -c "GRANT ALL ON SCHEMA public TO tracking_user;"
   ```

4. **TypeScript Errors:**
   ```bash
   pnpm install @types/pg
   ```

## Next Steps

After successful local testing:

1. Implement real-time WebSocket connections
2. Add route optimization algorithms  
3. Integrate with mapping services (Google Maps/Mapbox)
4. Add delivery status notifications
5. Implement driver mobile app API

For questions or issues, check the logs and run the test endpoint to diagnose problems. 