---
description: Describe the backend runtime and server-side package composition.
---

# Backend Architecture

The backend is centered on `@universo/core-backend`, which boots the Express
application, initializes the shared Knex runtime, runs platform migrations,
mounts service routers, and serves the frontend bundle.

## Runtime Pattern

- Express provides HTTP routing and middleware composition.
- Feature packages own routes, services, and SQL-first persistence helpers.
- `@universo/migrations-platform` validates and runs platform migrations.
- `@universo/database` provides the shared Knex singleton and executor factories.

## Current Domain Surface

The active public backend surface includes auth, onboarding, profiles,
metahubs, publications, applications, admin flows, and OpenAPI docs support.

This is a modular business backend for shared platform services.
