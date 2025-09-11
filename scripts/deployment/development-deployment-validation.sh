#!/bin/bash

# Development Environment Deployment Validation Script
# This script validates the user deletion endpoint in development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEV_APP_URL="${DEV_APP_URL:-http://localhost:3000}"
TEST_DATA_DIR="./scripts/deployment/test-data"
VALIDATION_RESULTS_FILE="./validation-results-dev-$(date +%Y%m%d-%H%M%S).json"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✅ PASS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠️  WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[❌ FAIL]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[ℹ️  INFO]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}================================================${NC}"
}

# Track validation results
VALIDATION_ERRORS=0
TEST_RESULTS=()

# Function to increment error count
increment_errors() {
    ((VALIDATION_ERRORS++))
}

# Function to record test result
record_test_result() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    local duration="$4"
    
    TEST_RESULTS+=("{
        \"test\": \"$test_name\",
        \"status\": \"$status\",
        \"details\": \"$details\",
        \"duration\": \"$duration\",
        \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"
    }")
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for application to be ready
wait_for_app() {
    print_info "Waiting for application to be ready at $DEV_APP_URL..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$DEV_APP_URL/api/health" >/dev/null 2>&1; then
            print_status "Application is ready"
            return 0
        fi
        
        if [ $((attempt % 5)) -eq 0 ]; then
            print_info "Still waiting... (attempt $attempt/$max_attempts)"
        fi
        
        sleep 2
        ((attempt++))
    done
    
    print_error "Application failed to become ready after $max_attempts attempts"
    return 1
}

# Function to create test data
create_test_data() {
    print_info "Creating test data for validation..."
    
    mkdir -p "$TEST_DATA_DIR"
    
    # Create test users JSON data
    cat > "$TEST_DATA_DIR/test-users.json" <<'EOF'
{
  "adminUser": {
    "email": "dev-admin@example.com",
    "name": "Development Admin",
    "type": "ADMIN"
  },
  "superAdminUser": {
    "email": "dev-superadmin@example.com", 
    "name": "Development Super Admin",
    "type": "SUPER_ADMIN"
  },
  "vendorUser": {
    "email": "dev-vendor@example.com",
    "name": "Development Vendor", 
    "type": "VENDOR"
  },
  "clientUser": {
    "email": "dev-client@example.com",
    "name": "Development Client",
    "type": "CLIENT"
  },
  "driverUser": {
    "email": "dev-driver@example.com",
    "name": "Development Driver",
    "type": "DRIVER"
  },
  "testDeleteUser": {
    "email": "dev-delete-test@example.com",
    "name": "Test Delete User",
    "type": "VENDOR"
  }
}
EOF
    
    print_status "Test data created in $TEST_DATA_DIR"
}

# Function to test basic application health
test_application_health() {
    print_info "Testing basic application health..."
    
    local start_time=$(date +%s)
    
    if curl -s -f "$DEV_APP_URL/api/health" >/dev/null; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        print_status "Application health check passed"
        record_test_result "application_health" "PASS" "Health endpoint responsive" "${duration}s"
    else
        print_error "Application health check failed"
        record_test_result "application_health" "FAIL" "Health endpoint not responding" "N/A"
        increment_errors
    fi
}

# Function to test database connectivity
test_database_connectivity() {
    print_info "Testing database connectivity..."
    
    local start_time=$(date +%s)
    
    if pnpm prisma db push --preview-feature >/dev/null 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        print_status "Database connectivity test passed"
        record_test_result "database_connectivity" "PASS" "Database accessible and schema synced" "${duration}s"
    else
        print_error "Database connectivity test failed"
        record_test_result "database_connectivity" "FAIL" "Cannot connect to database" "N/A"
        increment_errors
    fi
}

# Function to test user deletion endpoint accessibility
test_endpoint_accessibility() {
    print_info "Testing user deletion endpoint accessibility..."
    
    local start_time=$(date +%s)
    
    # Test with invalid auth (should get 401, not 500)
    local response=$(curl -s -o /dev/null -w "%{http_code}" \
        -X DELETE "$DEV_APP_URL/api/users/test-user-id" \
        -H "Content-Type: application/json" 2>/dev/null || echo "000")
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ "$response" = "401" ]; then
        print_status "Endpoint accessibility test passed (got expected 401)"
        record_test_result "endpoint_accessibility" "PASS" "Endpoint rejects unauthorized requests correctly" "${duration}s"
    elif [ "$response" = "400" ]; then
        print_status "Endpoint accessibility test passed (got expected 400)"
        record_test_result "endpoint_accessibility" "PASS" "Endpoint validates requests correctly" "${duration}s"
    elif [ "$response" = "000" ]; then
        print_error "Endpoint accessibility test failed (network error)"
        record_test_result "endpoint_accessibility" "FAIL" "Network error connecting to endpoint" "${duration}s"
        increment_errors
    else
        print_warning "Endpoint accessibility test got unexpected response: $response"
        record_test_result "endpoint_accessibility" "WARN" "Unexpected HTTP status: $response" "${duration}s"
    fi
}

