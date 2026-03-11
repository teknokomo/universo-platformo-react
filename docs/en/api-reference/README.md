---
description: Overview of the current REST and OpenAPI documentation surface.
---

# API Reference

The public API surface in this repository is REST-oriented and documented through
modular route packages plus the `@universo/rest-docs` package.

## What This Section Covers

- The base URL and shape of the public API surface.
- How authentication affects API requests.
- The current status of webhook-style integrations.

## Important Scope Note

The exact route surface depends on which feature packages are mounted by the
current build, but the repository already exposes platform APIs for auth,
profiles, metahubs, publications, applications, admin flows, and related config.
