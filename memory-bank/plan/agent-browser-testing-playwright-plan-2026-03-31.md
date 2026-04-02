# Agent Browser Testing Modernization Plan

> **Date**: 2026-03-31  
> **Mode**: PLAN  
> **Status**: DRAFT - pending user review  
> **Complexity**: Level 4 (Major/Complex)  
> **Primary Goal**: give AI agents a reliable "browser truth" loop with automated end-to-end validation, targeted visual verification, deterministic test data, and safe cleanup.

---

## 1. Overview

The repository already has strong unit and integration coverage through shared `Vitest` and `Jest` tooling, but it does not yet have a real browser-level testing system that can catch layout drift, broken dialogs, invalid save flows, routing regressions, session issues, or visual problems that only appear in a real browser.

The target state is a layered testing system:

1. **Unit and integration tests remain in place** for fast local verification.
2. **Playwright Test becomes the primary browser automation runner** for deterministic smoke, flow, and visual suites.
3. **Playwright CLI becomes the default agent-facing browser interaction layer** for token-efficient ad hoc checks.
4. **Playwright MCP becomes a secondary debugging tool** for exploratory inspection and complex interactive diagnosis.
5. **Supabase test lifecycle is formalized** with isolated test users, run-scoped data, and server-side cleanup.

This plan intentionally does **not** replace the existing `Vitest` / `Jest` stack. It adds the missing browser truth layer on top of it.

---

## 2. Strategic Decisions

### 2.1 Primary Browser Stack

**Decision**: use **Playwright** as the primary browser testing framework.

**Why this is the correct default here:**

- The current `Cypress` footprint is only a scaffold and is not integrated into the repository workflow.
- Playwright gives one integrated stack for:
  - browser automation,
  - traces,
  - screenshots,
  - video on failure,
  - storage state reuse,
  - setup project dependencies,
  - HTML reporting,
  - CI-friendly execution.
- Playwright is a better fit for a mixed human + AI-agent workflow than rebuilding a real `Cypress` foundation from scratch.

### 2.2 Playwright Test vs CLI vs MCP

**Decision**:

- **Playwright Test** = canonical automated suite runner.
- **Playwright CLI** = default agent tool for day-to-day browser checks.
- **Playwright MCP** = targeted interactive debugger, not the main regression engine.

**Rationale:**

- `Playwright Test` gives repeatable suites, artifacts, reports, retries, and visual assertions.
- `Playwright CLI` is explicitly positioned by Microsoft as a better fit for coding agents because it is more token-efficient than MCP-heavy workflows.
- `Playwright MCP` works primarily from accessibility snapshots rather than pixel-perfect vision. That is excellent for structured interaction and debugging, but insufficient as the only defense against visual drift.

### 2.3 Environment Separation

**Decision**: do **not** use the existing tracked runtime `.env` as the source of truth for browser autotests.

**Recommended naming pattern:**

- committed examples:
  - `packages/universo-core-backend/base/.env.e2e.example`
  - `packages/universo-core-frontend/base/.env.e2e.example`
- ignored local secrets:
  - `packages/universo-core-backend/base/.env.e2e.local`
  - `packages/universo-core-frontend/base/.env.e2e.local`

**Why `.env.e2e.local` and not `.env.autotest`:**

- `.env.e2e.local` is closer to the common ecosystem vocabulary and communicates purpose immediately.
- `.local` clearly marks secrets as machine-local and non-committable.

### 2.4 Supabase Target

**Default short-term target**: `UP-test`, because repository rules explicitly say to use that project by default unless the user says otherwise.

**Preferred medium-term target**: a dedicated E2E Supabase branch or project.

**Safety rule**:

- Browser E2E must never assume production-like shared state.
- If `UP-test` remains the target, all E2E data must be run-scoped and cleanup must be mandatory.

---

## 3. Current Repository Constraints

The plan must respect the following repository realities:

