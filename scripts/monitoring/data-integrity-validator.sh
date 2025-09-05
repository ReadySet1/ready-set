#!/bin/bash

# Data Integrity Validation Script for User Deletion System
# This script performs comprehensive data integrity checks and validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
VALIDATION_REPORT="/var/logs/ready-set/integrity/data-integrity-$(date +%Y%m%d-%H%M%S).json"
CRITICAL_THRESHOLD=10   # Number of issues that trigger critical alert
WARNING_THRESHOLD=5     # Number of issues that trigger warning

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✅ PASS]${NC} $1"
    log_result "PASS" "$1"
}

print_warning() {
    echo -e "${YELLOW}[⚠️  WARN]${NC} $1"
    log_result "WARN" "$1"
}

print_error() {
    echo -e "${RED}[❌ FAIL]${NC} $1"
    log_result "FAIL" "$1"
}

print_info() {
    echo -e "${BLUE}[ℹ️  INFO]${NC} $1"
    log_result "INFO" "$1"
}

print_critical() {
    echo -e "${PURPLE}[🚨 CRITICAL]${NC} $1"
    log_result "CRITICAL" "$1"
}

print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}================================================${NC}"
    log_result "HEADER" "$1"
}

# Track validation results
VALIDATION_ISSUES=0
VALIDATION_RESULTS=()

# Function to log validation results
log_result() {
    local level="$1"
    local message="$2"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    VALIDATION_RESULTS+=("{
        \"timestamp\": \"$timestamp\",
        \"level\": \"$level\",
        \"message\": \"$message\",
        \"test_category\": \"${CURRENT_TEST_CATEGORY:-general}\"
    }")
}

# Function to increment issues count
increment_issues() {
    ((VALIDATION_ISSUES++))
}

# Function to execute database query safely
execute_query() {
    local query="$1"
    local description="$2"
    
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL not configured"
        return 1
    fi
    
    # Parse database URL
    if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
        local db_user="${BASH_REMATCH[1]}"
        local db_password="${BASH_REMATCH[2]}"
        local db_host="${BASH_REMATCH[3]}"
        local db_port="${BASH_REMATCH[4]}"
        local db_name="${BASH_REMATCH[5]%%\?*}"
        
        export PGPASSWORD="$db_password"
        
        if result=$(psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -t -c "$query" 2>/dev/null); then
            echo "$result"
            return 0
        else
            print_error "Database query failed: $description"
            return 1
        fi
    else
        print_error "Invalid DATABASE_URL format"
        return 1
    fi
}

