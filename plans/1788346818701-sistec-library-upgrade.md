# SISTEC Library Portal — Implementation Plan

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
