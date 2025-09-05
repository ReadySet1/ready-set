#!/bin/bash

# Emergency Rollback Script for User Deletion Endpoint
# This script provides immediate rollback capabilities when deployment issues are detected

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
ROLLBACK_LOG="/var/logs/ready-set/rollback-$(date +%Y%m%d-%H%M%S).log"
BACKUP_DIR="/var/backups/ready-set-db"
DEPLOYMENT_TIMEOUT=300 # 5 minutes timeout for operations

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✅ SUCCESS]${NC} $1"
    log_message "SUCCESS: $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠️  WARNING]${NC} $1"
    log_message "WARNING: $1"
}

print_error() {
    echo -e "${RED}[❌ ERROR]${NC} $1"
    log_message "ERROR: $1"
}

print_info() {
    echo -e "${BLUE}[ℹ️  INFO]${NC} $1"
    log_message "INFO: $1"
}

print_critical() {
    echo -e "${PURPLE}[🚨 CRITICAL]${NC} $1"
    log_message "CRITICAL: $1"
}

print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}================================================${NC}"
    log_message "HEADER: $1"
}

# Function to log messages
log_message() {
    mkdir -p "$(dirname "$ROLLBACK_LOG")"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1" >> "$ROLLBACK_LOG"
}

# Function to send alerts (customize based on your alerting system)
send_alert() {
    local severity=$1
    local message=$2
    
    print_info "ALERT [$severity]: $message"
    
    # Example alert implementations (uncomment and customize as needed):
    
    # Slack webhook
    # curl -X POST -H 'Content-type: application/json' \
    #     --data "{\"text\":\"🚨 ROLLBACK ALERT [$severity]: $message\"}" \
    #     "$SLACK_WEBHOOK_URL"
    
    # Email notification
    # echo "$message" | mail -s "ROLLBACK ALERT [$severity]" "$ALERT_EMAIL"
    
    # PagerDuty/Opsgenie integration
    # curl -X POST ... (your alerting service API)
    
    log_message "ALERT SENT [$severity]: $message"
}

# Function to check if feature flag system is available
check_feature_flag_system() {
    print_info "Checking feature flag system availability..."
    
    # Example implementations - customize based on your feature flag system:
    
    # LaunchDarkly
    # if curl -s -H "Authorization: $LAUNCHDARKLY_API_KEY" \
    #     "https://app.launchdarkly.com/api/v2/flags/default/user-deletion" >/dev/null; then
    #     return 0
    # fi
    
    # Split.io
    # if curl -s -H "Authorization: Bearer $SPLIT_API_KEY" \
    #     "https://api.split.io/internal/api/v2/splits/user-deletion" >/dev/null; then
    #     return 0
    # fi
    
    # Environment variable based (simple implementation)
    if [ -f ".env.production" ] || [ -f ".env.local" ]; then
        print_status "Feature flag system available (environment variable based)"
        return 0
    fi
    
    print_warning "Feature flag system not detected"
    return 1
}

# Function to disable feature flag
disable_feature_flag() {
    print_info "Disabling user deletion feature flag..."
    
    if check_feature_flag_system; then
        # Example implementations:
        
        # Environment variable approach
        if [ -f ".env.production" ]; then
            if grep -q "ENABLE_USER_DELETION" ".env.production"; then
                sed -i 's/ENABLE_USER_DELETION=true/ENABLE_USER_DELETION=false/' ".env.production"
                print_status "Feature flag disabled in .env.production"
            else
                echo "ENABLE_USER_DELETION=false" >> ".env.production"
                print_status "Feature flag disabled (added to .env.production)"
            fi
        fi
        
        # LaunchDarkly example (customize as needed)
        # curl -X PATCH -H "Authorization: $LAUNCHDARKLY_API_KEY" \
        #     -H "Content-Type: application/json" \
        #     -d '{"op": "replace", "path": "/environments/production/on", "value": false}' \
        #     "https://app.launchdarkly.com/api/v2/flags/default/user-deletion"
        
        send_alert "HIGH" "User deletion feature flag has been disabled"
        return 0
    else
        print_error "Cannot disable feature flag - system not available"
        return 1
    fi
}

