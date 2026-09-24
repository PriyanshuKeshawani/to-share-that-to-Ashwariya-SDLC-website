# SISTEC Central Digital Library & Innovation Portal

> **INSTITUTIONAL NOTICE**:  
> This software is the private, proprietary property of **Sagar Institute of Science & Technology (SISTec), Bhopal**.  
> Developed for internal institutional operation across the **College Hostinger VPS (Ubuntu 22.04 LTS)**, **Supabase PostgreSQL Backend**, and **Campus Android Devices**.  
> *Confidential & Restricted — Not for public redistribution.*

---

## 📌 Document Overview for College Administration & IT Cell

This documentation is prepared specifically for **SISTec College Management, Principal Office, HODs, Department Coordinators, and the Campus IT Infrastructure Team**. It details how the digital library and student project showcase portal operates, how to manage it on the college server, and how to conduct administrative workflows.

---

## 📑 Table of Contents

1. [System Architecture & Working](#1-system-architecture--working)
2. [Key Capabilities & Modules](#2-key-capabilities--modules)
3. [College VPS Deployment Guide (Hostinger Ubuntu 22.04)](#3-college-vps-deployment-guide-hostinger-ubuntu-2204)
4. [Environment Configuration (.env.local)](#4-environment-configuration-envlocal)
5. [Database Setup & Supabase PostgreSQL](#5-database-setup--supabase-postgresql)
6. [Administrator Setup & Approval Workflows](#6-administrator-setup--approval-workflows)
7. [⚡ 1-Click Google Forms & Google Sheets Project Showcase](#7--1-click-google-forms--google-sheets-project-showcase)
8. [Testing Google Sheet & CSV Import](#8-testing-google-sheet--csv-import)
9. [Android APK Packaging & Distribution](#9-android-apk-packaging--distribution)
10. [Automated Backups & Server Maintenance](#10-automated-backups--server-maintenance)
11. [Troubleshooting & Emergency Reference](#11-troubleshooting--emergency-reference)

---

## 1. System Architecture & Working

```
  ┌────────────────────────────────────────────────────────┐
  │                 STUDENT & FACULTY ACCESS               │
  │     Web Browser (Desktop / Mobile)  &  Android App     │
  └───────────────────────────┬────────────────────────────┘
                              │ HTTPS (Port 443)
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │         COLLEGE HOSTINGER VPS (Ubuntu 22.04 LTS)       │
  │                                                        │
  │   [ Nginx Reverse Proxy ]                              │
  │   ├── SSL/TLS (Let's Encrypt automated certificate)   │
  │   ├── DDoS Rate Limiting (25 requests/sec burst 40)    │
  │   └── Static Microcache for Next.js chunks & assets    │
  │                           │                            │
  │                           ▼ (Port 3000)                │
  │   [ PM2 Cluster Manager ]                              │
  │   ├── Next.js 15 (App Router) + React 19 Engine        │
  │   └── Multi-core cluster mode ('max' CPU utilization)  │
  └───────────────────────────┬────────────────────────────┘
                              │
                              ▼ Secure HTTPS / WSS
  ┌────────────────────────────────────────────────────────┐
  │              CENTRAL CLOUD INFRASTRUCTURE              │
  │                                                        │
  │   [ Supabase PostgreSQL ]                              │
  │   ├── Institutional E-Book Catalog (1,400+ books)      │
  │   ├── Row-Level Security (RLS) & Branch Permissions    │
  │   ├── Student Verification & Approval Queue            │
  │   └── Innovation & Final Year Projects Showcase        │
  │                                                        │
  │   [ Firebase Cloud Messaging ]                         │
  │   └── Instant Push Notifications to Web & Mobile       │
  └────────────────────────────────────────────────────────┘
```

---

## 2. Key Capabilities & Modules

1. **Central E-Book Catalog & Interactive Reader**:
   - Access to over 1,400+ technical textbooks, reference guides, syllabus notes, and previous year papers.
   - Built-in flipbook reader (`pdfjs-dist` + `page-flip`) with offline client caching, multi-page layout, zoom, and chapter bookmarks.
2. **Departmental & Branch Access Control**:
   - Automatic catalog filtering for CSE, AIML, Cyber Security, IT, ME, EC, Civil, EX, and MBA.
   - Cross-branch book permission request and approval workflow.
3. **Student Learning & Activity Dashboard**:
   - Tracks student reading streaks, total minutes spent reading, books completed, personal notes, and bookmarks.
4. **Administrator Control Center (`/admin`)**:
   - **Student Verification Queue**: Verify student roll numbers, branches, and enrollments before granting access.
   - **Book Manager**: Upload, edit, categorize, and manage visibility of institutional books.
   - **Branch Permissions**: Review and grant inter-departmental book access requests.
   - **Student Activity Auditor**: View real-time reading progress and audit logs.
5. **Innovation & Final Year Projects Showcase**:
   - Platform for students to showcase Major Projects, Minor Projects, Hackathon entries, and Research papers.
   - Peer reactions, likes, live demo links, GitHub repositories, and mentor acknowledgments.

---

## 3. College VPS Deployment Guide (Hostinger Ubuntu 22.04)

### Step 1: Install Required Server Packages
Connect to your college VPS via SSH (`ssh root@YOUR_SERVER_IP`) and execute:

```bash
# Update package lists
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS (Recommended long-term release)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx git

# Install PM2 Process Manager globally
sudo npm install -g pm2
```

### Step 2: Clone Repository & Install Dependencies

```bash
cd /var/www
git clone https://github.com/DomainExpandersOfficial/SISTEC-LIBRARY-PORTAL-.git sistec-portal
cd sistec-portal

# Install root & client packages
npm install
npm run install-all
```

### Step 3: Configure Environment File
Create the production environment file:

```bash
cp .env.example client/.env.local
nano client/.env.local
```
*(Paste your live college Supabase credentials as described in Section 4 below).*

### Step 4: Build & Launch with PM2 Cluster

```bash
# Compile optimized production bundle
npm run build

# Start multi-core high-concurrency PM2 cluster
npm run start:cluster

# Configure PM2 to restart automatically on server reboot
pm2 save
pm2 startup
```

### Step 5: Configure Nginx & SSL

Create `/etc/nginx/sites-available/sistec-library`:

```nginx
server {
    listen 80;
    server_name library.sistec.ac.in; # (Replace with your actual domain or VPS IP)

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the configuration and issue free SSL:

```bash
sudo ln -s /etc/nginx/sites-available/sistec-library /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Issue Let's Encrypt SSL Certificate
sudo certbot --nginx -d library.sistec.ac.in
```

---

## 4. Environment Configuration (.env.local)

The application requires configuration in `client/.env.local`:

```env
# 1. SUPABASE DATABASE & AUTHENTICATION
NEXT_PUBLIC_SUPABASE_URL=https://your-sistec-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# 2. FIREBASE PUSH NOTIFICATIONS (OPTIONAL BUT RECOMMENDED)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_web_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=sistec-library-portal.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=sistec-library-portal
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=sistec-library-portal.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=1:your_sender_id:web:your_web_app_id
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_firebase_vapid_key_here
```

---

## 5. Database Setup & Supabase PostgreSQL

The database schema is self-contained in **`supabase_schema.sql`** at the repository root.

### Provisioning the Database:
1. Open the [Supabase Dashboard](https://supabase.com).
2. Navigate to **SQL Editor** in the left menu.
3. Paste the contents of `supabase_schema.sql` and click **Run**.
4. The script creates:
   - `branches` & `categories`: Pre-populated with SISTec departments.
   - `books`: Stores titles, authors, categories, drive links, and PDF URLs.
   - `users`: Student and admin profiles with verification status and branch affiliations.
   - `projects`: Student innovation projects, team structures, and deployment URLs.
   - `user_book_progress`: Real-time reading logs, session times, and completed books.
   - `notes` & `bookmarks`: Personal student study annotations.
   - **Row-Level Security (RLS)**: Enforces strict data separation so unverified students cannot access protected materials.

---

## 6. Administrator Setup & Approval Workflows

### Creating the First Administrator Account:
1. Register on the portal at `/register` using your college email address.
2. In the Supabase Dashboard → **Table Editor** → `users`:
   - Locate your newly registered account.
   - Change `role` to `'admin'`.
   - Change `status` to `'approved'`.
3. Sign in at `/login`. You will now have direct access to the **Admin Control Center** at `/admin`.

### Student Verification Workflow:
1. When new students register, their profile is marked as `pending`.
2. Faculty/Admin opens `/admin` → **Student Verification Queue**.
3. Admin reviews student name, department, enrollment number, and college ID.
4. Clicking **Approve** enables their account instantly; the student receives a notification and can immediately log in.

---

## 7. ⚡ 1-Click Google Forms & Google Sheets Project Showcase

Collecting student major/minor projects manually can be time-consuming. This portal includes an **automated 1-click Google Form & Sheet creator**:

### How Department Coordinators Use It:
1. In the Admin Portal → Navigate to **Projects Tab** → Click **Google Form Setup**.
2. Select desired fields (Project Title, Category, Branch, Team Members, Drive Screenshot URL, GitHub Link, Live Demo URL, Mentor Name).
3. Click the glowing button: **`⚡ 1-Click Auto-Create Form`**.
4. **What happens automatically**:
   - The system generates an automated Google Apps Script customized to your selected fields.
   - It copies the script to your clipboard and opens `script.new` in Google.
   - You simply press **Ctrl + V** and click **Run (▶)**.
   - Google instantly generates:
     - The **Google Form** with all 11 fields, descriptions, and branch dropdowns.
     - A linked **Google Spreadsheet** (`SISTEC Project Submissions (Responses)`) in your Google Drive.
5. Share the Form link with students. When students submit their projects, all rows are gathered into the Google Sheet automatically!

---

## 8. Testing Google Sheet & CSV Import

Once student submissions are collected in Google Sheets, administrators can import dozens or hundreds of projects in 1 click:

### Ways to Test Right Now:

#### Method A: Direct Paste Testing (0 Seconds, Zero Setup)
1. Open Admin Portal → **Projects Tab** → Click **Import from Form**.
2. Stay on the **"Paste Google Sheet"** tab.
3. Click the button: **`⚡ Load Sample Test Data`**.
4. Click **Parse & Auto-Map Columns** → Review the 5 auto-matched sample projects → Click **Import Projects**.
5. The projects will immediately appear live in the student and admin showcase!

#### Method B: CSV Upload Testing
1. Download the pre-built sample file:
   - Click **Download Sample CSV** inside the Import Wizard modal, or download [`sample_project_submissions.csv`](file:///client/public/sample_project_submissions.csv) directly.
2. Select the **"CSV File"** tab in the Import Wizard.
3. Choose the downloaded CSV → The intelligent engine maps all 11 columns automatically.

#### Method C: Live Google Sheet Testing
1. Create a Google Sheet with student responses at `sheets.new`.
2. Click **Share** (top-right) → Under *General Access*, set to **"Anyone with the link can view"**.
3. Copy the URL and paste it into the **Google Sheet URL** tab in the Import Wizard.
4. Click **Load & Preview Sheet** to import directly via the server proxy!

---

## 9. Android APK Packaging & Distribution

The portal is equipped with **Capacitor 8** to build native Android APKs:

```bash
# 1. Build web application & sync assets to Android
cd client
npm run build
npm run cap:sync

# 2. Build debug APK using Gradle CLI
cd android
./gradlew assembleDebug
```
The APK will be generated at:
`client/android/app/build/outputs/apk/debug/app-debug.apk`

Distribute this APK directly to students via the college website, WhatsApp groups, or institutional portals.

---

## 10. Automated Backups & Server Maintenance

To safeguard college data, a dedicated backup script is provided in `clg_vps_setup/backup_database.sh`:

```bash
# Run manual backup
bash clg_vps_setup/backup_database.sh
```

### Setup Nightly Automated Cron Backup:
Open the crontab editor on your VPS (`sudo crontab -e`) and add:

```cron
# Runs every night at 2:00 AM IST to backup database and server configuration
0 2 * * * /bin/bash /var/www/sistec-portal/clg_vps_setup/backup_database.sh >> /var/log/sistec_backup.log 2>&1
```
Backups are archived with timestamped archives and automatically retain the latest 14 days of backups while pruning older files.

### 24/7 Database Keep-Alive:
Supabase free tier databases pause after 7 days of inactivity. This repository includes `.github/workflows/supabase-keepalive.yml` which sends an automated ping every 3 days at 11:30 AM IST, keeping the database active 24/7/365 without manual intervention.

---

## 11. Troubleshooting & Emergency Reference

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **"Failed to fetch Google Sheet"** | Google Sheet is set to private | In Google Sheets, click **Share** → Change access to **"Anyone with the link" (Viewer)**. |
| **"Rate limit exceeded (429)"** | Too many sheet requests in 1 minute | Wait 60 seconds; the security rate limiter automatically resets. |
| **PM2 Process Crashed** | Memory limit exceeded or unhandled error | Check logs with `pm2 logs sistec-library`. Restart with `pm2 restart sistec-library`. |
| **Port 3000 In Use** | A stale Node process is running | Run `sudo lsof -i :3000` and kill the PID with `sudo kill -9 <PID>`, then restart PM2. |
| **Student Can't Sign In** | Account status is `pending` | Admin must open `/admin` → Student Verification Queue → Click **Approve**. |

---

*Prepared by the Development Team for Sagar Institute of Science & Technology (SISTec).*  
*Restricted Institutional Property — All Rights Reserved.*
