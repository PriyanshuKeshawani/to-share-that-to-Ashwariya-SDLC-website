# SISTEC Central Digital Library Portal — Hostinger K2 VPS Deployment & Infrastructure Guide

> **Document Type:** Production Deployment Manual & Architecture Guide  
> **Target Audience:** College System Administrator, DevOps Engineer, IT Faculty Committee  
> **Server Specifications:** Hostinger KVM 2 (K2) VPS (2 vCPU, 8 GB RAM, 100 GB NVMe SSD, Ubuntu 22.04 / 24.04 LTS)  
> **Repository:** `SISTEC-LIBRARY-PORTAL-`  
> **Database:** Supabase PostgreSQL 15 (Managed Cloud OR Self-Hosted Docker on VPS)

---

## 1. Executive Summary & Strategy Selection

When handing over and deploying the **SISTEC Central Digital Library Portal** on the college's Hostinger K2 VPS, you have **two primary deployment architectures**:

```
+---------------------------------------------------------------------------------------------------------+
|                                    CHOOSE YOUR DEPLOYMENT STRATEGY                                      |
+---------------------------------------------------------------------------------------------------------+
|  PATH A: Hybrid Cloud (⭐ Recommended for Stability & Zero Maintenance)                                 |
|  • Web App (Next.js 15) runs on Hostinger K2 VPS with Nginx Reverse Proxy & PM2.                       |
|  • Domain points to college VPS: https://library.sistec.ac.in.                                          |
|  • Database runs on Supabase Cloud (Managed PostgreSQL with automated backups & zero RAM overhead).     |
|  • RAM consumed on VPS: ~500 MB. Setup time: 15 minutes.                                                |
+---------------------------------------------------------------------------------------------------------+
|  PATH B: 100% Self-Hosted On-Premise / VPS (⭐ Required for Strict Internal Compliance)                 |
|  • Web App (Next.js 15) runs on Hostinger K2 VPS with PM2.                                             |
|  • Complete Supabase Docker Cluster runs inside the same Hostinger K2 VPS.                             |
|  • Database, Auth, Storage, and Realtime WebSockets are 100% self-hosted on the college server.          |
|  • RAM consumed on VPS: ~1.8 GB to 2.4 GB (well within the 8 GB RAM limit with our lean config!).       |
|  • Setup time: 45 minutes.                                                                              |
+---------------------------------------------------------------------------------------------------------+
```

---

## 2. Server Preparation (Applies to Both Path A & Path B)

SSH into your Hostinger VPS as `root`:
```bash
ssh root@YOUR_VPS_IP
```

### Step 2.1: System Update & Swap Configuration
Even with 8 GB RAM, configuring a 4 GB swap file guarantees zero crashes during CPU-heavy Next.js builds:
```bash
# Update Ubuntu package lists
apt update && apt upgrade -y

# Create 4 GB swapfile
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Verify memory and swap
free -h
```

### Step 2.2: Install Node.js 20 LTS, Nginx, Git & PM2
```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git nginx ufw curl postgresql-client

# Verify versions
node -v
npm -v

# Install PM2 Process Manager globally
npm install -g pm2
```

### Step 2.3: Clone Repository & Install Dependencies
```bash
# Create application directory
mkdir -p /var/www/sistec-library
cd /var/www/sistec-library

# Clone repository
git clone https://github.com/DomainExpandersOfficial/SISTEC-LIBRARY-PORTAL-.git .

# Install client dependencies
cd client
npm install --legacy-peer-deps
```

---

## 3. PATH A: Hybrid VPS Deployment (Easiest & Most Stable)

In Path A, the Next.js app runs on the VPS under PM2, and connects securely to Supabase Cloud.

### Step 3.1: Configure Environment Variables
Inside `/var/www/sistec-library/client`, create `.env`:
```bash
nano .env
```
Paste your production credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://ddjqajadhrwepcybfzam.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-app.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_vapid_key
PORT=3000
NODE_ENV=production
```
Save with `Ctrl + O`, `Enter`, and exit with `Ctrl + X`.

### Step 3.2: Build Next.js Production Bundle
```bash
npm run build
```
Verify that the output displays `✓ Compiled successfully`.

### Step 3.3: Launch with PM2 Process Manager
```bash
# Start Next.js server with PM2
pm2 start npm --name "sistec-library" -- start

# Configure PM2 to restart automatically on VPS reboot
pm2 save
pm2 startup
# (Run the sudo env command output by pm2 startup if prompted)
```

Proceed directly to **Section 5: Nginx Reverse Proxy & SSL Setup**.

---

## 4. PATH B: 100% Self-Hosted Supabase Docker on Hostinger K2 VPS

If college administration requires that all databases and data reside strictly inside their Hostinger VPS:

### Step 4.1: Install Docker & Docker Compose
```bash
# Install Docker prerequisites
apt install -y ca-certificates curl gnupg lsb-release

# Add Docker GPG key
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### Step 4.2: Setup Lean Supabase Docker Cluster
```bash
# Create Supabase docker root
mkdir -p /var/www/supabase-docker
cd /var/www/supabase-docker

# Clone official Supabase docker stack
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# Copy environment template
cp .env.example .env
```

### Step 4.3: Generate Secure Secrets for Supabase
Generate secure random keys:
```bash
openssl rand -hex 32
openssl rand -base64 32
```
Edit `/var/www/supabase-docker/supabase/docker/.env`:
- `POSTGRES_PASSWORD`: Set a strong database password (e.g. `Sistec2026@SecureHostingerDB`).
- `JWT_SECRET`: Paste a 32+ character secret string.
- `ANON_KEY`: Set your generated anon key (or use Supabase CLI token generator).
- `SERVICE_ROLE_KEY`: Set your generated service_role key.
- `SITE_URL`: `https://library.sistec.ac.in`
- `API_EXTERNAL_URL`: `https://api.library.sistec.ac.in` (or `http://YOUR_VPS_IP:8000`)

