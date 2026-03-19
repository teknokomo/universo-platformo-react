# Plan: Bootstrap Superuser On First Startup

> **Date**: 2026-03-19
> **Mode**: PLAN
> **Status**: DRAFT FOR DISCUSSION
> **Complexity**: Level 3 (Significant / cross-package backend bootstrap)
> **Scope**: core-backend startup bootstrap, Supabase Auth Admin provisioning, global-role assignment, profile repair, env contract, tests, README updates, and GitBook documentation

---

## Overview

The platform already creates the fixed data structure and global roles on first startup, but it still requires a manual SQL step to create the first superuser.

The goal of this plan is to add a **safe, idempotent, startup-time superuser bootstrap** controlled by environment variables in `packages/universo-core-backend/base/.env` and `.env.example`.

When enabled, the backend must:

1. Create a **real Supabase Auth user** through `supabase.auth.admin.createUser(...)`.
2. Ensure the user can sign in immediately as a normal password-based user.
3. Ensure the user has the **global `superuser` role** in `admin.rel_user_roles`.
4. Avoid unsafe shortcuts such as direct inserts into `auth.users`.
5. Remain safe under repeated startup, partial failure, and concurrent startup.

Fresh database recreation is allowed.
Legacy preservation is not required.
The implementation should reuse current package boundaries instead of inventing a parallel bootstrap stack.

---

## Additional Findings From The Extra Analysis

### Verified Current Repository Risks

1. **`.env.example` does not document the backend `SERVICE_ROLE_KEY`.**
   - The backend already uses `SERVICE_ROLE_KEY` to create a server-only Supabase admin client for admin user provisioning.
   - Without documenting it, the future startup bootstrap will appear broken on a fresh install even though the code path is valid.

2. **`BaseCommand` does not currently support `SERVICE_ROLE_KEY` or future bootstrap env overrides.**
   - `packages/universo-core-backend/base/src/commands/base.ts` only forwards a subset of env values into `process.env`.
   - If the feature is implemented only in `.env` but not in CLI overrides, command-based runs and CI flows will drift.

3. **Admin-side user provisioning logic is currently route-local and duplicated in shape.**
   - `packages/admin-backend/base/src/routes/globalUsersRoutes.ts` already provisions auth users and rolls them back on role assignment failure.
   - Startup bootstrap would currently duplicate the same create-user / role-sync / rollback logic unless it is extracted.

4. **Admin-side provisioning currently trusts the `auth.users -> profiles.cat_profiles` trigger without explicit repair.**
   - Public registration performs an additional profile update / upsert safety pass.
   - Admin provisioning and the future startup bootstrap do not currently verify that a profile row exists after auth user creation.
   - This is a correctness gap for partial-trigger or timing issues.

5. **`ProfileService` already contains the correct profile repair primitive.**
   - `ProfileService.getOrCreateProfile(userId, email)` can create a safe fallback nickname and recover missing profile rows.
   - The bootstrap plan should reuse this service instead of creating a second nickname/profile repair implementation.

6. **The repository already has an advisory-lock helper suitable for bootstrap serialization.**
   - `@universo/utils/database` exports `withAdvisoryLock(...)`.
   - That gives us an existing concurrency control primitive for multi-instance startup without creating a custom lock subsystem.

7. **Current documentation structure is only partially populated.**
   - `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md` reference many GitBook pages that do not yet exist in the workspace.
   - The documentation phase must therefore include both updating existing docs and creating missing GitBook pages where this feature belongs.

8. **The current `.cursor/rules/i18n-docs.mdc` rule file is not present in the workspace.**
   - The repository instructions refer to it, but the file is not available at the expected path.
   - The docs phase should follow the current GitBook structure in `docs/` and keep EN canonical + RU synchronized unless the missing rule file is restored later.

9. **`AUTH_EMAIL_CONFIRMATION_REQUIRED` is a UI/feature-toggle contract, not the actual confirmation source of truth.**
   - The real confirmed state is carried by Supabase Auth user fields.
   - Using `email_confirm: true` during bootstrap is therefore architecturally correct for an immediately usable bootstrap admin account.

