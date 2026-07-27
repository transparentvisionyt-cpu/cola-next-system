# ============================================
# COLA NEXT - Oracle Cloud FREE Hosting Guide
# Step-by-Step (Hindi/Urdu)
# ============================================

## STEP 1: Oracle Cloud Account Banao

1. Jaao: https://cloud.oracle.com/free
2. Click "Start for Free"
3. Country select karo: **Pakistan**
4. Email, Name, Password daal ke account banao
5. Credit/Debit card daalo (₹1-2 charge aayega, 3-4 din mein refund ho jayega)
6. Email verify karo
7. Done! Free account ban gaya

---

## STEP 2: VM Instance Create Karo

1. Oracle Cloud mein login karo
2. Top menu mein **"Create a VM Instance"** click karo
3. Yeh settings daalo:

| Setting | Value |
|---|---|
| Name | cola-next-server |
| Image | Ubuntu 22.04 (or latest) |
| Shape | **VM.Standard.E2.1.Micro** (Always Free) |
| VCN | Create new (default) |
| Subnet | Public |
| Assign Public IP | **Yes** |
| SSH Keys | **Generate & download** |

4. **SSH key pair** important hai:
   - "Generate a key pair" select karo
   - **"Save Private Key"** click karo — file download hogi
   - Isko safe rakho — isse server mein login karoge
5. **Create** click karo

---

## STEP 3: Server Mein Login Karo

1. Downloaded `.key` file ko apne PC pe save karo
2. Terminal/PowerShell mein:
```bash
chmod 400 downloaded-key.key
ssh -i downloaded-key.key ubuntu@PUBLIC_IP
```
3. Public IP: Oracle Cloud console mein instance pe dikhega
4. Login ho jayega!

---

## STEP 4: Deploy Cola Next

Server mein yeh command daalo (ek ek karke):

```bash
# System update
sudo apt update -y

# Node.js install
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Git & PM2 install
sudo apt install -y git
sudo npm install -g pm2

# Project clone
cd /home/ubuntu
git clone https://github.com/transparentvisionyt-cpu/cola-next-system.git
cd cola-next-system

# Dependencies install
npm install --production

# PM2 se start
pm2 start ecosystem.config.js
pm2 startup
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Firewall open
sudo ufw allow 3000
sudo ufw allow ssh
sudo ufw --force enable
```

---

## STEP 5: Backup Setup (Google Drive)

```bash
# Rclone install
curl https://rclone.org/install.sh | sudo bash

# Google Drive configure
rclone config
# - Google Drive select karo
# - Client ID/Secret: blank (Enter)
# - Full access: y
# - Team drive: n
# - Remote name: gdrive

# Backup script setup
chmod +x backup.sh
crontab -e
# Add this line at bottom:
# 0 3 * * 0 /home/ubuntu/cola-next-system/backup.sh
```

---

## STEP 6: Check Karo

Browser mein open karo:
- Admin Panel: `http://YOUR_PUBLIC_IP:3000`
- User Panel: `http://YOUR_PUBLIC_IP:3000/user`

---

## IMPORTANT NOTES:

### Data Safety:
- Data safe hai jab tak instance delete nahi karte
- Weekly backup Google Drive pe jaata hai
- Agar server band bhi ho jaye, data safe rahega

### Free Tier Limits:
- 1 VM instance (AMD, 1/8 OCPU, 1 GB RAM) — enough for this app
- 200 GB storage
- 10 TB bandwidth/month
- Always Free — 4 saal+ chalega

### APK Update:
APK mein URL change karna hoga:
```
http://YOUR_PUBLIC_IP:3000
```

### Domain Add Karna Ho:
Oracle mein free domain nahi milta. Hostinger se ₹300 mein .com domain le lo.
DNS record mein A record daalo: `@ → YOUR_PUBLIC_IP`

---

## PROBLEMS:

| Problem | Solution |
|---|---|
| SSH connect nahi ho raha | Security list mein port 22 allow karo |
| App load nahi ho raha | Port 3000 firewall mein allow karo |
| Data gaya | Google Drive backup se restore karo |
| Server slow | Free tier limited hai, heavy use ke liye VPS lo |