1. `pnpm dev` must **not** be automatically run by agents.
2. Reliable full validation currently expects **root `pnpm build`** before runtime verification.
3. `pnpm start` runs the built backend/frontend composition, which matches the user's requested workflow.
4. Backend env loading is currently hardcoded to `packages/universo-core-backend/base/.env`.
5. Frontend Vite config currently calls `dotenv.config()` without a first-class E2E env-selection contract.
6. Nested `.env.e2e.local` files are **not currently ignored by git**, so adding the new env convention requires explicit `.gitignore` work.
7. Authentication uses **session + CSRF + Supabase identity**, so E2E login must handle browser cookies and CSRF correctly.

---

## 4. Affected Areas

### 4.1 Root-Level

- `.gitignore`
- `package.json`
- workspace devDependencies

### 4.2 New Testing Infrastructure

- `tools/testing/e2e/README.md`
- `tools/testing/e2e/playwright.config.ts`
- `tools/testing/e2e/fixtures/*`
- `tools/testing/e2e/support/*`
- `tools/testing/e2e/specs/smoke/*`
- `tools/testing/e2e/specs/flows/*`
- `tools/testing/e2e/specs/visual/*`

### 4.3 Backend Runtime

- backend env loading and CLI env loading
- E2E test provisioning / cleanup boundary
- optional E2E support utilities

### 4.4 Frontend Runtime

- Vite env selection for E2E builds
- stable accessible selectors and targeted `data-testid` additions where required

### 4.5 Documentation and Agent Workflow

- repository testing README additions
- optional repo-local agent skills or skill wrappers
- explicit agent rules for browser validation

---

## 5. Proposed Repository Structure

```text
tools/testing/e2e/
├── README.md
├── playwright.config.ts
├── fixtures/
│   ├── auth.ts
│   ├── runContext.ts
│   └── testUsers.ts
├── support/
│   ├── env/
│   │   └── loadE2eEnv.ts
│   ├── backend/
│   │   ├── e2eProvisioning.ts
│   │   ├── e2eCleanup.ts
│   │   └── runManifest.ts
│   ├── selectors/
│   │   └── contracts.ts
│   └── visual/
│       └── masks.ts
├── specs/
│   ├── setup/
│   │   └── auth.setup.ts
│   ├── smoke/
│   │   ├── app-start.spec.ts
│   │   ├── auth-login.spec.ts
│   │   └── logout.spec.ts
│   ├── flows/
│   │   ├── metahub-create.spec.ts
│   │   ├── metahub-settings.spec.ts
│   │   ├── application-open.spec.ts
│   │   └── profile-update.spec.ts
│   └── visual/
│       ├── auth-page.visual.spec.ts
│       ├── dashboard.visual.spec.ts
│       └── settings-dialog.visual.spec.ts
└── .auth/                     # ignored
```

This structure keeps E2E centralized in the same spirit as the existing shared testing utilities under `tools/testing`.

---

## 6. Detailed Plan Steps

## Phase 0 - Formalize the decision surface

- [ ] Confirm that **Playwright** is the canonical E2E tool and `Cypress` will not be expanded.
- [ ] Confirm that the first implementation target is **`pnpm start`**, not `pnpm dev`.
- [ ] Confirm that initial automated browser tests will target **`UP-test`** unless the user later approves a dedicated E2E Supabase branch/project.
- [ ] Confirm that `memory-bank` remains English-only, while user-facing explanations remain Russian-only.

**Deliverable**: one approved testing direction with no ambiguity about tool ownership.

---

## Phase 1 - Create a safe multi-environment contract

### Problem

The repository currently hardcodes backend env loading to `.env`, and frontend Vite config does not expose a first-class E2E env-selection contract.

### Goal

Introduce a deterministic and safe env selection mechanism that supports:

- default runtime env,
- E2E runtime env,
- future CI env,
- future local isolated Supabase env.

### Steps

- [ ] Add ignored patterns:
  - `**/.env.e2e.local`
  - `**/.env.e2e`
  - `tools/testing/e2e/.auth`
  - `playwright-report`
  - `test-results`