10. **The startup bootstrap should not silently elevate arbitrary pre-existing users.**
    - If the configured bootstrap email already belongs to an unrelated account, blindly granting `superuser` would be unsafe.
    - The plan must define explicit takeover / repair rules for existing users.

---

## External Research Notes

### Supabase Docs / Official Guidance

1. `auth.admin.createUser()` is a **server-only** operation and should never expose the `service_role` key in the browser.
2. `createUser()` does **not** send a confirmation email; `inviteUserByEmail()` is the invite path.
3. `email_confirm: true` is the documented way to create an immediately confirmed password user.
4. Supabase recommends a **separate server-side service-role client** with `persistSession: false` and `autoRefreshToken: false`.
5. Supabase explicitly warns not to use normal auth flows like `signUp()` from a service-role client when you intend to provision users; the correct path is `admin.createUser()`.

### Inference For This Repository

The safest repository-aligned approach is:

- create a dedicated startup-only admin client,
- serialize bootstrap with an advisory lock,
- reuse current SQL-first role and profile services for repository state,
- and keep all `auth.users` writes behind Supabase Admin API only.

---

## Affected Areas

| Area | Package / Location | Planned Responsibility |
|---|---|---|
| Startup lifecycle | `packages/universo-core-backend/base/src/index.ts` | Trigger bootstrap after migrations and fixed-role seed |
| Startup config | `packages/universo-core-backend/base/.env.example`, `.env`, `src/commands/base.ts` | Add env contract and CLI parity |
| Shared provisioning logic | `packages/admin-backend/base/src/services/*` | Extract reusable auth-user provisioning / rollback / role-sync helper |
| Global access / role assignment | `packages/admin-backend/base/src/services/globalAccessService.ts` | Reuse or extend role resolution / superuser sync helpers |
| Profile repair | `packages/profile-backend/base/src/services/profileService.ts` | Reuse existing `getOrCreateProfile()` |
| Auth route parity | `packages/auth-backend/base/src/routes/auth.ts` | Keep semantics aligned, avoid divergent cleanup / repair logic |
| Core-backend tests | `packages/universo-core-backend/base/src/__tests__/App.initDatabase.test.ts` | Add startup bootstrap test coverage |
| Admin-backend tests | `packages/admin-backend/base/src/tests/routes/dashboardAndGlobalUsersRoutes.test.ts` and new service tests | Cover shared provisioning helper and route reuse |
| README docs | root `README.md`, `README-RU.md`, package READMEs | Document env, security warnings, first-run behavior |
| GitBook docs | `docs/en/*`, `docs/ru/*`, `SUMMARY.md` | Add configuration/auth/bootstrap documentation |

---

## Architecture Decisions

### 1. Provision The Bootstrap User Through Supabase Admin API Only

Do not write directly into `auth.users`.
Do not build a SQL-only side-channel for auth identity creation.

**Decision**:

- use `supabase.auth.admin.createUser(...)` for new bootstrap users,
- use `supabase.auth.admin.updateUserById(...)` only for explicit repair actions that we intentionally support,
- use `supabase.auth.admin.deleteUser(...)` for rollback of a freshly provisioned user on failure.

### 2. Keep Startup Config Local To Core Backend

The bootstrap env contract is **server-only** and specific to startup behavior.
It should not be exported to frontend bundles or general browser runtime env helpers.

**Decision**:

- implement a local config parser in `@universo/core-backend`,
- keep only generic boolean / number parsers in shared utils,
- avoid pushing private startup config into shared browser-facing env surfaces.

### 3. Extract A Reusable Backend Provisioning Service

The repository already has route-level admin provisioning.
Startup bootstrap should not duplicate it.

**Decision**:

- extract a reusable service in `@universo/admin-backend`,
- let both the admin route and startup bootstrap call the same provisioning pipeline,
- keep route parsing / HTTP responses in the route layer and all create-user / repair / rollback logic in the service layer.

### 4. Use Advisory Locking For Bootstrap Serialization

