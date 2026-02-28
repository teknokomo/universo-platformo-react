---
description: Server-side architecture and design patterns.
---

# Backend Architecture

{% hint style="info" %}
**This page is under development.** Detailed documentation will be added soon.
{% endhint %}

## Overview

The backend is built on Express.js with TypeORM for database access. Each feature module registers its routes, entities, and migrations through a centralized system in `flowise-core-backend`.

## Key Patterns

* **TypeORM Repository pattern** for all database operations
* **Rate limiting** per service with configurable budgets
* **RLS-aware** request managers for multi-tenant data isolation
* **Zod validation** for request body schemas

## Documentation

Coming soon.
