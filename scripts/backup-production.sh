#!/bin/bash

# Production Backup Script for Ready Set LLC
# Usage: ./scripts/backup-production.sh [daily|weekly|monthly|manual]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_TYPE="${1:-daily}"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_ROOT="/backups/ready-set"
LOG_FILE="$BACKUP_ROOT/logs/backup_$TIMESTAMP.log"

# Environment variables (should be set in production)
DATABASE_URL="${DATABASE_URL:-}"
BACKUP_STORAGE_BUCKET="${BACKUP_STORAGE_BUCKET:-ready-set-backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
ENCRYPTION_KEY_FILE="${ENCRYPTION_KEY_FILE:-/etc/ready-set/backup.key}"

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
        "INFO")  echo -e "${GREEN}[INFO]${NC}  $timestamp - $message" | tee -a "$LOG_FILE" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC}  $timestamp - $message" | tee -a "$LOG_FILE" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} $timestamp - $message" | tee -a "$LOG_FILE" ;;
        "DEBUG") echo -e "${BLUE}[DEBUG]${NC} $timestamp - $message" | tee -a "$LOG_FILE" ;;
    esac
}

# Error handler
error_handler() {
    local exit_code=$?
    log "ERROR" "Backup script failed with exit code $exit_code"
    
    # Send alert notification
    send_notification "BACKUP_FAILED" "Production backup failed with exit code $exit_code"
    
    exit $exit_code
}

# Set up error handling
trap error_handler ERR

# Create backup directories
setup_backup_environment() {
    log "INFO" "Setting up backup environment"
    
    mkdir -p "$BACKUP_ROOT"/{database,files,config,logs}
    mkdir -p "$BACKUP_ROOT/archive/$BACKUP_TYPE"
    
    # Set proper permissions
    chmod 700 "$BACKUP_ROOT"
    chmod 750 "$BACKUP_ROOT/logs"
    
    log "INFO" "Backup environment ready"
}

# Validate prerequisites
validate_prerequisites() {
    log "INFO" "Validating backup prerequisites"
    
    # Check required commands
    local required_commands=("pg_dump" "tar" "gzip" "aws" "openssl")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log "ERROR" "Required command '$cmd' not found"
            exit 1
        fi
    done
    
    # Check environment variables
    if [[ -z "$DATABASE_URL" ]]; then
        log "ERROR" "DATABASE_URL environment variable not set"
        exit 1
    fi
    
    # Check encryption key
    if [[ ! -f "$ENCRYPTION_KEY_FILE" ]]; then
        log "WARN" "Encryption key file not found at $ENCRYPTION_KEY_FILE"
        log "INFO" "Generating new encryption key"
        
        mkdir -p "$(dirname "$ENCRYPTION_KEY_FILE")"
        openssl rand -base64 32 > "$ENCRYPTION_KEY_FILE"
        chmod 600 "$ENCRYPTION_KEY_FILE"
    fi
    
    log "INFO" "Prerequisites validation completed"
}

# Database backup
backup_database() {
    log "INFO" "Starting database backup"
    
    local db_backup_file="$BACKUP_ROOT/database/db_backup_$BACKUP_TYPE_$TIMESTAMP.sql"
    local db_backup_encrypted="$db_backup_file.enc"
    
    # Create database backup
    log "INFO" "Creating database dump"
    pg_dump "$DATABASE_URL" \
        --verbose \
        --no-owner \
        --no-privileges \
        --format=custom \
        --compress=9 \
        --file="$db_backup_file"
    
    # Verify backup integrity
    log "INFO" "Verifying database backup integrity"
    if ! pg_restore --list "$db_backup_file" > /dev/null 2>&1; then
        log "ERROR" "Database backup verification failed"
        exit 1
    fi
    
    # Encrypt backup
    log "INFO" "Encrypting database backup"
    openssl enc -aes-256-cbc -salt -in "$db_backup_file" -out "$db_backup_encrypted" -pass file:"$ENCRYPTION_KEY_FILE"
    
    # Remove unencrypted backup
    rm "$db_backup_file"
    
    # Get backup size
    local backup_size=$(du -h "$db_backup_encrypted" | cut -f1)
    log "INFO" "Database backup completed: $backup_size"
    
    echo "$db_backup_encrypted"
}

