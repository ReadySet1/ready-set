#!/bin/bash

# Test script for Client Dashboard and Profile Page fixes
# This script runs comprehensive tests for the authentication and link fixes

set -e

echo "🧪 Running tests for Client Dashboard and Profile Page fixes..."
echo "================================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_warning "node_modules not found. Installing dependencies..."
    pnpm install
fi

print_status "Running Profile Page Authentication Tests..."
npm test -- --testPathPattern="profile-authentication.test.tsx" --verbose

if [ $? -eq 0 ]; then
    print_success "Profile Page Authentication Tests passed!"
else
    print_error "Profile Page Authentication Tests failed!"
    exit 1
fi

echo ""

print_status "Running Client Dashboard Links Tests..."
npm test -- --testPathPattern="client-dashboard-links.test.tsx" --verbose

if [ $? -eq 0 ]; then
    print_success "Client Dashboard Links Tests passed!"
else
    print_error "Client Dashboard Links Tests failed!"
    exit 1
fi

echo ""

print_status "Running UserContext Unit Tests..."
npm test -- --testPathPattern="UserContext.test.tsx" --verbose

if [ $? -eq 0 ]; then
    print_success "UserContext Unit Tests passed!"
else
    print_error "UserContext Unit Tests failed!"
    exit 1
fi

echo ""

print_status "Running Integration Tests..."
npm test -- --testPathPattern="integration" --verbose

if [ $? -eq 0 ]; then
    print_success "Integration Tests passed!"
else
    print_error "Integration Tests failed!"
    exit 1
fi

echo ""

print_status "Running TypeScript Type Checking..."
npx tsc --noEmit

if [ $? -eq 0 ]; then
    print_success "TypeScript type checking passed!"
else
    print_error "TypeScript type checking failed!"
    exit 1
fi

echo ""
echo "================================================================"
print_success "All tests passed! 🎉"
echo ""
echo "Summary of fixes tested:"
echo "✅ Profile page authentication flow"
echo "✅ Session refresh handling"
echo "✅ Client dashboard link redirects"
echo "✅ UserContext session initialization"
echo "✅ Error handling and edge cases"
echo "✅ TypeScript type safety"
echo ""
echo "The following issues have been verified as fixed:"
echo "• Profile page no longer redirects to sign-in unnecessarily"
echo "• Client dashboard links now point to correct pages:"
echo "  - New Order → /catering-request"
echo "  - Manage Addresses → /addresses"
echo "  - Update Profile → /profile"
echo "• UserContext properly initializes session state"
echo "• Session refresh works correctly when needed" 