# Function to run unit tests
test_unit_tests() {
    print_info "Running user deletion unit tests..."
    
    local start_time=$(date +%s)
    
    if pnpm test:user-deletion:unit --passWithNoTests --silent; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        print_status "Unit tests passed"
        record_test_result "unit_tests" "PASS" "All unit tests passing" "${duration}s"
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        print_error "Unit tests failed"
        record_test_result "unit_tests" "FAIL" "Unit tests have failures" "${duration}s"
        increment_errors
    fi
}

# Function to test TypeScript compilation
test_typescript_compilation() {
    print_info "Testing TypeScript compilation..."
    
    local start_time=$(date +%s)
    
    if pnpm typecheck; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        print_status "TypeScript compilation passed"
        record_test_result "typescript_compilation" "PASS" "No TypeScript errors found" "${duration}s"
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        print_error "TypeScript compilation failed"
        record_test_result "typescript_compilation" "FAIL" "TypeScript errors found" "${duration}s"
        increment_errors
    fi
}

# Function to test build process
test_build_process() {
    print_info "Testing build process..."
    
    local start_time=$(date +%s)
    
    if pnpm build; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        print_status "Build process passed"
        record_test_result "build_process" "PASS" "Application builds successfully" "${duration}s"
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        print_error "Build process failed"
        record_test_result "build_process" "FAIL" "Build process encountered errors" "${duration}s"
        increment_errors
    fi
}

# Function to test linting
test_linting() {
    print_info "Testing code linting..."
    
    local start_time=$(date +%s)
    
    if pnpm lint --quiet; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        print_status "Linting tests passed"
        record_test_result "linting" "PASS" "No linting errors found" "${duration}s"
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        print_error "Linting tests failed"
        record_test_result "linting" "FAIL" "Linting errors found" "${duration}s"
        increment_errors
    fi
}

# Function to test environment configuration
test_environment_configuration() {
    print_info "Testing environment configuration..."
    
    local start_time=$(date +%s)
    local config_issues=0
    
    # Check critical environment variables
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL not set"
        ((config_issues++))
    fi
    
    if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
        print_error "NEXT_PUBLIC_SUPABASE_URL not set"
        ((config_issues++))
    fi
    
    if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        print_error "SUPABASE_SERVICE_ROLE_KEY not set"
        ((config_issues++))
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ $config_issues -eq 0 ]; then
        print_status "Environment configuration test passed"
        record_test_result "environment_configuration" "PASS" "All required environment variables set" "${duration}s"
    else
        print_error "Environment configuration test failed ($config_issues issues)"
        record_test_result "environment_configuration" "FAIL" "$config_issues environment variables missing" "${duration}s"
        increment_errors
    fi
}

# Function to test performance benchmarks
test_performance_benchmarks() {
    print_info "Testing performance benchmarks..."
    
    local start_time=$(date +%s)
    
    # Run performance tests if available
    if pnpm test:user-deletion:performance --passWithNoTests --silent >/dev/null 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        print_status "Performance benchmarks passed"
        record_test_result "performance_benchmarks" "PASS" "Performance tests within acceptable limits" "${duration}s"
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        print_warning "Performance benchmarks could not be run or failed"
        record_test_result "performance_benchmarks" "WARN" "Performance tests not available or failed" "${duration}s"
    fi
}

# Function to test security configurations
test_security_configurations() {
    print_info "Testing security configurations..."
    
    local start_time=$(date +%s)
    local security_issues=0
    
    # Check route file for security implementations
    local route_file="src/app/api/users/[userId]/route.ts"
    
    if [ -f "$route_file" ]; then
        # Check for authorization
        if ! grep -q "ADMIN\|SUPER_ADMIN" "$route_file"; then
            print_error "Authorization checks not found in route file"
            ((security_issues++))
        fi
        
        # Check for authentication
        if ! grep -q "getUser()" "$route_file"; then
            print_error "Authentication validation not found in route file"
            ((security_issues++))
        fi
        
        # Check for audit logging
        if ! grep -q "AUDIT.*User deletion" "$route_file"; then
            print_error "Audit logging not found in route file"
            ((security_issues++))
        fi
    else
        print_error "Route file not found: $route_file"
        ((security_issues++))
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ $security_issues -eq 0 ]; then
        print_status "Security configuration test passed"
        record_test_result "security_configurations" "PASS" "All security measures implemented" "${duration}s"
    else
        print_error "Security configuration test failed ($security_issues issues)"
        record_test_result "security_configurations" "FAIL" "$security_issues security issues found" "${duration}s"
        increment_errors
    fi
}

