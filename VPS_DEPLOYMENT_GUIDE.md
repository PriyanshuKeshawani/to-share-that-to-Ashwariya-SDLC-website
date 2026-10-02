# SISTEC Central Digital Library — VPS Deployment Guide

This guide provides step-by-step instructions for hosting the **SISTEC Central Digital Library Portal** on an institutional VPS (Ubuntu 22.04 / 24.04 LTS or Debian).

---

## 📋 System Prerequisites
- **OS**: Ubuntu 20.04 / 22.04 / 24.04 LTS or any Linux VPS
- **Node.js**: v20.x or v22.x LTS (Recommended)
- **Memory**: Minimum 1 GB RAM (2 GB recommended)
- **Web Server**: Nginx (Reverse Proxy)
- **Process Manager**: PM2

---

## 🚀 Quick Setup (Step-by-Step)

### 1. Install Node.js LTS (if not installed)
```bash
# Install Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt update
sudo apt install -y nodejs git build-essential

# Verify versions
node -v
npm -v
```

### 2. Extract Project Files on VPS
Upload `sistec-library-portal-vps.zip` to your VPS (e.g. `/var/www/sistec-portal`) and unzip:
```bash
sudo mkdir -p /var/www/sistec-portal
sudo chown -R $USER:$USER /var/www/sistec-portal
cd /var/www/sistec-portal

# Extract zip
unzip /path/to/sistec-library-portal-vps.zip -d .
```

### 3. Verify Environment File (`.env`)
Ensure `.env` exists in `/var/www/sistec-portal/.env` with your active Supabase & Firebase credentials:
```bash
ls -la .env
# If needed, edit:
nano .env
```

### 4. Install Dependencies & Build
```bash
# Clean install exact production dependencies
npm install

# Build optimized production bundle
npm run build
```

---

## 🔄 Run with PM2 (Background Daemon & Auto-Restart)

Install PM2 globally to ensure the app restarts automatically if the server reboots:
```bash
sudo npm install -g pm2

# Start the application on default port 3000
pm2 start npm --name "sistec-library" -- start -- -p 3000

# Save PM2 process list and configure auto-start on boot
pm2 save
pm2 startup
# (Run the sudo env command output by pm2 startup)
```

Useful PM2 commands:
- `pm2 status` — Check service health
- `pm2 logs sistec-library` — Live server logs
- `pm2 restart sistec-library` — Restart application

---

## 🌐 Configure Nginx Reverse Proxy & SSL

### 1. Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/sistec-library
```

Paste the following configuration (replace `library.sistec.ac.in` with your domain or VPS IP):

```nginx
server {
    listen 80;
    server_name library.sistec.ac.in; # or your VPS IP

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Enable & Test Nginx
```bash
sudo ln -s /etc/nginx/sites-available/sistec-library /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. (Optional) Enable Free HTTPS with Let's Encrypt
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d library.sistec.ac.in
```

---

## 🗄️ Database Architecture
- **Backend Database**: Supabase PostgreSQL (Managed Cloud).
- **Client Cache**: IndexedDB (Dexie) in student/admin browser for instant zero-latency page loads and offline fallback.
- **Backups / Keepalive**: The database stays permanently active via automated API pings. If needed, the full SQL schema is in `supabase_schema.sql`.

---
✅ **Deployment Complete!** The portal is now live and serving production traffic.
