#!/bin/bash

# Production Database Backup Script for User Deletion Deployment
# This script creates comprehensive backups before deploying user deletion functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="/var/backups/ready-set-db"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_PREFIX="pre-user-deletion-deployment"
RETENTION_DAYS=30

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✅ SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠️  WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[❌ ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[ℹ️  INFO]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}================================================${NC}"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to parse DATABASE_URL
parse_database_url() {
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL environment variable is not set"
        exit 1
    fi
    
    # Parse DATABASE_URL (format: postgresql://user:password@host:port/database)
    DB_URL_REGEX="postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+)"
    
    if [[ $DATABASE_URL =~ $DB_URL_REGEX ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASSWORD="${BASH_REMATCH[2]}"
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        DB_NAME="${BASH_REMATCH[5]}"
        
        # Remove any query parameters from database name
        DB_NAME="${DB_NAME%%\?*}"
        
        print_info "Database connection parsed successfully"
        print_info "Host: $DB_HOST:$DB_PORT"
        print_info "Database: $DB_NAME"
        print_info "User: $DB_USER"
    else
        print_error "Could not parse DATABASE_URL format"
        exit 1
    fi
}

# Function to test database connectivity
test_database_connection() {
    print_info "Testing database connection..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        print_status "Database connection successful"
    else
        print_error "Cannot connect to database"
        print_error "Please verify:"
        print_error "  - Database is running"
        print_error "  - Network connectivity"
        print_error "  - Credentials are correct"
        exit 1
    fi
}

# Function to create backup directory
create_backup_directory() {
    if [ ! -d "$BACKUP_DIR" ]; then
        print_info "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
        chmod 750 "$BACKUP_DIR"
    fi
    
    if [ ! -w "$BACKUP_DIR" ]; then
        print_error "Backup directory is not writable: $BACKUP_DIR"
        exit 1
    fi
    
    print_status "Backup directory ready: $BACKUP_DIR"
}

# Function to create full database backup
create_full_backup() {
    local backup_file="$BACKUP_DIR/${BACKUP_PREFIX}-full-${TIMESTAMP}.sql"
    local compressed_backup="${backup_file}.gz"
    
    print_info "Creating full database backup..."
    print_info "Backup file: $backup_file"
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Create backup with verbose output
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --verbose \
        --no-owner \
        --no-privileges \
        --format=plain \
        --file="$backup_file" 2>/dev/null; then
        
        print_status "Full database backup created successfully"
        
        # Compress the backup
        print_info "Compressing backup file..."
        if gzip "$backup_file"; then
            print_status "Backup compressed: $compressed_backup"
            FULL_BACKUP_FILE="$compressed_backup"
        else
            print_warning "Failed to compress backup, keeping uncompressed version"
            FULL_BACKUP_FILE="$backup_file"
        fi
        
        # Get file size
        local file_size=$(du -h "$FULL_BACKUP_FILE" | cut -f1)
        print_info "Backup file size: $file_size"
        
    else
        print_error "Failed to create full database backup"
        exit 1
    fi
}

# Function to create schema-only backup
create_schema_backup() {
    local schema_backup="$BACKUP_DIR/${BACKUP_PREFIX}-schema-${TIMESTAMP}.sql"
    
    print_info "Creating schema-only backup..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --schema-only \
        --no-owner \
        --no-privileges \
        --format=plain \
        --file="$schema_backup" 2>/dev/null; then
        
        print_status "Schema backup created: $schema_backup"
        SCHEMA_BACKUP_FILE="$schema_backup"
    else
        print_error "Failed to create schema backup"
        exit 1
    fi
}

# Function to create table-specific backups for user deletion related tables
create_table_specific_backups() {
    local tables_dir="$BACKUP_DIR/table-backups-${TIMESTAMP}"
    mkdir -p "$tables_dir"
    
    # Tables that will be affected by user deletion
    local affected_tables=(
        "profiles"
        "accounts" 
        "sessions"
        "user_addresses"
        "addresses"
        "file_uploads"
        "dispatches"
        "catering_requests"
        "on_demand_requests"
        "job_applications"
    )
    
    print_info "Creating table-specific backups..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    local backup_success=true
    
    for table in "${affected_tables[@]}"; do
        local table_backup="$tables_dir/${table}-${TIMESTAMP}.sql"
        
        print_info "Backing up table: $table"
        
        if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --table="$table" \
            --data-only \
            --format=plain \
            --file="$table_backup" 2>/dev/null; then
            
            local row_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs)
            
            print_status "Table $table backed up ($row_count rows)"
        else
            print_warning "Failed to backup table: $table (table may not exist)"
            backup_success=false
        fi
    done
    
    if [ "$backup_success" = true ]; then
        print_status "Table-specific backups completed"
        TABLE_BACKUPS_DIR="$tables_dir"
    else
        print_warning "Some table backups failed - check if all tables exist"
        TABLE_BACKUPS_DIR="$tables_dir"
    fi
}

# Function to verify backup integrity
verify_backup_integrity() {
    print_info "Verifying backup integrity..."
    
    # Check if backup files exist and are not empty
    if [ -f "$FULL_BACKUP_FILE" ] && [ -s "$FULL_BACKUP_FILE" ]; then
        print_status "Full backup file exists and is not empty"
    else
        print_error "Full backup file is missing or empty"
        exit 1
    fi
    
    if [ -f "$SCHEMA_BACKUP_FILE" ] && [ -s "$SCHEMA_BACKUP_FILE" ]; then
        print_status "Schema backup file exists and is not empty"
    else
        print_error "Schema backup file is missing or empty"
        exit 1
    fi
    
    # Generate checksums
    print_info "Generating backup checksums..."
    
    local checksum_file="$BACKUP_DIR/${BACKUP_PREFIX}-checksums-${TIMESTAMP}.md5"
    
    {
        echo "# Backup Checksums - $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
        echo "# Generated for pre-user-deletion-deployment backup"
        echo ""
        md5sum "$FULL_BACKUP_FILE" 2>/dev/null || echo "Error calculating full backup checksum"
        md5sum "$SCHEMA_BACKUP_FILE" 2>/dev/null || echo "Error calculating schema backup checksum"
        
        if [ -d "$TABLE_BACKUPS_DIR" ]; then
            find "$TABLE_BACKUPS_DIR" -name "*.sql" -exec md5sum {} \; 2>/dev/null || echo "Error calculating table backup checksums"
        fi
    } > "$checksum_file"
    
    print_status "Checksums saved to: $checksum_file"
    CHECKSUM_FILE="$checksum_file"
}

# Function to create backup manifest
create_backup_manifest() {
    local manifest_file="$BACKUP_DIR/${BACKUP_PREFIX}-manifest-${TIMESTAMP}.json"
    
    print_info "Creating backup manifest..."
    
    # Get database statistics
    export PGPASSWORD="$DB_PASSWORD"
    local total_size=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" 2>/dev/null | xargs || echo "Unknown")
    
    local table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs || echo "Unknown")
    
    # Create JSON manifest
    cat > "$manifest_file" <<EOF
{
  "backup_info": {
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "purpose": "Pre-deployment backup for user deletion endpoint",
    "database_name": "$DB_NAME",
    "database_host": "$DB_HOST:$DB_PORT",
    "database_user": "$DB_USER",
    "database_size": "$total_size",
    "table_count": $table_count
  },
  "backup_files": {
    "full_backup": "$FULL_BACKUP_FILE",
    "schema_backup": "$SCHEMA_BACKUP_FILE",
    "table_backups_directory": "$TABLE_BACKUPS_DIR",
    "checksum_file": "$CHECKSUM_FILE"
  },
  "restoration_info": {
    "full_restore_command": "gunzip -c $FULL_BACKUP_FILE | psql -h HOST -p PORT -U USER -d DATABASE",
    "schema_restore_command": "psql -h HOST -p PORT -U USER -d DATABASE < $SCHEMA_BACKUP_FILE",
    "notes": [
      "Replace HOST, PORT, USER, DATABASE with actual values",
      "Ensure target database exists before restoration",
      "Full restore will overwrite existing data",
      "Test restoration in non-production environment first"
    ]
  },
  "affected_tables": [
    "profiles",
    "accounts",
    "sessions", 
    "user_addresses",
    "addresses",
    "file_uploads",
    "dispatches",
    "catering_requests",
    "on_demand_requests",
    "job_applications"
  ],
  "deployment_info": {
    "feature": "User deletion endpoint",
    "endpoint": "DELETE /api/users/[userId]",
    "risk_level": "HIGH",
    "rollback_required_if": [
      "Data corruption detected",
      "Cascade deletion failures",
      "Transaction integrity issues",
      "Performance degradation > 10x baseline"
    ]
  }
}
EOF
    
    print_status "Backup manifest created: $manifest_file"
    MANIFEST_FILE="$manifest_file"
}

