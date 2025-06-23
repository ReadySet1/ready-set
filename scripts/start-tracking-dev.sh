#!/bin/bash

# Quick start script for Driver Tracking System development
# This script sets up everything you need to start developing locally

set -e

echo "🚀 Starting Driver Tracking Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Step 1: Check prerequisites
print_step "1. Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker and try again."
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is not installed. Please install pnpm and try again."
    exit 1
fi

print_status "Prerequisites check passed!"

# Step 2: Setup environment file
print_step "2. Setting up environment file..."

if [ ! -f .env.local ]; then
    if [ -f env.tracking.template ]; then
        cp env.tracking.template .env.local
        print_status "Created .env.local from template"
        print_warning "Please edit .env.local and add your actual API keys!"
    else
        print_error "env.tracking.template not found!"
        exit 1
    fi
else
    print_status ".env.local already exists"
fi

# Step 3: Install dependencies
print_step "3. Installing dependencies..."
pnpm add pg @types/pg

# Step 4: Setup Docker services
print_step "4. Setting up Docker services..."
./scripts/setup-tracking-test.sh

# Step 5: Wait a moment for services to be ready
print_step "5. Waiting for services to stabilize..."
sleep 5

# Step 6: Test the setup
print_step "6. Testing the setup..."
if docker exec ready-set-tracking-db psql -U tracking_user -d ready_set_tracking -c "SELECT COUNT(*) FROM drivers;" > /dev/null 2>&1; then
    print_status "Database test passed!"
else
    print_error "Database test failed!"
    exit 1
fi

# Step 7: Start Next.js development server
print_step "7. Starting Next.js development server..."
echo ""
print_status "🎉 Setup complete! Starting development server..."
echo ""
echo "Available endpoints:"
echo "  📊 Health Check: http://localhost:3000/api/tracking/test"
echo "  👥 Drivers API:  http://localhost:3000/api/tracking/drivers"
echo "  📍 Locations:    http://localhost:3000/api/tracking/locations"
echo ""
echo "Database access:"
echo "  🐘 PostgreSQL:   localhost:5434"
echo "  🔴 Redis:        localhost:6379"
echo ""
echo "Press Ctrl+C to stop the development server"
echo ""

# Start the development server
pnpm dev 