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
9. [Database & Backend Setup](#database--backend-setup)
10. [Deployment Guide](#deployment-guide)
11. [Administrator Setup & Approval Flow](#administrator-setup--approval-flow)
12. [Maintenance & Keep-Alive Automation](#maintenance--keep-alive-automation)
13. [Troubleshooting](#troubleshooting)
14. [College IT Handover Notes](#college-it-handover-notes)

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

# 2. Install dependencies for the root and client
npm install
npm run install-all
```

> **Note**: An `.npmrc` file is included with `legacy-peer-deps=true` to guarantee deterministic package installation across all environments with React 19.

---

## Environment Configuration

Copy the example environment file to create your local `.env.local` configuration:

```bash
# Copy template from root to client
cp .env.example client/.env.local
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
# From the root directory:
npm run dev

# Or directly from client/:
cd client
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
# From the root directory:
npm run build

# Or within the client directory:
cd client
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

The repository includes a pre-configured native Android application under `client/android/`.

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
   cd client/android
   ./gradlew assembleDebug
   # Release build:
   ./gradlew assembleRelease
   ```
   The generated APK will be available in:
   `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## Database & Backend Setup

The database schema is self-contained in **`supabase_schema.sql`** at the root of this repository.

### Initializing Supabase PostgreSQL
1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** from the left navigation panel.
3. Open `supabase_schema.sql`, copy all contents, paste into the SQL Editor, and click **Run**.
4. The script provisions:
   - `branches`: Institutional engineering, pharmacy, and management branches.
   - `categories`: Subject taxonomy and department classifications.
   - `books`: Master book catalog (titles, authors, drive links, PDF URLs, covers).
   - `users`: Student and faculty profiles with approval status, branch, and roll numbers.
   - `user_book_progress`: Real-time reading progress, session duration, and page completion metrics.
   - `notes` & `bookmarks`: Personal student study notes and chapter bookmarks.
   - `senior_academic_profiles`: Directory of senior majors & minors with career and mentorship guidance.
   - `projects`: Student innovation & hackathon projects showcase with live URLs, GitHub repositories, and team members.
   - `project_likes` & `project_reactions`: Real-time peer reactions and synchronized like counters.
   - `user_fcm_tokens`: Push notification device registration for Web and Android.
   - **Row-Level Security (RLS)**: Enforces access control so users can only access authorized data.
   - **Triggers & Stored Procedures**: Automatic timestamps, like counters, and stats aggregation.

---

## Deployment Guide

### Option 1: Hostinger K2 VPS / On-Premise Deployment (College Server)
For deploying directly on the college's Hostinger KVM 2 VPS (8GB RAM) with Nginx reverse proxy, PM2 process management, automated database backups, and SSL, consult our comprehensive guide:
👉 **[DEPLOYMENT_AND_VPS_SETUP_GUIDE.md](file:///d:/CODE%20JAANI%20CODE/company%20work/Sistech%20libraray/SISTEC-LIBRARY-PORTAL-/DEPLOYMENT_AND_VPS_SETUP_GUIDE.md)**

### Option 2: Vercel (Cloud-Native SSR)
This repository is configured with a root `vercel.json` pointing to `client/`:
1. Connect your GitHub repository to [vercel.com](https://vercel.com).
2. Set Root Directory to `client` (or leave default as `vercel.json` automatically manages this).
3. Add your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel Environment Variables.
4. Click **Deploy**.

### Option 3: Cloudflare Pages / Static Edge (100k Users Zero Cost)
For zero egress costs and high student concurrency, consult our detailed architecture blueprint:
👉 **[architecture_100k_free_tier.md](file:///d:/CODE%20JAANI%20CODE/company%20work/Sistech%20libraray/SISTEC-LIBRARY-PORTAL-/architecture_100k_free_tier.md)**

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
