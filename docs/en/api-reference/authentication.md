---
description: Explain how authentication affects API requests.
---

# Authentication

Most non-public API routes require an authenticated session.

## Current Contract

- Backend session handling is implemented with Passport.js.
- Supabase identity is used as the backing auth system.
- CSRF protection is expected for state-changing requests.
- 401 and 419 responses have specific frontend handling behavior.

## Practical Guidance

If you are integrating against a running instance, assume that protected routes
need both session-aware auth and correct CSRF handling rather than only a raw
Bearer-token flow.