Multiple startup processes must not race on the same bootstrap email.

**Decision**:

- use `withAdvisoryLock(getPoolExecutor(), lockKey, ...)`,
- lock by normalized email, for example `bootstrap-superuser:<lowercase-email>`,
- keep the lock scope limited to the one bootstrap account flow.

### 5. Be Strict About Existing Users

The startup bootstrap must be idempotent, but not permissive.

**Decision**:

- if the configured email does not exist: create the user and assign `superuser`,
- if the configured email exists and is already an active `superuser`: no-op,
- if the configured email exists but is **not** a `superuser`: fail fast with a clear startup error by default,
- do **not** silently change the password of an unrelated existing user in v1,
- do **not** silently elevate an unrelated existing user in v1.

This is the safest default for a platform root account.

### 6. Ensure Profile Existence Explicitly

Even though the DB trigger should create the profile row, startup bootstrap must not depend on that side effect blindly.

**Decision**:

- after successful auth user provisioning or discovery, call `ProfileService.getOrCreateProfile(userId, email)`,
- avoid duplicating nickname generation logic outside `profile-backend`,
- keep consent fields empty unless explicitly required by the product contract.

### 7. Keep Role Sync Canonical And Exclusive

The repository already treats `superuser` as an exclusive role.

**Decision**:

- assign bootstrap root access through the same canonical multi-role synchronization path as admin user management,
- resolve the `superuser` role by codename and then call the canonical role replacement flow,
- avoid adding a second ad hoc SQL insert path for `admin.rel_user_roles`.

### 8. No Frontend Surface In V1

This feature is a startup/admin concern, not a UI workflow.

**Decision**:

- no new frontend screens in v1,
- no new TanStack Query integration in v1,
- only documentation and server-side behavior change.

### 9. Document Demo Credentials Aggressively

The env example must include demo values, but they must not look production-safe.

**Decision**:

- example email: `demo-admin@example.com`
- example password: `ChangeMe_123456!`
- documentation must explicitly state that real deployments must replace both before first real use.

---

## Proposed Env Contract

### Required For The Bootstrap Feature

```env
# Server-side admin client for Supabase Auth Admin API
# Required when BOOTSTRAP_SUPERUSER_ENABLED=true
# SERVICE_ROLE_KEY=...

# BOOTSTRAP_SUPERUSER_ENABLED:
# Automatically provision the first platform superuser during startup bootstrap.
# Default: true
BOOTSTRAP_SUPERUSER_ENABLED=true

# BOOTSTRAP_SUPERUSER_EMAIL:
# Demo bootstrap admin email for first startup.
# Change before any real deployment.
BOOTSTRAP_SUPERUSER_EMAIL=demo-admin@example.com

# BOOTSTRAP_SUPERUSER_PASSWORD:
# Demo bootstrap admin password for first startup.
# Change before any real deployment.
BOOTSTRAP_SUPERUSER_PASSWORD=ChangeMe_123456!
```

### Startup Validation Rules

When `BOOTSTRAP_SUPERUSER_ENABLED=true`:

1. `SUPABASE_URL` must exist.
2. `SERVICE_ROLE_KEY` must exist.
3. `BOOTSTRAP_SUPERUSER_EMAIL` must be a valid email.
4. `BOOTSTRAP_SUPERUSER_PASSWORD` must pass a minimum-strength policy.
5. Startup should fail fast if validation fails.

When `BOOTSTRAP_SUPERUSER_ENABLED=false`:

- the feature is a pure no-op,
- missing bootstrap email/password should not fail startup.

---

## Detailed Implementation Plan

### Phase 0: Finalize Behavioral Contract

- [ ] **0.1** Confirm that the default behavior for an existing non-superuser with the configured bootstrap email is **fail fast**, not auto-escalate.
- [ ] **0.2** Confirm that v1 will **not** automatically rotate passwords for pre-existing users.
- [ ] **0.3** Confirm that v1 only guarantees a valid auth account + profile row + `superuser` role, and does **not** simulate end-user legal consent acceptance.
- [ ] **0.4** Confirm demo env values and warning text for `.env.example`, README, and GitBook docs.

