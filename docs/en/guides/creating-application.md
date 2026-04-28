---
description: How to think about creating a new application in the current platform.
---

# Creating a New Application

In the current repository, creating an application usually involves application
metadata, memberships, publication links,
controlled schema behavior, and frontend or backend package integration.

![Application settings](../.gitbook/assets/quiz-tutorial/application-settings-general.png)

## Recommended Approach

1. Decide the structural application parameters first:
   whether workspaces are enabled, and the initial visibility (`closed` or `public`).
2. If the application is public, enable workspaces from the start so every participant gets isolated data.
3. Clarify how the application relates to metahubs, publications, memberships, and runtime schema sync.
4. Reuse the shared `General / Parameters` dialog pattern in admin UI instead of inventing a custom form flow.
5. When runtime schema is created from a publication, keep workspace support inside the same canonical snapshot lineage.
6. Add or extend backend routes and SQL-first persistence only where necessary.
7. Validate behavior with targeted tests and a root build.

Treat application creation as a platform design task with shared runtime implications.

Visibility can be changed later from Application Settings. Workspace mode remains structural because it affects runtime schema creation, workspace tables, row predicates, and snapshot lineage.