- [ ] Add committed example files:
  - `packages/universo-core-backend/base/.env.e2e.example`
  - `packages/universo-core-frontend/base/.env.e2e.example`
- [ ] Add a shared backend env loader that supports:
  - `UNIVERSO_ENV_FILE`
  - optional `UNIVERSO_ENV_TARGET=e2e`
  - fallback to current `.env`
- [ ] Update both backend bootstrap and backend CLI command base to use the same env loader.
- [ ] Update Vite config to support selecting `.env.e2e.local` explicitly instead of using generic `dotenv.config()` only.
- [ ] Document that the agent must never read secrets from tracked `.env` as the E2E contract.

### Safe backend env-loader example

```ts
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

const backendRoot = path.resolve(__dirname, '..', '..')

function resolveBackendEnvPath(): string {
  const explicit = process.env.UNIVERSO_ENV_FILE?.trim()
  if (explicit) {
    return path.isAbsolute(explicit) ? explicit : path.join(backendRoot, explicit)
  }

  const target = process.env.UNIVERSO_ENV_TARGET?.trim()
  if (target === 'e2e') {
    return path.join(backendRoot, '.env.e2e.local')
  }

  return path.join(backendRoot, '.env')
}

export function loadBackendEnv(): string {
  const envPath = resolveBackendEnvPath()
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true })
  }
  return envPath
}
```

### Safety rules

- `SERVICE_ROLE_KEY` must remain server-side only.
- The browser, Playwright page context, screenshots, and traces must never receive the raw service key.
- `storageState` files are secrets and must be gitignored.

**Deliverable**: a real E2E env boundary, not a naming convention without runtime support.

---

## Phase 2 - Build a deterministic test data lifecycle

### Problem

Browser tests are unreliable if they depend on uncontrolled shared data or leave residue after failures.

### Goal

Create a run-scoped data model so that every automated browser run can:

1. provision what it needs,
2. reuse a deterministic login flow,
3. clean up safely,
4. rerun without manual database surgery.

### Core model

Each run gets a unique `runId`, for example:

```text
e2e-20260331-153012-4f2a
```

That `runId` is used in:

- test emails,
- names,
- slugs,
- titles,
- metadata,
- cleanup manifests.

### Steps

- [ ] Define a typed `E2eRunManifest` stored on disk in ignored local artifacts.
- [ ] Create a Node-only provisioning layer under `tools/testing/e2e/support/backend`.
- [ ] Provision one dedicated admin-capable test user for browser login.
- [ ] Create run-scoped domain data only through trusted server-side code.
- [ ] Delete test users through `supabase.auth.admin.deleteUser(...)` on teardown.
- [ ] Delete test data through trusted server-side executors and existing stores or dedicated cleanup SQL.
- [ ] Make cleanup idempotent so reruns can recover from half-failed previous runs.

### Safe user provisioning example

```ts
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export async function createE2eAuthUser() {
  const runId = crypto.randomUUID()
  const email = `e2e-admin+${runId}@example.test`

  const admin = createClient(process.env.SUPABASE_URL!, process.env.SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: process.env.E2E_ADMIN_PASSWORD!,
    email_confirm: true
  })

  if (error) throw error
  return { runId, userId: data.user.id, email }
}
```

### Important repository-specific rule

For database cleanup, prefer **trusted server-side Node code** using the repository's SQL-first runtime and executor boundaries rather than browser-originated cleanup logic.

### Short-term vs medium-term strategy

**Short-term**:

- Use `UP-test`.
- Use run-scoped entities and strict cleanup.

**Medium-term**:

- Move to dedicated Supabase E2E branch/project or a local Supabase CLI stack for stronger isolation.

**Deliverable**: deterministic data lifecycle with no manual cleanup requirement after ordinary failures.

---

## Phase 3 - Add Playwright Test foundation

### Goal

