# SISTEC Library Portal — Client Application

This directory contains the **Next.js 15 App Router** frontend and **Capacitor 8 Android** mobile application for the SISTEC Central Digital Library Portal.

---

## Directory Overview

- `app/`: Next.js 15 App Router entry points and routes (`/`, `/login`, `/register`, `/student`, `/admin`, `/read/[id]`, `/complete-profile`).
- `src/`: Reusable React components, context providers (`AuthContext`, `ThemeContext`), views, and utilities.
- `public/`: Static assets, brand logos, sounds, web workers (`firebase-messaging-sw.js`), and Digital Asset Links (`.well-known/assetlinks.json`).
- `android/`: Native Android Studio project generated and synchronized by Capacitor.
- `next.config.mjs`: Next.js configuration with environment fallbacks, webpack polyfills, and workspace tracing settings.
- `capacitor.config.json`: Capacitor mobile runtime configuration.

---

## Quick Commands

```bash
# Run local development server
npm run dev

# Compile production build
npm run build

# Run ESLint validation
npm run lint

# Synchronize web assets with native Android project
npm run cap:sync

# Open Android project in Android Studio
npm run cap:open
```

For complete system setup, database provisioning, and deployment instructions, refer to the [Root README.md](../README.md).