# Application files backup
backup_application_files() {
    log "INFO" "Starting application files backup"
    
    local files_backup_file="$BACKUP_ROOT/files/app_files_$BACKUP_TYPE_$TIMESTAMP.tar.gz"
    local files_backup_encrypted="$files_backup_file.enc"
    
    # Define files/directories to backup
    local backup_items=(
        "$PROJECT_ROOT/prisma/schema.prisma"
        "$PROJECT_ROOT/package.json"
        "$PROJECT_ROOT/package-lock.json"
        "$PROJECT_ROOT/pnpm-lock.yaml"
        "$PROJECT_ROOT/next.config.js"
        "$PROJECT_ROOT/tailwind.config.js"
        "$PROJECT_ROOT/tsconfig.json"
        "$PROJECT_ROOT/.env.example"
        "$PROJECT_ROOT/public"
        "$PROJECT_ROOT/scripts"
        "$PROJECT_ROOT/docs"
    )
    
    # Create tar archive
    log "INFO" "Creating application files archive"
    tar -czf "$files_backup_file" \
        --exclude='node_modules' \
        --exclude='.next' \
        --exclude='.git' \
        --exclude='*.log' \
        -C "$PROJECT_ROOT" \
        "${backup_items[@]/#/$PROJECT_ROOT/}" 2>/dev/null || true
    
    # Encrypt backup
    log "INFO" "Encrypting application files backup"
    openssl enc -aes-256-cbc -salt -in "$files_backup_file" -out "$files_backup_encrypted" -pass file:"$ENCRYPTION_KEY_FILE"
    
    # Remove unencrypted backup
    rm "$files_backup_file"
    
    # Get backup size
    local backup_size=$(du -h "$files_backup_encrypted" | cut -f1)
    log "INFO" "Application files backup completed: $backup_size"
    
    echo "$files_backup_encrypted"
}

# Configuration backup
backup_configuration() {
    log "INFO" "Starting configuration backup"
    
    local config_backup_file="$BACKUP_ROOT/config/config_backup_$BACKUP_TYPE_$TIMESTAMP.tar.gz"
    local config_backup_encrypted="$config_backup_file.enc"
    
    # Configuration items to backup (sensitive configs should be backed up separately)
    local config_items=(
        "/etc/nginx/sites-available/ready-set"
        "/etc/systemd/system/ready-set.service"
        "/etc/cron.d/ready-set-backups"
        "$PROJECT_ROOT/.github/workflows"
        "$PROJECT_ROOT/docker-compose.yml"
        "$PROJECT_ROOT/Dockerfile"
    )
    
    # Create configuration archive
    log "INFO" "Creating configuration archive"
    tar -czf "$config_backup_file" "${config_items[@]}" 2>/dev/null || true
    
    # Encrypt backup
    log "INFO" "Encrypting configuration backup"
    openssl enc -aes-256-cbc -salt -in "$config_backup_file" -out "$config_backup_encrypted" -pass file:"$ENCRYPTION_KEY_FILE"
    
    # Remove unencrypted backup
    rm "$config_backup_file"
    
    # Get backup size
    local backup_size=$(du -h "$config_backup_encrypted" | cut -f1)
    log "INFO" "Configuration backup completed: $backup_size"
    
    echo "$config_backup_encrypted"
}

# Upload to cloud storage
upload_to_cloud() {
    local backup_files=("$@")
    
    log "INFO" "Uploading backups to cloud storage"
    
    for backup_file in "${backup_files[@]}"; do
        local file_name=$(basename "$backup_file")
        local s3_path="s3://$BACKUP_STORAGE_BUCKET/$BACKUP_TYPE/$(date '+%Y/%m')/$file_name"
        
        log "INFO" "Uploading $file_name to $s3_path"
        
        if aws s3 cp "$backup_file" "$s3_path" --storage-class STANDARD_IA; then
            log "INFO" "Successfully uploaded $file_name"
        else
            log "ERROR" "Failed to upload $file_name"
            return 1
        fi
    done
    
    log "INFO" "All backups uploaded successfully"
}

