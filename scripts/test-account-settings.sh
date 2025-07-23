#!/bin/bash

# Account Settings Changes - Test Runner Script
# This script runs all tests related to the Account Settings changes

echo "🧪 Running Account Settings Test Suite"
echo "======================================"
echo

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0

run_test() {
    local test_name="$1"
    local test_pattern="$2"
    
    echo -e "${BLUE}Running $test_name...${NC}"
    
    if pnpm test "$test_pattern" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $test_name PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ $test_name FAILED${NC}"
        echo "Re-running with output:"
        pnpm test "$test_pattern"
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo
}

# Run all test suites
echo "Running all Account Settings related tests..."
echo

run_test "Integration Tests (Navigation Flow)" "account-settings-navigation"
run_test "Component Tests (Authentication Logic)" "ProfileAuthentication"
run_test "API Tests (Backend Route)" "profile-api"

echo "======================================"
echo -e "${BLUE}Test Results Summary:${NC}"
echo -e "✅ Passed: ${GREEN}$PASSED_TESTS${NC}/$TOTAL_TESTS"

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "${GREEN}🎉 All Account Settings tests are passing!${NC}"
    exit 0
else
    FAILED_TESTS=$((TOTAL_TESTS - PASSED_TESTS))
    echo -e "❌ Failed: ${RED}$FAILED_TESTS${NC}/$TOTAL_TESTS"
    echo -e "${RED}Some tests failed. Please check the output above.${NC}"
    exit 1
fi 