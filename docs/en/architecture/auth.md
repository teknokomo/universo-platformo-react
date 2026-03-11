---
description: Describe authentication, sessions, CSRF, and request-scoped RLS handling.
---

# Authentication and Authorization

The current auth model combines Passport.js session handling with Supabase
identity and request-scoped database context.

## Current Model

- Backend auth routes and middleware live in `@universo/auth-backend`.
- Frontend auth helpers and UI flows live in `@universo/auth-frontend`.
- Clients use session-aware requests and CSRF protection.
- Request-scoped RLS context is applied for protected database operations.

## Important Contracts

- Public routes are centrally defined in shared auth utilities.
- CSRF failures map to HTTP 419 and should retry only once when safe.
- 401 handling is coordinated with frontend redirect behavior.
- Membership and role checks remain explicit platform concerns.

This model supports multi-user business flows across shared platform modules.
