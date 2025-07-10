#!/bin/bash

# URL Encoding Tests Runner
# This script runs all tests related to the URL encoding fix for order numbers with special characters

set -e

echo "🧪 URL Encoding Tests Runner"
echo "============================"
echo ""

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

# Function to run tests and capture results
run_test_suite() {
    local test_name="$1"
    local test_command="$2"
    
    print_status "Running $test_name..."
    
    if eval "$test_command"; then
        print_success "$test_name completed successfully"
        return 0
    else
        print_error "$test_name failed"
        return 1
    fi
}

# Initialize counters
total_suites=0
passed_suites=0
failed_suites=0

echo "🚀 Starting URL Encoding Test Suite..."
echo ""

# 1. Unit Tests - Component URL Encoding
echo "📝 UNIT TESTS - Component URL Encoding"
echo "======================================"

total_suites=$((total_suites + 1))
if run_test_suite "CateringOrdersTable Tests" "pnpm test src/components/Orders/CateringOrders/__tests__/CateringOrdersTable.test.tsx --run"; then
    passed_suites=$((passed_suites + 1))
else
    failed_suites=$((failed_suites + 1))
fi
echo ""

total_suites=$((total_suites + 1))
if run_test_suite "OnDemandOrders Tests" "pnpm test src/components/Orders/OnDemand/__tests__/OnDemandOrders.test.tsx --run"; then
    passed_suites=$((passed_suites + 1))
else
    failed_suites=$((failed_suites + 1))
fi
echo ""

# 2. Unit Tests - Page URL Decoding
echo "📄 UNIT TESTS - Page URL Decoding"
echo "=================================="

total_suites=$((total_suites + 1))
if run_test_suite "Order Page Tests" "pnpm test src/app/(backend)/admin/catering-orders/__tests__/order-page.test.tsx --run"; then
    passed_suites=$((passed_suites + 1))
else
    failed_suites=$((failed_suites + 1))
fi
echo ""

# 3. Unit Tests - API Encoding
echo "🔌 UNIT TESTS - API Encoding"
echo "============================="

total_suites=$((total_suites + 1))
if run_test_suite "SingleOrder API Tests" "pnpm test src/components/Orders/__tests__/SingleOrder-api.test.tsx --run"; then
    passed_suites=$((passed_suites + 1))
else
    failed_suites=$((failed_suites + 1))
fi
echo ""

total_suites=$((total_suites + 1))
if run_test_suite "API Encoding Tests" "pnpm test src/app/api/__tests__/order-encoding.test.ts --run"; then
    passed_suites=$((passed_suites + 1))
else
    failed_suites=$((failed_suites + 1))
fi
echo ""

# 4. Integration Tests
echo "🔗 INTEGRATION TESTS"
echo "===================="

total_suites=$((total_suites + 1))
if run_test_suite "Order Navigation Integration" "pnpm test src/__tests__/integration/order-navigation.test.tsx --run"; then
    passed_suites=$((passed_suites + 1))
else
    failed_suites=$((failed_suites + 1))
fi
echo ""

# 5. E2E Tests (Optional - requires running dev server)
echo "🌐 END-TO-END TESTS"
echo "==================="

# Check if we should run E2E tests
if [ "$1" = "--e2e" ] || [ "$1" = "--all" ]; then
    print_status "Checking if development server is running..."
    
    # Check if server is running on port 3000
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        print_success "Development server is running"
        
        total_suites=$((total_suites + 1))
        if run_test_suite "E2E URL Encoding Tests" "npx playwright test e2e/order-url-encoding.spec.ts"; then
            passed_suites=$((passed_suites + 1))
        else
            failed_suites=$((failed_suites + 1))
        fi
    else
        print_warning "Development server not running. Skipping E2E tests."
        print_warning "To run E2E tests, start the dev server with: pnpm dev"
        print_warning "Then run this script with: $0 --e2e"
    fi
else
    print_warning "Skipping E2E tests. Use --e2e or --all flag to include them."
fi
echo ""

# 6. Test Coverage (Optional)
if [ "$1" = "--coverage" ] || [ "$1" = "--all" ]; then
    echo "📊 TEST COVERAGE"
    echo "================"
    
    print_status "Generating test coverage report..."
    if pnpm test --coverage --run src/components/Orders/ src/app/api/__tests__/ src/__tests__/integration/; then
        print_success "Coverage report generated"
        print_status "Coverage report available in ./coverage/ directory"
    else
        print_warning "Coverage generation failed"
    fi
    echo ""
fi

# Summary
echo "📋 TEST SUMMARY"
echo "==============="
echo ""
echo "Total Test Suites: $total_suites"
echo "Passed: $passed_suites"
echo "Failed: $failed_suites"
echo ""

if [ $failed_suites -eq 0 ]; then
    print_success "All tests passed! 🎉"
    echo ""
    echo "✅ URL encoding fix is working correctly:"
    echo "   • Order numbers with special characters are properly encoded in URLs"
    echo "   • API calls use correctly encoded order numbers"
    echo "   • Page navigation works with decoded order numbers"
    echo "   • Cross-component consistency is maintained"
    echo ""
    exit 0
else
    print_error "Some tests failed. Please review the output above."
    echo ""
    echo "🔧 Debugging tips:"
    echo "   • Check component implementations for encoding/decoding logic"
    echo "   • Verify API endpoints handle encoded order numbers"
    echo "   • Ensure all mocks are properly configured"
    echo "   • Run individual test files for detailed error messages"
    echo ""
    exit 1
fi 