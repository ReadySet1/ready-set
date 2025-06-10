#!/bin/bash

# Ready Set Development Database Setup Script
# This script sets up the complete development environment

set -e

echo "🚀 Setting up Ready Set Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

print_success "Docker is running"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is not installed. Please install pnpm and try again."
    exit 1
fi

print_success "pnpm is available"

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    print_status "Creating .env.local from example..."
    cp env.local.example .env.local
    print_warning "Please update .env.local with your actual values"
else
    print_success ".env.local already exists"
fi

# Stop existing containers
print_status "Stopping existing containers..."
docker-compose -f docker-compose.dev.yml down

# Start the development databases
print_status "Starting development databases..."
docker-compose -f docker-compose.dev.yml up -d postgres-dev postgres-test

# Wait for databases to be ready
print_status "Waiting for databases to be ready..."
sleep 10

# Check if databases are healthy
if docker-compose -f docker-compose.dev.yml ps postgres-dev | grep -q "healthy"; then
    print_success "Development database is healthy"
else
    print_error "Development database is not healthy"
    docker-compose -f docker-compose.dev.yml logs postgres-dev
    exit 1
fi

if docker-compose -f docker-compose.dev.yml ps postgres-test | grep -q "healthy"; then
    print_success "Test database is healthy"
else
    print_error "Test database is not healthy"
    docker-compose -f docker-compose.dev.yml logs postgres-test
    exit 1
fi

# Install dependencies
print_status "Installing dependencies..."
pnpm install

# Generate Prisma client
print_status "Generating Prisma client..."
pnpm prisma generate

# Run database migrations
print_status "Running database migrations..."
pnpm dotenv -e .env.local -- prisma db push

# Run test database migrations
print_status "Setting up test database..."
DATABASE_URL="postgresql://test_user:test_password@localhost:5433/ready_set_test" pnpm prisma db push

print_success "🎉 Development environment setup complete!"

echo ""
echo "📋 Setup Summary:"
echo "  • Development DB: postgresql://dev_user:dev_password@localhost:5432/ready_set_dev"
echo "  • Test DB: postgresql://test_user:test_password@localhost:5433/ready_set_test"
echo "  • pgAdmin: http://localhost:8080 (admin@readyset.local / admin123)"
echo ""
echo "🛠️  Available Commands:"
echo "  • Start dev server: pnpm dev"
echo "  • Run tests: pnpm test"
echo "  • Database studio: pnpm studio"
echo "  • Start pgAdmin: docker-compose -f docker-compose.dev.yml up -d pgadmin"
echo ""
echo "⚠️  Don't forget to:"
echo "  • Update .env.local with your actual values"
echo "  • Set up your Supabase auth configuration"
echo ""

# Optionally start pgAdmin
read -p "Would you like to start pgAdmin for database management? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Starting pgAdmin..."
    docker-compose -f docker-compose.dev.yml up -d pgadmin
    print_success "pgAdmin started at http://localhost:8080"
fi

print_success "Ready to develop! 🚀" 