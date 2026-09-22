# SISTEC Library Portal — Hostinger K2 VPS Deployment & Supabase Migration Guide

> **Target Audience:** College System Administrator / Lead Developer  
> **Server Specifications:** Hostinger KVM 2 (K2) VPS (2 vCPU, 4GB/8GB RAM, NVMe SSD, Ubuntu 22.04 / 24.04 LTS)  
> **Repository:** `SISTEC-LIBRARY-PORTAL-`

---

## Executive Summary: "Kya Supabase Locally/VPS par chalana chahiye?"

Aapke sawaal ka practical aur realistic answer:

1. **Hostinger K2 VPS par Website + Next.js Server chalana:** **100% Recommended & Perfect.**  
   Aapka custom domain (e.g. `library.sistec.ac.in`) college ke Hostinger VPS IP par point karega, Nginx reverse proxy aur PM2 se high speed par live chalega with free SSL.
2. **Supabase ko VPS ke andar Self-Host karna:** **Technically Possible, but Highly Demanding.**  
   - Supabase koi single database nahi hai — yeh ek **pura microservices cluster** hai (12 Docker containers: Kong API Gateway, GoTrue Auth, PostgREST, Realtime WebSockets server, Storage API, PostgreSQL 15, Supabase Studio UI, Logflare, Vector, etc.).
   - Yeh idle state mein hi ~2.5 GB to 3.5 GB RAM consume karta hai. Agar K2 VPS par Next.js + Nginx + pura Supabase Docker daal diya, toh traffic aane par VPS memory spike (OOM crash) ho sakta hai agar Swap configure na ho.
3. **"Mujhe Supabase URLs change nahi karne aur data dubara setup nahi karna":**  
   - **Best Strategy (Standard Industry Approach):** College ko unka domain aur web app VPS par run hota dikhega (`library.sistec.ac.in`), jabki Supabase Cloud background mein as a managed, auto-backed-up PostgreSQL database kaam karega. Isme **zero downtime**, **zero data loss**, aur **zero URL changes** honge!
   - **Alternative Strategy (Full VPS Migration):** Agar college management strictly insistence kare ki database bhi VPS par hi ho, toh aapko Supabase Cloud ka pura schema + data export karke VPS ke PostgreSQL / Self-hosted Supabase mein 1 click import karna hoga.

---

## 3 Deployment Architectures (Choose Your Path)

| Feature | Path A: VPS Frontend + Cloud Supabase (⭐ Most Recommended) | Path B: Full Self-Hosted Supabase on VPS (Docker) | Path C: VPS Nginx Reverse Proxy (Domain masking) |
| :--- | :--- | :--- | :--- |
| **Effort** | **15 Minutes** (Easiest & Safest) | **2 - 3 Hours** (High Complexity) | **30 Minutes** |
| **URL Change Needed?** | ❌ **No (0 Changes)** | ✔️ Yes (Must update VPS URL in `.env`) | ❌ No |
| **Risk of Data Loss** | ❌ Zero | ⚠️ Medium (Requires careful `pg_dump`) | ❌ Zero |
| **RAM Usage on VPS** | ~400 MB to 700 MB | ~3.5 GB to 4.5 GB (Heavy on K2) | ~500 MB |
| **College Requirement Met?** | ✔️ Yes (Domain on VPS, Hosted on VPS) | ✔️ Yes (100% on VPS) | ✔️ Yes (College Domain handles API calls) |

---

# PATH A (RECOMMENDED): Deploying the Web App & Domain on Hostinger K2 VPS

*Is setup mein college ka domain Hostinger VPS par chalega, Next.js server VPS par run hoga, aur Supabase Cloud securely connect rahega bina kisi URL change ke.*

### Step 1: Initial VPS Setup & Dependencies (Ubuntu 22.04/24.04)

SSH into your Hostinger VPS:
```bash
ssh root@YOUR_VPS_IP
```

Update system packages and create a 4GB Swapfile (Hostinger VPS stability ke liye mandatory):
```bash
# Update repositories
apt update && apt upgrade -y

# Create 4GB Swap file (prevents crash on build)
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Verify swap
free -h
```

Install Node.js 20 LTS, Git, PM2, and Nginx:
```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git nginx ufw

# Verify versions
node -v
npm -v

# Install PM2 Process Manager globally
npm install -g pm2
```

---

### Step 2: Clone Repository & Configure Environment

```bash
# Navigate to web root
mkdir -p /var/www/sistec-library
cd /var/www/sistec-library

# Clone your GitHub repository
git clone https://github.com/DomainExpandersOfficial/SISTEC-LIBRARY-PORTAL-.git .

# Move into client folder
cd client

# Install dependencies
npm install --legacy-peer-deps
```

