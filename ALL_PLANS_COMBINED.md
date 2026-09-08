# SISTEC Library Portal — All Plans Combined

> **Combined**: September 2026  
> **Source Files**:
> 1. `plans/1788346818701-sistec-library-upgrade.md`
> 2. `plans/student-activity-and-100k-scale-master-plan.md`
> 3. `.kilo/plans/1788793921630-ebook-only-cleanup-plan.md`

---

# Plan 1: SISTEC Library Portal — Implementation Plan

## 1. Current State
- React + Vite + Supabase digital library
- Tables: users, branches, categories, books, permissions, activity_logs
- Username/password auth with synthetic email
- Student registration + admin approval
- Branch-based book access
- PDF upload/reading + page tracking
- Admin analytics dashboard
- Theme system + Capacitor mobile wrapper

## 2. Key Decisions
- Table identification: QR codes at each table
- Book identification: existing physical UUID, no new QR on books
- Presence: student self check-in via table QR scan
- Auth: Google OAuth preferred + keep password fallback
- Book model: split into books (metadata) + physical_book_copies (individual copies)
- Fines: automatic calculation, admin override with audit
- Admin map: realtime via Supabase subscriptions

## 3. Database Schema

```sql
CREATE TABLE physical_book_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  copy_uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'available',
  qr_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE book_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  copy_id UUID REFERENCES physical_book_copies(id),
  user_id UUID REFERENCES users(id),
  issued_at TIMESTAMP DEFAULT NOW(),
  due_date TIMESTAMP NOT NULL,
  returned_at TIMESTAMP,
  status TEXT DEFAULT 'issued',
  fine_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE rooms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tables (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES rooms(id),
  table_number TEXT NOT NULL,
  qr_identifier TEXT UNIQUE NOT NULL,
  current_occupant_id UUID REFERENCES users(id),
  session_started_at TIMESTAMP,
  status TEXT DEFAULT 'free',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE library_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  table_id INTEGER REFERENCES tables(id),
  entered_at TIMESTAMP DEFAULT NOW(),
  exited_at TIMESTAMP,
  duration_minutes INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE library_settings (
  id SERIAL PRIMARY KEY,
  loan_duration_days INTEGER DEFAULT 14,
  fine_per_day DECIMAL(10,2) DEFAULT 5,
  max_fine DECIMAL(10,2) DEFAULT 200,
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO library_settings DEFAULT VALUES;

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'password';

CREATE INDEX idx_book_loans_user ON book_loans(user_id);
CREATE INDEX idx_book_loans_copy ON book_loans(copy_id);
CREATE INDEX idx_library_sessions_user ON library_sessions(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
```

## 4. Implementation Phases

### Phase 1: Core Infrastructure (P0)
1. Enable Google provider in Supabase Auth
2. Update AuthContext.jsx for Google sign-in + fallback
3. First-time Google login: collect roll number, branch, year, semester
4. Create physical_book_copies table + admin UI to add copies
5. Book issue/return request flow with status machine
6. Admin approval dashboard for registrations + issue/return requests
7. Automatic fine calculation + admin override with audit
8. Enhanced student dashboard: current table, my books, fine

### Phase 2: Library Experience (P1)
9. Admin room/table management + printable QR generator
10. QR scanner component for table check-in
11. Library session tracking (entry/exit/table changes)
12. Admin live library map with realtime subscriptions
13. Student directory search
14. Notification bell + realtime notifications

### Phase 3: Intelligence (P2)
15. Advanced search + filters + pagination
16. Reports: student, book, financial, usage + export
17. Analytics dashboards

## 5. Component Changes

### New Components
- components/QRScanner.jsx — camera QR/barcode scanner
- components/NotificationBell.jsx — notification dropdown
- components/AdminLiveMap.jsx — visual table grid
- components/BookScanner.jsx — book UUID scanner
- components/FineDisplay.jsx — fine summary

### New Pages
- pages/StudentDashboard.jsx — enhanced student dashboard
- pages/AdminLiveMap.jsx — full-screen live map
- pages/BookIssue.jsx — issue/return flow

