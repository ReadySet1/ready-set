#!/bin/bash

# Setup script for Driver Tracking System local testing
# This script sets up the Docker environment and initializes the database

set -e

echo "🚀 Setting up Driver Tracking System for local testing..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose is not installed. Please install it and try again."
    exit 1
fi

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p sql/init
mkdir -p logs

# Stop existing containers if running
print_status "Stopping existing tracking containers..."
docker-compose -f docker-compose.tracking.yml down -v || true

# Start the tracking system containers
print_status "Starting tracking system containers..."
docker-compose -f docker-compose.tracking.yml up -d

# Wait for PostgreSQL to be ready
print_status "Waiting for PostgreSQL to be ready..."
timeout=60
counter=0
while ! docker exec ready-set-tracking-db pg_isready -U tracking_user -d ready_set_tracking > /dev/null 2>&1; do
    if [ $counter -ge $timeout ]; then
        print_error "PostgreSQL failed to start within $timeout seconds"
        exit 1
    fi
    sleep 1
    counter=$((counter + 1))
    echo -n "."
done
echo ""

print_status "PostgreSQL is ready!"

# Wait for Redis to be ready
print_status "Waiting for Redis to be ready..."
timeout=30
counter=0
while ! docker exec ready-set-tracking-redis redis-cli ping > /dev/null 2>&1; do
    if [ $counter -ge $timeout ]; then
        print_error "Redis failed to start within $timeout seconds"
        exit 1
    fi
    sleep 1
    counter=$((counter + 1))
    echo -n "."
done
echo ""

print_status "Redis is ready!"

# Test the database connection
print_status "Testing database connection..."
if docker exec ready-set-tracking-db psql -U tracking_user -d ready_set_tracking -c "SELECT version();" > /dev/null 2>&1; then
    print_status "Database connection successful!"
else    
    print_error "Failed to connect to database"
    exit 1
fi

# Test PostGIS extension
print_status "Testing PostGIS extension..."
if docker exec ready-set-tracking-db psql -U tracking_user -d ready_set_tracking -c "SELECT PostGIS_Version();" > /dev/null 2>&1; then
    print_status "PostGIS extension is working!"
else
    print_error "PostGIS extension is not working"
    exit 1
fi

# Show sample data
print_status "Sample data has been inserted. Here's a summary:"
docker exec ready-set-tracking-db psql -U tracking_user -d ready_set_tracking -c "
SELECT 'Drivers' as table_name, count(*) as count FROM drivers
UNION ALL
SELECT 'Deliveries', count(*) FROM deliveries  
UNION ALL
SELECT 'Driver Locations', count(*) FROM driver_locations
UNION ALL
SELECT 'Tracking Events', count(*) FROM tracking_events
UNION ALL
SELECT 'Geofences', count(*) FROM geofences;
"

echo ""
print_status "🎉 Tracking system setup complete!"
echo ""
echo "Database Details:"
echo "  Host: localhost"
echo "  Port: 5434"
echo "  Database: ready_set_tracking"
echo "  Username: tracking_user"
echo "  Password: tracking_pass"
echo ""
echo "Redis Details:"
echo "  Host: localhost"
echo "  Port: 6379"
echo ""
echo "Next steps:"
echo "  1. Copy env.tracking.template to .env.local (and update with your keys)"
echo "  2. Install dependencies: pnpm add pg @types/pg"
echo "  3. Run: pnpm dev"
echo "  4. Test the tracking API endpoints"
echo ""
echo "To stop the services: docker-compose -f docker-compose.tracking.yml down"
echo "To view logs: docker-compose -f docker-compose.tracking.yml logs -f" 