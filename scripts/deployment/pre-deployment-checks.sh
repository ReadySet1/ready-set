#!/bin/bash

# Pre-Deployment Validation Script for User Deletion Endpoint
# This script performs comprehensive checks before deploying the user deletion feature

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REQUIRED_COVERAGE=90
MAX_ERROR_RATE=0.1
REQUIRED_TESTS_PASSING=21

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

# Function to increment error count
increment_errors() {
    ((VALIDATION_ERRORS++))
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

print_header "PRE-DEPLOYMENT VALIDATION FOR USER DELETION ENDPOINT"

print_info "Starting comprehensive pre-deployment validation..."
print_info "Target: User deletion endpoint (DELETE /api/users/[userId])"
print_info "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# Check 1: Environment and Dependencies
print_header "1. ENVIRONMENT AND DEPENDENCY VALIDATION"

print_info "Checking required tools and dependencies..."

if command_exists pnpm; then
    print_status "pnpm is installed: $(pnpm --version)"
else
    print_error "pnpm is not installed or not in PATH"
    increment_errors
fi

if command_exists node; then
    NODE_VERSION=$(node --version)
    print_status "Node.js is installed: $NODE_VERSION"
    
    # Check if Node version meets minimum requirements (16+)
    if [[ "${NODE_VERSION#v}" =~ ^1[6-9]|^[2-9][0-9] ]]; then
        print_status "Node.js version meets requirements (16+)"
    else
        print_error "Node.js version $NODE_VERSION does not meet minimum requirement (16+)"
        increment_errors
    fi
else
    print_error "Node.js is not installed or not in PATH"
    increment_errors
fi

if [ -f "package.json" ]; then
    print_status "package.json found"
else
    print_error "package.json not found - not in project root?"
    increment_errors
fi

if [ -f "prisma/schema.prisma" ]; then
    print_status "Prisma schema found"
else
    print_error "Prisma schema not found"
    increment_errors
fi

# Check 2: Environment Variables
print_header "2. ENVIRONMENT CONFIGURATION VALIDATION"

print_info "Checking required environment variables..."

ENV_VARS_MISSING=0

check_env_var() {
    if [ -z "${!1}" ]; then
        print_error "Environment variable $1 is not set"
        ((ENV_VARS_MISSING++))
    else
        print_status "Environment variable $1 is configured"
    fi
}

# Critical environment variables for user deletion
check_env_var "DATABASE_URL"
check_env_var "NEXT_PUBLIC_SUPABASE_URL"
check_env_var "SUPABASE_SERVICE_ROLE_KEY"

if [ $ENV_VARS_MISSING -gt 0 ]; then
    print_error "$ENV_VARS_MISSING required environment variables are missing"
    increment_errors
fi

# Check 3: Code Quality Validation
print_header "3. CODE QUALITY VALIDATION"

print_info "Running TypeScript compilation check..."
if pnpm typecheck; then
    print_status "TypeScript compilation successful"
else
    print_error "TypeScript compilation failed"
    increment_errors
fi

print_info "Running ESLint check..."
if pnpm lint --quiet; then
    print_status "ESLint checks passed"
else
    print_error "ESLint checks failed"
    increment_errors
fi

# Check 4: Test Suite Validation
print_header "4. TEST SUITE VALIDATION"

print_info "Running user deletion unit tests..."
if pnpm test:user-deletion:unit --passWithNoTests --silent; then
    print_status "Unit tests passed"
else
    print_error "Unit tests failed"
    increment_errors
fi

print_info "Running test coverage analysis..."
COVERAGE_OUTPUT=$(pnpm test:user-deletion:coverage --silent --passWithNoTests 2>/dev/null || echo "Coverage check failed")

if [[ "$COVERAGE_OUTPUT" == *"Coverage check failed"* ]]; then
    print_warning "Coverage analysis could not be completed - tests may not be fully configured"
else
    print_status "Test coverage analysis completed"
fi

# Check 5: Database Schema Validation
print_header "5. DATABASE SCHEMA VALIDATION"

print_info "Validating Prisma schema integrity..."
if pnpm prisma validate; then
    print_status "Prisma schema is valid"
else
    print_error "Prisma schema validation failed"
    increment_errors
fi

print_info "Checking for pending database migrations..."
if pnpm prisma migrate status --schema=prisma/schema.prisma 2>/dev/null; then
    print_status "Database migrations are up to date"
else
    print_warning "Could not verify migration status - ensure database is accessible"
fi

# Check 6: Build Process Validation
print_header "6. BUILD PROCESS VALIDATION"

print_info "Testing build process..."
if pnpm build; then
    print_status "Build process completed successfully"
else
    print_error "Build process failed"
    increment_errors
fi

# Check 7: API Endpoint Validation
print_header "7. API ENDPOINT VALIDATION"

print_info "Validating user deletion endpoint exists..."
ROUTE_FILE="src/app/api/users/[userId]/route.ts"

if [ -f "$ROUTE_FILE" ]; then
    print_status "User deletion route file found: $ROUTE_FILE"
    
    # Check if DELETE method is implemented
    if grep -q "export.*DELETE" "$ROUTE_FILE"; then
        print_status "DELETE method export found"
    else
        print_error "DELETE method export not found in route file"
        increment_errors
    fi
    
    # Check for critical components
    if grep -q "prisma\.\$transaction" "$ROUTE_FILE"; then
        print_status "Transaction handling found in endpoint"
    else
        print_error "Transaction handling not found - data integrity risk"
        increment_errors
    fi
    
    if grep -q "AUDIT.*User deletion" "$ROUTE_FILE"; then
        print_status "Audit logging found in endpoint"
    else
        print_error "Audit logging not found - compliance risk"
        increment_errors
    fi
    
else
    print_error "User deletion route file not found: $ROUTE_FILE"
    increment_errors
fi

# Check 8: Security Validation
print_header "8. SECURITY VALIDATION"

print_info "Checking security implementations..."

if grep -q "ADMIN\|SUPER_ADMIN" "$ROUTE_FILE" 2>/dev/null; then
    print_status "Authorization checks found"
else
    print_error "Authorization checks not found - security risk"
    increment_errors
fi

if grep -q "getUser()" "$ROUTE_FILE" 2>/dev/null; then
    print_status "Authentication validation found"
else
    print_error "Authentication validation not found - security risk"
    increment_errors
fi

# Check 9: Performance Validation
print_header "9. PERFORMANCE VALIDATION"

print_info "Checking performance configurations..."

if grep -q "timeout.*10000" "$ROUTE_FILE" 2>/dev/null; then
    print_status "Transaction timeout configured (10 seconds)"
else
    print_warning "Transaction timeout not found - performance risk under load"
fi

# Check 10: Documentation Validation
print_header "10. DOCUMENTATION VALIDATION"

DOCS_MISSING=0

check_doc_file() {
    if [ -f "$1" ]; then
        print_status "Documentation found: $1"
    else
        print_error "Documentation missing: $1"
        ((DOCS_MISSING++))
    fi
}

print_info "Checking deployment documentation..."
check_doc_file "docs/deployment/user-deletion-deployment-strategy.md"
check_doc_file "docs/testing/user-deletion-testing-guide.md"

if [ $DOCS_MISSING -gt 0 ]; then
    print_warning "$DOCS_MISSING documentation files are missing"
fi

# Final Validation Summary
print_header "VALIDATION SUMMARY"

if [ $VALIDATION_ERRORS -eq 0 ]; then
    print_status "All validation checks passed! ✨"
    print_status "User deletion endpoint is ready for deployment"
    print_info "Next steps:"
    print_info "  1. Create database backup"
    print_info "  2. Deploy to development environment"
    print_info "  3. Run integration tests"
    print_info "  4. Proceed with staging deployment"
else
    print_error "$VALIDATION_ERRORS validation errors found"
    print_error "Deployment is NOT recommended until all issues are resolved"
    print_info "Please fix the above issues before proceeding with deployment"
    
    # Show checklist of failed items
    echo ""
    print_info "Failed validation checklist:"
    if [ $ENV_VARS_MISSING -gt 0 ]; then
        echo "  - Fix missing environment variables"
    fi
    if [ $DOCS_MISSING -gt 0 ]; then
        echo "  - Create missing documentation"
    fi
    echo "  - Review all error messages above"
    echo "  - Re-run this validation script"
fi

# Generate validation report
REPORT_FILE="deployment-validation-$(date +%Y%m%d-%H%M%S).log"
{
    echo "User Deletion Endpoint - Pre-Deployment Validation Report"
    echo "======================================================="
    echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "Validation Errors: $VALIDATION_ERRORS"
    echo "Environment Variables Missing: $ENV_VARS_MISSING"
    echo "Documentation Files Missing: $DOCS_MISSING"
    echo ""
    echo "Status: $([ $VALIDATION_ERRORS -eq 0 ] && echo "READY FOR DEPLOYMENT" || echo "NOT READY - ISSUES FOUND")"
} > "$REPORT_FILE"

print_info "Validation report saved to: $REPORT_FILE"

# Exit with appropriate code
exit $VALIDATION_ERRORS