### Updated Files
- context/AuthContext.jsx — Google OAuth, expanded apiCall
- pages/AdminDashboard.jsx — new tabs, live map
- pages/Dashboard.jsx — student enhancements
- pages/Login.jsx — Google sign-in button
- pages/Register.jsx — optional for Google users

## 6. Technical Architecture

### Auth Flow
Google Login → Supabase Auth OAuth → find/insert user by google_id → session persisted

### Table QR Flow
Scan table QR → lookup table by qr_identifier → create/update library_session → update table occupant → confirm

### Book Issue Flow
Scan book UUID → lookup physical_book_copy by copy_uuid → check available → create loan request → notify admin → approve/reject with status transition

### Realtime
Use Supabase Realtime for: admin live map, notifications, pending action counts. Not for book lists or analytics.

## 7. Validation Plan

### Student Flow
- Google login + password login both work
- First-time Google login prompts college details
- Table QR scan checks in successfully
- New table QR updates current table
- Book UUID scan identifies copy
- Issue request appears to admin
- Admin approve changes book status
- Return request flow works
- Fine auto-calculates on overdue

### Admin Flow
- Live map updates realtime
- Pending actions visible
- Approve/reject works
- Fine override with audit log
- Reports export correctly

### Edge Cases
- Two students scan same table → one succeeds, one gets error
- Race condition on same book → prevented by DB constraint
- Already issued book → cannot be re-issued
- Session auto check-out after max duration
- Location permission OFF → QR fallback still works
- No network → cached QR scan still works

## 8. Rollout
1. Week 1: Schema + Google OAuth + enhanced auth
2. Week 2: Physical copies + issue/return + admin approvals
3. Week 3: Table QR + library sessions + live map
4. Week 4: Notifications + dashboard + fines
5. Week 5: Reports + analytics + testing

## 9. Open Questions
1. Book UUID format: confirm scanner compatibility
2. Supabase Google provider: verify enabled with client IDs
3. Table QR printing: admin printable QR generator needed
4. Max session duration: default 4 hours?
5. Fine payment: manual tracking only initially

---
---

# Plan 2: SISTEC Library Portal — Master Implementation & Scaling Plan

> **File**: `plans/student-activity-and-100k-scale-master-plan.md`  
> **Created**: September 2026  
> **Target**: Student Activity & Transcript Engine + 100,000 Users Scale on 100% Free Tier (₹0/Month)

---

## 1. Executive Overview

This master plan document serves as a complete technical blueprint for two key pillars of the SISTEC Central Digital Library Portal:
1. **Student Complete Activity History & Official Printable Transcript Engine** (`StudentActivityModal.jsx`).
2. **100,000 Users Zero-Cost Production Scaling & Database-Only Persistence Architecture** (Zero `localStorage`, 100% Supabase PostgreSQL, Cloudflare Pages, Cloudflare R2).

Whenever you want to expand, deploy, or hand off this system in the future, follow the steps and architectural guidelines documented here.

---

## 2. Pillar I: Student Activity History & Transcript Engine

### A. Component Architecture (`StudentActivityModal.jsx`)
- **Location**: `client/src/components/StudentActivityModal.jsx` (1,263 lines, standalone, fully responsive).
- **Trigger**: Clickable from any student row, name cell, or dedicated **`Activity`** button in the Admin Dashboard ("Student Account Management" table).
- **Responsive Layout**:
  - Sticky modal header with avatar, full name, roll number, BT code, branch, year/sem badges.
  - Live Desk Status banner (pulsating green badge if student is currently seated at a desk).
  - Compact 2-column mobile KPI grid.
  - Horizontal scroll-friendly tabs (`Overview`, `Loans`, `Seating`, `E-Books`, `Audit Logs`).