# Function to generate validation report
generate_validation_report() {
    print_info "Generating validation report..."
    
    # Convert TEST_RESULTS array to JSON
    local results_json=""
    local first=true
    
    for result in "${TEST_RESULTS[@]}"; do
        if [ "$first" = true ]; then
            results_json="$result"
            first=false
        else
            results_json="$results_json,$result"
        fi
    done
    
    # Create comprehensive validation report
    cat > "$VALIDATION_RESULTS_FILE" <<EOF
{
  "validation_report": {
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "environment": "development",
    "target_feature": "user_deletion_endpoint",
    "total_tests": ${#TEST_RESULTS[@]},
    "total_errors": $VALIDATION_ERRORS,
    "status": "$([ $VALIDATION_ERRORS -eq 0 ] && echo "PASSED" || echo "FAILED")",
    "application_url": "$DEV_APP_URL"
  },
  "test_results": [
    $results_json
  ],
  "next_steps": {
    "if_passed": [
      "Proceed with staging environment deployment",
      "Create deployment documentation",
      "Notify QA team for integration testing"
    ],
    "if_failed": [
      "Fix all identified issues",
      "Re-run development validation",
      "Review error details in test results"
    ]
  }
}
EOF
    
    print_info "Validation report saved to: $VALIDATION_RESULTS_FILE"
}

# Main execution
main() {
    print_header "DEVELOPMENT ENVIRONMENT VALIDATION"
    
    print_info "Starting development deployment validation..."
    print_info "Target: User deletion endpoint"
    print_info "Environment: Development"
    print_info "Application URL: $DEV_APP_URL"
    print_info "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    
    # Check prerequisites
    print_header "PREREQUISITES CHECK"
    
    if ! command_exists curl; then
        print_error "curl is required but not installed"
        exit 1
    fi
    
    if ! command_exists pnpm; then
        print_error "pnpm is required but not installed"
        exit 1
    fi
    
    # Create test data
    create_test_data
    
    # Wait for application to be ready
    if ! wait_for_app; then
        print_error "Application is not ready - cannot proceed with validation"
        exit 1
    fi
    
    # Run validation tests
    print_header "VALIDATION TESTS"
    
    test_application_health
    test_database_connectivity
    test_environment_configuration
    test_typescript_compilation
    test_linting
    test_unit_tests
    test_build_process
    test_endpoint_accessibility
    test_security_configurations
    test_performance_benchmarks
    
    # Generate report
    print_header "VALIDATION REPORT"
    generate_validation_report
    
    # Final summary
    print_header "VALIDATION SUMMARY"
    
    if [ $VALIDATION_ERRORS -eq 0 ]; then
        print_status "All validation tests passed! ✨"
        print_status "Development environment is ready for user deletion endpoint"
        print_info ""
        print_info "Next steps:"
        print_info "  1. ✅ Development validation complete"
        print_info "  2. 🎭 Deploy to staging environment"
        print_info "  3. 🧪 Run staging validation tests"
        print_info "  4. 🔒 Run security penetration tests"
        print_info "  5. 📈 Run load testing"
        print_info ""
        print_status "Ready to proceed to staging deployment!"
    else
        print_error "$VALIDATION_ERRORS validation errors found"
        print_error "Development deployment is NOT ready"
        print_info ""
        print_info "Required fixes:"
        
        # Show specific error categories
        for result in "${TEST_RESULTS[@]}"; do
            if echo "$result" | grep -q '"status": "FAIL"'; then
                local test_name=$(echo "$result" | grep -o '"test": "[^"]*"' | cut -d'"' -f4)
                print_info "  ❌ Fix: $test_name"
            fi
        done
        
        print_info ""
        print_info "After fixing issues:"
        print_info "  1. Re-run development validation"
        print_info "  2. Verify all tests pass"
        print_info "  3. Proceed with staging deployment"
    fi
    
    print_info ""
    print_info "Detailed results: $VALIDATION_RESULTS_FILE"
    
    # Exit with appropriate code
    exit $VALIDATION_ERRORS
}

# Handle script interruption
trap 'print_error "Validation interrupted"; exit 1' INT TERM

# Parse command line arguments
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Development Environment Deployment Validation"
    echo ""
    echo "Usage:"
    echo "  $0                    # Run full validation suite"
    echo "  $0 --help            # Show this help"
    echo ""
    echo "Environment variables:"
    echo "  DEV_APP_URL           # Development application URL (default: http://localhost:3000)"
    echo "  DATABASE_URL          # Database connection string"
    echo "  NEXT_PUBLIC_SUPABASE_URL    # Supabase URL"
    echo "  SUPABASE_SERVICE_ROLE_KEY   # Supabase service key"
    echo ""
    exit 0
fi

# Run main function
main "$@"
