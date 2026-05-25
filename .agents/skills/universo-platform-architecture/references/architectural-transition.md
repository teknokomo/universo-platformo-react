# Architectural Transition Status

This reference describes the platform's current architectural transition,
its current target state, and the practical rules for development during
the transition. Use it whenever a task touches metahubs, applications,
admin, profile, start, or the relationship between feature packages and
the published-application surface.

## Current State (transitional)

The platform currently keeps several feature areas as **separate
workspace packages**, each with its own backend and frontend:

- `metahubs-backend` / `metahubs-frontend` — metahub authoring
- `applications-backend` / `applications-frontend` — applications list and management
- `admin-backend` / `admin-frontend` — platform administration
- `profile-backend` / `profile-frontend` — user profile
- `start-backend` / `start-frontend` — onboarding and start flows
- `auth-backend` / `auth-frontend` — authentication

Most of these packages render their UI via `packages/universo-react-template-mui`,
the original MUI template that the platform has been built on top of for a
long time.

In parallel, a new template package — `packages/universo-react-apps-template-mui` — is
being grown to render **published applications**. It shares the same MUI
foundation but is being built as the **runtime surface for any
application**, including the future versions of metahubs, admin, profile,
etc., once they become applications themselves.

## Target State

The long-term goal is to make **everything an Application**, including
metahubs:

1. The current metahub authoring surface gets a runtime "self-image": a
   metahub that models all of metahub's own sections (entity types,
   layouts, scripts, settings, publications, snapshots, etc.).
2. That self-image is published through `apps-template-mui` as a regular
   application — the **Metahubs application**.
3. The same is repeated for admin, profile, start, and other current
   feature packages: each becomes an application.
4. Once the new applications cover the existing functionality, the legacy
   feature packages (`metahubs-*`, `applications-*`, `admin-*`,
   `profile-*`, `start-*`, etc.) are **removed** from the workspace.
5. The platform ends up as a small core (auth, runtime, schema-ddl,
   migrations, types, utils) plus a set of applications shipped as file
   configurations.

## Pseudo-App Pattern (current bootstrap)

While the metahub authoring surface cannot yet model itself, the platform
uses a manual bootstrap pattern called the **pseudo-app pattern**:

1. A base snapshot is hand-built as if it had been exported from a real
   metahub (one such snapshot per current feature area).
2. From that snapshot the platform generates **file migrations** for the
   corresponding system application.
3. On first launch the platform runs those migrations to install the
   system applications.

The pseudo-app implementations were created some time ago. Parts of their
architecture may be outdated. The likely future direction is to replace
the hand-built pseudo-app code with **JSON configuration files** in the
same shape as the product Playwright snapshots
(`tools/fixtures/metahubs-*-snapshot.json`).

Treat the pseudo-app code as transitional. Do not invest in deepening it
beyond what is needed for the current task; prefer JSON-snapshot-shaped
output where reasonable.

## First-Run Setup Wizard (planned)

The future first launch of the platform will show a **Setup Wizard**:

- The user sees the list of system applications that are required (or
  recommended) for basic platform functioning, for example "Applications
  list", "Metahubs", "Admin".
- The user can choose which additional applications to install.
- Installable applications come from two sources:
  - the platform's bundled set of file configurations,
  - the **central marketplace** (planned).
- After the wizard finishes, the platform installs the chosen
  applications and proceeds to the normal runtime.

The Setup Wizard is **planned**, not yet implemented. Briefs and plans
that touch first-run flows must keep the wizard in mind so the work does
not foreclose this design.

## Practical Rules During The Transition

Do not block on the architectural transition completing. The transition
is iterative and partial. The following rules apply right now:

- **Continue to develop in the existing legacy packages** when the work
  fits there. Adding features, fixing bugs, and improving UX inside
  `metahubs-frontend`, `applications-backend`, `admin-frontend`, etc.
  is normal and expected.
- **Create new workspace packages** when significant new functionality
  warrants its own boundary. The legacy/transitional state does not
  freeze the workspace.
- **Do not propose blanket rewrites** of legacy packages "to get on the
  apps-template path early". The migration of each feature area to an
  application happens deliberately, not as an opportunistic refactor.
- **Do not assume legacy packages will live forever.** New investment in
  a legacy package should be scoped to the value it delivers now; deep
  redesign of legacy code is rarely a good ROI when the area is
  scheduled to be replaced by an application.
- **Use `apps-template-mui` for every new published-application
  surface.** Keep it isolated (see the dedicated rule in
  `mui-runtime-ux-patterns`).

## Decision Hints

When in doubt about where to put work:

- **Authoring UI / configuration / metadata editing** → today this lives
  in `metahubs-*` and similar legacy packages. Continue there.
- **Runtime UI inside a published application** → use
  `apps-template-mui`.
- **Backend domain logic that supports both surfaces** → put it in the
  domain backend package (`metahubs-backend` etc.) until that area is
  migrated to an application.
- **New cross-cutting backend capability** → consider a new workspace
  package under `packages/`.
- **Anything related to first-run install** → keep the Setup Wizard's
  needs in mind, even if the wizard itself is not the current task.