### Phase 1: Extract A Reusable Provisioning Service

- [ ] **1.1** Create a new internal service in `@universo/admin-backend` for provisioning a Supabase auth user and synchronizing global roles.
- [ ] **1.2** Move route-local cleanup logic out of `globalUsersRoutes.ts` into the reusable service layer.
- [ ] **1.3** Reuse `GlobalAccessService.setUserRoles(...)` for canonical superuser assignment.
- [ ] **1.4** Add a helper that resolves role IDs by codename inside the service layer so startup code does not need to know admin schema details.
- [ ] **1.5** Inject `ProfileService` and call `getOrCreateProfile(...)` after user creation or user discovery.
- [ ] **1.6** Return a structured provisioning result, for example:
  - created new auth user vs reused existing user,
  - created or repaired profile,
  - roles synchronized,
  - no-op state if the configured user is already a superuser.
- [ ] **1.7** Keep HTTP-specific concerns out of the service so the startup path can reuse it without Express request objects.

### Phase 2: Add A Dedicated Startup Bootstrap Orchestrator

- [ ] **2.1** Add a local core-backend bootstrap module, for example `src/bootstrap/bootstrapSuperuser.ts`.
- [ ] **2.2** Add a local config parser, for example `src/bootstrap/bootstrapSuperuserConfig.ts`, instead of scattering raw `process.env` reads.
- [ ] **2.3** Normalize the configured email once and build an advisory lock key from it.
- [ ] **2.4** Run the bootstrap after migration validation, schema generation, post-schema migrations, and fixed system-app structure bootstrap have completed successfully.
- [ ] **2.5** Create a dedicated service-role Supabase client in the bootstrap path with:
  - `persistSession: false`
  - `autoRefreshToken: false`
- [ ] **2.6** Under advisory lock:
  - lookup the existing auth user by email,
  - create via `auth.admin.createUser(...)` if missing,
  - ensure profile exists,
  - synchronize the exclusive `superuser` role,
  - rollback only the newly created auth user if role synchronization fails.
- [ ] **2.7** Fail startup if an existing account with the configured email is present but is not already a superuser.
- [ ] **2.8** Add high-signal logs without secrets:
  - feature enabled/disabled,
  - created / reused / skipped,
  - existing-user conflict,
  - rollback outcome.
- [ ] **2.9** Do not log raw password, service role key, full JWT, or unsafe PII.

### Phase 3: Bring CLI / Config Parity To Commands

- [ ] **3.1** Extend `BaseCommand.flags` with:
  - `SERVICE_ROLE_KEY`
  - `BOOTSTRAP_SUPERUSER_ENABLED`
  - `BOOTSTRAP_SUPERUSER_EMAIL`
  - `BOOTSTRAP_SUPERUSER_PASSWORD`
- [ ] **3.2** Forward those flags into `process.env` in the same style as the current command bootstrap.
- [ ] **3.3** Keep env naming stable between `.env`, CLI flags, README, and GitBook docs.

### Phase 4: Reuse The Shared Provisioning Service In Admin Routes

- [ ] **4.1** Refactor `POST /api/v1/admin/global-users/create-user` to call the shared provisioning service instead of keeping a separate create-user flow.
- [ ] **4.2** Preserve current HTTP behavior and validation semantics.
- [ ] **4.3** Keep route-specific inputs like `roleIds`, `comment`, and request user ID in the route layer only.
- [ ] **4.4** Ensure the shared service still supports cleanup and structured failure reporting for the route path.

### Phase 5: Deep Test Plan

#### Core-backend startup tests

- [ ] **5.1** `App.initDatabase()` calls startup bootstrap only after migrations and fixed role seed are ready.
- [ ] **5.2** Startup bootstrap is skipped when `BOOTSTRAP_SUPERUSER_ENABLED=false`.
- [ ] **5.3** Startup fails fast when bootstrap is enabled but `SERVICE_ROLE_KEY` is missing.
- [ ] **5.4** Startup fails fast when email/password config is invalid.
- [ ] **5.5** Startup logs no-op when the configured superuser already exists and is valid.

