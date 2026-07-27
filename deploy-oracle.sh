#!/bin/bash
# ============================================
# Cola Next - Oracle Cloud Auto Deploy Script
# Run this ONCE on your Oracle Cloud VM
# ============================================

echo "=============================="
echo "  COLA NEXT - AUTO DEPLOY"
echo "=============================="

# Step 1: System Update
echo "[1/8] Updating system..."
sudo apt update -y
sudo apt upgrade -y

# Step 2: Install Node.js 20
echo "[2/8] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Step 3: Install Git & PM2
echo "[3/8] Installing Git & PM2..."
sudo apt install -y git
sudo npm install -g pm2

# Step 4: Clone Project
echo "[4/8] Cloning project..."
cd /home/ubuntu
git clone https://github.com/transparentvisionyt-cpu/cola-next-system.git
cd cola-next-system

# Step 5: Install Dependencies
echo "[5/8] Installing dependencies..."
npm install --production

# Step 6: Setup PM2
echo "[6/8] Starting with PM2..."
pm2 start ecosystem.config.js
pm2 startup
pm2 save

# Step 7: Auto-start on boot
echo "[7/8] Setting up auto-start..."
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Step 8: Open Firewall Port
echo "[8/8] Opening port 3000..."
sudo ufw allow 3000
sudo ufw allow ssh
sudo ufw --force enable

echo ""
echo "=============================="
echo "  DEPLOYMENT COMPLETE!"
echo "  URL: http://YOUR_PUBLIC_IP:3000"
echo "  User Panel: http://YOUR_PUBLIC_IP:3000/user"
echo "=============================="
