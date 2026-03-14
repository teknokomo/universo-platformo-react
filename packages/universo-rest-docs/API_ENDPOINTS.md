# Universo Platformo REST API Endpoint Guide

> Last Updated: 2026-03-14
> Base URL: `/api/v1`

## Overview

This package now publishes a generated current-state endpoint inventory.
The goal of this guide is to explain how the documented route families are organized and how to interpret the Swagger surface safely.

## Authentication Model

- Public endpoints can be called without a bearer token.
- Protected endpoints require a JWT bearer token.
- The runtime uses request-scoped authentication and PostgreSQL RLS for protected backend flows.
- Swagger authorization should be treated as a testing convenience, not as a production workflow.

## Public Route Families

| Route family | Mount path | Notes |
| --- | --- | --- |
| System | `/ping`, `/health/db` | Liveness and dependency health endpoints. |
| Auth | `/auth/*` | Session bootstrap, auth config, CSRF, register, login, logout. |
| Public Locales | `/locales/*` | Locale feeds used before authenticated bootstrap. |
| Public Metahub | `/public/metahub/*` | Public metahub read endpoints. |
| Profile nickname check | `/profile/check-nickname/:nickname` | Public validation route inside the profile family. |

## Protected Route Families

| Route family | Mount path | Notes |
| --- | --- | --- |
| Profile | `/profile/*` | Current-user profile and settings operations. |
| Onboarding | `/onboarding/*` | Authenticated start and onboarding flows. |
| Admin | `/admin/*` | Global users, instances, roles, locales, settings. |
| Applications | `/applications/*` | Application listing, details, runtime metadata. |
| Connectors | `/applications/:applicationId/connectors/*` and related routes | Connector CRUD and publication-link operations. |
| Application Runtime Sync | `/application/:applicationId/*` | Sync, diff, release-bundle export, release-bundle apply. |
| Metahubs | `/metahubs`, `/metahub/:metahubId/*`, `/templates/*` | Metahub and design-time domain operations. |

## Metahub Domain Breakdown

The metahub area currently includes route groups for:

- metahubs and members
- branches
- publications and publication applications
- metahub migrations
- application migrations inside the metahub domain
- hubs
- catalogs
- sets
- enumerations
- attributes
- constants
- elements
- layouts
- settings
- templates

## How To Use Swagger Safely

1. Start the docs server from this package.
2. Open `/api-docs` in the browser.
3. Set the target server URL that matches the backend you want to inspect.
4. Authorize with a bearer token only if you need protected endpoints.
5. Treat generated request and response bodies as exploration helpers unless a route is backed by a stronger explicit contract.

## Important Limitations

- The generated spec is authoritative for route existence, not for every payload field.
- Some handlers accept broader payloads than the generic schemas shown in Swagger.
- If route declarations move, the OpenAPI source must be regenerated before the docs are considered current.
- Removed domains should disappear from this guide and from Swagger as soon as the generator stops sourcing them.

## Related Files

- `scripts/generate-openapi-source.js`
- `src/openapi/index.yml`
- `dist/openapi-bundled.yml`
