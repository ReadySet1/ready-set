#!/bin/bash

# Development Database Backup Script
# Creates a backup of the development database

set -e

BACKUP_DIR="./backups"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/ready_set_dev_$DATE.sql"

echo "📦 Creating development database backup..."

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if development database container is running
if ! docker-compose -f docker-compose.dev.yml ps postgres-dev | grep -q "healthy"; then
    echo "❌ Development database is not running. Starting it..."
    docker-compose -f docker-compose.dev.yml up -d postgres-dev
    sleep 10
fi

# Create backup
echo "🗄️ Backing up database to: $BACKUP_FILE"
docker exec ready-set-postgres-dev pg_dump -U dev_user -d ready_set_dev > "$BACKUP_FILE"

# Compress backup
echo "🗜️ Compressing backup..."
gzip "$BACKUP_FILE"
COMPRESSED_FILE="$BACKUP_FILE.gz"

echo "✅ Backup completed successfully!"
echo "📁 Backup location: $COMPRESSED_FILE"
echo "💾 Backup size: $(du -h "$COMPRESSED_FILE" | cut -f1)"

# Show recent backups
echo ""
echo "📋 Recent backups:"
ls -lah "$BACKUP_DIR"/*.gz 2>/dev/null | tail -5 || echo "No previous backups found"

echo ""
echo "🔄 To restore this backup:"
echo "   ./scripts/restore-dev-db.sh $COMPRESSED_FILE" 