#### Admin-backend service tests

- [ ] **5.6** Creating a missing bootstrap user provisions auth user, repairs/creates profile, and synchronizes only the `superuser` role.
- [ ] **5.7** Role synchronization failure after fresh auth user creation triggers rollback through `deleteUser(...)`.
- [ ] **5.8** Existing valid superuser is treated as idempotent success, not duplicate failure.
- [ ] **5.9** Existing non-superuser with the configured email causes explicit hard failure.
- [ ] **5.10** Missing profile on an existing auth user is repaired through `ProfileService.getOrCreateProfile(...)`.
- [ ] **5.11** Advisory lock path is exercised so concurrent bootstrap attempts cannot both create a user.

#### Route regression tests

- [ ] **5.12** Admin create-user route still works after switching to the shared provisioning service.
- [ ] **5.13** Admin route rollback semantics remain intact.
- [ ] **5.14** Admin route still supports non-superuser role creation flows.

#### Optional integration / live verification plan

- [ ] **5.15** On a fresh `UP-test` reset or a dedicated scratch project, verify:
  - startup creates the auth user,
  - profile row exists,
  - `admin.rel_user_roles` contains exactly one active `superuser` assignment,
  - login succeeds through the normal password flow.

### Phase 6: README And GitBook Documentation

- [ ] **6.1** Update root `README.md` and `README-RU.md` with first-run bootstrap behavior and env warnings.
- [ ] **6.2** Update `packages/universo-core-backend/base/README.md` and `README-RU.md` with:
  - startup lifecycle addition,
  - required `SERVICE_ROLE_KEY`,
  - bootstrap superuser env contract,
  - security warning about demo credentials.
- [ ] **6.3** Update `packages/admin-backend/base/README.md` and `README-RU.md` to note that admin route provisioning and startup bootstrap share the same backend provisioning pipeline.
- [ ] **6.4** Create or update GitBook pages in `docs/en` and `docs/ru` for:
  - getting-started configuration,
  - authentication / authorization architecture,
  - first startup / bootstrap behavior.
- [ ] **6.5** Update `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md` so the new pages are reachable from GitBook navigation.
- [ ] **6.6** Keep English docs canonical and provide synchronized Russian translation in the same commit / implementation wave.

---

## Safe Code Sketches

### Example 1: Local Startup Config Parser

```ts
interface BootstrapSuperuserConfig {
  enabled: boolean
  email: string | null
  password: string | null
}

const parseEnvBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value.trim() === '') return fallback
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1'
}

export function getBootstrapSuperuserConfig(): BootstrapSuperuserConfig {
  const enabled = parseEnvBoolean(process.env.BOOTSTRAP_SUPERUSER_ENABLED, true)

  return {
    enabled,
    email: process.env.BOOTSTRAP_SUPERUSER_EMAIL?.trim().toLowerCase() || null,
    password: process.env.BOOTSTRAP_SUPERUSER_PASSWORD || null
  }
}
```

### Example 2: Serialized Startup Bootstrap Flow

```ts
await withAdvisoryLock(getPoolExecutor(), `bootstrap-superuser:${normalizedEmail}`, async () => {
  const existingUserId = await globalAccessService.findUserIdByEmail(normalizedEmail)

  if (existingUserId) {
    const info = await globalAccessService.getGlobalAccessInfo(existingUserId)
    if (info.isSuperuser) {
      await profileService.getOrCreateProfile(existingUserId, normalizedEmail)
      return { status: 'noop_existing_superuser' as const }
    }

    throw new Error(
      `Bootstrap email ${normalizedEmail} already belongs to an existing non-superuser account. ` +
        `Refusing automatic privilege escalation.`
    )
  }

  const adminResponse = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true
  })

  if (adminResponse.error || !adminResponse.data.user) {
    throw adminResponse.error ?? new Error('Failed to create bootstrap superuser')
  }

  const userId = adminResponse.data.user.id

  try {
    await profileService.getOrCreateProfile(userId, normalizedEmail)
    await provisioningService.replaceUserRolesByCodenames(userId, ['superuser'], null, 'startup bootstrap')
    return { status: 'created' as const, userId }
  } catch (error) {
    await supabaseAdmin.auth.admin.deleteUser(userId)
    throw error
  }
})
```