# Function to check current system health
check_system_health() {
    print_info "Checking current system health..."
    
    local health_issues=0
    
    # Check database connectivity
    if [ -n "$DATABASE_URL" ]; then
        if timeout 10 pnpm prisma db push --preview-feature >/dev/null 2>&1; then
            print_status "Database connectivity: OK"
        else
            print_error "Database connectivity: FAILED"
            ((health_issues++))
        fi
    else
        print_warning "DATABASE_URL not set - cannot check database"
        ((health_issues++))
    fi
    
    # Check application health endpoint
    if command -v curl >/dev/null 2>&1; then
        local app_url="${APP_URL:-http://localhost:3000}"
        if curl -s -f "$app_url/api/health" >/dev/null; then
            print_status "Application health endpoint: OK"
        else
            print_error "Application health endpoint: FAILED"
            ((health_issues++))
        fi
    fi
    
    # Check disk space
    local disk_usage=$(df / | awk 'NR==2{print $5}' | sed 's/%//')
    if [ "$disk_usage" -lt 90 ]; then
        print_status "Disk usage: ${disk_usage}% (OK)"
    else
        print_error "Disk usage: ${disk_usage}% (HIGH - may affect operations)"
        ((health_issues++))
    fi
    
    # Check memory usage
    if command -v free >/dev/null 2>&1; then
        local mem_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
        if [ "$mem_usage" -lt 90 ]; then
            print_status "Memory usage: ${mem_usage}% (OK)"
        else
            print_warning "Memory usage: ${mem_usage}% (HIGH)"
        fi
    fi
    
    return $health_issues
}

# Function to revert application deployment
revert_application_deployment() {
    print_info "Reverting application deployment..."
    
    # Method 1: Git-based rollback
    if [ -d ".git" ]; then
        print_info "Git repository detected - checking for previous deployment tag"
        
        # Find the most recent deployment tag
        local previous_tag=$(git tag -l "deploy-*" --sort=-version:refname | head -2 | tail -1)
        
        if [ -n "$previous_tag" ]; then
            print_info "Rolling back to previous deployment: $previous_tag"
            
            if git checkout "$previous_tag"; then
                print_status "Code reverted to: $previous_tag"
                
                # Reinstall dependencies if needed
                if [ -f "package.json" ]; then
                    print_info "Reinstalling dependencies..."
                    pnpm install --frozen-lockfile
                fi
                
                # Rebuild application
                print_info "Rebuilding application..."
                if pnpm build; then
                    print_status "Application rebuilt successfully"
                else
                    print_error "Application rebuild failed"
                    return 1
                fi
            else
                print_error "Failed to revert to previous tag: $previous_tag"
                return 1
            fi
        else
            print_warning "No previous deployment tag found"
        fi
    fi
    
    # Method 2: Container-based rollback (if using Docker)
    if command -v docker >/dev/null 2>&1; then
        print_info "Docker detected - checking for previous image"
        
        # Example Docker rollback (customize based on your setup)
        local previous_image="ready-set-app:previous"
        
        if docker image inspect "$previous_image" >/dev/null 2>&1; then
            print_info "Rolling back to previous Docker image"
            
            # Stop current container
            docker stop ready-set-app || true
            docker rm ready-set-app || true
            
            # Start previous version
            if docker run -d --name ready-set-app "$previous_image"; then
                print_status "Docker container rolled back successfully"
            else
                print_error "Docker rollback failed"
                return 1
            fi
        fi
    fi
    
    # Method 3: Process restart (if using PM2, systemd, etc.)
    if command -v pm2 >/dev/null 2>&1; then
        print_info "Restarting application with PM2..."
        if pm2 restart ready-set-app; then
            print_status "PM2 restart successful"
        else
            print_error "PM2 restart failed"
        fi
    elif command -v systemctl >/dev/null 2>&1; then
        print_info "Restarting application service..."
        if sudo systemctl restart ready-set; then
            print_status "Systemd restart successful"
        else
            print_error "Systemd restart failed"
        fi
    fi
    
    return 0
}