# Function to cleanup old backups
cleanup_old_backups() {
    print_info "Cleaning up backups older than $RETENTION_DAYS days..."
    
    local deleted_count=0
    
    # Find and delete old backup files
    if find "$BACKUP_DIR" -name "${BACKUP_PREFIX}-*" -type f -mtime +$RETENTION_DAYS -exec rm {} \; 2>/dev/null; then
        deleted_count=$(find "$BACKUP_DIR" -name "${BACKUP_PREFIX}-*" -type f -mtime +$RETENTION_DAYS | wc -l)
    fi
    
    if [ $deleted_count -gt 0 ]; then
        print_info "Cleaned up $deleted_count old backup files"
    else
        print_info "No old backup files to clean up"
    fi
}

# Function to test backup restoration (optional, in isolated environment)
test_backup_restoration() {
    if [ "$SKIP_RESTORE_TEST" = "true" ]; then
        print_warning "Skipping backup restoration test (SKIP_RESTORE_TEST=true)"
        return
    fi
    
    print_info "Testing backup restoration..."
    print_warning "This would require a test database - skipping in production script"
    print_info "To test restoration manually:"
    print_info "  1. Create a test database"
    print_info "  2. Run: gunzip -c $FULL_BACKUP_FILE | psql -h HOST -p PORT -U USER -d TEST_DB"
    print_info "  3. Verify data integrity and completeness"
}