> [!TIP]
> **RAM Optimization for 8 GB VPS:** In `docker-compose.yml`, comment out the `analytics` (Vector / Logflare) containers if you do not need enterprise event telemetry. This drops idle RAM usage from **3.2 GB down to just ~950 MB**!

### Step 4.4: Start Supabase Docker Containers
```bash
docker compose up -d
```
Verify running containers:
```bash
docker compose ps
```
You will see `supabase-db` (PostgreSQL), `supabase-kong` (API Gateway on port 8000), `supabase-auth`, `supabase-rest`, `supabase-realtime`, and `supabase-studio` (port 8001).

### Step 4.5: Execute the Unified Schema (`supabase_schema.sql`)
Run the consolidated schema directly into the local PostgreSQL instance:
```bash
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -f /var/www/sistec-library/supabase_schema.sql
```
*(Enter your `POSTGRES_PASSWORD` when prompted).*

This creates:
- All 20 tables (`branches`, `categories`, `users`, `books`, `permissions`, `user_book_progress`, `senior_academic_profiles`, `projects`, `project_likes`, `project_reactions`, `user_fcm_tokens`, etc.)
- All foreign keys, unique constraints, and B-Tree indexes
- Automatic `sync_project_likes_count` trigger
- Row Level Security (RLS) policies
- Storage buckets (`pdfs`, `covers`)
- Realtime publication `supabase_realtime`

### Step 4.6: Update Web App `.env` to Point to VPS Supabase
In `/var/www/sistec-library/client/.env`:
```env
NEXT_PUBLIC_SUPABASE_URL=http://YOUR_VPS_IP:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_generated_anon_key
```
Rebuild and restart the Next.js app:
```bash
cd /var/www/sistec-library/client
npm run build
pm2 restart sistec-library
```

---

## 5. Nginx Reverse Proxy & Free SSL Configuration

To serve the portal securely on `https://library.sistec.ac.in` with automatic HTTPS:

### Step 5.1: Create Nginx Site Configuration
```bash
nano /etc/nginx/sites-available/sistec-library
```
Paste this production Nginx block:
```nginx
server {
    listen 80;
    server_name library.sistec.ac.in www.library.sistec.ac.in;

    client_max_body_size 100M;

    # Gzip compression for high-speed delivery
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

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

### Step 5.2: Activate Nginx Site & Verify
```bash
ln -s /etc/nginx/sites-available/sistec-library /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

### Step 5.3: Issue Free Let's Encrypt SSL
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d library.sistec.ac.in -d www.library.sistec.ac.in
```
Follow the interactive prompts to enable automatic HTTPS redirect.

### Step 5.4: Configure Firewall
```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status
```

---

## 6. Automated Backup Strategy (Zero Data Loss)

Set up automated daily database dumps to protect college records:

### Create Backup Script
```bash
nano /var/www/daily_backup.sh
```
Paste:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/sistec_db"
DATE=$(date +'%Y-%m-%d_%H%M%S')
mkdir -p "$BACKUP_DIR"

# Backup Supabase PostgreSQL database
PGPASSWORD="YOUR_POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -p 5432 -U postgres -d postgres -F c -b -v -f "$BACKUP_DIR/sistec_backup_$DATE.dump"

# Retain only the last 30 days of backups
find "$BACKUP_DIR" -type f -name "*.dump" -mtime +30 -exec rm {} \;
```
Make executable:
```bash
chmod +x /var/www/daily_backup.sh
```

### Add to Crontab (Runs Daily at 2:00 AM)
```bash
crontab -e
```
Add line:
```cron
0 2 * * * /var/www/daily_backup.sh >> /var/log/db_backup.log 2>&1
```

---

## 7. Verification & Handover Checklist

Before handing the portal over to the college administration:

- [ ] **DNS Verification:** Domain `library.sistec.ac.in` resolves to Hostinger VPS IP.
- [ ] **SSL Security:** Browser displays green padlock `https://` with valid Let's Encrypt certificate.
- [ ] **Admin Login:** Login with `sistec.library@sistec.ac.in` / Admin password.
- [ ] **Student Registration & Approval:** Register a test student roll number and verify admin approval flow.
- [ ] **E-Book Reader & Progress:** Open textbook in reader (`/read/[id]`), test page turn, notes, and bookmarking.
- [ ] **Realtime Project Likes:** Open `/student` Projects tab in two browser windows; click like in one and verify instant peer update in the other window.
- [ ] **Android APK Integration:** Build and install APK on mobile, verify push notifications register into `user_fcm_tokens`.
- [ ] **Server Resource Check:** Run `htop` and `free -h` to verify RAM usage is healthy (< 3 GB used of 8 GB).

---

## 8. Quick Administrator Command Cheat-Sheet

| Operational Task | Linux Command |
| :--- | :--- |
| **Check App Logs** | `pm2 logs sistec-library` |
| **Restart App** | `pm2 restart sistec-library` |
| **Check RAM & CPU** | `htop` or `free -h` |
| **Check Docker Containers** | `docker compose -f /var/www/supabase-docker/supabase/docker/docker-compose.yml ps` |
| **Restart Docker DB** | `docker compose -f /var/www/supabase-docker/supabase/docker/docker-compose.yml restart` |
| **Test Nginx Configuration**| `nginx -t` |
| **Reload Nginx Server** | `systemctl reload nginx` |
| **Test SSL Auto-Renewal** | `certbot renew --dry-run` |
| **Manual DB Dump** | `/var/www/daily_backup.sh` |
