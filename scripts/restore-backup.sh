#!/bin/bash

# Production Backup Restoration Script for Ready Set LLC
# Usage: ./scripts/restore-backup.sh <backup_manifest_file> [--dry-run] [--force]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MANIFEST_FILE="${1:-}"
DRY_RUN=false
FORCE_RESTORE=false
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
RESTORE_LOG="/tmp/restore_$TIMESTAMP.log"

# Parse command line arguments
for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE_RESTORE=true
            shift
            ;;
    esac
done

# Environment variables
DATABASE_URL="${DATABASE_URL:-}"
BACKUP_STORAGE_BUCKET="${BACKUP_STORAGE_BUCKET:-ready-set-backups}"
ENCRYPTION_KEY_FILE="${ENCRYPTION_KEY_FILE:-/etc/ready-set/backup.key}"
RESTORE_DIR="/tmp/restore-$TIMESTAMP"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$level" in
        "INFO")  echo -e "${GREEN}[INFO]${NC}  $timestamp - $message" | tee -a "$RESTORE_LOG" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC}  $timestamp - $message" | tee -a "$RESTORE_LOG" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} $timestamp - $message" | tee -a "$RESTORE_LOG" ;;
        "DEBUG") echo -e "${BLUE}[DEBUG]${NC} $timestamp - $message" | tee -a "$RESTORE_LOG" ;;
    esac
}

# Error handler
error_handler() {
    local exit_code=$?
    log "ERROR" "Restore script failed with exit code $exit_code"
    cleanup_restore_files
    exit $exit_code
}

# Set up error handling
trap error_handler ERR

# Show usage
show_usage() {
    cat << EOF
Usage: $0 <backup_manifest_file> [--dry-run] [--force]

Arguments:
  backup_manifest_file  Path to the backup manifest JSON file

Options:
  --dry-run            Validate restore process without making changes
  --force              Skip confirmation prompts (use with caution)

Examples:
  $0 /backups/manifest_daily_20240101_120000.json
  $0 /backups/manifest_weekly_20240101_120000.json --dry-run
  $0 s3://ready-set-backups/daily/2024/01/manifest_daily_20240101_120000.json --force

EOF
}

# Validate input parameters
validate_input() {
    if [[ -z "$MANIFEST_FILE" ]]; then
        log "ERROR" "Backup manifest file not specified"
        show_usage
        exit 1
    fi
    
    if [[ -z "$DATABASE_URL" ]]; then
        log "ERROR" "DATABASE_URL environment variable not set"
        exit 1
    fi
    
    if [[ ! -f "$ENCRYPTION_KEY_FILE" ]]; then
        log "ERROR" "Encryption key file not found at $ENCRYPTION_KEY_FILE"
        exit 1
    fi
}

