---
description: How to think about creating a new application in the current platform.
---

# Creating a New Application

In the current repository, creating an application usually involves application
metadata, memberships, publication links,
controlled schema behavior, and frontend or backend package integration.

## Recommended Approach

1. Decide whether the application needs only managed metadata or its own runtime schema.
2. Clarify how it relates to metahubs, publications, and memberships.
3. Add or extend backend routes and SQL-first persistence only where necessary.
4. Connect the frontend through the shared shell and API client packages.
5. Validate behavior with targeted tests and a root build.

Treat application creation as a platform design task with shared runtime implications.
