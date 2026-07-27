#!/bin/bash
# ============================================
# Google Drive Backup Setup (Run ONCE)
# ============================================

echo "=============================="
echo "  GOOGLE DRIVE BACKUP SETUP"
echo "=============================="

# Step 1: Install rclone
echo "[1/4] Installing rclone..."
curl https://rclone.org/install.sh | sudo bash

# Step 2: Configure Google Drive (interactive)
echo "[2/4] Configuring Google Drive..."
echo "When asked:"
echo "  - Select 'Google Drive'"
echo "  - Leave Client ID blank (press Enter)"
echo "  - Leave Client Secret blank (press Enter)"
echo "  - Select 'Full access'"
echo "  - When asked for team drive, say 'n'"
echo "  - Remote name: gdrive"
echo ""
rclone config

# Step 3: Test connection
echo "[3/4] Testing connection..."
rclone lsd gdrive: 2>/dev/null
if [ $? -eq 0 ]; then
    echo "Google Drive connected successfully!"
else
    echo "ERROR: Google Drive connection failed. Run 'rclone config' again."
    exit 1
fi

# Step 4: Setup weekly cron job
echo "[4/4] Setting up weekly cron job..."
chmod +x /home/ubuntu/cola-next-system/backup.sh

# Add cron job (every Sunday at 3 AM)
(crontab -l 2>/dev/null; echo "0 3 * * 0 /home/ubuntu/cola-next-system/backup.sh") | crontab -

echo ""
echo "=============================="
echo "  SETUP COMPLETE!"
echo "  Backup runs every Sunday 3 AM"
echo "  Backups stored in Google Drive:"
echo "  gdrive:/cola-next-backups/"
echo "=============================="
