# SISTEC Central Digital Library Portal

> Official digital library management system and e-book reading platform for **Sagar Institute of Science & Technology (SISTEC)**.  
> Designed for high concurrency, zero operational cost on free tiers, and cross-platform access across Web and Android devices.

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [System Requirements](#system-requirements)
4. [Quick Start & Installation](#quick-start--installation)
5. [Environment Configuration](#environment-configuration)
6. [Development Workflow](#development-workflow)
7. [Production Build](#production-build)
8. [Android / Capacitor Mobile App](#android--capacitor-mobile-app)
9. [Complete VPS Setup Guide (Low-RAM & Self-Hosted Supabase)](#complete-vps-setup-guide-low-ram--self-hosted-supabase)
10. [Administrator Setup & Approval Flow](#administrator-setup--approval-flow)
11. [Maintenance & Keep-Alive Automation](#maintenance--keep-alive-automation)
12. [Troubleshooting](#troubleshooting)
13. [College IT Handover Notes](#college-it-handover-notes)

---

## Project Overview

The **SISTEC Central Digital Library Portal** is an institutional digital library platform providing students and faculty with instant access to academic textbooks, reference guides, lecture notes, syllabus materials, and past-year question papers.

### Key Capabilities
- **Academic Catalog & Search**: Instant filtering by branch (CSE, AI/DS, IT, ME, CE, Pharmacy, MBA, etc.), semester, category, and subject keyword.
- **In-Browser Flipbook & PDF Reader**: High-performance reader powered by `pdfjs-dist` and `page-flip` with page caching, full-screen reading mode, zoom, and background streaming.
- **Student Dashboard**: Real-time tracking of reading time, streak counter, completed books, bookmarks, and activity logs.
- **Admin Management Portal**: Bulk book uploads, category management, student approval/rejection queue, student verification badge toggling, and audit reporting.
- **Push Notification Center**: Firebase Cloud Messaging (FCM) integration delivering broadcast announcements and reading reminders to web browsers and Android devices.
- **Cross-Platform Native Android App**: Built with Capacitor 8, packaging the portal into an optimized native Android application.

---

## Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend Framework** | **Next.js 15** (App Router), **React 19**, **Vanilla CSS** (Design System) |
| **Icons & UI Utilities** | `lucide-react`, `page-flip`, `pdfjs-dist`, `qrcode` |
| **Mobile Runtime** | **Capacitor 8** (`@capacitor/core`, `@capacitor/android`, `@capacitor/cli`) |
| **Backend & Database** | **Supabase PostgreSQL** (Relational tables, Row-Level Security, Database Triggers, Stored Procedures) |
| **Cloud Storage** | **Supabase Storage** / Cloudflare R2 / Google Drive Direct Streaming |
| **Push Notifications** | **Firebase Cloud Messaging (FCM)** + Service Worker (`firebase-messaging-sw.js`) |
| **CI / Automation** | **GitHub Actions** (Automated keep-alive pings to prevent database pause) |
| **Hosting Targets** | **Vercel** (SSR/Edge) or **Cloudflare Pages** (Static Export / Zero Egress) |

---

## System Requirements

To build and run this repository from a clean machine, ensure the following software is installed:

- **Node.js**: `v18.18.0` or higher (Recommended: `v20.x LTS` or `v22.x LTS`)
- **Package Manager**: `npm` (v9.x or v10.x)
- **Git**: `2.30+`
- **For Android Development (Optional)**:
  - **Android Studio** (Ladybug / Hedgehog or newer)
  - **Java JDK**: Version 17 or Version 21
  - **Android SDK**: API Level 34 or 35

---

## Quick Start & Installation

From a clean machine, clone the repository and install all required dependencies:

```bash
# 1. Clone the repository
git clone https://github.com/DomainExpandersOfficial/SISTEC-LIBRARY-PORTAL-.git
cd SISTEC-LIBRARY-PORTAL-

# 2. Install dependencies
npm install
```

> **Note**: An `.npmrc` file is included with `legacy-peer-deps=true` to guarantee deterministic package installation across all environments with React 19.

---

## Environment Configuration

Copy the example environment file to create your local `.env.local` configuration:

```bash
# Copy template to .env.local
cp .env.example .env.local
```

### Environment Variables Reference

| Variable Name | Purpose | Required | Example Source |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project API URL | **Yes** | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anonymous API key (governed by RLS) | **Yes** | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API Key | Optional | Firebase Console → Project Settings |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Authentication domain | Optional | Firebase Console → Project Settings |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Project ID | Optional | Firebase Console → Project Settings |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket domain | Optional | Firebase Console → Project Settings |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM Messaging Sender ID | Optional | Firebase Console → Project Settings |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Web App Identifier | Optional | Firebase Console → Project Settings |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | FCM Web Push Certificate Public Key | Optional | Firebase Console → Cloud Messaging |

> **Security Note**: Never commit `.env` or `.env.local` containing actual credentials. Client-side security is strictly enforced at the database level using Supabase Row-Level Security (RLS) policies.

---

## Development Workflow

Start the local development server:

```bash
npm run dev
```

The application will be live at: **`http://localhost:3000`**

### Available Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts Next.js development server with Fast Refresh |
| `npm run build` | Compiles an optimized production build |
| `npm run start` | Starts the production server locally |
| `npm run lint` | Runs ESLint analysis across client source code |

---

## Production Build

To verify and generate the production build:

```bash
npm run build
```

This compiles all dynamic and static pages:
- `/` (Home & Catalog)
- `/login` (Institutional Auth)
- `/register` (Student Registration)
- `/student` (Student Learning Dashboard)
- `/admin` (Administrator Control Center)
- `/read/[id]` (Interactive Book Reader)
- `/complete-profile` (Google OAuth Profile Onboarding)

---

## Android / Capacitor Mobile App

The repository includes a pre-configured native Android application under `android/`.

### Android Project Specifications
- **Application ID / Namespace**: `com.sistec.libraryportal`
- **Minimum SDK**: 24 (Android 7.0 Nougat)
- **Target SDK**: 35 (Android 15)
- **Cleartext Traffic**: Enabled for campus intranet connectivity
- **Deep Linking**: Digital Asset Links configured under `client/public/.well-known/assetlinks.json`

### Android Build Steps

1. **Synchronize Capacitor Assets**:
   ```bash
   cd client
   npm run cap:sync
   ```
2. **Open in Android Studio**:
   ```bash
   npm run cap:open
   ```
3. **Build APK / Bundle via Gradle CLI**:
   ```bash
   cd android
   ./gradlew assembleDebug
   # Release build:
   ./gradlew assembleRelease
   ```
   The generated APK will be available in:
   `android/app/build/outputs/apk/debug/app-debug.apk`

---

## Complete VPS Setup Guide (Low-RAM & Self-Hosted Supabase)

This guide provides a production-grade, step-by-step walkthrough to deploy both the **Next.js Portal** and a **Self-Hosted Supabase Backend** on a single Linux VPS (Ubuntu 22.04 / 24.04 LTS, Debian 12, Hostinger, DigitalOcean, Hetzner, AWS EC2, etc.).

> [!IMPORTANT]
> **Why the Standard Supabase Stack is Too Heavy:**  
> The standard Supabase self-hosted stack spins up 12+ containers (including Vector, Logflare analytics, Prometheus, and BigQuery connectors) which consume **2.5 GB to 4 GB of RAM**.  
> **The Low-RAM Solution (< 700 MB RAM):**  
> We run a **Slim Supabase Stack** containing only the 6 core services this library portal actually requires: `PostgreSQL (tuned)`, `GoTrue (Auth)`, `PostgREST (API)`, `Realtime`, `Storage (PDFs/Images)`, and `Kong (API Gateway)`. Paired with a 4 GB Linux Swapfile, this runs reliably even on a cheap **1 GB or 2 GB RAM VPS** without crashing!

---

### Step 1: VPS Initial Prep & 4 GB Swap Setup (Crucial for Low-RAM)

Connect to your VPS via SSH as `root`:
```bash
ssh root@YOUR_SERVER_IP
```

1. **Update system packages:**
   ```bash
   apt update && apt upgrade -y
   apt install -y curl git ufw htop ca-certificates gnupg
   ```

2. **Create 4 GB Virtual Swap Memory:**  
   *(This prevents Out-Of-Memory (OOM) crashes during `npm run build` and database spikes)*
   ```bash
   # Create 4GB swapfile
   fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
   chmod 600 /swapfile
   mkswap /swapfile
   swapon /swapfile

   # Make swap permanent across reboots
   echo '/swapfile none swap sw 0 0' >> /etc/fstab

   # Optimize swappiness (keeps active processes in RAM, swaps idle memory)
   sysctl vm.swappiness=10
   echo 'vm.swappiness=10' >> /etc/sysctl.conf
   ```

3. **Install Docker & Docker Compose Plugin:**
   ```bash
   install -m 0755 -d /etc/apt/keyrings
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
   chmod a+r /etc/apt/keyrings/docker.asc

   echo \
     "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
     $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
     tee /etc/apt/sources.list.d/docker.list > /dev/null

   apt update
   apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   systemctl enable --now docker
   ```

4. **Install Node.js 20 LTS, Nginx, Certbot & PM2:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
   apt install -y nodejs nginx certbot python3-certbot-nginx
   npm install -g pm2
   ```

---

### Step 2: Deploy the Ultra-Lightweight Local Supabase Stack

1. **Create the Supabase directory on your server:**
   ```bash
   mkdir -p /opt/supabase-lite && cd /opt/supabase-lite
   ```

2. **Generate Secure Secrets:**
   Run these commands to generate your JWT and database secrets:
   ```bash
   POSTGRES_PASSWORD=$(openssl rand -hex 16)
   JWT_SECRET=$(openssl rand -hex 32)
   echo "POSTGRES_PASSWORD: $POSTGRES_PASSWORD"
   echo "JWT_SECRET: $JWT_SECRET"
   ```

3. **Generate your Anon and Service Keys:**  
   Use an online tool like [supabase.github.io/jwt-generator](https://supabase.github.io/jwt-generator/) or Node.js to generate two tokens signed with your `JWT_SECRET`:
   - Token 1 (role: `anon`, exp: 10 years)
   - Token 2 (role: `service_role`, exp: 10 years)

4. **Create the Low-RAM `docker-compose.yml`:**
   Create `/opt/supabase-lite/docker-compose.yml`:
   ```yaml
   services:
     # ── 1. PostgreSQL Database (Memory-Tuned) ──
     db:
       image: supabase/postgres:15.1.1.78
       container_name: supabase-db
       restart: unless-stopped
       environment:
         POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
         POSTGRES_DB: postgres
       command:
         - postgres
         - -c
         - shared_buffers=128MB
         - -c
         - work_mem=4MB
         - -c
         - maintenance_work_mem=32MB
         - -c
         - max_connections=60
         - -c
         - effective_cache_size=256MB
       mem_limit: 300m
       volumes:
         - ./db_data:/var/lib/postgresql/data
       ports:
         - "127.0.0.1:5432:5432"

     # ── 2. GoTrue (Authentication) ──
     auth:
       image: supabase/gotrue:v2.158.0
       container_name: supabase-auth
       restart: unless-stopped
       depends_on:
         - db
       environment:
         GOTRUE_API_HOST: 0.0.0.0
         GOTRUE_API_PORT: 9999
         API_EXTERNAL_URL: ${API_EXTERNAL_URL}
         GOTRUE_DB_DRIVER: postgres
         GOTRUE_DB_DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD}@db:5432/postgres?sslmode=disable
         GOTRUE_SITE_URL: ${SITE_URL}
         GOTRUE_URI_ALLOW_LIST: "*"
         GOTRUE_JWT_SECRET: ${JWT_SECRET}
         GOTRUE_JWT_EXP: 3600
         GOTRUE_DISABLE_SIGNUP: "false"
       mem_limit: 80m

     # ── 3. PostgREST (Instant REST API) ──
     rest:
       image: postgrest/postgrest:v12.0.2
       container_name: supabase-rest
       restart: unless-stopped
       depends_on:
         - db
       environment:
         PGRST_DB_URI: postgres://postgres:${POSTGRES_PASSWORD}@db:5432/postgres?sslmode=disable
         PGRST_DB_SCHEMAS: public,storage
         PGRST_DB_ANON_ROLE: anon
         PGRST_JWT_SECRET: ${JWT_SECRET}
       mem_limit: 80m

     # ── 4. Realtime (WebSockets Live Sync) ──
     realtime:
       image: supabase/realtime:v2.30.23
       container_name: supabase-realtime
       restart: unless-stopped
       depends_on:
         - db
       environment:
         PORT: 4000
         DB_HOST: db
         DB_PORT: 5432
         DB_NAME: postgres
         DB_USER: postgres
         DB_PASSWORD: ${POSTGRES_PASSWORD}
         DB_SSL: "false"
         JWT_SECRET: ${JWT_SECRET}
         REPLICATION_MODE: RLS
         REPLICATION_POLL_INTERVAL: 100
         SECURE_CHANNELS: "true"
       mem_limit: 100m

     # ── 5. Storage (PDFs & Book Covers) ──
     storage:
       image: supabase/storage-api:v1.11.13
       container_name: supabase-storage
       restart: unless-stopped
       depends_on:
         - db
         - rest
       environment:
         ANON_KEY: ${ANON_KEY}
         SERVICE_KEY: ${SERVICE_ROLE_KEY}
         POSTGREST_URL: http://rest:3000
         PGRST_JWT_SECRET: ${JWT_SECRET}
         DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD}@db:5432/postgres?sslmode=disable
         FILE_STORAGE_BACKEND_PATH: /var/lib/storage
         TENANT_ID: default
         REGION: global
         GLOBAL_S3_BUCKET: library-storage
       volumes:
         - ./storage_data:/var/lib/storage
       mem_limit: 90m

     # ── 6. Kong API Gateway (Unified Port 8000) ──
     kong:
       image: kong:2.8.1
       container_name: supabase-kong
       restart: unless-stopped
       depends_on:
         - auth
         - rest
         - realtime
         - storage
       environment:
         KONG_DATABASE: "off"
         KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
         KONG_DNS_ORDER: LAST,A,CNAME
         KONG_PLUGINS: request-transformer,cors,key-auth,acl
       volumes:
         - ./kong.yml:/var/lib/kong/kong.yml:ro
       ports:
         - "127.0.0.1:8000:8000"
       mem_limit: 80m
   ```

5. **Create the Kong configuration (`/opt/supabase-lite/kong.yml`):**
   ```yaml
   _format_version: "2.1"
   services:
     - name: auth-v1
       url: http://auth:9999/
       routes:
         - name: auth-v1-all
           strip_path: true
           paths:
             - /auth/v1/
     - name: rest-v1
       url: http://rest:3000/
       routes:
         - name: rest-v1-all
           strip_path: true
           paths:
             - /rest/v1/
     - name: realtime-v1
       url: http://realtime:4000/socket
       routes:
         - name: realtime-v1-all
           strip_path: true
           paths:
             - /realtime/v1/
     - name: storage-v1
       url: http://storage:5000/
       routes:
         - name: storage-v1-all
           strip_path: true
           paths:
             - /storage/v1/
   ```

6. **Create the environment file (`/opt/supabase-lite/.env`):**
   ```env
   POSTGRES_PASSWORD=YOUR_POSTGRES_PASSWORD
   JWT_SECRET=YOUR_JWT_SECRET
   ANON_KEY=YOUR_GENERATED_ANON_KEY
   SERVICE_ROLE_KEY=YOUR_GENERATED_SERVICE_ROLE_KEY
   API_EXTERNAL_URL=https://library.yourdomain.com/api/supabase
   SITE_URL=https://library.yourdomain.com
   ```

7. **Launch the Slim Supabase Stack:**
   ```bash
   cd /opt/supabase-lite
   docker compose up -d
   ```
   *Verify RAM usage:* Run `docker stats --no-stream`. Total RAM consumed across all 6 containers will be **under 650 MB!**

8. **Initialize the Database Schema:**
   Clone your project or copy `supabase_schema.sql` to the server and apply it:
   ```bash
   docker exec -i supabase-db psql -U postgres -d postgres < /path/to/SISTEC-LIBRARY-PORTAL-/supabase_schema.sql
   ```

---

### Step 3: Deploy the Next.js Frontend on the VPS

1. **Clone the repository to `/var/www`:**
   ```bash
   cd /var/www
   git clone https://github.com/DomainExpandersOfficial/SISTEC-LIBRARY-PORTAL-.git
   cd SISTEC-LIBRARY-PORTAL-
   ```

2. **Configure Production Environment (`.env`):**
   ```bash
   nano .env
   ```
   Set your local Supabase credentials (or domain URL):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://library.yourdomain.com/supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_LOCAL_ANON_KEY
   NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_FIREBASE_KEY
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=sistec-library-portal.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=sistec-library-portal
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=sistec-library-portal.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1076845729176
   NEXT_PUBLIC_FIREBASE_APP_ID=1:1076845729176:web:8b35bc3b968dbd16cb07ed
   NEXT_PUBLIC_FIREBASE_VAPID_KEY=YOUR_VAPID_KEY
   ```

3. **Install Dependencies & Build Production Bundle:**
   ```bash
   npm install
   npm run build
   ```

4. **Launch with PM2 (Auto-Restart on Reboot):**
   ```bash
   # Launch PM2 with automatic CPU core scaling
   npm run start:cluster

   # Save the process list and setup systemd auto-start
   pm2 save
   pm2 startup
   ```

---

### Step 4: Configure Nginx & SSL (Unified Single-Domain Routing)

Configure Nginx so that the frontend runs on `https://library.yourdomain.com` and all Supabase calls are proxied through `/supabase/` without needing extra ports open in the firewall.

1. **Create Nginx site configuration:**
   ```bash
   nano /etc/nginx/sites-available/sistec-library
   ```
   Paste the following:
   ```nginx
   server {
       server_name library.yourdomain.com;

       client_max_body_size 100M;

       # ── Next.js Frontend (Port 3000) ──
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

       # ── Local Supabase Kong Gateway (Port 8000) ──
       location /supabase/ {
           rewrite ^/supabase/(.*) /$1 break;
           proxy_pass http://127.0.0.1:8000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

2. **Enable Site & Install Free SSL:**
   ```bash
   ln -s /etc/nginx/sites-available/sistec-library /etc/nginx/sites-enabled/
   nginx -t
   systemctl reload nginx

   # Obtain Let's Encrypt SSL
   certbot --nginx -d library.yourdomain.com
   ```

---

### Step 5: Automated Daily Database Backups (Zero-Loss)

Setup a lightweight daily cron job to back up the local PostgreSQL database:

```bash
mkdir -p /var/backups/supabase
cat << 'EOF' > /usr/local/bin/backup-library-db.sh
#!/bin/bash
DATE=$(date +%Y-%m-%d_%H%M%S)
docker exec supabase-db pg_dump -U postgres postgres | gzip > /var/backups/supabase/db_backup_$DATE.sql.gz
# Keep only last 14 days of backups
find /var/backups/supabase/ -type f -name "*.sql.gz" -mtime +14 -delete
EOF

chmod +x /usr/local/bin/backup-library-db.sh

# Add to crontab to run daily at 3:00 AM IST
(crontab -l 2>/dev/null; echo "0 21 * * * /usr/local/bin/backup-library-db.sh") | crontab -
```

---

### Step 6: Server Resource Summary

| Service | Memory (RAM) Consumed |
| :--- | :--- |
| **Next.js Production App (Node.js/PM2)** | ~180 MB |
| **Slim Supabase PostgreSQL** | ~220 MB |
| **Supabase GoTrue, PostgREST, Realtime, Storage** | ~230 MB |
| **Kong API Gateway** | ~60 MB |
| **Nginx Web Server** | ~25 MB |
| **Total Server Usage** | **~715 MB RAM** (Fits comfortably on any 1GB or 2GB VPS!) |

---

## Administrator Setup & Approval Flow

### Initial Admin Account Creation
1. Navigate to `/register` on the deployed web portal.
2. Register an account with your institutional email.
3. Open Supabase Dashboard → **Table Editor** → `users`.
4. Locate your account record and update:
   - `role`: Set to `'admin'`
   - `status`: Set to `'approved'`
5. Now sign in at `/login` or navigate to `/admin` to access the full administrator dashboard.

### Student Approval Workflow
- When students register, their initial state is `pending`.
- Administrators log in to `/admin` → **Student Verification Queue**.
- Admins can verify the student's Roll Number and BT Number, then click **Approve Account** or **Reject**.
- Once approved, students receive an instant push notification and can sign in.

---

## Maintenance & Keep-Alive Automation

Supabase free-tier databases automatically pause after 7 consecutive days of inactivity.

To ensure **100% 24/7 uptime without manual intervention**, this repository includes an automated GitHub Actions workflow:
- File: `.github/workflows/supabase-keepalive.yml`
- Schedule: Runs every 3 days at 06:00 UTC (11:30 AM IST).
- Performs an automated REST health ping against your database, resetting the inactivity timer.

To customize for your own Supabase project:
1. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## Troubleshooting

### Issue: "Missing or invalid environment variables"
- **Solution**: Ensure `.env.local` exists in `client/` and that variable names start with `NEXT_PUBLIC_`.

### Issue: "Notifications blocked or VAPID key invalid"
- **Solution**: Check that the browser window is not in Incognito/Private mode (Chrome disables service workers and push notifications in incognito). Verify `NEXT_PUBLIC_FIREBASE_VAPID_KEY` matches your Firebase console key.

### Issue: "Cannot resolve module canvas / pdfjs-dist worker error"
- **Solution**: Handled automatically in `client/next.config.mjs` via webpack alias `canvas: false` and custom TC39 map polyfills in `BookReader.jsx`.

---

## College IT Handover Notes

1. **Ownership & Access**:
   - Transfer Supabase project ownership to the institutional IT email.
   - Transfer Firebase project ownership to the institutional Google workspace account.
2. **Domain Mapping**:
   - To link the college domain (e.g., `library.sistec.ac.in`), configure a CNAME record in your DNS provider pointing to your Vercel or Cloudflare deployment.
3. **Database Backups**:
   - Supabase automatically manages daily backups. For custom SQL dumps, use the Supabase CLI (`supabase db dump`).
4. **Android Signing Keys**:
   - When generating release APKs/AABs for the Google Play Store, generate a secure Java Keystore (`.jks`) file and store it safely in the college vault. Never commit `.jks` files to Git.

---

*Handover Prepared by Sagar Institute of Science & Technology Development Team.*
