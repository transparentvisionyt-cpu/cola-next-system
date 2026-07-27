#!/bin/bash
# ============================================
# Cola Next - Auto Backup to Google Drive
# Weekly backup of database + images
# ============================================

BACKUP_DIR="/home/ubuntu/cola-next-system/backups"
DB_FILE="/home/ubuntu/cola-next-system/cola_next.db"
IMAGES_DIR="/home/ubuntu/cola-next-system/public/images"
DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_FILE="$BACKUP_DIR/cola-next-backup-$DATE.tar.gz"
RCLONE_REMOTE="gdrive"  # Google Drive remote name

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup (database + images + settings)
echo "[$(date)] Starting backup..."
tar -czf "$BACKUP_FILE" \
    -C /home/ubuntu/cola-next-system \
    cola_next.db \
    public/images/ \
    public/uploads/ \
    2>/dev/null

# Check if backup was created
if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date)] Backup created: $BACKUP_FILE ($SIZE)"
    
    # Upload to Google Drive
    rclone copy "$BACKUP_FILE" "$RCLONE_REMOTE:/cola-next-backups/" \
        --log-file=/home/ubuntu/cola-next-system/backup.log \
        -v
    
    if [ $? -eq 0 ]; then
        echo "[$(date)] Uploaded to Google Drive successfully!"
    else
        echo "[$(date)] ERROR: Upload failed!"
    fi
    
    # Keep only last 4 backups locally
    ls -t "$BACKUP_DIR"/cola-next-backup-*.tar.gz 2>/dev/null | tail -n +5 | xargs rm -f 2>/dev/null
    echo "[$(date)] Local backups cleaned (kept last 4)"
else
    echo "[$(date)] ERROR: Backup file not created!"
fi

echo "[$(date)] Backup complete!"
