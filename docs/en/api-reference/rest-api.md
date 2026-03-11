---
description: Base REST API conventions for Universo Platformo React.
---

# REST API

## Base URL

```text
https://your-instance.example.com/api/v1
```

## Current API Shape

The current repository organizes API routes by platform module.

Typical route groups include auth, start, profile, metahubs, publications,
applications, admin, configuration, and generated OpenAPI endpoints.

## Documentation Source

The Swagger or OpenAPI presentation layer is provided by `@universo/rest-docs`.
That package aggregates modular route documentation into one published surface.