# Function to validate foreign key constraints
validate_foreign_key_constraints() {
    CURRENT_TEST_CATEGORY="foreign_key_constraints"
    print_info "Validating foreign key constraints..."
    
    local fk_issues=0
    
    # Check accounts table foreign keys
    local orphaned_accounts_query="
        SELECT COUNT(*) as count
        FROM accounts 
        WHERE \"userId\" NOT IN (SELECT id FROM profiles);
    "
    
    local orphaned_accounts=$(execute_query "$orphaned_accounts_query" "orphaned accounts check")
    orphaned_accounts=${orphaned_accounts// /}
    orphaned_accounts=${orphaned_accounts:-0}
    
    if [ "$orphaned_accounts" -gt 0 ]; then
        print_error "Found $orphaned_accounts orphaned accounts (foreign key constraint violation)"
        increment_issues
        ((fk_issues++))
    else
        print_status "Accounts foreign key constraints valid"
    fi
    
    # Check sessions table foreign keys
    local orphaned_sessions_query="
        SELECT COUNT(*) as count
        FROM sessions 
        WHERE \"userId\" NOT IN (SELECT id FROM profiles);
    "
    
    local orphaned_sessions=$(execute_query "$orphaned_sessions_query" "orphaned sessions check")
    orphaned_sessions=${orphaned_sessions// /}
    orphaned_sessions=${orphaned_sessions:-0}
    
    if [ "$orphaned_sessions" -gt 0 ]; then
        print_error "Found $orphaned_sessions orphaned sessions (foreign key constraint violation)"
        increment_issues
        ((fk_issues++))
    else
        print_status "Sessions foreign key constraints valid"
    fi
    
    # Check user_addresses table foreign keys
    local orphaned_user_addresses_query="
        SELECT COUNT(*) as count
        FROM user_addresses 
        WHERE \"userId\" NOT IN (SELECT id FROM profiles);
    "
    
    local orphaned_user_addresses=$(execute_query "$orphaned_user_addresses_query" "orphaned user addresses check")
    orphaned_user_addresses=${orphaned_user_addresses// /}
    orphaned_user_addresses=${orphaned_user_addresses:-0}
    
    if [ "$orphaned_user_addresses" -gt 0 ]; then
        print_error "Found $orphaned_user_addresses orphaned user addresses (foreign key constraint violation)"
        increment_issues
        ((fk_issues++))
    else
        print_status "User addresses foreign key constraints valid"
    fi
    
    # Check catering_requests table foreign keys
    local orphaned_catering_requests_query="
        SELECT COUNT(*) as count
        FROM catering_requests 
        WHERE \"userId\" NOT IN (SELECT id FROM profiles);
    "
    
    local orphaned_catering_requests=$(execute_query "$orphaned_catering_requests_query" "orphaned catering requests check")
    orphaned_catering_requests=${orphaned_catering_requests// /}
    orphaned_catering_requests=${orphaned_catering_requests:-0}
    
    if [ "$orphaned_catering_requests" -gt 0 ]; then
        print_error "Found $orphaned_catering_requests orphaned catering requests (foreign key constraint violation)"
        increment_issues
        ((fk_issues++))
    else
        print_status "Catering requests foreign key constraints valid"
    fi
    
    # Check on_demand table foreign keys
    local orphaned_on_demand_query="
        SELECT COUNT(*) as count
        FROM on_demand 
        WHERE \"userId\" NOT IN (SELECT id FROM profiles);
    "
    
    local orphaned_on_demand=$(execute_query "$orphaned_on_demand_query" "orphaned on demand requests check")
    orphaned_on_demand=${orphaned_on_demand// /}
    orphaned_on_demand=${orphaned_on_demand:-0}
    
    if [ "$orphaned_on_demand" -gt 0 ]; then
        print_error "Found $orphaned_on_demand orphaned on demand requests (foreign key constraint violation)"
        increment_issues
        ((fk_issues++))
    else
        print_status "On demand requests foreign key constraints valid"
    fi
    
    print_info "Foreign key validation complete: $fk_issues issues found"
    return $fk_issues
}

# Function to validate cascade deletion completeness
validate_cascade_deletions() {
    CURRENT_TEST_CATEGORY="cascade_deletions"
    print_info "Validating cascade deletion completeness..."
    
    local cascade_issues=0
    
    # Get a sample of recent successful deletions
    local recent_deletions_query="
        SELECT \"targetUserId\"
        FROM audit_logs 
        WHERE action = 'USER_DELETION' 
            AND success = true 
            AND timestamp > NOW() - INTERVAL '24 hours'
        LIMIT 10;
    "
    
    local deleted_user_ids=$(execute_query "$recent_deletions_query" "recent deleted users")
    
    if [ -n "$deleted_user_ids" ] && [ "$deleted_user_ids" != "" ]; then
        # Check each deleted user ID to ensure complete cleanup
        while IFS= read -r user_id; do
            user_id=$(echo "$user_id" | tr -d ' ')
            
            if [ -n "$user_id" ] && [ "$user_id" != "" ]; then
                # Check if profile still exists (should not)
                local profile_exists_query="
                    SELECT COUNT(*) FROM profiles WHERE id = '$user_id';
                "
                
                local profile_exists=$(execute_query "$profile_exists_query" "profile existence check for $user_id")
                profile_exists=${profile_exists// /}
                
                if [ "$profile_exists" -gt 0 ]; then
                    print_error "Deleted user profile still exists: $user_id"
                    increment_issues
                    ((cascade_issues++))
                fi
                
                # Check if accounts were properly deleted (should be 0)
                local accounts_exist_query="
                    SELECT COUNT(*) FROM accounts WHERE \"userId\" = '$user_id';
                "
                
                local accounts_exist=$(execute_query "$accounts_exist_query" "accounts cleanup check for $user_id")
                accounts_exist=${accounts_exist// /}
                
                if [ "$accounts_exist" -gt 0 ]; then
                    print_error "Deleted user still has accounts: $user_id ($accounts_exist accounts)"
                    increment_issues
                    ((cascade_issues++))
                fi
                
                # Check if sessions were properly deleted (should be 0)
                local sessions_exist_query="
                    SELECT COUNT(*) FROM sessions WHERE \"userId\" = '$user_id';
                "
                
                local sessions_exist=$(execute_query "$sessions_exist_query" "sessions cleanup check for $user_id")
                sessions_exist=${sessions_exist// /}
                
                if [ "$sessions_exist" -gt 0 ]; then
                    print_error "Deleted user still has sessions: $user_id ($sessions_exist sessions)"
                    increment_issues
                    ((cascade_issues++))
                fi
            fi
        done <<< "$deleted_user_ids"
        
        if [ $cascade_issues -eq 0 ]; then
            print_status "Cascade deletion validation passed for all sampled deletions"
        fi
    else
        print_info "No recent deletions found to validate"
    fi
    
    print_info "Cascade deletion validation complete: $cascade_issues issues found"
    return $cascade_issues
}

# Function to validate manual cleanup operations
validate_manual_cleanup() {
    CURRENT_TEST_CATEGORY="manual_cleanup"
    print_info "Validating manual cleanup operations..."
    
    local cleanup_issues=0
    
    # Check dispatches cleanup (should not have references to deleted users)
    local orphaned_dispatches_query="
        SELECT 
            d.id,
            d.\"driverId\",
            d.\"userId\"
        FROM dispatches d
        WHERE (
            d.\"driverId\" IS NOT NULL AND 
            NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = d.\"driverId\")
        ) OR (
            d.\"userId\" IS NOT NULL AND 
            NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = d.\"userId\")
        );
    "
    
    local orphaned_dispatches=$(execute_query "$orphaned_dispatches_query" "orphaned dispatches check")
    local orphaned_dispatches_count=$(echo "$orphaned_dispatches" | wc -l)
    orphaned_dispatches_count=${orphaned_dispatches_count// /}
    
    if [ "$orphaned_dispatches_count" -gt 1 ]; then  # Greater than 1 because wc -l includes empty line
        print_error "Found orphaned dispatches with references to deleted users"
        increment_issues
        ((cleanup_issues++))
    else
        print_status "Dispatches manual cleanup validation passed"
    fi
    
    # Check file uploads cleanup (userId should be null for deleted users)
    local file_upload_references_query="
        SELECT COUNT(*) as count
        FROM file_uploads f
        WHERE f.\"userId\" IS NOT NULL 
            AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = f.\"userId\");
    "
    
    local orphaned_file_uploads=$(execute_query "$file_upload_references_query" "file uploads cleanup check")
    orphaned_file_uploads=${orphaned_file_uploads// /}
    orphaned_file_uploads=${orphaned_file_uploads:-0}
    
    if [ "$orphaned_file_uploads" -gt 0 ]; then
        print_error "Found $orphaned_file_uploads file uploads with references to deleted users"
        increment_issues
        ((cleanup_issues++))
    else
        print_status "File uploads manual cleanup validation passed"
    fi
    
    # Check addresses cleanup (createdBy should be null or deleted for orphaned addresses)
    local orphaned_addresses_query="
        SELECT COUNT(*) as count
        FROM addresses a
        WHERE a.\"createdBy\" IS NOT NULL 
            AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = a.\"createdBy\")
            AND NOT EXISTS (
                SELECT 1 FROM user_addresses ua WHERE ua.\"addressId\" = a.id
                UNION
                SELECT 1 FROM catering_requests cr WHERE cr.\"addressId\" = a.id
                UNION  
                SELECT 1 FROM on_demand od WHERE od.\"addressId\" = a.id
            );
    "
    
    local orphaned_addresses=$(execute_query "$orphaned_addresses_query" "addresses cleanup check")
    orphaned_addresses=${orphaned_addresses// /}
    orphaned_addresses=${orphaned_addresses:-0}
    
    if [ "$orphaned_addresses" -gt 0 ]; then
        print_warning "Found $orphaned_addresses addresses created by deleted users (may need cleanup)"
        # This is a warning, not an error, as it might be expected behavior
    else
        print_status "Addresses manual cleanup validation passed"
    fi
    
    print_info "Manual cleanup validation complete: $cleanup_issues issues found"
    return $cleanup_issues
}

# Function to validate audit trail completeness
validate_audit_trail() {
    CURRENT_TEST_CATEGORY="audit_trail"
    print_info "Validating audit trail completeness..."
    
    local audit_issues=0
    
    # Check that all recent deletions have audit logs
    local deletion_count_query="
        SELECT COUNT(*) as profile_deletions
        FROM audit_logs 
        WHERE action = 'USER_DELETION' 
            AND timestamp > NOW() - INTERVAL '7 days';
    "
    
    local logged_deletions=$(execute_query "$deletion_count_query" "logged deletions count")
    logged_deletions=${logged_deletions// /}
    logged_deletions=${logged_deletions:-0}
    
    # Check for audit logs with missing required fields
    local incomplete_audit_logs_query="
        SELECT COUNT(*) as incomplete_logs
        FROM audit_logs 
        WHERE action = 'USER_DELETION' 
            AND timestamp > NOW() - INTERVAL '7 days'
            AND (
                \"performedBy\" IS NULL OR
                \"targetUserId\" IS NULL OR
                success IS NULL OR
                timestamp IS NULL
            );
    "
    
    local incomplete_logs=$(execute_query "$incomplete_audit_logs_query" "incomplete audit logs check")
    incomplete_logs=${incomplete_logs// /}
    incomplete_logs=${incomplete_logs:-0}
    
    if [ "$incomplete_logs" -gt 0 ]; then
        print_error "Found $incomplete_logs incomplete audit log entries"
        increment_issues
        ((audit_issues++))
    else
        print_status "All audit logs have required fields"
    fi
    
    # Check for suspicious patterns in audit logs
    local suspicious_patterns_query="
        SELECT 
            COUNT(CASE WHEN \"performedBy\" = \"targetUserId\" THEN 1 END) as self_deletions,
            COUNT(CASE WHEN \"performedByType\" = 'SUPER_ADMIN' AND \"targetUserType\" = 'SUPER_ADMIN' THEN 1 END) as super_admin_deletions
        FROM audit_logs 
        WHERE action = 'USER_DELETION' 
            AND success = true
            AND timestamp > NOW() - INTERVAL '7 days';
    "
    
    local suspicious_patterns=$(execute_query "$suspicious_patterns_query" "suspicious patterns check")
    local self_deletions=$(echo "$suspicious_patterns" | awk '{print $1}' | head -1)
    local super_admin_deletions=$(echo "$suspicious_patterns" | awk '{print $2}' | head -1)
    
    self_deletions=${self_deletions// /}
    super_admin_deletions=${super_admin_deletions// /}
    self_deletions=${self_deletions:-0}
    super_admin_deletions=${super_admin_deletions:-0}
    
    if [ "$self_deletions" -gt 0 ]; then
        print_error "Found $self_deletions self-deletion attempts that succeeded (should be prevented)"
        increment_issues
        ((audit_issues++))
    fi
    
    if [ "$super_admin_deletions" -gt 0 ]; then
        print_error "Found $super_admin_deletions SUPER_ADMIN deletions (should be prevented)"
        increment_issues
        ((audit_issues++))
    fi
    
    if [ "$logged_deletions" -gt 0 ]; then
        print_status "Found $logged_deletions deletion audit logs in the last 7 days"
    else
        print_info "No deletion operations found in the last 7 days"
    fi
    
    print_info "Audit trail validation complete: $audit_issues issues found"
    return $audit_issues
}

# Function to validate data consistency
validate_data_consistency() {
    CURRENT_TEST_CATEGORY="data_consistency"
    print_info "Validating overall data consistency..."
    
    local consistency_issues=0
    
    # Check for duplicate profiles (should never happen)
    local duplicate_profiles_query="
        SELECT email, COUNT(*) as count
        FROM profiles 
        GROUP BY email 
        HAVING COUNT(*) > 1;
    "
    
    local duplicate_profiles=$(execute_query "$duplicate_profiles_query" "duplicate profiles check")
    local duplicate_count=$(echo "$duplicate_profiles" | wc -l)
    duplicate_count=${duplicate_count// /}
    
    if [ "$duplicate_count" -gt 1 ]; then
        print_error "Found duplicate profiles (data consistency violation)"
        increment_issues
        ((consistency_issues++))
    else
        print_status "No duplicate profiles found"
    fi
    
    # Check for invalid user types
    local invalid_user_types_query="
        SELECT COUNT(*) as count
        FROM profiles 
        WHERE type NOT IN ('ADMIN', 'SUPER_ADMIN', 'VENDOR', 'CLIENT', 'DRIVER', 'HELPDESK');
    "
    
    local invalid_types=$(execute_query "$invalid_user_types_query" "invalid user types check")
    invalid_types=${invalid_types// /}
    invalid_types=${invalid_types:-0}
    
    if [ "$invalid_types" -gt 0 ]; then
        print_error "Found $invalid_types profiles with invalid user types"
        increment_issues
        ((consistency_issues++))
    else
        print_status "All user types are valid"
    fi
    
    # Check for profiles with invalid email formats (basic check)
    local invalid_emails_query="
        SELECT COUNT(*) as count
        FROM profiles 
        WHERE email NOT LIKE '%@%' OR email NOT LIKE '%.%';
    "
    
    local invalid_emails=$(execute_query "$invalid_emails_query" "invalid email formats check")
    invalid_emails=${invalid_emails// /}
    invalid_emails=${invalid_emails:-0}
    
    if [ "$invalid_emails" -gt 0 ]; then
        print_warning "Found $invalid_emails profiles with questionable email formats"
        # This is a warning since email validation might be more complex
    else
        print_status "All email formats appear valid"
    fi
    
    print_info "Data consistency validation complete: $consistency_issues issues found"
    return $consistency_issues
}

# Function to generate data integrity report
generate_integrity_report() {
    print_info "Generating data integrity validation report..."
    
    mkdir -p "$(dirname "$VALIDATION_REPORT")"
    
    # Convert VALIDATION_RESULTS array to JSON
    local results_json=""
    local first=true
    
    for result in "${VALIDATION_RESULTS[@]}"; do
        if [ "$first" = true ]; then
            results_json="$result"
            first=false
        else
            results_json="$results_json,$result"
        fi
    done
    
    # Generate comprehensive report
    cat > "$VALIDATION_REPORT" <<EOF
{
  "data_integrity_validation": {
    "validation_timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "target_system": "user_deletion_endpoint",
    "total_issues_found": $VALIDATION_ISSUES,
    "validation_status": "$([ $VALIDATION_ISSUES -eq 0 ] && echo "PASSED" || echo "FAILED")",
    "severity_level": "$([ $VALIDATION_ISSUES -ge $CRITICAL_THRESHOLD ] && echo "CRITICAL" || [ $VALIDATION_ISSUES -ge $WARNING_THRESHOLD ] && echo "WARNING" || echo "OK")"
  },
  "validation_results": [
    $results_json
  ],
  "summary": {
    "foreign_key_constraints": "$(grep -c '"test_category": "foreign_key_constraints".*"level": "FAIL"' <<< "$results_json" || echo "0") issues",
    "cascade_deletions": "$(grep -c '"test_category": "cascade_deletions".*"level": "FAIL"' <<< "$results_json" || echo "0") issues",
    "manual_cleanup": "$(grep -c '"test_category": "manual_cleanup".*"level": "FAIL"' <<< "$results_json" || echo "0") issues",
    "audit_trail": "$(grep -c '"test_category": "audit_trail".*"level": "FAIL"' <<< "$results_json" || echo "0") issues",
    "data_consistency": "$(grep -c '"test_category": "data_consistency".*"level": "FAIL"' <<< "$results_json" || echo "0") issues"
  },
  "recommendations": {
    "immediate_actions": [
      "$([ $VALIDATION_ISSUES -ge $CRITICAL_THRESHOLD ] && echo "URGENT: Address all critical data integrity issues immediately" || echo "Review and resolve identified data integrity issues")",
      "$([ $VALIDATION_ISSUES -gt 0 ] && echo "Investigate root causes of data integrity violations" || echo "Continue regular data integrity monitoring")",
      "$([ $VALIDATION_ISSUES -gt 0 ] && echo "Consider implementing automated cleanup procedures" || echo "Data integrity appears healthy")"
    ],
    "preventive_measures": [
      "Implement automated data integrity checks in CI/CD pipeline",
      "Add database constraints to prevent orphaned records",
      "Enhance audit logging to capture more detailed information",
      "Consider implementing soft deletes for critical data"
    ]
  },
  "next_validation": {
    "recommended_frequency": "$([ $VALIDATION_ISSUES -gt 0 ] && echo "daily" || echo "weekly")",
    "focus_areas": [
      "$([ $VALIDATION_ISSUES -gt 0 ] && echo "Address identified issues and re-validate" || echo "Continue comprehensive monitoring")",
      "Monitor trends in data integrity metrics",
      "Validate effectiveness of any implemented fixes"
    ]
  }
}
EOF
    
    print_status "Data integrity validation report saved to: $VALIDATION_REPORT"
}

# Main execution
main() {
    print_header "DATA INTEGRITY VALIDATION FOR USER DELETION SYSTEM"
    
    print_info "Starting comprehensive data integrity validation..."
    print_info "Target: User deletion endpoint and related data operations"
    print_info "Validation timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    
    # Check database connectivity
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL environment variable is required"
        exit 1
    fi
    
    # Run all validation tests
    print_header "FOREIGN KEY CONSTRAINTS VALIDATION"
    validate_foreign_key_constraints
    
    print_header "CASCADE DELETION VALIDATION"
    validate_cascade_deletions
    
    print_header "MANUAL CLEANUP VALIDATION"
    validate_manual_cleanup
    
    print_header "AUDIT TRAIL VALIDATION"
    validate_audit_trail
    
    print_header "DATA CONSISTENCY VALIDATION"
    validate_data_consistency
    
    # Generate comprehensive report
    print_header "VALIDATION SUMMARY"
    generate_integrity_report
    
    # Final summary
    if [ $VALIDATION_ISSUES -eq 0 ]; then
        print_status "🎉 ALL DATA INTEGRITY VALIDATIONS PASSED! 🎉"
        print_status "User deletion system data integrity is healthy"
    elif [ $VALIDATION_ISSUES -ge $CRITICAL_THRESHOLD ]; then
        print_critical "🚨 CRITICAL DATA INTEGRITY ISSUES FOUND 🚨"
        print_critical "$VALIDATION_ISSUES issues detected (threshold: $CRITICAL_THRESHOLD)"
        print_critical "IMMEDIATE ACTION REQUIRED"
    elif [ $VALIDATION_ISSUES -ge $WARNING_THRESHOLD ]; then
        print_warning "⚠️  DATA INTEGRITY ISSUES DETECTED ⚠️"
        print_warning "$VALIDATION_ISSUES issues found (warning threshold: $WARNING_THRESHOLD)"
        print_warning "Investigation and remediation recommended"
    else
        print_info "✅ Data integrity validation completed with minor issues"
        print_info "$VALIDATION_ISSUES issues found (below warning threshold)"
    fi
    
    print_info ""
    print_info "📊 Detailed Report: $VALIDATION_REPORT"
    
    # Exit with appropriate code
    exit $VALIDATION_ISSUES
}

# Handle script interruption
trap 'print_error "Data integrity validation interrupted"; exit 1' INT TERM

# Parse command line arguments
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Data Integrity Validation for User Deletion System"
    echo ""
    echo "Usage:"
    echo "  $0                    # Run comprehensive data integrity validation"
    echo "  $0 --help            # Show this help"
    echo ""
    echo "Environment variables:"
    echo "  DATABASE_URL          # Database connection string (required)"
    echo ""
    echo "Validation categories:"
    echo "  • Foreign key constraints validation"
    echo "  • Cascade deletion completeness verification"
    echo "  • Manual cleanup operations validation"
    echo "  • Audit trail completeness and consistency"
    echo "  • Overall data consistency checks"
    echo ""
    echo "Thresholds:"
    echo "  • Warning threshold: $WARNING_THRESHOLD issues"
    echo "  • Critical threshold: $CRITICAL_THRESHOLD issues"
    echo ""
    exit 0
fi

# Run main function
main "$@"
