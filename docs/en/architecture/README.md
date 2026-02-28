---
description: Understand the system architecture and design decisions.
---

# Architecture

{% hint style="info" %}
**This section is under development.** Detailed architecture documentation will be added progressively.
{% endhint %}

## Overview

Universo Platformo is a monorepo built with **pnpm workspaces** and **Turborepo**. It extends the Flowise AI platform with multi-user capabilities, a custom application framework, and 3D/AR/VR content tools.

## Technology Stack

| Layer | Technology |
| --- | --- |
| **Runtime** | Node.js 18+ |
| **Package Manager** | pnpm 9+ with workspaces |
| **Build System** | Turborepo, tsdown, tsc, Vite |
| **Backend** | Express.js 4, TypeORM 0.3 |
| **Frontend** | React 18, TypeScript 5, Material UI 7 |
| **Database** | PostgreSQL (Supabase) |
| **Authentication** | Passport.js + Supabase Auth |
| **Real-time** | Colyseus WebSocket |

## Key Principles

* Minimal changes to the original Flowise codebase
* Feature isolation through independent packages
* TypeORM Repository pattern for all database access
* Shared runtime DDL logic in dedicated packages

## Learn More

* [Monorepo Structure](monorepo-structure.md) — how packages are organized
* [Backend Architecture](backend.md) — server-side design
* [Frontend Architecture](frontend.md) — client-side design
* [Database Design](database.md) — schema and migrations
* [Authentication & Authorization](auth.md) — security model