Create the canonical browser regression engine.

### Steps

- [ ] Add root devDependency: `@playwright/test`.
- [ ] Create `tools/testing/e2e/playwright.config.ts`.
- [ ] Create a setup project that performs one real browser login and saves `storageState`.
- [ ] Configure browser artifacts conservatively:
  - `trace: 'on-first-retry'`
  - `screenshot: 'only-on-failure'`
  - `video: 'retain-on-failure'`
- [ ] Use `webServer` to start the built app through `pnpm start`.
- [ ] Use `baseURL` and a real readiness endpoint.
- [ ] Configure at least:
  - `setup`
  - `chromium-smoke`
  - `chromium-visual`
- [ ] Add HTML + list reporters.

### Recommended Playwright config example

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './specs',
  timeout: 45_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: 'pnpm start',
    url: 'http://127.0.0.1:3000/api/v1/ping',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      UNIVERSO_ENV_TARGET: 'e2e'
    }
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\\.setup\\.ts/
    },
    {
      name: 'chromium-smoke',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tools/testing/e2e/.auth/admin.json'
      },
      dependencies: ['setup']
    }
  ]
})
```

### Performance and reliability rules

- Do not enable `trace: 'on'` globally.
- Do not default to serial mode.
- Keep tests isolated whenever possible.
- Use `test.describe.configure({ mode: 'serial' })` only for rare truly stateful flows.

**Deliverable**: one standard browser suite runner with deterministic startup and artifacts.

---

## Phase 4 - Create a stable selector contract

### Problem

Browser automation becomes fragile if it depends on CSS selectors or translated text only.

### Goal

Adopt a selector policy that stays stable across layout refactors and i18n changes.

### Rules

1. Prefer **accessible locators**:
   - `getByRole`
   - `getByLabel`
   - `getByPlaceholder`
2. Add `data-testid` only where accessible contracts are ambiguous or unstable.
3. Use a naming pattern that maps to business meaning, not implementation detail.

### Recommended naming pattern

```text
auth-login-submit
metahub-create-button
metahub-settings-tab
entity-form-save-button
profile-display-name-input
```

### Steps

- [ ] Audit current high-value screens for selector readiness.
- [ ] Add missing `aria-label`, `role`, and `data-testid` only where necessary.
- [ ] Document a selector policy in `tools/testing/e2e/README.md`.
- [ ] Reject CSS-path selectors in code review unless absolutely unavoidable.

### Good E2E assertion example

```ts
await page.getByRole('button', { name: /save/i }).click()
await expect(page.getByRole('alert')).toContainText(/saved/i)
```

### Avoid

```ts
await page.locator('.MuiButton-root:nth-child(3)').click()
```

**Deliverable**: resilient selectors that survive UI refactors better than DOM-shape selectors.

---

## Phase 5 - Implement the first scenario matrix

### Goal

Cover the highest-value browser truths first, not the entire platform at once.

### Wave 1 - Smoke

- [ ] App boots successfully through `pnpm start`.
- [ ] Login page renders without fatal browser errors.
- [ ] Admin E2E user can log in through the real browser form.
- [ ] Post-login landing page loads.
- [ ] Logout works and returns to auth route.

### Wave 2 - Core flows

- [ ] Create a metahub.
- [ ] Open metahub settings dialog and save changes.
- [ ] Create a hub/catalog/set or equivalent minimal entity chain.
- [ ] Create one application or open an existing runtime surface.
- [ ] Update profile information and verify persistence.

### Wave 3 - Regression hotspots

- [ ] Reopen settings dialogs after save.
- [ ] Validate button enabled/disabled states for create/edit flows.
- [ ] Validate branch refresh / page refresh behavior on critical routes.
- [ ] Validate a representative flow that crosses authentication, routing, and save confirmation.

### Example setup project for auth reuse

```ts
import { test, expect } from '@playwright/test'