# Create backup manifest
create_backup_manifest() {
    local backup_files=("$@")
    local manifest_file="$BACKUP_ROOT/manifest_$BACKUP_TYPE_$TIMESTAMP.json"
    
    log "INFO" "Creating backup manifest"
    
    cat > "$manifest_file" << EOF
{
  "backup_type": "$BACKUP_TYPE",
  "timestamp": "$TIMESTAMP",
  "date": "$(date -Iseconds)",
  "version": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "files": [
EOF
    
    local first=true
    for backup_file in "${backup_files[@]}"; do
        if [[ "$first" == true ]]; then
            first=false
        else
            echo "," >> "$manifest_file"
        fi
        
        local file_name=$(basename "$backup_file")
        local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file")
        local file_hash=$(sha256sum "$backup_file" | cut -d' ' -f1)
        
        cat >> "$manifest_file" << EOF
    {
      "name": "$file_name",
      "path": "$backup_file",
      "size": $file_size,
      "sha256": "$file_hash"
    }
EOF
    done
    
    cat >> "$manifest_file" << EOF
  ]
}
EOF
    
    log "INFO" "Backup manifest created: $manifest_file"
    echo "$manifest_file"
}

# Send notification
send_notification() {
    local event_type="$1"
    local message="$2"
    
    # Add notification logic here (Slack, email, etc.)
    case "$event_type" in
        "BACKUP_SUCCESS")
            log "INFO" "Notification: $message"
            ;;
        "BACKUP_FAILED")
            log "ERROR" "Alert: $message"
            ;;
        "BACKUP_WARNING")
            log "WARN" "Warning: $message"
            ;;
    esac
}

# Clean old backups
cleanup_old_backups() {
    log "INFO" "Cleaning up old backups (retention: $BACKUP_RETENTION_DAYS days)"
    
    # Local cleanup
    find "$BACKUP_ROOT" -type f -name "*.enc" -mtime +$BACKUP_RETENTION_DAYS -delete
    find "$BACKUP_ROOT" -type f -name "manifest_*.json" -mtime +$BACKUP_RETENTION_DAYS -delete
    
    # Cloud cleanup (lifecycle policies should handle this, but manual cleanup as backup)
    local cutoff_date=$(date -d "$BACKUP_RETENTION_DAYS days ago" '+%Y-%m-%d')
    log "INFO" "Local cleanup completed (files older than $cutoff_date removed)"
}

# Validate backup type
validate_backup_type() {
    case "$BACKUP_TYPE" in
        "daily"|"weekly"|"monthly"|"manual")
            log "INFO" "Backup type: $BACKUP_TYPE"
            ;;
        *)
            log "ERROR" "Invalid backup type: $BACKUP_TYPE"
            log "INFO" "Valid types: daily, weekly, monthly, manual"
            exit 1
            ;;
    esac
}

# Main backup function
main() {
    log "INFO" "Starting $BACKUP_TYPE backup process"
    
    validate_backup_type
    setup_backup_environment
    validate_prerequisites
    
    local backup_files=()
    
    # Perform backups
    backup_files+=($(backup_database))
    backup_files+=($(backup_application_files))
    backup_files+=($(backup_configuration))
    
    # Create manifest
    local manifest_file=$(create_backup_manifest "${backup_files[@]}")
    backup_files+=("$manifest_file")
    
    # Upload to cloud storage
    upload_to_cloud "${backup_files[@]}"
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Calculate total backup size
    local total_size=0
    for backup_file in "${backup_files[@]}"; do
        local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file")
        total_size=$((total_size + file_size))
    done
    local total_size_human=$(numfmt --to=iec-i --suffix=B $total_size)
    
    log "INFO" "Backup process completed successfully"
    log "INFO" "Total backup size: $total_size_human"
    log "INFO" "Files backed up: ${#backup_files[@]}"
    
    # Send success notification
    send_notification "BACKUP_SUCCESS" "$BACKUP_TYPE backup completed successfully ($total_size_human)"
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 