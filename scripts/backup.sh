#!/bin/bash
# Backup script for meal-planner database
# Run daily via cron: 0 2 * * * /home/user/Projects/meal-planner/scripts/backup.sh

set -e

PROJECT_DIR="${PROJECT_DIR:-$HOME/Projects/meal-planner}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/meals}"
DB_FILE="$PROJECT_DIR/packages/data/meals.db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_FILE" ]; then
    echo "Database file not found: $DB_FILE"
    exit 1
fi

# Create timestamped backup
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/meals_$DATE.db"

cp "$DB_FILE" "$BACKUP_FILE"
echo "Backup created: $BACKUP_FILE"

# Keep last 30 backups, delete older ones
ls -t "$BACKUP_DIR"/meals_*.db 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null || true

# Show backup count
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/meals_*.db 2>/dev/null | wc -l)
echo "Total backups: $BACKUP_COUNT"