### Example 3: Focused Test Shape

```ts
it('fails startup when configured bootstrap email already belongs to a non-superuser', async () => {
  mockFindUserIdByEmail.mockResolvedValue('user-1')
  mockGetGlobalAccessInfo.mockResolvedValue({
    isSuperuser: false,
    canAccessAdmin: false,
    globalRoles: []
  })

  await expect(runBootstrap()).rejects.toThrow(
    'already belongs to an existing non-superuser account'
  )

  expect(mockCreateUser).not.toHaveBeenCalled()
  expect(mockSetUserRoles).not.toHaveBeenCalled()
})
```

---

## Potential Challenges And How To Address Them

### 1. Transaction-scoped advisory lock around an external admin API call

Holding a DB transaction while calling `auth.admin.createUser(...)` is not ideal in a hot path.
Here it is acceptable because this is a cold-start bootstrap flow, not a high-frequency request path.

Mitigation:

- keep the lock key very narrow,
- keep timeout bounded,
- keep the bootstrap logic small and single-account only,
- avoid expanding this pattern into normal request flows.

### 2. Existing user takeover policy

There is product pressure to “just make the env user root”.
That is operationally convenient but unsafe.

Mitigation:

- default to fail-fast for existing non-superuser accounts,
- if product later wants an explicit takeover mode, add it as a second, intentionally named env flag in a separate follow-up.

### 3. Profile trigger timing

Relying only on the trigger can leave rare gaps.

Mitigation:

- explicitly repair profile existence through `ProfileService.getOrCreateProfile(...)`.

### 4. Route / startup semantic drift

If startup bootstrap and admin create-user evolve independently, bugs will reappear.

Mitigation:

- one shared provisioning service,
- one cleanup strategy,
- one test matrix covering both callers.

### 5. Documentation sprawl

This feature touches root README, package READMEs, and GitBook.

Mitigation:

- treat docs as a first-class implementation phase,
- update EN and RU together,
- keep one canonical env contract string across all documents.

---

## Design Notes

### Why This Does Not Need A Separate CREATIVE Phase

This feature is backend/bootstrap-oriented.
No new screen, visual flow, or design system work is required in v1.

### Why This Still Needs Careful Architecture Review

It modifies:

- startup ordering,
- security-sensitive auth provisioning,
- root access semantics,
- rollback behavior,
- and first-run documentation.

That combination is operationally sensitive even without UI work.

---

## Dependencies

1. **Supabase Admin API availability**
   - The feature requires `SERVICE_ROLE_KEY`.

2. **Current role seed contract**
   - The `superuser` role must continue to be seeded before bootstrap runs.

3. **Current profile service contract**
   - `ProfileService.getOrCreateProfile(...)` must remain exported and backend-safe.

4. **Documentation synchronization**
   - EN and RU docs should ship together to avoid conflicting setup guidance.

---

## Recommended Execution Order

1. Finalize the takeover / existing-user policy.
2. Extract shared provisioning + rollback service.
3. Add startup bootstrap orchestrator and config parser.
4. Add CLI parity for env overrides.
5. Refactor admin create-user route onto the shared service.
6. Add the full regression suite.
7. Update root README, package READMEs, and GitBook docs.
8. Validate on a fresh Supabase database or controlled reset.

---

## Discussion Points Requiring Explicit Approval

1. Should existing non-superuser accounts with the configured bootstrap email cause a **hard startup failure** by default?
2. Is it correct that v1 should **not** auto-reset the password of an existing account?
3. Is it acceptable that v1 creates a valid bootstrap admin account **without synthetic legal-consent acceptance fields**, while still ensuring full login/profile/role readiness?