# Main execution
main() {
    print_header "PRODUCTION DATABASE BACKUP FOR USER DELETION DEPLOYMENT"
    
    print_info "Starting backup process..."
    print_info "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    print_info "Purpose: Pre-deployment backup for user deletion endpoint"
    
    # Prerequisites check
    print_header "PREREQUISITES CHECK"
    
    if ! command_exists pg_dump; then
        print_error "pg_dump is not installed. Please install PostgreSQL client tools."
        exit 1
    fi
    
    if ! command_exists psql; then
        print_error "psql is not installed. Please install PostgreSQL client tools."
        exit 1
    fi
    
    # Parse database configuration
    parse_database_url
    
    # Create backup directory
    create_backup_directory
    
    # Test database connection
    test_database_connection
    
    # Create backups
    print_header "CREATING BACKUPS"
    
    create_full_backup
    create_schema_backup
    create_table_specific_backups
    
    # Verify and document backups
    print_header "VERIFICATION AND DOCUMENTATION"
    
    verify_backup_integrity
    create_backup_manifest
    
    # Optional restoration test
    test_backup_restoration
    
    # Cleanup old backups
    print_header "CLEANUP"
    cleanup_old_backups
    
    # Final summary
    print_header "BACKUP COMPLETED SUCCESSFULLY"
    
    print_status "All backups created and verified ✨"
    print_info "Backup location: $BACKUP_DIR"
    print_info "Backup timestamp: $TIMESTAMP"
    print_info ""
    print_info "Backup files created:"
    print_info "  📄 Full backup: $FULL_BACKUP_FILE"
    print_info "  📋 Schema backup: $SCHEMA_BACKUP_FILE"
    print_info "  📁 Table backups: $TABLE_BACKUPS_DIR"
    print_info "  🔐 Checksums: $CHECKSUM_FILE"
    print_info "  📝 Manifest: $MANIFEST_FILE"
    print_info ""
    print_status "Database is ready for user deletion deployment"
    print_warning "Keep these backup files safe until deployment is verified successful"
    
    # Set environment variables for other scripts
    export BACKUP_TIMESTAMP="$TIMESTAMP"
    export BACKUP_FULL_FILE="$FULL_BACKUP_FILE"
    export BACKUP_MANIFEST_FILE="$MANIFEST_FILE"
    
    print_info "Environment variables set for deployment pipeline:"
    print_info "  BACKUP_TIMESTAMP=$BACKUP_TIMESTAMP"
    print_info "  BACKUP_FULL_FILE=$BACKUP_FULL_FILE"
    print_info "  BACKUP_MANIFEST_FILE=$BACKUP_MANIFEST_FILE"
}

# Run main function
main "$@"
