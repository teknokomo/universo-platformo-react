---
description: Set up your local development environment.
---

# Development Setup

{% hint style="info" %}
**This page is under development.** Detailed setup instructions will be added soon.
{% endhint %}

## Prerequisites

* Node.js >= 18.15.0
* pnpm >= 9
* PostgreSQL (via Supabase or local)
* Git

## Setup Steps

```bash
# Clone the repository
git clone https://github.com/teknokomo/universo-platformo-react.git
cd universo-platformo-react

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your database and service credentials

# Build all packages
pnpm build

# Start development servers
pnpm dev
```

## Documentation

Coming soon.
