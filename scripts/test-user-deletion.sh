#!/bin/bash

# User Deletion Testing Script
# This script provides easy access to run different types of user deletion tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}================================================${NC}"
}

# Show usage information
show_usage() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  unit           Run unit tests for user deletion API"
    echo "  integration    Run integration tests for user deletion flow"
    echo "  performance    Run performance tests for user deletion operations"
    echo "  all            Run all user deletion tests"
    echo "  coverage       Run tests with coverage reporting"
    echo "  watch          Run tests in watch mode"
    echo "  help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 unit                    # Run only unit tests"
    echo "  $0 integration            # Run only integration tests"
    echo "  $0 performance            # Run only performance tests"
    echo "  $0 all                    # Run all test types"
    echo "  $0 coverage               # Run with coverage"
}

# Function to run unit tests
run_unit_tests() {
    print_header "Running User Deletion Unit Tests"
    print_status "Testing authorization, database integrity, and edge cases..."
    
    pnpm jest src/__tests__/api/users/userId-delete.test.ts --verbose
    
    if [ $? -eq 0 ]; then
        print_status "✅ Unit tests passed!"
    else
        print_error "❌ Unit tests failed!"
        exit 1
    fi
}

# Function to run integration tests
run_integration_tests() {
    print_header "Running User Deletion Integration Tests"
    print_status "Testing frontend integration and database state verification..."
    print_warning "Note: Integration tests require database connection"
    
    pnpm jest src/__tests__/integration/user-deletion-flow.integration.test.ts --verbose
    
    if [ $? -eq 0 ]; then
        print_status "✅ Integration tests passed!"
    else
        print_error "❌ Integration tests failed!"
        exit 1
    fi
}

# Function to run performance tests
run_performance_tests() {
    print_header "Running User Deletion Performance Tests"
    print_status "Testing transaction performance and scalability..."
    print_warning "Note: Performance tests require database connection and may take longer"
    
    pnpm jest src/__tests__/performance/user-deletion-performance.test.ts --verbose --testTimeout=30000
    
    if [ $? -eq 0 ]; then
        print_status "✅ Performance tests passed!"
    else
        print_error "❌ Performance tests failed!"
        exit 1
    fi
}

# Function to run all tests
run_all_tests() {
    print_header "Running Complete User Deletion Test Suite"
    
    run_unit_tests
    echo ""
    run_integration_tests
    echo ""
    run_performance_tests
    
    print_header "All User Deletion Tests Completed Successfully! 🎉"
}

# Function to run tests with coverage
run_with_coverage() {
    print_header "Running User Deletion Tests with Coverage"
    print_status "Generating test coverage report..."
    
    pnpm jest \
        src/__tests__/api/users/userId-delete.test.ts \
        src/__tests__/integration/user-deletion-flow.integration.test.ts \
        --coverage \
        --collectCoverageFrom="src/app/api/users/[userId]/route.ts" \
        --coverageReporters="text" \
        --coverageReporters="html" \
        --coverageDirectory="coverage/user-deletion"
    
    if [ $? -eq 0 ]; then
        print_status "✅ Coverage tests completed!"
        print_status "📊 Coverage report generated in coverage/user-deletion/"
    else
        print_error "❌ Coverage tests failed!"
        exit 1
    fi
}

# Function to run tests in watch mode
run_watch_mode() {
    print_header "Running User Deletion Tests in Watch Mode"
    print_status "Watching for changes... Press 'q' to quit"
    
    pnpm jest \
        src/__tests__/api/users/userId-delete.test.ts \
        --watch \
        --verbose
}

# Function to check prerequisites
check_prerequisites() {
    # Check if pnpm is available
    if ! command -v pnpm &> /dev/null; then
        print_error "pnpm is required but not installed"
        print_status "Please install pnpm: npm install -g pnpm"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Please run this script from the project root directory"
        exit 1
    fi
    
    # Check if Jest is configured
    if [ ! -f "jest.config.js" ]; then
        print_error "jest.config.js not found. Jest configuration is required"
        exit 1
    fi
}

# Main execution logic
main() {
    check_prerequisites
    
    case "${1:-help}" in
        "unit")
            run_unit_tests
            ;;
        "integration")
            run_integration_tests
            ;;
        "performance")
            run_performance_tests
            ;;
        "all")
            run_all_tests
            ;;
        "coverage")
            run_with_coverage
            ;;
        "watch")
            run_watch_mode
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            print_error "Unknown option: $1"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