### B. KPI Metrics Computation
| Metric | Source Table | Filter Criteria | Purpose |
| :--- | :--- | :--- | :--- |
| **Currently Borrowed** | `book_loans` | `user_id = student.id AND status = 'issued'` | Active physical books in hand |
| **Lifetime Borrowed** | `book_loans` | `user_id = student.id` | Total all-time borrowings |
| **Study Desk Visits** | `library_sessions` | `user_id = student.id` | Physical library check-ins |
| **Total Study Time** | `library_sessions` | `SUM(duration_minutes)` | Total time logged at study desks |
| **Fines Incurred** | `book_loans` | `SUM(fine_amount)` | Outstanding or paid late fee dues |
| **Digital E-Books Read**| `user_book_progress` | `user_id = student.id` | E-books opened in reader |

### C. The 5 Detailed Activity Tabs
1. **Summary Overview**:
   - Academic Profile summary.
   - Quick list of 3 most recent book loans with due dates.
   - Quick list of 3 most recent desk visits with duration badges.
2. **Physical Book Loans**:
   - Live search bar (by book title, author, QR copy ID).
   - Filter pills (`All`, `Active Issued`, `Returned`, `Overdue`).
   - Detailed loan cards showing copy UUID, issue date, due date, return date, and fine dues.
3. **Desk & Room Check-Ins**:
   - History of all physical seat sessions with Room Name and Desk Number (e.g. `Hall 101 - Desk B-4`).
   - Entry timestamp, exit timestamp, duration badges (e.g. `1h 45m`).
   - Status indicators (`Completed` or `In Progress`).
4. **Digital E-Books Progress**:
   - List of all digital books read by the student.
   - Last page read, total access count, and download status.
5. **Audit Trail & System Logs**:
   - Branch access request history (`pending`, `approved`, `rejected`).
   - Historical login, logout, and fine adjustment logs from `activity_logs`.

### D. Official Printable Transcript Engine (`handlePrintReport`)
- Generates a standalone **300 DPI high-resolution printable transcript** on an independent `window.open` document.
- Includes:
  - Official SISTEC Central Digital Library & Sagar Group Header.
  - Student Academic Credentials table (Roll Number, BT Code, Branch, Semester).
  - High-level KPI Summary table.
  - Complete Physical Book Circulation Log.
  - Physical Study Room Seating Attendance Log.
  - Librarian Signature & Date stamp blocks.
- Optimized with `@media print` CSS rules (clean page breaks, no buttons or URLs printed).

---

## 3. Pillar II: Database-Only Persistence (Zero LocalStorage)

### A. The Requirement
Operational data (such as seating templates, room configs, desk layouts, book loans) must **never rely on client browser `localStorage`**. It must live directly in the live Supabase PostgreSQL database so that:
- Any administrator logging in from any PC, laptop, or mobile sees the exact same layouts and templates.
- Clearing browser cache or switching devices causes zero data loss.

### B. Implementation Details
1. **`RoomSeatingManager.jsx`**:
   - Completely eliminated `localStorage.getItem('sistec_library_seating_templates')` and `localStorage.setItem`.
   - On component mount, calls `apiCall('/seating-templates')` to load all saved templates directly from Supabase.
   - When an admin saves a template, it sends a `POST /seating-templates` request to insert it into Supabase.
   - Added direct database deletion (`×`) via `DELETE /seating-templates/:id`.
2. **`AuthContext.jsx`**:
   - `GET /seating-templates`: Queries `activity_logs` where `action_type = 'seating_template'`.
   - `POST /seating-templates`: Inserts the template JSON into `activity_logs.details`.
   - `DELETE /seating-templates/:id`: Deletes the record permanently from Supabase.
3. **`supabase_schema.sql`**:
   - Added `seating_templates JSONB DEFAULT '[]'::jsonb` to `library_settings`.

---

## 4. Pillar III: 100,000 Users Scale on ₹0 Free Tier

### A. The Zero-Cost Architecture Diagram