Create production `.env` file inside `/var/www/sistec-library/client/.env`:
```bash
nano .env
```
Paste your existing production variables (NO URL CHANGES NEEDED!):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-app.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id_here
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_vapid_key_here
PORT=3000
NODE_ENV=production
```
Save with `Ctrl + O`, then `Enter`, then `Ctrl + X`.

Build the Next.js production bundle:
```bash
npm run build
```

Start the application with PM2:
```bash
pm2 start npm --name "sistec-portal" -- start
pm2 save
pm2 startup
```

---

### Step 3: Configure Nginx & SSL on Hostinger VPS

Create Nginx site configuration:
```bash
nano /etc/nginx/sites-available/sistec-library
```

Paste this configuration (replace `library.sistec.ac.in` with your college domain):
```nginx
server {
    listen 80;
    server_name library.sistec.ac.in www.library.sistec.ac.in;

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

Enable the site and restart Nginx:
```bash
ln -s /etc/nginx/sites-available/sistec-library /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

Install Certbot for Free HTTPS / SSL:
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d library.sistec.ac.in -d www.library.sistec.ac.in
```

Configure Firewall:
```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

🎉 **Result:** Aapka portal college ke official domain (`https://library.sistec.ac.in`) par Hostinger VPS ke andar live chalega! Supabase Cloud backend 100% seamlessly work karega bina kisi configuration change ke.

---

# PATH B: Self-Hosting Supabase on Hostinger K2 VPS via Docker

*Agar college authorities strictly kehti hain ki database bhi VPS ke andar hi install hona chahiye.*

### Step 1: Install Docker & Docker Compose on VPS

```bash
# Remove older Docker versions if any
apt remove -y docker docker-engine docker.io containerd runc

# Install Docker official repository
apt install -y ca-certificates curl gnupg lsb-release
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker engine
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
docker --version
```

---

### Step 2: Download & Configure Official Supabase Docker

```bash
mkdir -p /var/www/supabase-docker
cd /var/www/supabase-docker

# Clone official Supabase docker repo
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# Copy example environment
cp .env.example .env
```

Generate secure secrets for `.env`:
Run this in bash to generate fresh JWT secrets and passwords:
```bash
# Generate random 32+ char secrets
openssl rand -hex 32
openssl rand -base64 32
```
Edit `/var/www/supabase-docker/supabase/docker/.env`:
- `POSTGRES_PASSWORD`: Strong password (e.g. `SistecSupabase2026!Secure`)
- `JWT_SECRET`: 32+ character random string
- `ANON_KEY`: Generate using JWT Secret (Supabase CLI or online JWT generator for role `anon`)
- `SERVICE_ROLE_KEY`: Generate for role `service_role`
- `SITE_URL`: `https://library.sistec.ac.in`
- `API_EXTERNAL_URL`: `https://api.library.sistec.ac.in` (or `http://YOUR_VPS_IP:8000`)

Start Supabase containers:
```bash
docker compose up -d
```
Verify running containers:
```bash
docker compose ps
```
You will see: `supabase-db`, `supabase-auth`, `supabase-rest`, `supabase-realtime`, `supabase-storage`, `supabase-kong`, `supabase-studio`.

---

### Step 3: Export 100% Data from Supabase Cloud to VPS (Zero Data Loss)

Aapko apna database scratch se setup **nahi** karna padega!

1. **Supabase Cloud Dashboard se Connection String lein:**
   - Supabase Dashboard -> **Project Settings** -> **Database** -> **Connection string** (URI mode, port 5432 or 6543).
   - E.g.: `postgresql://postgres.[ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`

2. **Run `pg_dump` directly from your VPS to copy all tables, RLS policies & data:**
   ```bash
   apt install -y postgresql-client
   
   # Dump from Cloud Supabase
   pg_dump "postgresql://postgres.[YOUR-REF]:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres" \
     --clean --if-exists --no-owner --no-privileges -f /var/www/cloud_backup.sql
   ```

3. **Restore into your VPS Supabase PostgreSQL:**
   ```bash
   psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -f /var/www/cloud_backup.sql
   ```
   *Enter the `POSTGRES_PASSWORD` you set in Step 2.*

Saari tables (`books`, `users`, `senior_academic_profiles`, `user_fcm_tokens`, `system_settings`), sabhi RLS policies, sabhi users aur passwords 100% VPS par restore ho jaate hain!

---

# PATH C: The "Smart Reverse Proxy" (Custom College Subdomain for Supabase)

Agar college chahta hai ki network traffic mein Supabase ka direct `.supabase.co` URL na dikhe aur unka apna subdomain dikhe (e.g. `https://db.library.sistec.ac.in`):

Add this Nginx configuration on Hostinger VPS:
```nginx
server {
    listen 80;
    server_name db.library.sistec.ac.in;

    location / {
        proxy_pass https://YOUR-PROJECT-REF.supabase.co;
        proxy_set_header Host YOUR-PROJECT-REF.supabase.co;
        proxy_ssl_server_name on;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

Is tarah:
- College management ko unka apna domain `db.library.sistec.ac.in` milega.
- Backend par managed Supabase Cloud rahega jo kabhi crash nahi hoga.
- Aapko koi naya database setup nahi karna padega.

---

## Testing & Verification Checklist

Once setup is complete, verify all subsystems:
- [ ] **Web Portal Access:** Open `https://library.sistec.ac.in/` in browser.
- [ ] **Admin Authentication:** Login with `sistec.library@sistec.ac.in` / Admin credentials.
- [ ] **Student Login & Registration:** Test student signup with enrollment number.
- [ ] **PDF Book Reader:** Open any book in eBook reader (`/read/[id]`).
- [ ] **Realtime WebSocket Notification:** Test bell notification in top bar.
- [ ] **Flutter Android APK Integration:** Ensure APK loads `https://library.sistec.ac.in` and `window.__SISTEC_NATIVE_FCM_TOKEN__` saves device token into `user_fcm_tokens`.

---

## Important Commands Reference for Hostinger VPS

| Action | Linux Command |
| :--- | :--- |
| **Check Website Logs** | `pm2 logs sistec-portal` |
| **Restart Website** | `pm2 restart sistec-portal` |
| **Check RAM & CPU Usage** | `htop` or `free -h` |
| **Test Nginx Config** | `nginx -t` |
| **Reload Nginx** | `systemctl reload nginx` |
| **Renew SSL Certificate** | `certbot renew --dry-run` |
| **Check Docker Containers (If Path B)** | `docker compose ps` |
