# User Profile MVP Plan

This document outlines the steps to add a basic user profile section.

## Goals
- Create a new front-end app `profile-frt` in `apps/`.
- Provide a simple page to update email and password in Supabase.
- Add API endpoints on the server for updating the current user.
- Integrate the page into the main UI and localization system.

## Implementation Steps
1. **Server**
   - Extend `packages/server/src/controllers/up-auth/auth.ts` with
     `updateUserEmail` and `updateUserPassword` functions using Supabase
     `updateUser`.
   - Add routes `/api/v1/auth/email` and `/api/v1/auth/password` protected by
     `ensureAuth` middleware in `routes/up-auth/index.ts`.
2. **Front-End App**
   - Scaffold `apps/profile-frt/base` with TypeScript config and gulpfile.
   - Implement `src/pages/Profile.jsx` containing forms to change email and
     password. Use MUI components and `useAuth` context for current user.
   - Provide internationalization files in `src/i18n` (EN and RU).
   - Export `ProfilePage` from `src/index.ts`.
3. **Main UI Integration**
   - Register alias `@apps/profile-frt` in `packages/ui/vite.config.js`.
   - Import translations and add `/profile` route in
     `packages/ui/src/routes/MainRoutes.jsx` with `AuthGuard`.
   - Merge translations in `packages/ui/src/i18n/index.js`.
4. **Documentation & Tasks**
   - Record this plan in `memory-bank/stages` for future reference.