test('authenticate admin user', async ({ page, context }) => {
  await page.goto('/auth')
  await page.getByLabel(/email/i).fill(process.env.E2E_ADMIN_EMAIL!)
  await page.getByLabel(/password/i).fill(process.env.E2E_ADMIN_PASSWORD!)
  await page.getByRole('button', { name: /log in|sign in/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'))
  await expect(page).not.toHaveURL(/\/auth/)
  await context.storageState({ path: 'tools/testing/e2e/.auth/admin.json' })
})
```

**Deliverable**: a small but real browser suite that catches high-value breakage early.

---

## Phase 6 - Add a dedicated visual verification layer

### Goal

Catch real layout drift without turning the whole E2E suite into a slow and flaky screenshot pipeline.

### Rules

1. Use **visual assertions only on deterministic surfaces**.
2. Prefer **locator screenshots** over full-page screenshots when possible.
3. Mask dynamic areas and disable animations.
4. Keep visual baselines reviewable by humans.
5. Never auto-update baselines inside the normal agent self-healing loop.

### Steps

- [ ] Create a `visual/` spec group separate from smoke/flow specs.
- [ ] Pick 3-5 high-value stable screens first:
  - auth page,
  - dashboard shell,
  - entity settings dialog,
  - one list/table surface,
  - one form surface.
- [ ] Disable animations in screenshot assertions.
- [ ] Mask timestamps, generated IDs, or dynamic counters where needed.
- [ ] Pin browser/project choice for visual runs to reduce environmental drift.

### Good visual assertion example

```ts
await expect(page.getByRole('dialog', { name: /settings/i })).toHaveScreenshot('entity-settings-dialog.png', {
  animations: 'disabled',
  caret: 'hide'
})
```

### Important safety note

Visual regression checks should not be the only proof of correctness. They complement, not replace, behavioral assertions.

**Deliverable**: targeted visual truth without full-suite visual bloat.

---

## Phase 7 - Add agent-first workflows

### Goal

Make the system practical for AI-agent loops instead of only human CI pipelines.

### Default agent execution order

1. targeted unit/integration tests for the changed area,
2. root `pnpm build`,
3. targeted Playwright smoke flow,
4. inspect failure artifacts,
5. fix,
6. rerun targeted suite,
7. optional visual suite,
8. cleanup.

### Recommended root scripts

- [ ] `test:e2e:smoke`
- [ ] `test:e2e:flows`
- [ ] `test:e2e:visual`
- [ ] `test:e2e:full`
- [ ] `test:e2e:cleanup`
- [ ] `test:e2e:agent`

### Example script contract

```json
{
  "scripts": {
    "test:e2e:smoke": "pnpm exec playwright test -c tools/testing/e2e/playwright.config.ts --grep @smoke",
    "test:e2e:visual": "pnpm exec playwright test -c tools/testing/e2e/playwright.config.ts --grep @visual",
    "test:e2e:full": "pnpm run test:e2e:smoke && pnpm run test:e2e:visual",
    "test:e2e:cleanup": "node ./tools/testing/e2e/support/backend/e2eCleanup.js"
  }
}
```

### Agent decision rules

- Use **Playwright Test** for repeatable regression checking.
- Use **Playwright CLI** for quick ad hoc browser probes and token-efficient interaction.
- Use **Playwright MCP** when the agent needs iterative structured inspection of the live page.
- Do not default to MCP for every run.
- Do not default to visual snapshots for every behavioral test.

**Deliverable**: a browser QA loop that agents can run repeatedly without excessive token cost.

---

## Phase 8 - Add explicit failure triage workflow

### Goal

Make failed runs actionable instead of merely red.

### Steps

- [ ] Standardize where artifacts go:
  - HTML report,
  - traces,
  - screenshots,
  - videos,
  - run manifest,
  - cleanup manifest.
- [ ] Add a README section explaining:
  - how to open the HTML report,
  - how to inspect traces,
  - how to rerun a single failed spec,
  - when to use CLI vs MCP.
- [ ] Make targeted rerun commands obvious.

### Failure triage sequence

1. inspect Playwright HTML report,
2. open trace for the failed test,
3. inspect failure screenshot,
4. if the cause is still unclear, run a focused Playwright CLI or MCP session against the same route,
5. patch,
6. rerun only the affected spec first.

**Deliverable**: reliable debugging ergonomics for both humans and agents.

---

## Phase 9 - Add CI and local modes

### Goal

Support both:

- local agent/human development,
- future CI verification.

### Local mode

- `reuseExistingServer: true`
- open reports locally
- faster retries

### CI mode

- isolated server start
- fixed worker count
- artifact upload
- visual suite possibly split into a separate job

### Steps

- [ ] Define local/CI behavior inside `playwright.config.ts`.
- [ ] Keep CI initially on `chromium` only.
- [ ] Add optional future matrix for Firefox/WebKit after the first stable wave.

**Deliverable**: one config that works locally and can graduate into CI.

---

## Phase 10 - Add optional Supabase CLI and pgTAP hardening

### Goal

Strengthen database and RLS confidence beyond browser flows.

### Why this is optional in the first implementation

- The repository does not currently have a first-class local Supabase CLI layout.
- Browser truth is the most urgent gap.
- RLS and DB-policy hardening can be added in the second wave.

### Recommended second-wave work

- [ ] Introduce a local `supabase/` directory if approved.
- [ ] Add `supabase start` support for isolated local DB testing.
- [ ] Add `supabase db reset` for fully clean local DB cycles.
- [ ] Add `supabase test db` with pgTAP for critical RLS contracts.
- [ ] Keep browser E2E and DB-policy tests as separate layers.

**Deliverable**: optional future local Supabase isolation with first-class DB-policy testing.

---

## 7. Potential Challenges and Mitigations

### Challenge 1 - Hardcoded env loading

**Risk**: `.env.e2e.local` exists but runtime never loads it.  
**Mitigation**: env loader work is Phase 1, not an afterthought.

### Challenge 2 - Shared `UP-test` contamination

**Risk**: previous runs pollute new runs.  
**Mitigation**: run-scoped naming + mandatory teardown + idempotent cleanup.

### Challenge 3 - Session and CSRF handling

**Risk**: browser login fails intermittently if setup ignores CSRF/session behavior.  
**Mitigation**: authenticate through the real browser flow once, then reuse `storageState`.

### Challenge 4 - Visual flakiness

**Risk**: full-page screenshots become noisy.  
**Mitigation**: use stable pages only, locator screenshots, masking, fixed browser target, disabled animations.

### Challenge 5 - Expensive validation loop

**Risk**: running full E2E after every tiny change slows development too much.  
**Mitigation**: introduce smoke/flows/visual tiers and agent-first targeted reruns.

### Challenge 6 - Weak selectors

**Risk**: tests break because locators depend on DOM shape or translated text only.  
**Mitigation**: define a selector contract and add targeted `data-testid` attributes where accessibility contracts are insufficient.

### Challenge 7 - Security leakage through artifacts

**Risk**: storage state or traces may expose secrets.  
**Mitigation**:

- gitignore all auth state,
- never store service-role material in browser flows,
- keep reports local/CI-private,
- sanitize any explicitly attached debug payloads.

---

## 8. Design Notes

This work does not require a classic visual UI design phase. The "design" work is architectural:

1. env topology,
2. agent workflow topology,
3. selector contract,
4. data lifecycle contract,
5. artifact and cleanup contract.

If a later phase introduces a dedicated internal QA dashboard, report viewer UI, or browser-test management UI, that should go through a separate `CREATIVE` / design phase.

---

## 9. Dependencies and Coordination

### Cross-module dependencies

- backend env loading,
- frontend Vite env loading,
- root scripts and devDependencies,
- frontend selector hygiene,
- Supabase admin/test data boundary,
- optional CI pipeline changes.

### External dependencies

- `@playwright/test`
- optional `playwright-cli`
- optional `@playwright/mcp`
- current Supabase project policy

### Coordination note

If the user later approves a dedicated Supabase E2E project or branch, the cleanup and isolation model becomes significantly safer and simpler.

---

## 10. Proposed Agent Rules

These rules should be documented for future implementation and workflow automation:

1. Do not auto-run `pnpm dev`.
2. Default browser validation should target `pnpm start`.
3. Always prefer targeted smoke reruns before full-suite reruns.
4. Never auto-update visual baselines without explicit approval.
5. Never expose `SERVICE_ROLE_KEY` to the browser context.
6. Never commit `.auth`, `storageState`, `playwright-report`, or `test-results`.
7. Use Playwright CLI for cheap exploratory checks; use MCP when deep page introspection is necessary.
8. Prefer `getByRole` / `getByLabel` selectors before adding `data-testid`.
9. Cleanup must run even after failed browser suites.
10. Browser E2E does not replace `Vitest` / `Jest`; both layers remain mandatory.

---

## 11. Suggested Skill Strategy

### Current state

The current Codex session does **not** expose a dedicated Playwright skill in the local skill list.

### Recommendation

Add a repo-local future skill after the first working E2E foundation exists.

### Proposed future skills

#### `playwright-e2e`

Purpose:

- run smoke/flow/visual suites,
- open HTML report,
- explain traces,
- enforce local repo conventions.

Suggested skill contract:

```text
1. Run the smallest relevant browser suite first.
2. If a test fails, inspect HTML report and trace before re-running.
3. Use Playwright CLI for quick route-specific checks.
4. Use Playwright MCP only when structured inspection is needed.
5. Always run cleanup after provisioning test data.
```

#### `supabase-e2e-cleanup`

Purpose:

- create run-scoped users,
- seed deterministic test data,
- clean users and DB data safely.

These should be implemented only after the first E2E backbone exists and proves stable enough to justify local skill abstraction.

---

## 12. Acceptance Criteria

The first implementation wave is complete when all of the following are true:

- [ ] `pnpm start` can be used as the automated browser runtime for Playwright.
- [ ] A dedicated E2E env path exists and is actually loaded by runtime code.
- [ ] One setup-project login flow saves reusable `storageState`.
- [ ] At least 3 smoke tests run reliably on Chromium.
- [ ] At least 2 real save/edit flows are covered.
- [ ] At least 2 visual assertions exist on stable surfaces.
- [ ] Test users and run-scoped data are cleaned automatically.
- [ ] `storageState` and reports are gitignored.
- [ ] A short E2E README explains local usage, artifacts, and cleanup.
- [ ] Agent guidance exists for when to use Playwright Test vs CLI vs MCP.

---

## 13. Recommended Implementation Order

1. **Phase 1** - env contract and gitignore safety
2. **Phase 2** - provisioning/cleanup lifecycle
3. **Phase 3** - Playwright config and setup project
4. **Phase 4** - selector contract
5. **Phase 5** - smoke scenarios
6. **Phase 6** - visual layer
7. **Phase 7** - agent scripts and workflow docs
8. **Phase 8** - failure triage UX
9. **Phase 9** - CI mode
10. **Phase 10** - optional Supabase CLI / pgTAP hardening

This order is important: without the env boundary and cleanup lifecycle, the browser suite will become fragile and unsafe very quickly.

---

## 14. Final Recommendation

The correct target architecture for this repository is:

- **Playwright Test** as the authoritative automated browser suite,
- **Playwright CLI** as the default low-token agent interaction layer,
- **Playwright MCP** as the secondary interactive debugger,
- **run-scoped Supabase test data with strict cleanup**,
- **a dedicated `.env.e2e.local` contract with real runtime support**,
- **browser validation layered on top of existing `Vitest` / `Jest` tooling, not instead of it**.

This gives the project a practical path to browser truth without turning the testing stack into an expensive or unsafe system.
