---
description: Database schema design and migration strategy.
---

# Database Design

{% hint style="info" %}
**This page is under development.** Detailed documentation will be added soon.
{% endhint %}

## Overview

Universo Platformo uses PostgreSQL (via Supabase) with TypeORM for schema management. Migrations are organized per-package and registered centrally.

## Key Concepts

* **Single PostgreSQL database** via Supabase
* **TypeORM entities and migrations** per package
* **Central migration registry** in `flowise-core-backend`
* **UUID v7** for primary keys (time-sortable)
* **Row Level Security (RLS)** for multi-tenant isolation

## Documentation

Coming soon.
