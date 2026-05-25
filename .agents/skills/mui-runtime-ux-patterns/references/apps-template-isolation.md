# apps-template-mui Isolation

This reference covers the dependency boundary between
`packages/universo-react-apps-template-mui` and the legacy template/feature packages.
Use it when work touches `apps-template-mui`, when adding new components
to it, or when reviewing a proposal to share code between
`apps-template-mui` and `universo-template-mui`.

## Rule

`packages/universo-react-apps-template-mui` must stay **isolated** from the legacy
template package and from feature packages that are scheduled for
removal during the architectural transition.

Concretely:

- `apps-template-mui` MUST NOT depend on `packages/universo-react-template-mui`.
- `apps-template-mui` MUST NOT depend on `metahubs-frontend`,
  `applications-frontend`, `admin-frontend`, `profile-frontend`,
  `start-frontend`, or any other workspace package planned for removal
  once the corresponding functionality migrates into an application.
- `apps-template-mui` MAY depend on shared **non-UI** workspace packages
  that survive the transition (for example `@universo-react/types`,
  `@universo-react/utils`, `@universo-react/i18n`, `@universo-react/api-client`).
- Within `apps-template-mui`, components and utilities follow the usual
  monorepo conventions and stay self-contained.

## Why

The architectural transition aims to make every feature an Application
rendered through `apps-template-mui`, then remove the legacy packages
(see `.agents/skills/universo-platform-architecture/references/architectural-transition.md`).
If `apps-template-mui` reaches into the legacy template or feature
packages, removing them later either breaks the runtime or forces a
risky last-minute extraction.

Keeping `apps-template-mui` isolated:

- makes the eventual removal of legacy packages a clean cut;
- lets the published-application surface evolve at its own pace;
- avoids accidentally tying runtime behavior to authoring-time
  conventions that should not survive the transition.

## Component Duplication Is Acceptable — But Only Across The Isolation Boundary

During the transition, **duplicating components** between the legacy
packages and `apps-template-mui` is normal and intentional. Examples:

- A `FormDialog` that exists in both `universo-template-mui` and
  `apps-template-mui` with similar API but separate implementations.
- A `ToolbarControls` or `ItemCard` that has its own copy in
  `apps-template-mui`.
- Localized strings or theme tokens that are kept in step manually
  rather than imported.

This duplication is a deliberate trade-off:

- "DRY" within `apps-template-mui` is still required — do not copy the
  same component or utility multiple times **inside** the new template.
  Apply the usual best practices for the project's stack
  (TypeScript/React/MUI): extract shared primitives, lift common logic
  into hooks or utilities, keep one source of truth per concern.
- "DRY" across the boundary between `apps-template-mui` and the legacy
  packages is **not** required at this stage; component duplication
  there is expected.
- "DRY" between the legacy packages themselves (for example, between
  `metahubs-frontend` and `universo-template-mui`, or between two
  legacy feature packages) continues to follow the usual best practices.
  The relaxation only applies across the `apps-template-mui` isolation
  boundary.
- When the legacy packages are removed, the `apps-template-mui`
  implementation becomes the canonical one without further work.

## When To Lift Code Into A Shared Package

If a piece of UI code is genuinely shared between `apps-template-mui`
and a package that **survives** the transition, lift it into a stable
shared package (for example `@universo-react/types` for type contracts, or a
new neutral UI utility package), not into `universo-template-mui`. The
shared package must not be on the deprecation path.

Doing this requires explicit justification in the brief or plan
because it expands the surface that must remain stable through the
transition.

## What Counts As A Violation

- Adding `"@universo-react/template-mui"` (or any equivalent name for the
  legacy template) to `packages/universo-react-apps-template-mui/package.json`
  dependencies.
- Adding `"@universo-react/metahubs-frontend"`, `"@universo-react/applications-frontend"`,
  `"@universo-react/admin-frontend"`, `"@universo-react/profile-frontend"`,
  `"@universo-react/start-frontend"`, or any similar deprecated package as a
  dependency.
- Importing from any of those packages via path or alias inside
  `apps-template-mui/src/`.
- Refactoring a duplicated component out of `apps-template-mui` into
  one of those packages "to avoid duplication".

## Origin Of `apps-template-mui`

`apps-template-mui` started from a stock MUI dashboard template that was
copied into the project with demo data. The demo data is being replaced
with real data and real workspace primitives over time, while the
original visual style is preserved. The historical reference for the
copied-in version is kept in the project author's local environment
(not in the repository); briefs may point to it indirectly when MANAGER
needs to.

## Quick Sanity Check

When reviewing a change to `apps-template-mui` or a proposal that
involves it:

1. Does it add a dependency on `universo-template-mui` or a feature
   package scheduled for removal? → Reject.
2. Does it import from such a package via alias or relative path? →
   Reject.
3. Does it propose to "share" a component by lifting it into one of
   those packages? → Reject; lift into a stable shared package or
   accept the duplication.
4. Otherwise: proceed with normal MUI runtime UX checks
   (`SKILL.md` and the other references in this folder).
