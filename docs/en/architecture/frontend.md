---
description: Describe the frontend shell and feature-package composition.
---

# Frontend Architecture

The frontend is centered on `@universo/core-frontend`, which bootstraps the
React application and assembles feature packages into one routed web shell.

## Runtime Pattern

- React provides the UI runtime.
- Vite is used for frontend build and dev tooling.
- Redux, React Query, auth helpers, routing, and i18n are composed at startup.
- Feature packages provide domain-specific pages and UI flows.

## Current Domain Surface

The active public frontend includes authentication, onboarding, profile,
metahubs, applications, admin pages, shared templates, and API client usage.

The frontend shell is therefore a modular assembly point, not a single
hard-coded application layer.