```
                     ┌──────────────────────────────────────────────────────────┐
                     │          100,000 STUDENTS & FACULTY (CAMPUS/MOBILE)       │
                     └────────────────────────────┬─────────────────────────────┘
                                                  │
                                                  ▼
                     ┌──────────────────────────────────────────────────────────┐
                     │              CLOUDFLARE ANYCAST EDGE CDN                 │
                     │  • Unlimited Bandwidth (₹0) • 300+ Edge POPs             │
                     │  • Edge Cache Rules (Public Catalog, Branches, Themes)   │
                     └──────┬─────────────────────┬──────────────────────┬──────┘
                            │                     │                      │
            [Static React SPA]         [E-Book PDF Downloads]     [Live API Requests]
                            │                     │                      │
                            ▼                     ▼                      ▼
                     ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
                     │  Cloudflare  │      │  Cloudflare  │      │   PostgREST  │
                     │    Pages     │      │   R2 Object  │      │  (Supabase)  │
                     │ (Unlimited)  │      │   Storage    │      │  HTTP Engine │
                     └──────────────┘      │  (0 Egress)  │      └──────┬───────┘
                                           └──────────────┘             │
                                                                 (Pooled TCP)
                                                                        │
                                                                        ▼
                                                           ┌────────────────────────┐
                                                           │  SUPABASE POSTGRESQL   │
                                                           │  • B-Tree Indexes      │
                                                           │  • Partial Indexes     │
                                                           │  • 500MB Lean Schema   │
                                                           └────────────────────────┘
```

### B. Free Tier Strategy Breakdown
1. **Frontend Hosting (Cloudflare Pages)**:
   - **Cost**: **₹0.00**
   - **Limit**: **100% Unlimited Bandwidth** and unlimited static requests. Avoids Vercel/Netlify 100 GB egress traps.
2. **Textbook PDF Storage (Cloudflare R2)**:
   - **Cost**: **₹0.00**
   - **Limit**: 10 GB free storage + **Zero Egress Fees Forever**. 100k students can download large engineering textbooks without exhausting Supabase's 5 GB limit.
3. **Edge API Caching (Cloudflare Cache Rules)**:
   - **Cost**: **₹0.00**
   - **Strategy**: Cache `/books`, `/books/categories`, `/books/branches` at the CDN edge for 120 seconds.
   - **Benefit**: **85%+ of read requests never reach Supabase**, keeping CPU load near 0%.
4. **PostgreSQL Database Indexes (Sub-2ms Lookups)**:
   - All critical lookups use B-Tree indexes:
     - `idx_tables_qr`: Desk QR scan matches desk in < 2ms among 100,000 records.
     - `idx_users_roll`: Student login verification in < 1ms.
     - `idx_library_sessions_user_active`: Partial index (`WHERE exited_at IS NULL`) checks if student is seated with near-zero RAM footprint.
     - `idx_notifications_user_unread`: Partial index (`WHERE is_read = FALSE`) powers the notification bell instantly.