# Function to restore database (USE WITH EXTREME CAUTION)
restore_database() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        print_error "No backup file specified for database restoration"
        return 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        return 1
    fi
    
    print_critical "⚠️  DATABASE RESTORATION REQUESTED ⚠️"
    print_critical "This will overwrite ALL current database data!"
    print_critical "Backup file: $backup_file"
    
    # Safety confirmation
    if [ "$FORCE_DATABASE_RESTORE" != "true" ]; then
        print_error "Database restoration requires FORCE_DATABASE_RESTORE=true"
        print_error "This is a safety measure to prevent accidental data loss"
        print_info "To proceed, set: export FORCE_DATABASE_RESTORE=true"
        return 1
    fi
    
    print_info "FORCE_DATABASE_RESTORE=true detected - proceeding with restoration"
    send_alert "CRITICAL" "Database restoration initiated - this will overwrite ALL data"
    
    # Parse database URL
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL not set - cannot restore database"
        return 1
    fi
    
    # Extract database connection details (same as backup script)
    DB_URL_REGEX="postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+)"
    
    if [[ $DATABASE_URL =~ $DB_URL_REGEX ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASSWORD="${BASH_REMATCH[2]}"
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        DB_NAME="${BASH_REMATCH[5]}"
        DB_NAME="${DB_NAME%%\?*}"  # Remove query parameters
    else
        print_error "Could not parse DATABASE_URL"
        return 1
    fi
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Test connectivity
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        print_error "Cannot connect to database for restoration"
        return 1
    fi
    
    # Create pre-restoration backup
    local emergency_backup="$BACKUP_DIR/emergency-pre-rollback-$(date +%Y%m%d-%H%M%S).sql"
    print_info "Creating emergency backup before restoration: $emergency_backup"
    
    mkdir -p "$BACKUP_DIR"
    
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --no-owner --no-privileges --format=plain --file="$emergency_backup"; then
        print_status "Emergency backup created: $emergency_backup"
    else
        print_error "Failed to create emergency backup - ABORTING restoration"
        return 1
    fi
    
    # Perform restoration
    print_info "Restoring database from: $backup_file"
    
    if [[ "$backup_file" == *.gz ]]; then
        # Compressed backup
        if gunzip -c "$backup_file" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"; then
            print_status "Database restored successfully from compressed backup"
        else
            print_error "Database restoration FAILED"
            print_error "Emergency backup available at: $emergency_backup"
            return 1
        fi
    else
        # Uncompressed backup
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$backup_file"; then
            print_status "Database restored successfully"
        else
            print_error "Database restoration FAILED"
            print_error "Emergency backup available at: $emergency_backup"
            return 1
        fi
    fi
    
    send_alert "CRITICAL" "Database restoration completed successfully"
    return 0
}

# Function to verify rollback success
verify_rollback_success() {
    print_info "Verifying rollback success..."
    
    local verification_failures=0
    
    # Test basic application functionality
    print_info "Testing basic application health..."
    if check_system_health; then
        print_status "System health check passed"
    else
        print_error "System health check failed"
        ((verification_failures++))
    fi
    
    # Test that user deletion endpoint is disabled/reverted
    if command -v curl >/dev/null 2>&1; then
        print_info "Testing user deletion endpoint status..."
        
        local app_url="${APP_URL:-http://localhost:3000}"
        local test_response=$(curl -s -o /dev/null -w "%{http_code}" \
            -X DELETE "$app_url/api/users/test-user-id" \
            -H "Authorization: Bearer invalid-token" 2>/dev/null || echo "000")
        
        # Expect 401 (unauthorized) rather than 500 (server error) or 200 (working)
        if [ "$test_response" = "401" ] || [ "$test_response" = "404" ]; then
            print_status "User deletion endpoint properly secured/disabled"
        elif [ "$test_response" = "000" ]; then
            print_warning "Could not test user deletion endpoint (network error)"
        else
            print_error "User deletion endpoint returned unexpected status: $test_response"
            ((verification_failures++))
        fi
    fi
    
    # Test database connectivity and basic operations
    if [ -n "$DATABASE_URL" ]; then
        print_info "Testing database operations..."
        
        export PGPASSWORD="$DB_PASSWORD"
        
        # Test basic read operation
        if timeout 10 psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            -c "SELECT COUNT(*) FROM profiles LIMIT 1;" >/dev/null 2>&1; then
            print_status "Database read operations working"
        else
            print_error "Database read operations failed"
            ((verification_failures++))
        fi
    fi
    
    if [ $verification_failures -eq 0 ]; then
        print_status "All rollback verifications passed ✅"
        send_alert "INFO" "Rollback verification completed successfully"
        return 0
    else
        print_error "$verification_failures rollback verifications failed"
        send_alert "HIGH" "Rollback verification failed - manual intervention required"
        return 1
    fi
}

# Function to show rollback options menu
show_rollback_menu() {
    echo ""
    print_header "EMERGENCY ROLLBACK OPTIONS"
    echo ""
    echo "Please select the rollback action to perform:"
    echo ""
    echo "1) Disable feature flag only (safest, fastest)"
    echo "2) Revert application deployment"
    echo "3) Full rollback (application + database restore)"
    echo "4) Health check only"
    echo "5) Exit without action"
    echo ""
    read -p "Enter your choice (1-5): " choice
    
    case $choice in
        1) return 1;;  # Feature flag only
        2) return 2;;  # Application rollback
        3) return 3;;  # Full rollback
        4) return 4;;  # Health check only
        5) return 5;;  # Exit
        *) 
            print_error "Invalid choice. Please select 1-5."
            show_rollback_menu
            ;;
    esac
}