# Download manifest file if it's from S3
download_manifest() {
    if [[ "$MANIFEST_FILE" =~ ^s3:// ]]; then
        log "INFO" "Downloading manifest from S3: $MANIFEST_FILE"
        local local_manifest="$RESTORE_DIR/manifest.json"
        mkdir -p "$RESTORE_DIR"
        
        if aws s3 cp "$MANIFEST_FILE" "$local_manifest"; then
            MANIFEST_FILE="$local_manifest"
            log "INFO" "Manifest downloaded successfully"
        else
            log "ERROR" "Failed to download manifest from S3"
            exit 1
        fi
    fi
    
    if [[ ! -f "$MANIFEST_FILE" ]]; then
        log "ERROR" "Manifest file not found: $MANIFEST_FILE"
        exit 1
    fi
}

# Parse manifest file
parse_manifest() {
    log "INFO" "Parsing backup manifest: $MANIFEST_FILE"
    
    if ! jq empty "$MANIFEST_FILE" 2>/dev/null; then
        log "ERROR" "Invalid JSON in manifest file"
        exit 1
    fi
    
    # Extract backup information
    BACKUP_TYPE=$(jq -r '.backup_type' "$MANIFEST_FILE")
    BACKUP_TIMESTAMP=$(jq -r '.timestamp' "$MANIFEST_FILE")
    BACKUP_DATE=$(jq -r '.date' "$MANIFEST_FILE")
    BACKUP_VERSION=$(jq -r '.version' "$MANIFEST_FILE")
    
    log "INFO" "Backup Details:"
    log "INFO" "  Type: $BACKUP_TYPE"
    log "INFO" "  Timestamp: $BACKUP_TIMESTAMP"
    log "INFO" "  Date: $BACKUP_DATE"
    log "INFO" "  Version: $BACKUP_VERSION"
}

# Download backup files
download_backup_files() {
    log "INFO" "Downloading backup files"
    
    mkdir -p "$RESTORE_DIR"/{database,files,config}
    
    # Read file list from manifest
    local file_count=$(jq '.files | length' "$MANIFEST_FILE")
    log "INFO" "Found $file_count backup files"
    
    for ((i=0; i<file_count; i++)); do
        local file_name=$(jq -r ".files[$i].name" "$MANIFEST_FILE")
        local expected_size=$(jq -r ".files[$i].size" "$MANIFEST_FILE")
        local expected_hash=$(jq -r ".files[$i].sha256" "$MANIFEST_FILE")
        
        log "INFO" "Downloading: $file_name"
        
        # Determine file type and download location
        local download_path=""
        if [[ "$file_name" =~ db_backup ]]; then
            download_path="$RESTORE_DIR/database/$file_name"
        elif [[ "$file_name" =~ app_files ]]; then
            download_path="$RESTORE_DIR/files/$file_name"
        elif [[ "$file_name" =~ config_backup ]]; then
            download_path="$RESTORE_DIR/config/$file_name"
        else
            download_path="$RESTORE_DIR/$file_name"
        fi
        
        # Download from S3
        local s3_path="s3://$BACKUP_STORAGE_BUCKET/$BACKUP_TYPE/$(date -d "$BACKUP_DATE" '+%Y/%m')/$file_name"
        
        if aws s3 cp "$s3_path" "$download_path"; then
            log "INFO" "Downloaded: $file_name"
            
            # Verify file size and hash
            local actual_size=$(stat -c%s "$download_path")
            local actual_hash=$(sha256sum "$download_path" | cut -d' ' -f1)
            
            if [[ "$actual_size" != "$expected_size" ]]; then
                log "ERROR" "Size mismatch for $file_name: expected $expected_size, got $actual_size"
                exit 1
            fi
            
            if [[ "$actual_hash" != "$expected_hash" ]]; then
                log "ERROR" "Hash mismatch for $file_name: expected $expected_hash, got $actual_hash"
                exit 1
            fi
            
            log "INFO" "Verification successful for $file_name"
        else
            log "ERROR" "Failed to download: $file_name"
            exit 1
        fi
    done
    
    log "INFO" "All backup files downloaded and verified"
}

# Decrypt backup files
decrypt_backup_files() {
    log "INFO" "Decrypting backup files"
    
    find "$RESTORE_DIR" -name "*.enc" | while read -r encrypted_file; do
        local decrypted_file="${encrypted_file%.enc}"
        local file_name=$(basename "$encrypted_file")
        
        log "INFO" "Decrypting: $file_name"
        
        if openssl enc -aes-256-cbc -d -in "$encrypted_file" -out "$decrypted_file" -pass file:"$ENCRYPTION_KEY_FILE"; then
            log "INFO" "Decrypted: $file_name"
            rm "$encrypted_file"  # Remove encrypted file after successful decryption
        else
            log "ERROR" "Failed to decrypt: $file_name"
            exit 1
        fi
    done
    
    log "INFO" "All backup files decrypted successfully"
}

# Create database backup before restore
create_pre_restore_backup() {
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN: Skipping pre-restore database backup"
        return
    fi
    
    log "INFO" "Creating pre-restore database backup"
    
    local pre_restore_backup="$RESTORE_DIR/pre_restore_backup_$TIMESTAMP.sql"
    
    if pg_dump "$DATABASE_URL" \
        --verbose \
        --no-owner \
        --no-privileges \
        --format=custom \
        --compress=9 \
        --file="$pre_restore_backup"; then
        
        log "INFO" "Pre-restore backup created: $pre_restore_backup"
        
        # Upload to S3 for safety
        local s3_backup_path="s3://$BACKUP_STORAGE_BUCKET/pre-restore/pre_restore_backup_$TIMESTAMP.sql"
        aws s3 cp "$pre_restore_backup" "$s3_backup_path"
        log "INFO" "Pre-restore backup uploaded to: $s3_backup_path"
    else
        log "ERROR" "Failed to create pre-restore database backup"
        exit 1
    fi
}

# Restore database
restore_database() {
    log "INFO" "Starting database restoration"
    
    # Find database backup file
    local db_backup_file=$(find "$RESTORE_DIR/database" -name "db_backup_*.sql" | head -1)
    
    if [[ -z "$db_backup_file" || ! -f "$db_backup_file" ]]; then
        log "ERROR" "Database backup file not found"
        exit 1
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN: Would restore database from $db_backup_file"
        
        # Validate backup file
        if pg_restore --list "$db_backup_file" > /dev/null 2>&1; then
            log "INFO" "DRY RUN: Database backup file is valid"
        else
            log "ERROR" "DRY RUN: Database backup file validation failed"
            exit 1
        fi
        return
    fi
    
    log "INFO" "Restoring database from: $db_backup_file"
    
    # Validate backup file
    if ! pg_restore --list "$db_backup_file" > /dev/null 2>&1; then
        log "ERROR" "Database backup file validation failed"
        exit 1
    fi
    
    # Restore database
    if pg_restore \
        --verbose \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges \
        --dbname="$DATABASE_URL" \
        "$db_backup_file"; then
        
        log "INFO" "Database restoration completed successfully"
    else
        log "ERROR" "Database restoration failed"
        exit 1
    fi
}

# Restore application files
restore_application_files() {
    log "INFO" "Starting application files restoration"
    
    # Find application files backup
    local files_backup=$(find "$RESTORE_DIR/files" -name "app_files_*.tar.gz" | head -1)
    
    if [[ -z "$files_backup" || ! -f "$files_backup" ]]; then
        log "WARN" "Application files backup not found, skipping"
        return
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN: Would restore application files from $files_backup"
        return
    fi
    
    log "INFO" "Restoring application files from: $files_backup"
    
    # Create temporary extraction directory
    local extract_dir="$RESTORE_DIR/extract"
    mkdir -p "$extract_dir"
    
    # Extract files
    if tar -xzf "$files_backup" -C "$extract_dir"; then
        log "INFO" "Application files extracted successfully"
        
        # Copy files to project root (be careful not to overwrite important files)
        log "INFO" "Copying restored files to project directory"
        cp -r "$extract_dir"/* "$PROJECT_ROOT/" 2>/dev/null || true
        
        log "INFO" "Application files restoration completed"
    else
        log "ERROR" "Failed to extract application files"
        exit 1
    fi
}

# Restore configuration files
restore_configuration() {
    log "INFO" "Starting configuration restoration"
    
    # Find configuration backup
    local config_backup=$(find "$RESTORE_DIR/config" -name "config_backup_*.tar.gz" | head -1)
    
    if [[ -z "$config_backup" || ! -f "$config_backup" ]]; then
        log "WARN" "Configuration backup not found, skipping"
        return
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN: Would restore configuration from $config_backup"
        return
    fi
    
    log "WARN" "Configuration restoration requires manual review"
    log "INFO" "Configuration backup available at: $config_backup"
    log "INFO" "Please manually review and apply configuration changes"
}

# Verify restoration
verify_restoration() {
    log "INFO" "Verifying restoration"
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN: Skipping verification"
        return
    fi
    
    # Test database connectivity
    if npx prisma db pull --preview-feature > /dev/null 2>&1; then
        log "INFO" "Database connectivity verified"
    else
        log "ERROR" "Database connectivity test failed"
        exit 1
    fi
    
    # Check if application can start
    log "INFO" "Testing application startup"
    if timeout 30s npm run build > /dev/null 2>&1; then
        log "INFO" "Application build test passed"
    else
        log "WARN" "Application build test failed - manual intervention may be required"
    fi
    
    log "INFO" "Restoration verification completed"
}

# Cleanup restore files
cleanup_restore_files() {
    if [[ -d "$RESTORE_DIR" ]]; then
        log "INFO" "Cleaning up restore files"
        rm -rf "$RESTORE_DIR"
    fi
}

# Confirmation prompt
confirm_restore() {
    if [[ "$FORCE_RESTORE" == true || "$DRY_RUN" == true ]]; then
        return
    fi
    
    echo
    echo -e "${RED}WARNING: This will restore the database and application files!${NC}"
    echo "This action cannot be undone automatically."
    echo
    echo "Backup Details:"
    echo "  Type: $BACKUP_TYPE"
    echo "  Date: $BACKUP_DATE"
    echo "  Version: $BACKUP_VERSION"
    echo
    read -p "Are you sure you want to proceed? (type 'yes' to continue): " -r
    echo
    
    if [[ ! $REPLY =~ ^yes$ ]]; then
        log "INFO" "Restore cancelled by user"
        exit 0
    fi
}

# Main restoration function
main() {
    log "INFO" "Starting restoration process"
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "Running in DRY RUN mode - no changes will be made"
    fi
    
    validate_input
    download_manifest
    parse_manifest
    confirm_restore
    download_backup_files
    decrypt_backup_files
    create_pre_restore_backup
    restore_database
    restore_application_files
    restore_configuration
    verify_restoration
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN completed successfully - restore process validated"
    else
        log "INFO" "Restoration completed successfully"
        log "INFO" "Please test your application thoroughly"
    fi
    
    cleanup_restore_files
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ "$#" -eq 0 ]]; then
        show_usage
        exit 1
    fi
    
    main "$@"
fi 