5. **Database Storage Capacity (500 MB Limit)**:
   - 100,000 user profiles = ~32.0 MB
   - 5,000 book records = ~1.2 MB
   - 40,000 physical copies = ~7.2 MB
   - 50,000 active/recent loans = ~10.0 MB
   - 100,000 session logs (30 days) = ~14.0 MB
   - Indexes = ~25.0 MB
   - **TOTAL DISK USAGE**: **~89.6 MB** (Well within Supabase's 500 MB free allowance).

---

## 5. Maintenance & Pruning Automation

To maintain the database indefinitely under the 500 MB ceiling, execute this SQL script in the Supabase SQL editor once a quarter:

```sql
-- 1. Prune library seating sessions older than 90 days
DELETE FROM library_sessions 
WHERE created_at < NOW() - INTERVAL '90 days';

-- 2. Prune read notifications older than 60 days
DELETE FROM notifications 
WHERE is_read = TRUE AND created_at < NOW() - INTERVAL '60 days';

-- 3. Prune audit logs older than 90 days (preserves seating templates)
DELETE FROM activity_logs 
WHERE action_type != 'seating_template' 
  AND created_at < NOW() - INTERVAL '90 days';

-- 4. Reclaim disk space
VACUUM;
```

---

## 6. Deployment Checklist

1. **Step 1 — Build Client**:
   ```bash
   npm run build --prefix client
   ```
2. **Step 2 — Push to Cloudflare Pages**:
   - Connect repository to Cloudflare Pages.
   - Build command: `npm run build` | Output dir: `dist`.
   - Set environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
3. **Step 3 — Run Supabase Schema**:
   - Copy contents of `supabase_schema.sql` into Supabase SQL Editor and click **Run**.
4. **Step 4 — Automated Test Verification**:
   ```bash
   node client/test_deep_suite.mjs
   ```
   Ensures all 37/37 assertions pass.

---
---

# Plan 3: SISTEC Library Portal — Ebook-Only Feature Audit & Cleanup Plan

## Current State Summary

The SISTEC Library Portal is a React + Supabase single-page app with **two major systems**:
1. **Ebook system** — books, PDF reader, permissions, reading progress
2. **Physical library system** — QR check-in, room seating, loans, fines, notifications

The goal is to **keep only the ebook system** and remove the physical library system entirely.

---

## Phase 1: Feature Classification

### KEEP — Ebook Core

| Feature | Files | DB Tables | Why Keep |
|---------|-------|-----------|----------|
| Authentication | `AuthContext.jsx`, `Login.jsx`, `Register.jsx`, `GoogleProfileCompletion.jsx` | `users`, `auth.users` | Required for any user-facing app |
| Book Catalog | `AdminDashboard.jsx` (books tab), `StudentDashboard.jsx` (catalog tabs) | `books`, `categories`, `branches` | Core ebook browsing |
| PDF Reader | `BookReader.jsx` | — | Core ebook consumption |
| Reading Progress | `activity_logs` (reading events), `user_book_progress` | `user_book_progress` | Ebook UX feature |
| Permissions | `AdminDashboard.jsx` (permissions tab) | `permissions` | Access control for ebooks |
| User Management | `AdminDashboard.jsx` (users/students tabs) | `users` | Admin needs to manage readers |
| Settings | `SettingsView.jsx` | — | Theme/account prefs |
| Notifications | `NotificationBell.jsx` | `notifications` | General UX (can be simplified) |
| Shared UI | `BottomNav.jsx`, `SkeletonLoader.jsx`, `StatusBadge.jsx`, `EmptyState.jsx` | — | Reusable components |
| Theme | `ThemeContext.jsx`, `index.css` | — | Visual polish |

### REMOVE — Physical Library System

| Feature | Files | DB Tables | Why Remove |
|---------|-------|-----------|------------|
| QR Check-in | `QRScanner.jsx` | `library_sessions`, `qr_codes` | Physical attendance tracking |
| Room Seating | `RoomSeatingManager.jsx`, `BulkRoomBuilderModal.jsx`, `TableQRBadgeModal.jsx`, `DeskCheckinSuccessModal.jsx` | `rooms`, `tables`, `library_sessions` | Physical space management |
| QR Generation | `qrGenerator.js` | — | Tied to physical system |
| Loan Management | `AdminDashboard.jsx` (loans/copies tabs) | `physical_book_copies`, `book_loans` | Physical book circulation |
| Fine System | `AdminDashboard.jsx` (loans tab) | — | Physical overdue fines |
| Seating Tests | `test_deep_suite.mjs` | — | Tests removed features |

### SIMPLIFY — Mixed Features

| Feature | Action |
|---------|--------|
| `AdminDashboard.jsx` | Remove physical tabs (loans, copies, rooms), keep ebook tabs |
| `StudentDashboard.jsx` | Remove loans/fines/history tabs, keep catalog + reading |
| `StudentActivityModal.jsx` | Remove physical activity entries, keep reading history |
| `NotificationBell.jsx` | Keep component but simplify notification types |
| `test_pdf_lifecycle.mjs` | Keep — tests ebook functionality |

---

## Phase 2: Database Cleanup

### Tables to REMOVE (with data loss — OK for rebuild)
- `rooms`
- `tables`
- `library_sessions`
- `physical_book_copies`
- `book_loans`
- `seating_templates` (if exists in activity_logs)

### Tables to KEEP (possibly rename)
- `books` → keep as-is
- `categories` → keep as-is
- `branches` → keep as-is
- `users` → keep as-is
- `permissions` → keep as-is
- `user_book_progress` → keep as-is
- `notifications` → keep, simplify types
- `activity_logs` → keep only ebook-related actions
- `library_settings` → keep only ebook-relevant settings

### Schema Changes Needed
1. Drop foreign keys from removed tables
2. Remove `pdf_url` Base64 fallback logic (if moving to Drive)
3. Add `drive_file_id` column to `books` (for Drive integration)
4. Simplify `activity_logs.action_type` enum

---

## Phase 3: Frontend Cleanup

### Remove Entirely
- `client/src/components/QRScanner.jsx`
- `client/src/components/RoomSeatingManager.jsx`
- `client/src/components/BulkRoomBuilderModal.jsx`
- `client/src/components/TableQRBadgeModal.jsx`
- `client/src/components/DeskCheckinSuccessModal.jsx`
- `client/src/utils/qrGenerator.js`
- `client/test_deep_suite.mjs`

### Simplify
- `AdminDashboard.jsx` — remove loans, copies, rooms tabs
- `StudentDashboard.jsx` — remove loans, fines, history tabs; keep catalog + reader
- `StudentActivityModal.jsx` — strip physical activities
- `NotificationBell.jsx` — remove physical notifications
- `BottomNav.jsx` — update tab list

### Keep As-Is
- `BookReader.jsx`
- `AuthContext.jsx`
- `Login.jsx`
- `Register.jsx`
- `GoogleProfileCompletion.jsx`
- `SettingsView.jsx`
- `SkeletonLoader.jsx`
- `StatusBadge.jsx`
- `EmptyState.jsx`
- `ThemeContext.jsx`
- `test_pdf_lifecycle.mjs`

---

## Phase 4: Google Drive Integration Strategy

### Decision Required: Approach

**Option A — Simple Links (Recommended)**
- Admin pastes Drive share links into book form
- `books.drive_link` column stores the URL
- Reader opens Drive in new tab / iframe
- Fastest to implement, minimal changes

**Option B — Drive Embed**
- Admin pastes Drive file ID
- Reader embeds via `https://drive.google.com/file/d/{id}/preview`
- Better UX, still simple

**Option C — Full Drive Sync**
- Admin connects Google account
- App lists Drive files, auto-indexes
- Most complex, requires Google API setup

### Recommended: Option B
- Minimal backend changes
- Good user experience
- No Google API credentials needed
- Works with any Drive link

---

## Phase 5: Execution Order

1. **Backup** — Commit current state, create branch `cleanup/ebook-only`
2. **DB Migration** — Create new migration to drop physical tables
3. **Schema Update** — Add `drive_link` / `drive_file_id` to `books`
4. **Remove Components** — Delete QR, seating, room files
5. **Simplify Dashboards** — Edit AdminDashboard, StudentDashboard
6. **Update Navigation** — Fix BottomNav tabs
7. **Update Reader** — Add Drive embed support
8. **Update Book Form** — Add Drive link field instead of PDF upload
9. **Clean Tests** — Remove `test_deep_suite.mjs`
10. **Verify** — Run `test_pdf_lifecycle.mjs`, manual test flows
11. **Deploy** — Push to production

---

## Phase 6: Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Accidental data loss | Backup DB before migration |
| Broken navigation | Test all routes after tab removal |
| Auth breaks | Keep all auth files intact |
| Reader breaks | Keep BookReader.jsx fully intact |
| Mobile breaks | Test BottomNav after tab changes |

---

## Open Questions for User

1. **Drive approach**: Option A, B, or C?
2. **User data**: Keep existing users/books, or fresh start?
3. **Reading history**: Keep `activity_logs` reading data, or clear it?
4. **Notifications**: Keep notification bell, or remove entirely?
5. **Theme**: Keep dark/light theme toggle, or single theme?

---

## Next Steps

1. Confirm this plan
2. Answer open questions
3. Switch to implementation agent to execute Phase 5