# Main rollback execution
main() {
    print_header "🚨 EMERGENCY ROLLBACK - USER DELETION ENDPOINT"
    
    print_critical "EMERGENCY ROLLBACK INITIATED"
    print_info "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    print_info "Rollback log: $ROLLBACK_LOG"
    
    # Log rollback initiation
    send_alert "HIGH" "Emergency rollback initiated for user deletion endpoint"
    
    # Show current system status
    print_header "CURRENT SYSTEM STATUS"
    check_system_health
    
    # Determine rollback action
    local rollback_action
    
    if [ "$1" = "--auto" ]; then
        print_info "Automatic rollback mode - disabling feature flag"
        rollback_action=1
    elif [ "$1" = "--full" ]; then
        print_info "Full rollback mode - application and database"
        rollback_action=3
    else
        show_rollback_menu
        rollback_action=$?
    fi
    
    # Execute rollback based on selection
    case $rollback_action in
        1)
            print_header "EXECUTING: FEATURE FLAG DISABLE"
            if disable_feature_flag; then
                print_status "Feature flag rollback completed"
                verify_rollback_success
            else
                print_error "Feature flag rollback failed"
                exit 1
            fi
            ;;
            
        2)
            print_header "EXECUTING: APPLICATION ROLLBACK"
            disable_feature_flag
            if revert_application_deployment; then
                print_status "Application rollback completed"
                verify_rollback_success
            else
                print_error "Application rollback failed"
                exit 1
            fi
            ;;
            
        3)
            print_header "EXECUTING: FULL ROLLBACK (APPLICATION + DATABASE)"
            print_critical "⚠️  FULL ROLLBACK INCLUDES DATABASE RESTORATION ⚠️"
            
            # Find the most recent backup
            local latest_backup=$(find "$BACKUP_DIR" -name "pre-user-deletion-deployment-full-*.sql*" \
                -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
            
            if [ -z "$latest_backup" ]; then
                print_error "No backup file found in $BACKUP_DIR"
                print_error "Cannot proceed with database restoration"
                exit 1
            fi
            
            print_info "Latest backup found: $latest_backup"
            
            # Disable feature flag first
            disable_feature_flag
            
            # Revert application
            if revert_application_deployment; then
                print_status "Application rollback completed"
            else
                print_error "Application rollback failed - continuing with database restoration"
            fi
            
            # Restore database
            if restore_database "$latest_backup"; then
                print_status "Database restoration completed"
                verify_rollback_success
            else
                print_error "Database restoration failed"
                exit 1
            fi
            ;;
            
        4)
            print_header "EXECUTING: HEALTH CHECK ONLY"
            if check_system_health; then
                print_status "System health check completed - no issues found"
            else
                print_warning "System health check found issues - consider rollback actions"
            fi
            ;;
            
        5)
            print_info "Rollback cancelled by user"
            exit 0
            ;;
    esac
    
    # Final status
    print_header "ROLLBACK COMPLETED"
    print_status "Emergency rollback procedures completed successfully ✅"
    print_info "Rollback log saved to: $ROLLBACK_LOG"
    print_info "Monitor system closely for the next 30 minutes"
    
    send_alert "INFO" "Emergency rollback completed successfully"
}

# Handle script interruption
trap 'print_error "Rollback interrupted - check system state"; exit 1' INT TERM

# Parse command line arguments
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Emergency Rollback Script for User Deletion Endpoint"
    echo ""
    echo "Usage:"
    echo "  $0                    # Interactive mode"
    echo "  $0 --auto            # Automatic feature flag disable"
    echo "  $0 --full            # Full rollback including database"
    echo "  $0 --help            # Show this help"
    echo ""
    echo "Environment variables:"
    echo "  FORCE_DATABASE_RESTORE=true    # Required for database restoration"
    echo "  SKIP_HEALTH_CHECK=true         # Skip initial health check"
    echo "  APP_URL=http://...             # Application URL for testing"
    echo ""
    exit 0
fi

# Execute main function
main "$@"
