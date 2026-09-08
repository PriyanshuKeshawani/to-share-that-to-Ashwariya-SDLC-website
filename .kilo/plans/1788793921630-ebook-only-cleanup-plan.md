# SISTEC Library Portal — Ebook-Only Feature Audit & Cleanup Plan

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
