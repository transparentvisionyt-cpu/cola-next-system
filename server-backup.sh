#!/bin/bash
BACKUP_DIR=/home/ubuntu/cola-next-system/backups
DB=/home/ubuntu/cola-next-system/cola_next.db
IMAGES=/home/ubuntu/cola-next-system/public/images
DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_FILE=$BACKUP_DIR/cola-next-$DATE.db
mkdir -p $BACKUP_DIR
cp $DB $BACKUP_FILE
# Keep last 30 backups
ls -t $BACKUP_DIR/cola-next-*.db 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null
echo "[$(date)] Backup done: $BACKUP_FILE"
