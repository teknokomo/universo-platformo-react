# Admin Roles Refactoring & Метапанель — Implementation Plan

> **Date**: 2026-03-17
> **Complexity**: Level 4 (Major/Complex)
> **Estimated blocks**: 6 phases, ~45 tasks
> **Status**: DRAFT v3 — QA-revalidated against live routing, onboarding, AbilityContext, and dashboard-stats seams; awaiting approval

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Decisions](#architecture-decisions)
3. [Phase 0 — Shared Types & CASL Extensions](#phase-0--shared-types--casl-extensions)
4. [Phase 1 — Database Migrations & Backend Core](#phase-1--database-migrations--backend-core)
5. [Phase 2 — Roles UI Refactoring](#phase-2--roles-ui-refactoring)
6. [Phase 3 — User Management & Multi-Role Assignment](#phase-3--user-management--multi-role-assignment)
7. [Phase 4 — Onboarding Integration & Role Lifecycle](#phase-4--onboarding-integration--role-lifecycle)
8. [Phase 5 — Метапанель Package & Role-Based Menus](#phase-5--метапанель-package--role-based-menus)
9. [Testing Strategy](#testing-strategy)
10. [i18n Keys Plan](#i18n-keys-plan)
11. [File Change Summary](#file-change-summary)
12. [Risks & Mitigations](#risks--mitigations)

---

## Overview

Refactor the admin panel role management system to:
1. **Keep** the existing admin section (instances) as-is.
2. **Standardize** Roles UI to match metahub patterns (EntityFormDialog for create/edit/copy, BaseEntityMenu, VLC fields).
3. **Refactor** the Role Detail Page into a tabbed layout (Permissions + Settings), keeping it as a standalone page.
4. **Extend** the database to seed 3 system roles (`superuser`, `registered`, `user`) instead of 1.
5. **Enable** multiple global roles per user with EntitySelectionPanel-based assignment.
6. **Create** a new `metapanel-frontend` package as the primary dashboard entry point.
7. **Introduce** an explicit `/start` onboarding route plus authenticated home redirect logic.
8. **Implement** role-based menu visibility, section gating, and route guards.
9. **Move** the final onboarding completion mutation to the completion CTA and refresh authorization through `AbilityContext`.
10. **Add** admin-side Supabase user creation with server-side bootstrap injection.
11. **Enforce** superuser exclusivity (assigning superuser clears other roles).

The existing `admin.cat_roles`, `admin.rel_role_permissions`, and `admin.rel_user_roles` tables remain the foundation. No TypeORM dependency exists — all queries use raw SQL via `DbExecutor`.

---

## Architecture Decisions

### AD-1: Role Binding Uses UUID, Not Codename
`admin.rel_user_roles.role_id` is a UUID FK → `admin.cat_roles.id`. The `codename` column is a human-friendly identifier (unique among active rows), safe to make editable for non-system roles. System roles (`is_system = true`) retain immutable codenames (`superuser`, `registered`, `user`).

### AD-2: VLC Fields for Role Name and Description
Role `name` and `description` are already JSONB columns using the VLC schema (`_schema`, `_primary`, `locales`). The Roles UI must render these through the same VLC input pattern used in metahub entity dialogs (via `LocalizedInlineField` already used in `RoleEdit.tsx`).

### AD-3: Three System Roles With Distinct Permission Sets
| Codename | Purpose | Key Permissions |
|---|---|---|
| `superuser` | Full platform access, permission bypass | `subject='*', action='*'` (existing) |
| `registered` | Post-registration, pre-onboarding user | `subject='onboarding', action='read'` |
| `user` | Post-onboarding standard user | `subject='applications', action='read'`, `subject='metahubs', action='read'`, `subject='profile', action='manage'` |

### AD-4: Completion CTA Owns Final Onboarding Mutation
`syncSelections()` remains on the last wizard data step, but `POST /onboarding/complete` becomes the exclusive responsibility of the completion CTA. This single mutation point marks onboarding as completed and, when enabled, adds the `user` role.

New ENV flag: `AUTO_ROLE_AFTER_ONBOARDING=true|false`.
- `true` (default): completion adds `user`, refreshes `AbilityContext`, and sends the user to the main product flow.
- `false`: completion only marks onboarding finished; the user remains in the `/start` completion state until an admin grants an additional role.

### AD-5: Метапанель Is a Separate Frontend Package
New package: `packages/metapanel-frontend/base/` — follows the same dual-build TSX pattern as other frontend packages (tsdown, `dist/` output). Provides dashboard stat cards. **Important**: `MainGrid` has hardcoded cards and does not accept a `cards` prop. Метапанель renders `StatCard` components directly in a `Grid` layout.

### AD-6: Menu Visibility Is Role-Based, Section-Aware, and Separate From Footer Actions
Role-based visibility uses role codenames from `useHasGlobalAccess().globalRoles`, but it must model the real shell structure instead of only `rootMenuItems`:
- `registered` role → no main-shell root items; onboarding stays on `/start`
- `user` role → Метапанель, Applications, Profile, Docs/Help
- Admin section visibility is driven by `canAccessAdminPanel`, not by `hasAnyGlobalRole`
- Existing logout buttons in `SideMenu` / `SideMenuMobile` remain footer actions and are not part of menu filtering
- Separate root sections such as MetaHubs must be filtered explicitly, not left visible because they are rendered outside `rootMenuItems`

### AD-7: Explicit `/start` Route and Authenticated Home Redirect
Add a dedicated `/start` route for the onboarding/completion flow. Route `/` becomes a resolver:
- guest → guest landing
- authenticated registered-only user → `/start`
- authenticated user with any non-registered role → `/metapanel`

`RegisteredUserGuard` still protects the main shell, but it is not sufficient on its own because the current root route bypasses the main layout entirely.

### AD-8: Role Copy Reuses EntityFormDialog Copy Mode
Role copying uses the standard `EntityFormDialog` `mode='copy'` pattern: pre-fills name, description, and color from the source role. The `codename` field is cleared for user input. Permissions are optionally copied (checkbox). System flag is always `false` for copies. After copy — the user navigates to the new role's detail page to manage permissions.

### AD-9: Role Detail Page With Tabs (Not Dialog)
Per TZ: "При заходе во внутрь роли — Вкладки: Права доступа (таблица) и Настройки". The **Role Detail Page** (`RoleEdit.tsx`) is preserved as a standalone page and refactored into a tabbed layout using MUI `<Tabs>`. EntityFormDialog is used only for create/edit/copy of basic fields (name, codename, color, description). Permissions management lives exclusively on the Role Detail Page's "Permissions" tab. The existing `PermissionMatrix` component (already table-based with MUI `<Table>`) is reused.

### AD-10: Superuser Role Is Exclusive
Per TZ: "Суперюзер — эксклюзивная роль". When the superuser role is assigned to a user, all other roles are automatically removed within the same DB transaction. On the Role Detail Page for superuser, all permissions are shown as checked and locked (read-only).

### AD-11: Admin-Side User Creation via Supabase Admin API
Per TZ: "Должна быть возможность создать нового пользователя прямо из админки через Supabase". A new backend endpoint uses `supabase.auth.admin.createUser()` to create users, then auto-assigns the specified role(s). The `supabaseAdmin` client is created in `universo-core-backend` from `SUPABASE_URL` + `SERVICE_ROLE_KEY` and injected into `createGlobalUsersRoutes(...)`; it must never be instantiated in browser-facing code.

### AD-12: Ability Refresh Uses `AbilityContext`, Not TanStack Query
Authorization refresh after role/lifecycle changes must call `useAbility().refreshAbility()` (or the same context method via `AbilityContext`) because current permission loading is owned by `AbilityContextProvider`, not by TanStack Query.

### AD-13: Dashboard Stats Use a Dedicated Admin Dashboard Contract
Метапанель and the existing Admin board should read one dedicated dashboard stats contract such as `GET /api/v1/admin/dashboard/stats`. Do not overload `GET /api/v1/admin/global-users/stats`, because metapanel cards aggregate multiple domains (applications, metahubs, roles) and are not a pure global-users concern.

---

## Phase 0 — Shared Types, CASL & Ability Context

**Goal**: Extend shared types and keep the real frontend ability implementation aligned before any backend/frontend feature work.

### Step 0.1 — Extend CASL Subjects

**File**: `packages/universo-types/base/src/abilities/index.ts`

Current `Subjects` type: `'Publication' | 'Admin' | 'Role' | 'Instance' | 'all'`

Add new subjects:

```typescript
export type Subjects =
  | 'Publication'
  | 'Admin'
  | 'Role'
  | 'Instance'
  | 'Metahub'
  | 'Application'
  | 'Profile'
  | 'Onboarding'
  | 'all'
```

Update `MODULE_TO_SUBJECT` map:

```typescript
const MODULE_TO_SUBJECT: Record<string, Subjects> = {
  publications: 'Publication',
  admin: 'Admin',
  roles: 'Role',
  instances: 'Instance',
  metahubs: 'Metahub',
  applications: 'Application',
  profile: 'Profile',
  onboarding: 'Onboarding',
  '*': 'all'
}
```

Export the shared module-to-subject map from `@universo/types` so frontend ability builders do not keep a second drift-prone version.

### Step 0.2 — Synchronize `AbilityContextProvider` Subject Mapping

**File**: `packages/universo-store/base/src/context/AbilityContextProvider.jsx`

The current frontend ability layer has its own local `MODULE_TO_SUBJECT` map. Update it to consume the shared exported map from `@universo/types`, or at minimum mirror the same subjects exactly (`applications`, `metahubs`, `profile`, `onboarding`). This step is required so the new backend role seeds and menu/routing logic are reflected in the actual client-side CASL state.

### Step 0.3 — Extend Admin Types

**File**: `packages/universo-types/base/src/common/admin.ts`

Add new types:

```typescript
/** System role codenames (immutable) */
export type SystemRoleCodename = 'superuser' | 'registered' | 'user'

/** Request payload for setting multiple roles for a user (replaces all) */
export interface SetUserRolesPayload {
  userId: string
  roleIds: string[]
  comment?: string
}

/** Request payload for copying a role */
export interface CopyRolePayload {
  sourceRoleId: string
  codename: string
  name: VersionedLocalizedContent<string>
  description?: VersionedLocalizedContent<string>
  color?: string
  copyPermissions: boolean
}

/** Role with permission count for list display */
export interface RoleListItem extends GlobalRole {
  permissionCount: number
  userCount: number
}

/** Request payload for creating a user from admin panel */
export interface AdminCreateUserPayload {
  email: string
  password?: string
  roleIds: string[]
  comment?: string
}
```

### Step 0.4 — Add Section-Aware Role Menu Mapping

**File**: `packages/universo-types/base/src/common/admin.ts`

```typescript
export interface RoleMenuVisibility {
  rootMenuIds: string[]
  showMetahubsSection?: boolean
}

/** Maps role codenames to shell-visible sections */
export const ROLE_MENU_VISIBILITY: Record<string, RoleMenuVisibility> = {
  registered: { rootMenuIds: [] },
  user: { rootMenuIds: ['metapanel', 'applications', 'profile', 'docs'], showMetahubsSection: false },
  // admin visibility is derived separately from canAccessAdminPanel
}
```

**Checklist:**
- [ ] 0.1 — Extend Subjects type and export the shared module-to-subject map from `@universo/types`
- [ ] 0.2 — Synchronize `AbilityContextProvider` with the shared subject map / new subjects
- [ ] 0.3 — Add multi-role types, copy payload, create-user payload, list item types
- [ ] 0.4 — Add section-aware `ROLE_MENU_VISIBILITY` mapping

---

## Phase 1 — Database Migrations & Backend Core

**Goal**: Seed 3 system roles, add role copy route, add multi-role grant endpoint, add admin user creation, add ENV-controlled onboarding role transition, enforce superuser exclusivity.

### Step 1.1 — Seed `registered` and `user` System Roles

**File**: `packages/admin-backend/base/src/platform/migrations/index.ts`

Add to the `support` SQL array (after existing superuser seed):

```sql
-- Seed 'registered' system role
INSERT INTO admin.cat_roles (codename, description, name, color, is_superuser, is_system)
VALUES (
  'registered',
  '{"_schema":"1","_primary":"en","locales":{
    "en":{"content":"Newly registered user before onboarding completion","version":1,"isActive":true,"createdAt":"2026-03-17T00:00:00.000Z","updatedAt":"2026-03-17T00:00:00.000Z"},
    "ru":{"content":"Новый зарегистрированный пользователь до завершения онбординга","version":1,"isActive":true,"createdAt":"2026-03-17T00:00:00.000Z","updatedAt":"2026-03-17T00:00:00.000Z"}
  }}'::jsonb,
  '{"_schema":"1","_primary":"en","locales":{
    "en":{"content":"Registered","version":1,"isActive":true,"createdAt":"2026-03-17T00:00:00.000Z","updatedAt":"2026-03-17T00:00:00.000Z"},
    "ru":{"content":"Зарегистрированный","version":1,"isActive":true,"createdAt":"2026-03-17T00:00:00.000Z","updatedAt":"2026-03-17T00:00:00.000Z"}
  }}'::jsonb,
  '#2196f3',
  false,
  true
)
ON CONFLICT (codename) WHERE _upl_deleted = false AND _app_deleted = false
DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color;

-- Seed 'user' system role
INSERT INTO admin.cat_roles (codename, description, name, color, is_superuser, is_system)
VALUES (
  'user',
  '{"_schema":"1","_primary":"en","locales":{
    "en":{"content":"Standard platform user with full application access","version":1,"isActive":true,"createdAt":"2026-03-17T00:00:00.000Z","updatedAt":"2026-03-17T00:00:00.000Z"},
    "ru":{"content":"Стандартный пользователь платформы с полным доступом к приложениям","version":1,"isActive":true,"createdAt":"2026-03-17T00:00:00.000Z","updatedAt":"2026-03-17T00:00:00.000Z"}
  }}'::jsonb,
  '{"_schema":"1","_primary":"en","locales":{
    "en":{"content":"User","version":1,"isActive":true,"createdAt":"2026-03-17T00:00:00.000Z","updatedAt":"2026-03-17T00:00:00.000Z"},
    "ru":{"content":"Пользователь","version":1,"isActive":true,"createdAt":"2026-03-17T00:00:00.000Z","updatedAt":"2026-03-17T00:00:00.000Z"}
  }}'::jsonb,
  '#4caf50',
  false,
  true
)
ON CONFLICT (codename) WHERE _upl_deleted = false AND _app_deleted = false
DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color;
```

### Step 1.2 — Seed Permissions for New System Roles

After role seed, add permission seeds:

```sql
-- Permissions for 'registered' role
INSERT INTO admin.rel_role_permissions (role_id, subject, action, conditions, fields)
SELECT r.id, p.subject, p.action, p.conditions, p.fields
FROM admin.cat_roles r
CROSS JOIN (VALUES
  ('onboarding', 'read', NULL::jsonb, NULL::text[]),
  ('profile', 'read', NULL::jsonb, NULL::text[])
) AS p(subject, action, conditions, fields)
WHERE r.codename = 'registered'
  AND r._upl_deleted = false AND r._app_deleted = false
  AND NOT EXISTS (
    SELECT 1 FROM admin.rel_role_permissions rp
    WHERE rp.role_id = r.id AND rp.subject = p.subject AND rp.action = p.action
  );

-- Permissions for 'user' role
INSERT INTO admin.rel_role_permissions (role_id, subject, action, conditions, fields)
SELECT r.id, p.subject, p.action, p.conditions, p.fields
FROM admin.cat_roles r
CROSS JOIN (VALUES
  ('applications', 'read', NULL::jsonb, NULL::text[]),
  ('metahubs', 'read', NULL::jsonb, NULL::text[]),
  ('profile', 'manage', NULL::jsonb, NULL::text[]),
  ('onboarding', 'read', NULL::jsonb, NULL::text[])
) AS p(subject, action, conditions, fields)
WHERE r.codename = 'user'
  AND r._upl_deleted = false AND r._app_deleted = false
  AND NOT EXISTS (
    SELECT 1 FROM admin.rel_role_permissions rp
    WHERE rp.role_id = r.id AND rp.subject = p.subject AND rp.action = p.action
  );
```

### Step 1.3 — Introduce a Privileged System-Role Provisioning Helper

**Files**:
- `packages/auth-backend/base/src/routes/auth.ts`
- `packages/start-backend/base/src/routes/index.ts`
- `packages/start-backend/base/src/routes/onboardingRoutes.ts`
- `packages/universo-core-backend/base/src/index.ts`
- `packages/universo-core-backend/base/src/routes/index.ts`

Do **not** duplicate raw admin-role SQL independently in `auth-backend` and `start-backend`. Introduce one small privileged callback contract injected from bootstrap code:

```typescript
export interface AssignSystemRoleInput {
  userId: string
  roleCodename: 'registered' | 'user'
  reason: string
}

export type AssignSystemRole = (input: AssignSystemRoleInput) => Promise<void>
```

`universo-core-backend` wires this callback with a pool-level executor, while feature packages only call the injected function.

### Step 1.4 — Auto-Assign `registered` Role After Registration

**File**: `packages/auth-backend/base/src/routes/auth.ts`

After successful user creation (after profile wait loop + consent update), call the injected helper instead of embedding admin SQL in the auth package:

```typescript
await assignSystemRole?.({
  userId: data.user.id,
  roleCodename: 'registered',
  reason: 'auto-assigned on registration'
})
```

**Security note**: the callback uses a privileged pool-level executor in bootstrap code, not request-scoped RLS, because the user just registered and request-scoped application access context is not established yet. The underlying insert remains idempotent (`ON CONFLICT DO NOTHING`).

### Step 1.5 — Onboarding Completion Role Transition Via the Same Helper

**Files**:
- `packages/start-backend/base/src/routes/index.ts`
- `packages/start-backend/base/src/routes/onboardingRoutes.ts`

Extend `createStartServiceRoutes(...)` and `createOnboardingRoutes(...)` to receive the same privileged callback. The `/complete` handler remains the single authoritative lifecycle mutation and, when `AUTO_ROLE_AFTER_ONBOARDING !== 'false'`, adds `user` through the injected helper:

```typescript
const autoRole = process.env.AUTO_ROLE_AFTER_ONBOARDING !== 'false' // default true
if (autoRole) {
  await assignSystemRole?.({
    userId,
    roleCodename: 'user',
    reason: 'auto-assigned on onboarding completion'
  })
}
```

**Note**: this adds `user` alongside `registered`; the base `registered` role is not removed. Frontend route logic checks whether the user has any role beyond `registered`.

### Step 1.6 — Add Required ENV Variables to `.env.example`

**File**: `packages/universo-core-backend/base/.env.example`

```bash
# Onboarding
AUTO_ROLE_AFTER_ONBOARDING=true

# Server-side Supabase admin client
SERVICE_ROLE_KEY=your_service_role_key
```

`SERVICE_ROLE_KEY` is server-only and must be consumed exclusively in backend bootstrap.

### Step 1.6 — Role Copy Backend Route

**File**: `packages/admin-backend/base/src/routes/rolesRoutes.ts`

Add POST `/:id/copy` endpoint inside `createRolesRoutes()` factory:

```typescript
const CopyRoleSchema = z.object({
  codename: z.string().min(2).max(50).regex(/^[a-z][a-z0-9_]*$/),
  name: z.record(z.any()), // VLC JSONB
  description: z.record(z.any()).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#9e9e9e'),
  copyPermissions: z.boolean().default(false),
})

router.post('/:id/copy',
  ensureGlobalAccess('roles', 'create'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id: sourceRoleId } = req.params
    const parsed = CopyRoleSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Invalid input', details: parsed.error.errors })
      return
    }
    const { codename, name, description, color, copyPermissions } = parsed.data
    const userId = (req as RequestWithGlobalRole).user!.id
    const exec = getRequestDbExecutor(req, getDbExecutor())

    // Check source exists
    const { rows: source } = await exec.query(
      `SELECT id FROM admin.cat_roles
       WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false`,
      [sourceRoleId]
    )
    if (source.length === 0) {
      res.status(404).json({ success: false, error: 'Source role not found' })
      return
    }

    // Check codename uniqueness
    const { rows: existing } = await exec.query(
      `SELECT id FROM admin.cat_roles
       WHERE codename = $1 AND _upl_deleted = false AND _app_deleted = false`,
      [codename]
    )
    if (existing.length > 0) {
      res.status(409).json({ success: false, error: 'Codename already exists' })
      return
    }

    // Use transaction for atomicity
    const result = await exec.transaction(async (trx) => {
      // Create role copy (always non-system, non-superuser)
      const { rows: newRole } = await trx.query(
        `INSERT INTO admin.cat_roles (codename, name, description, color, is_superuser, is_system, _upl_created_by)
         VALUES ($1, $2, $3, $4, false, false, $5)
         RETURNING *`,
        [codename, JSON.stringify(name), JSON.stringify(description || {}), color, userId]
      )

      // Copy permissions if requested
      if (copyPermissions) {
        await trx.query(
          `INSERT INTO admin.rel_role_permissions (role_id, subject, action, conditions, fields)
           SELECT $1, subject, action, conditions, fields
           FROM admin.rel_role_permissions
           WHERE role_id = $2`,
          [newRole[0].id, sourceRoleId]
        )
      }

      const { rows: permCount } = await trx.query(
        `SELECT COUNT(*)::int AS count FROM admin.rel_role_permissions WHERE role_id = $1`,
        [newRole[0].id]
      )

      return { ...newRole[0], permissionCount: permCount[0].count }
    })

    res.status(201).json({ success: true, data: result })
  })
)
```

### Step 1.7 — Multi-Role Set Endpoint (With Superuser Exclusivity)

**File**: `packages/admin-backend/base/src/routes/globalUsersRoutes.ts`

Add PUT `/:memberId/roles` inside `createGlobalUsersRoutes()` factory. This route uses `globalAccessService` internally (following existing pattern — globalUsersRoutes does NOT receive `getDbExecutor` directly).

```typescript
const SetUserRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()).min(0).max(20),
  comment: z.string().max(500).optional(),
})

router.put('/:memberId/roles',
  ensureGlobalAccess('users', 'update'),
  async (req, res, next) => {
    try {
      const { memberId } = req.params
      const currentUserId = (req as RequestWithGlobalRole).user!.id

      // Self-modification guard: cannot modify own roles
      if (memberId === currentUserId) {
        return res.status(400).json({
          success: false,
          error: 'Cannot modify your own roles'
        })
      }

      const parsed = SetUserRolesSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: formatZodError(parsed.error)
        })
      }

      const { roleIds, comment } = parsed.data

      // Delegate to globalAccessService for transaction-safe role replacement
      const updatedRoles = await globalAccessService.setUserRoles(
        memberId, roleIds, currentUserId, comment
      )

      res.json({ success: true, data: { userId: memberId, roles: updatedRoles } })
    } catch (error) {
      next(error)
    }
  }
)
```

### Step 1.8 — Add `setUserRoles` to GlobalAccessService

**File**: `packages/admin-backend/base/src/services/globalAccessService.ts`

Add method with superuser exclusivity enforcement inside a single transaction:

```typescript
async function setUserRoles(
  userId: string,
  roleIds: string[],
  grantedBy: string,
  comment?: string
): Promise<Array<{ id: string; codename: string; name: any; color: string; is_superuser: boolean; is_system: boolean }>> {
  const exec = getDbExecutor()

  return exec.transaction(async (trx) => {
    // Validate all roleIds exist
    if (roleIds.length > 0) {
      const { rows: validRoles } = await trx.query(
        `SELECT id, is_superuser FROM admin.cat_roles
         WHERE id = ANY($1::uuid[])
           AND _upl_deleted = false AND _app_deleted = false`,
        [roleIds]
      )
      if (validRoles.length !== roleIds.length) {
        throw Object.assign(new Error('One or more role IDs are invalid'), { statusCode: 400 })
      }

      // Superuser exclusivity: if any requested role is superuser, keep ONLY that role
      const hasSuperuser = validRoles.some(r => r.is_superuser)
      if (hasSuperuser) {
        const superuserRoleId = validRoles.find(r => r.is_superuser)!.id
        roleIds = [superuserRoleId] // override: only superuser
      }
    }

    // Remove all existing roles for this user
    await trx.query(
      `DELETE FROM admin.rel_user_roles WHERE user_id = $1`,
      [userId]
    )

    // Insert new roles
    if (roleIds.length > 0) {
      await trx.query(
        `INSERT INTO admin.rel_user_roles (user_id, role_id, granted_by, comment)
         SELECT $1, unnest($2::uuid[]), $3, $4`,
        [userId, roleIds, grantedBy, comment || 'bulk role assignment']
      )
    }

    // Return updated roles
    const { rows } = await trx.query(
      `SELECT r.id, r.codename, r.name, r.color, r.is_superuser, r.is_system
       FROM admin.rel_user_roles aur
       JOIN admin.cat_roles r ON r.id = aur.role_id
       WHERE aur.user_id = $1
         AND r._upl_deleted = false AND r._app_deleted = false`,
      [userId]
    )

    return rows
  })
}
```

### Step 1.9 — Admin-Side User Creation Endpoint

**File**: `packages/admin-backend/base/src/routes/globalUsersRoutes.ts`

Add POST `/create-user` endpoint. Requires `supabaseAdmin` client injected into factory config:

```typescript
const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128).optional(),
  roleIds: z.array(z.string().uuid()).min(1).max(20),
  comment: z.string().max(500).optional(),
})

router.post('/create-user',
  ensureGlobalAccess('users', 'create'),
  async (req, res, next) => {
    try {
      const parsed = CreateUserSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: formatZodError(parsed.error)
        })
      }

      const { email, password, roleIds, comment } = parsed.data
      const grantedBy = (req as RequestWithGlobalRole).user!.id

      // Create user via Supabase Admin API
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: password || undefined,
        email_confirm: true, // auto-confirm email
      })

      if (createError || !newUser?.user) {
        return res.status(400).json({
          success: false,
          error: createError?.message || 'Failed to create user'
        })
      }

      // Assign roles (reuses setUserRoles with superuser exclusivity)
      const roles = await globalAccessService.setUserRoles(
        newUser.user.id, roleIds, grantedBy, comment || 'created from admin panel'
      )

      res.status(201).json({
        success: true,
        data: {
          userId: newUser.user.id,
          email: newUser.user.email,
          roles
        }
      })
    } catch (error) {
      next(error)
    }
  }
)
```

**Note**: Extend `createGlobalUsersRoutes()` factory config to accept `supabaseAdmin` client, and build that client in `packages/universo-core-backend/base/src/routes/index.ts` from `SUPABASE_URL` + `SERVICE_ROLE_KEY`:
```typescript
export function createGlobalUsersRoutes(config: {
  globalAccessService: GlobalAccessService
  permissionService: PermissionService
  supabaseAdmin: SupabaseClient  // NEW: service_role client
}) { ... }
```

### Step 1.10 — Update Backend User List to Return Multiple Roles + Users Without Roles

**File**: `packages/admin-backend/base/src/services/globalAccessService.ts`

Update `listGlobalUsers()` to use LEFT JOIN and include users without roles:

```sql
SELECT
  u.id, u.email,
  COALESCE(p.onboarding_completed, false) AS onboarding_completed,
  p.created_at AS registered_at,
  COALESCE(
    json_agg(
      json_build_object(
        'id', r.id,
        'codename', r.codename,
        'name', r.name,
        'color', r.color,
        'is_superuser', r.is_superuser,
        'is_system', r.is_system
      )
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'
  ) AS roles
FROM auth.users u
LEFT JOIN profiles.cat_profiles p ON p.user_id = u.id
LEFT JOIN admin.rel_user_roles aur ON aur.user_id = u.id
LEFT JOIN admin.cat_roles r ON r.id = aur.role_id
  AND r._upl_deleted = false AND r._app_deleted = false
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.email, p.onboarding_completed, p.created_at
ORDER BY u.email
```

This replaces the current INNER JOIN pattern so that **users without any role** appear in the list with an empty `roles` array.

### Step 1.11 — Introduce Dedicated Admin Dashboard Stats Contract

**Files**:
- `packages/admin-backend/base/src/routes/dashboardRoutes.ts` *(new)*
- `packages/universo-core-backend/base/src/routes/index.ts`
- `packages/admin-frontend/base/src/api/adminApi.ts`
- `packages/admin-frontend/base/src/types.ts`
- `packages/admin-frontend/base/src/pages/AdminBoard.tsx`

Add `GET /api/v1/admin/dashboard/stats` and move both AdminBoard and Метапанель to that contract. Do **not** overload `/admin/global-users/stats`, because the metapanel cards aggregate multiple domains.

Suggested shared response shape:

```typescript
interface AdminDashboardStats {
  totalGlobalUsers: number
  byRole: Record<string, number>
  totalRoles: number
  totalApplications: number
  totalMetahubs: number
}
```

Applications and MetaHubs counts must be real active-row counts, not placeholder zeroes. AdminBoard may continue deriving role-specific legacy cards from `byRole` if needed.

### Step 1.12 — One-Time Data Migration for Existing Users

**File**: `packages/admin-backend/base/src/platform/migrations/index.ts`

Add migration SQL to `support` array (after role and permission seeds):

```sql
-- Grant 'user' role to all existing users who completed onboarding
INSERT INTO admin.rel_user_roles (user_id, role_id, granted_by, comment)
SELECT
  p.user_id,
  r.id,
  p.user_id,
  'migration: auto-assigned user role for onboarded users'
FROM profiles.cat_profiles p
CROSS JOIN admin.cat_roles r
WHERE p.onboarding_completed = true
  AND r.codename = 'user'
  AND r._upl_deleted = false AND r._app_deleted = false
  AND NOT EXISTS (
    SELECT 1 FROM admin.rel_user_roles aur
    WHERE aur.user_id = p.user_id AND aur.role_id = r.id
  );

-- Grant 'registered' role to users who haven't completed onboarding
INSERT INTO admin.rel_user_roles (user_id, role_id, granted_by, comment)
SELECT
  p.user_id,
  r.id,
  p.user_id,
  'migration: auto-assigned registered role for pre-onboarding users'
FROM profiles.cat_profiles p
CROSS JOIN admin.cat_roles r
WHERE (p.onboarding_completed IS NULL OR p.onboarding_completed = false)
  AND r.codename = 'registered'
  AND r._upl_deleted = false AND r._app_deleted = false
  AND NOT EXISTS (
    SELECT 1 FROM admin.rel_user_roles aur
    WHERE aur.user_id = p.user_id AND aur.role_id = r.id
  );
```

### Step 1.13 — Verify `/auth/permissions` Covers Menu Filtering and Ability Refresh

**File**: `packages/auth-backend/base/src/services/permissionService.ts`

The existing `getFullPermissions()` already returns `globalRoles` with codenames and metadata. No backend shape change is required here, but Phase 4/5 must consume this endpoint through `AbilityContextProvider.refreshAbility()` instead of assuming TanStack Query ownership.

**Checklist:**
- [ ] 1.1 — Seed `registered` and `user` system roles in admin migrations
- [ ] 1.2 — Seed permissions for new system roles
- [ ] 1.3 — Introduce a privileged injected helper for system-role provisioning
- [ ] 1.4 — Auto-assign `registered` role after registration in auth routes via the injected helper
- [ ] 1.5 — Onboarding completion role transition (add `user` role) via the same injected helper
- [ ] 1.6 — Add `AUTO_ROLE_AFTER_ONBOARDING` and `SERVICE_ROLE_KEY` placeholders to `.env.example`
- [ ] 1.6 — Role copy backend route POST `/:id/copy` with Zod validation + transaction
- [ ] 1.7 — Multi-role set endpoint PUT `/:memberId/roles` with Zod UUID validation + self-modification guard
- [ ] 1.8 — Add `setUserRoles()` to GlobalAccessService with superuser exclusivity in transaction
- [ ] 1.9 — Admin-side user creation endpoint POST `/create-user` via Supabase Admin API
- [ ] 1.10 — Update user list to LEFT JOIN → show roles array + users without roles
- [ ] 1.11 — Add dedicated admin dashboard stats route and shared client contract for AdminBoard + Метапанель
- [ ] 1.12 — One-time data migration for existing users
- [ ] 1.13 — Verify `/auth/permissions` covers menu filtering + `AbilityContext` refresh needs

---

## Phase 2 — Roles UI Refactoring

**Goal**: Refactor Roles UI: (1) use EntityFormDialog for create/edit/copy of **basic fields only** (name, codename, color, description), (2) refactor RoleEdit page into tabbed layout with Permissions + Settings tabs, (3) rename "Уникальный идентификатор" to "Кодовое имя", (4) existing `PermissionMatrix` and `ColorPicker` components are reused as-is.

### Step 2.1 — Create RoleFormDialog for Create/Edit/Copy (Basic Fields Only)

**File**: `packages/admin-frontend/base/src/components/RoleFormDialog.tsx` *(new)*

Uses `EntityFormDialog` from `@universo/template-mui`. **No permissions tab** in this dialog — permissions are managed on the Role Detail Page per TZ requirement.

```tsx
import { EntityFormDialog } from '@universo/template-mui'
import { useTranslation } from 'react-i18next'
import { ColorPicker } from './ColorPicker' // existing component

interface RoleFormDialogProps {
  open: boolean
  mode: 'create' | 'edit' | 'copy'
  role?: RoleListItem | null
  onClose: () => void
  onSave: (data: RoleFormData) => Promise<void>
  onDelete?: () => Promise<void>
}

export const RoleFormDialog: React.FC<RoleFormDialogProps> = ({
  open, mode, role, onClose, onSave, onDelete
}) => {
  const { t } = useTranslation('admin')

  return (
    <EntityFormDialog
      open={open}
      mode={mode}
      title={
        mode === 'create' ? t('roles.dialog.createTitle') :
        mode === 'copy' ? t('roles.dialog.copyTitle') :
        t('roles.dialog.editTitle')
      }
      nameLabel={t('roles.fields.name')}
      descriptionLabel={t('roles.fields.description')}
      initialName={role?.name || ''}
      initialDescription={role?.description || ''}
      initialExtraValues={{
        codename: mode === 'copy' ? '' : (role?.codename || ''),
        color: role?.color || '#9e9e9e',
        ...(mode === 'copy' ? { copyPermissions: false } : {}),
      }}
      extraFields={({ values, setValue, isLoading }) => (
        <>
          <TextField
            label={t('roles.fields.codename')}
            value={values.codename}
            onChange={(e) => setValue('codename', e.target.value)}
            disabled={isLoading || (mode === 'edit' && role?.is_system)}
            helperText={
              role?.is_system
                ? t('roles.fields.codenameSystemHint')
                : t('roles.fields.codenameHint')
            }
            fullWidth
            size="small"
          />
          <ColorPicker
            value={values.color}
            onChange={(color) => setValue('color', color)}
            label={t('roles.fields.color')}
          />
          {mode === 'copy' && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={values.copyPermissions || false}
                  onChange={(e) => setValue('copyPermissions', e.target.checked)}
                />
              }
              label={t('roles.dialog.copyPermissions')}
            />
          )}
        </>
      )}
      validate={(values) => {
        const errors: Record<string, string> = {}
        if (!values.codename || values.codename.length < 2) {
          errors.codename = t('roles.validation.codenameRequired')
        }
        if (!/^[a-z][a-z0-9_]*$/.test(values.codename)) {
          errors.codename = t('roles.validation.codenameFormat')
        }
        return Object.keys(errors).length > 0 ? errors : null
      }}
      onSave={onSave}
      onClose={onClose}
      onDelete={mode === 'edit' && !role?.is_system ? onDelete : undefined}
      showDeleteButton={mode === 'edit' && !role?.is_system}
      deleteButtonDisabled={role?.userCount > 0}
      deleteButtonDisabledReason={t('roles.delete.hasUsersHint')}
    />
  )
}
```

After creating a role → navigate to the new role's detail page: `/admin/instance/:instanceId/roles/:newRoleId`. This matches ТЗ п.8: "создать роль → потом внутри наполнить правами".

### Step 2.2 — Refactor RoleEdit.tsx Into Tabbed Layout

**File**: `packages/admin-frontend/base/src/pages/RoleEdit.tsx` *(existing, refactor)*

Refactor the existing monolithic page into a tabbed layout with two tabs. The existing `PermissionMatrix` component (from `../components/PermissionMatrix`) is already table-based with MUI `<Table>` and `showSelectAll` — it is **reused as-is**.

**Tab 1 — "Права доступа" (Permissions)**:
- Contains the existing `PermissionMatrix` component
- `showSelectAll={true}` — already supported
- For superuser roles: all checkboxes checked and disabled (existing `disabled` prop), plus an `<Alert severity="info">` explaining full access

**Tab 2 — "Настройки" (Settings)**:
- System role badge (`Chip` — system / custom)
- Superuser toggle (existing `Switch` for `isSuperuser`, disabled for system roles)
- Admin access info alert (existing)
- Role metadata (creation date, etc.)

Basic form fields (codename, color, name, description) remain above the tabs, always visible.

```tsx
// Simplified structure of refactored RoleEdit.tsx
import { Tabs, Tab, Box, Chip, Alert, Switch, FormControlLabel, Button, Stack, Divider } from '@mui/material'
import { PermissionMatrix } from '../components/PermissionMatrix'
import { ColorPicker } from '../components/ColorPicker'
import { getVLCString } from '@universo/utils'

return (
  <Stack spacing={2}>
    {/* Header: back button + title */}
    <ViewHeader title={isNew ? t('roles.createTitle') : getVLCString(role?.name, locale)} />

    {/* Basic fields card (always visible, above tabs) */}
    <MainCard>
      <Stack spacing={2}>
        <TextField
          label={t('roles.fields.codename')}
          value={formState.codename}
          onChange={handleCodenameChange}
          disabled={isSaving || isSystemRole}
          helperText={isSystemRole ? t('roles.fields.codenameSystemHint') : t('roles.fields.codenameHint')}
          fullWidth size="small"
        />
        <ColorPicker
          value={formState.color}
          onChange={handleColorChange}
          label={t('roles.fields.color')}
        />
        <LocalizedInlineField
          label={t('roles.fields.name')}
          value={formState.name}
          onChange={handleNameChange}
        />
        <LocalizedInlineField
          label={t('roles.fields.description')}
          value={formState.description}
          onChange={handleDescChange}
        />
      </Stack>
    </MainCard>

    {/* Tabbed section */}
    <MainCard>
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
        <Tab label={t('roles.tabs.permissions')} />
        <Tab label={t('roles.tabs.settings')} />
      </Tabs>

      {activeTab === 0 && (
        <Box sx={{ pt: 2 }}>
          {role?.is_superuser && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {t('roles.permissions.superuserNotice')}
            </Alert>
          )}
          <PermissionMatrix
            permissions={formState.permissions}
            onChange={handlePermissionsChange}
            disabled={isSaving || isSystemRole}
            showSelectAll
          />
        </Box>
      )}

      {activeTab === 1 && (
        <Box sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Chip
              label={isSystemRole ? t('roles.settings.systemRole') : t('roles.settings.customRole')}
              color={isSystemRole ? 'primary' : 'default'}
              size="small"
            />
            {!isSystemRole && (
              <FormControlLabel
                control={
                  <Switch
                    checked={formState.isSuperuser}
                    onChange={handleSuperuserToggle}
                    disabled={isSaving}
                  />
                }
                label={t('roles.field.isSuperuser')}
              />
            )}
            {formState.isSuperuser && (
              <Alert severity="warning">{t('roles.settings.superuserWarning')}</Alert>
            )}
            {isSystemRole && (
              <Alert severity="info">{t('roles.settings.systemRoleNotice')}</Alert>
            )}
          </Stack>
        </Box>
      )}
    </MainCard>

    {/* Save / Cancel buttons */}
    <Stack direction="row" spacing={2} justifyContent="flex-end">
      <Button variant="outlined" onClick={handleBack}>{tc('actions.cancel')}</Button>
      <Button variant="contained" onClick={handleSubmit} disabled={isSaving}>
        {isNew ? t('roles.create') : tc('actions.save')}
      </Button>
    </Stack>
  </Stack>
)
```

**Key points:**
- **Keep the existing page and route** (`/admin/instance/:instanceId/roles/:roleId`)
- Rename i18n label "Уникальный идентификатор" → "Кодовое имя"
- Existing `PermissionMatrix` is **reused as-is** (no new component)
- Existing `ColorPicker` from `../components/ColorPicker` is reused (NOT `ColorPickerField`)
- Uses `getVLCString(field, locale)` from `@universo/utils` (NOT `getVlcContent`)

### Step 2.3 — Update RolesList.tsx to Use BaseEntityMenu + Dialog

**File**: `packages/admin-frontend/base/src/pages/RolesList.tsx` *(existing, refactor)*

Add `BaseEntityMenu` with action descriptors for create/copy/delete. The "edit" action navigates to the Role Detail Page (does not open dialog).

```tsx
import { BaseEntityMenu } from '@universo/template-mui'
import type { ActionDescriptor } from '@universo/template-mui'

const roleActionDescriptors: ActionDescriptor<RoleListItem>[] = [
  {
    id: 'open',
    labelKey: 'roles.actions.edit',
    icon: <IconEdit size={18} />,
    order: 1,
    // Navigate to detail page (not dialog) — per TZ п.3 requirement
    onSelect: (ctx) => {
      navigate(`/admin/instance/${instanceId}/roles/${ctx.entity.id}`)
    },
  },
  {
    id: 'copy',
    labelKey: 'roles.actions.copy',
    icon: <IconCopy size={18} />,
    order: 2,
    dialog: {
      loader: () => import('../components/RoleFormDialog').then(m => ({ default: m.RoleFormDialog })),
      buildProps: (ctx) => ({
        mode: 'copy',
        role: ctx.entity,
        onSave: async (data: RoleFormData) => {
          const result = await copyRoleMutation.mutateAsync({
            sourceRoleId: ctx.entity.id,
            ...data,
          })
          // Navigate to new role's detail page to add permissions
          navigate(`/admin/instance/${instanceId}/roles/${result.id}`)
        },
      }),
    },
  },
  {
    id: 'delete',
    labelKey: 'roles.actions.delete',
    icon: <IconTrash size={18} />,
    tone: 'danger',
    order: 10,
    dividerBefore: true,
    visible: (ctx) => !ctx.entity.is_system,
    enabled: (ctx) => ctx.entity.userCount === 0,
    confirm: (ctx) => ({
      titleKey: 'roles.delete.confirmTitle',
      descriptionKey: 'roles.delete.confirmDescription',
      confirmKey: 'common.delete',
      cancelKey: 'common.cancel',
    }),
    onSelect: (ctx) => deleteRoleMutation.mutateAsync(ctx.entity.id),
  },
]
```

The "Add Role" button opens `RoleFormDialog` in create mode. On successful creation → navigate to the new role's detail page to add permissions.

### Step 2.4 — Add TanStack Query Mutations for Role CRUD + Copy

**File**: `packages/admin-frontend/base/src/hooks/useRoleMutations.ts` *(new)*

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useRoleMutations() {
  const queryClient = useQueryClient()

  const createRole = useMutation({
    mutationFn: (data: CreateRolePayload) => rolesApi.createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rolesQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: rolesQueryKeys.assignable() })
    },
  })

  const updateRole = useMutation({
    mutationFn: ({ id, ...data }: UpdateRolePayload & { id: string }) =>
      rolesApi.updateRole(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: rolesQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: rolesQueryKeys.detail(variables.id) })
    },
  })

  const copyRole = useMutation({
    mutationFn: (data: CopyRolePayload) => rolesApi.copyRole(data.sourceRoleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rolesQueryKeys.all })
    },
  })

  const deleteRole = useMutation({
    mutationFn: (id: string) => rolesApi.deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rolesQueryKeys.all })
    },
  })

  return { createRole, updateRole, copyRole, deleteRole }
}
```

**Checklist:**
- [ ] 2.1 — Create RoleFormDialog (basic fields only: name, codename, color, description, copyPermissions checkbox for copy mode)
- [ ] 2.2 — Refactor RoleEdit.tsx into tabbed layout (Permissions + Settings tabs) using existing PermissionMatrix + ColorPicker
- [ ] 2.3 — Update RolesList to use BaseEntityMenu with navigate-to-detail for edit
- [ ] 2.4 — Add TanStack Query mutations for role CRUD + copy

---

## Phase 3 — User Management & Multi-Role Assignment

**Goal**: Rework user management: multi-role assignment via EntitySelectionPanel, tabbed user dialog ("Основное" + "Роли"), admin-side user creation UI, show users without roles, multi-role chip display.

### Step 3.1 — Create UserFormDialog With Two Tabs

**File**: `packages/admin-frontend/base/src/components/UserFormDialog.tsx` *(new)*

Uses `EntityFormDialog` with `hideDefaultFields` (no name/description) and **two tabs per TZ п.6**:
- Tab 1: "Основное" (General) — user info (email, registration date, onboarding status; for create mode: email + password fields)
- Tab 2: "Роли" (Roles) — EntitySelectionPanel for multi-role assignment

```tsx
import { EntityFormDialog, EntitySelectionPanel } from '@universo/template-mui'
import { getVLCString } from '@universo/utils'

interface UserFormDialogProps {
  open: boolean
  mode: 'edit' | 'create'
  user: GlobalUserMember | null
  onClose: () => void
  onSave: (data: { email?: string; password?: string; roleIds: string[] }) => Promise<void>
}

export const UserFormDialog: React.FC<UserFormDialogProps> = ({
  open, mode, user, onClose, onSave
}) => {
  const { t, i18n } = useTranslation('admin')
  const locale = i18n.language

  const { data: allRoles = [] } = useQuery({
    queryKey: ['admin', 'roles', 'assignable'],
    queryFn: () => adminApi.getAssignableRoles(),
    enabled: open,
  })

  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(
    user?.roles?.map((r: { id: string }) => r.id) || []
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedRoleIds(user?.roles?.map((r: { id: string }) => r.id) || [])
      setEmail('')
      setPassword('')
    }
  }, [open, user])

  return (
    <EntityFormDialog
      open={open}
      mode={mode}
      title={
        mode === 'create'
          ? t('users.dialog.createTitle')
          : t('users.dialog.editTitle', { email: user?.email })
      }
      hideDefaultFields
      tabs={() => [
        {
          id: 'basic',
          label: t('users.tabs.basic'),
          content: (
            <Stack spacing={2}>
              {mode === 'create' ? (
                <>
                  <TextField
                    label={t('users.fields.email')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    fullWidth
                    size="small"
                    type="email"
                  />
                  <TextField
                    label={t('users.fields.password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    fullWidth
                    size="small"
                    helperText={t('users.fields.passwordHint')}
                  />
                </>
              ) : (
                <Stack spacing={1}>
                  <Typography variant="body2">
                    <strong>{t('users.fields.email')}:</strong> {user?.email}
                  </Typography>
                  <Typography variant="body2">
                    <strong>{t('users.fields.registeredAt')}:</strong>{' '}
                    {user?.registered_at ? new Date(user.registered_at).toLocaleDateString() : '—'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>{t('users.fields.onboardingStatus')}:</strong>{' '}
                    {user?.onboarding_completed
                      ? t('users.fields.onboardingCompleted')
                      : t('users.fields.onboardingPending')
                    }
                  </Typography>
                </Stack>
              )}
            </Stack>
          ),
        },
        {
          id: 'roles',
          label: t('users.tabs.roles'),
          content: (
            <EntitySelectionPanel
              availableEntities={allRoles}
              selectedIds={selectedRoleIds}
              onSelectionChange={setSelectedRoleIds}
              getDisplayName={(role) => getVLCString(role.name, locale)}
              getCodename={(role) => role.codename}
              labels={{
                title: t('users.roles.title'),
                addButton: t('users.roles.addButton'),
                dialogTitle: t('users.roles.dialogTitle'),
                emptyMessage: t('users.roles.emptyMessage'),
                noAvailableMessage: t('users.roles.noAvailableMessage'),
                searchPlaceholder: t('users.roles.searchPlaceholder'),
                cancelButton: tc('actions.cancel'),
                confirmButton: tc('actions.confirm'),
                removeTitle: t('users.roles.removeTitle'),
                nameHeader: t('users.roles.nameHeader'),
                codenameHeader: t('users.roles.codenameHeader'),
              }}
            />
          ),
        },
      ]}
      onSave={async () => {
        if (mode === 'create') {
          await onSave({ email, password: password || undefined, roleIds: selectedRoleIds })
        } else {
          await onSave({ roleIds: selectedRoleIds })
        }
      }}
      onClose={onClose}
    />
  )
}
```

### Step 3.2 — Update InstanceUsers.tsx for Multi-Role Display + Roleless Users

**File**: `packages/admin-frontend/base/src/pages/InstanceUsers.tsx` *(existing, refactor)*

Update user cards/table to show multiple role chips and display users without roles:

```tsx
// In user card rendering — replace single role display with role chips
<Stack direction="row" spacing={0.5} flexWrap="wrap">
  {user.roles.length > 0 ? (
    user.roles.map((role: { id: string; name: any; color: string; codename: string }) => (
      <Chip
        key={role.id}
        label={getVLCString(role.name, locale)}
        size="small"
        sx={{
          bgcolor: role.color + '20',
          color: role.color,
          borderColor: role.color,
          border: '1px solid',
        }}
      />
    ))
  ) : (
    <Chip label={t('users.noRoles')} size="small" color="default" variant="outlined" />
  )}
</Stack>
```

Also add:
1. "Create User" button that opens `UserFormDialog` in `mode='create'`.
2. Context menu / row click opens `UserFormDialog` in `mode='edit'`.

### Step 3.3 — Replace MemberFormDialog With UserFormDialog

Replace existing `MemberFormDialog` usage with the new `UserFormDialog` from Step 3.1 for both create and edit flows. Remove the old single-role invite pattern.

**Checklist:**
- [ ] 3.1 — Create UserFormDialog with "Основное" + "Роли" tabs (including create mode with email/password)
- [ ] 3.2 — Update InstanceUsers.tsx for multi-role chip display + roleless users + create user button
- [ ] 3.3 — Replace MemberFormDialog with UserFormDialog for create + edit flows

---

## Phase 4 — Onboarding Integration & Role Lifecycle

**Goal**: Make the completion CTA the single authoritative lifecycle boundary and refresh authorization through `AbilityContext`.

### Step 4.1 — Refactor `OnboardingWizard` to Sync Selections Only

**File**: `packages/start-frontend/base/src/components/OnboardingWizard.tsx`

The wizard should continue saving selections on the last data step, but it must stop calling `completeOnboarding()` before the completion screen is shown. The last data step should only:
- call `syncSelections(...)`
- advance to the `completion` step
- stop short of any role/lifecycle mutation

This removes the current duplicate-completion seam and aligns the flow with the TZ button semantics.

### Step 4.2 — Update `CompletionStep.tsx`

**File**: `packages/start-frontend/base/src/components/CompletionStep.tsx` *(existing, modify)*

Add a primary "Start Acting" button that calls `completeOnboarding()`, then refreshes authorization via `useAbility().refreshAbility()`:

```tsx
const handleStartActing = async () => {
  setLoading(true)
  try {
    await completeOnboarding()
    await refreshAbility()

    // If user received any non-registered role → enter the main product flow.
    // If AUTO_ROLE_AFTER_ONBOARDING=false and the user is still registered-only,
    // stay on /start completion state and wait for admin-granted access.
    navigate(nextRouteBasedOnRoles)
  } catch (error) {
    console.error('Failed to complete onboarding:', error)
    setError(t('onboarding.completion.error'))
  } finally {
    setLoading(false)
  }
}

return (
  <Stack spacing={3} alignItems="center">
    {/* ... existing hero image and text ... */}
    <Stack direction="row" spacing={2}>
      <Button
        variant="contained"
        color="primary"
        size="large"
        onClick={handleStartActing}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={20} /> : <IconRocket size={20} />}
      >
        {t('onboarding.completion.startActing')}
      </Button>
      <Button
        variant="outlined"
        onClick={handleStartOver}
        disabled={loading}
      >
        {t('onboarding.completion.startOver')}
      </Button>
    </Stack>
  </Stack>
)
```

### Step 4.3 — Preserve the Completed Registered-Only State on `/start`

When `AUTO_ROLE_AFTER_ONBOARDING=false`, the user remains registered-only even after onboarding is complete. The `/start` route must therefore keep rendering the completion state instead of redirecting into the main shell or falling into a redirect loop.

**Checklist:**
- [ ] 4.1 — Refactor `OnboardingWizard` so completion is not called before the CTA
- [ ] 4.2 — Add "Start Acting" button to `CompletionStep` and refresh auth via `AbilityContext`
- [ ] 4.3 — Preserve the completed registered-only state on `/start` when auto role assignment is disabled

---

## Phase 5 — Метапанель Package & Role-Based Menus

**Goal**: Create new `metapanel-frontend` package, add explicit `/start` + home redirect topology, and gate the real shell/menu structure without hidden seams.

### Step 5.1 — Create `metapanel-frontend` Package

**Directory**: `packages/metapanel-frontend/base/`

Structure:

```
packages/metapanel-frontend/
  base/
    src/
      index.ts              # Package entry
      MetapanelDashboard.tsx # Main dashboard component
    dist/                    # Build output
    tsconfig.json
    tsconfig.esm.json
    package.json
```

**package.json** (key fields):

```json
{
  "name": "@universo/metapanel-frontend",
  "version": "0.1.0",
  "main": "dist/cjs/index.js",
  "module": "dist/esm/index.js",
  "types": "dist/cjs/index.d.ts",
  "scripts": {
    "build": "tsdown src/index.ts --format cjs,esm --dts",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@universo/template-mui": "workspace:*",
    "@universo/store": "workspace:*",
    "@universo/types": "workspace:*",
    "@universo/i18n": "workspace:*",
    "react": "^18.0.0",
    "@mui/material": "^5.0.0",
    "@tabler/icons-react": "^3.0.0"
  }
}
```

### Step 5.2 — MetapanelDashboard Component

**File**: `packages/metapanel-frontend/base/src/MetapanelDashboard.tsx`

Uses `StatCard` directly in a responsive `Grid` layout. **Important**: `MainGrid` has hardcoded cards and does NOT accept a `cards` prop. The dashboard composes `StatCard` + `Grid` directly.

**Stat cards per TZ п.5**: Приложения (доступ), Метахабы (доступ), Глобальные роли (количество).

Use the dedicated dashboard stats contract from Phase 1, not `/admin/global-users/stats`.

```tsx
import { StatCard } from '@universo/template-mui'
import { Box, Typography, Grid } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'

export const MetapanelDashboard: React.FC = () => {
  const { t } = useTranslation('metapanel')

  const { data: stats } = useQuery({
    queryKey: ['metapanel', 'stats'],
    queryFn: () =>
      fetch('/api/v1/admin/dashboard/stats')
        .then(r => r.json())
        .then(r => r.data),
  })

  return (
    <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto' }}>
      <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
        {t('dashboard.title')}
      </Typography>

      <Grid container spacing={2} columns={12} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} lg={4}>
          <StatCard
            title={t('dashboard.applications')}
            value={String(stats?.totalApplications ?? 0)}
            interval={t('dashboard.access')}
            trend="neutral"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={4}>
          <StatCard
            title={t('dashboard.metahubs')}
            value={String(stats?.totalMetahubs ?? 0)}
            interval={t('dashboard.access')}
            trend="neutral"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={4}>
          <StatCard
            title={t('dashboard.globalRoles')}
            value={String(stats?.totalRoles ?? 0)}
            interval={t('dashboard.count')}
            trend="neutral"
          />
        </Grid>
      </Grid>
    </Box>
  )
}
```

### Step 5.3 — Add Explicit `/start` Route and Root Home Resolver

**Files**:
- `packages/universo-template-mui/base/src/routes/MainRoutesMUI.tsx`
- `packages/start-frontend/base/src/views/StartPage.tsx`
- `packages/start-frontend/base/src/views/AuthenticatedStartPage.tsx`

Routing changes required by the live shell architecture:
- `/` becomes a resolver route: guest landing for unauthenticated visitors, `/start` for registered-only authenticated users, `/metapanel` for users with any non-registered role
- `/start` becomes the explicit onboarding/completion route
- authenticated users with non-registered roles must not keep landing on the start flow after onboarding

Add a small resolver component or route element that reads auth + global roles and redirects accordingly.

### Step 5.4 — Add Метапанель to `rootMenuItems`

**File**: `packages/universo-template-mui/base/src/navigation/menuConfigs.ts`

Add Метапанель as the first item:

```typescript
import { IconHome2 } from '@tabler/icons-react'

export const rootMenuItems: TemplateMenuItem[] = [
    {
        id: 'metapanel',
        titleKey: 'metapanel',
        url: '/metapanel',
        icon: IconHome2
    },
    // ... existing items (applications, profile, docs)
]
```

### Step 5.5 — Create `RegisteredUserGuard` and `StartAccessGuard`

**Files**:
- `packages/universo-template-mui/base/src/components/routing/RegisteredUserGuard.tsx` *(new)*
- `packages/universo-template-mui/base/src/components/routing/StartAccessGuard.tsx` *(new)*

`RegisteredUserGuard` blocks registered-only users from the main shell. `StartAccessGuard` does the inverse for `/start`: authenticated users with any non-registered role are redirected to `/metapanel`.

Properly typed — no `(r: any)` cast:

```tsx
import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@universo/auth-frontend'
import { useHasGlobalAccess } from '@universo/store'
import { Loader } from '../feedback/loading'
import type { GlobalRoleInfo } from '@universo/types'

export const RegisteredUserGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { globalRoles, loading: accessLoading, hasAnyGlobalRole } = useHasGlobalAccess()

  if (authLoading || accessLoading) return <Loader />
  if (!isAuthenticated) return <Navigate to="/auth" replace />

  // User has no roles at all — send to start page
  if (!hasAnyGlobalRole) return <Navigate to="/start" replace />

  // If ALL of the user's roles are 'registered' → redirect to /start
  const roleCodes = (globalRoles as GlobalRoleInfo[]).map(r => r.codename)
  const onlyRegistered = roleCodes.length > 0 && roleCodes.every(c => c === 'registered')

  if (onlyRegistered) return <Navigate to="/start" replace />

  return <>{children}</>
}
```

Wrap the **entire** main shell with `RegisteredUserGuard`; do not only guard `/metapanel`, because applications/profile/admin/metahubs are also outside the allowed registered-only flow.

### Step 5.6 — Add Section-Aware Role-Based Menu Filtering

**File**: `packages/universo-template-mui/base/src/components/dashboard/MenuContent.tsx` *(existing, modify)*

Add filtering logic to the real shell structure, not only to `rootMenuItems`:

```tsx
import { useHasGlobalAccess } from '@universo/store'
import { ROLE_MENU_VISIBILITY } from '@universo/types'
import type { GlobalRoleInfo } from '@universo/types'

// Inside MenuContent component
const { globalRoles, isSuperuser, canAccessAdminPanel } = useHasGlobalAccess()

const shellVisibility = useMemo(() => {
  if (isSuperuser) {
    return { rootMenuIds: null, showMetahubsSection: true }
  }

  const roleCodes = (globalRoles as GlobalRoleInfo[]).map(r => r.codename)
  const rootMenuIds = new Set<string>()
  let showMetahubsSection = false

  for (const code of roleCodes) {
    const visibility = ROLE_MENU_VISIBILITY[code]
    if (visibility) {
      visibility.rootMenuIds.forEach(id => rootMenuIds.add(id))
      showMetahubsSection = showMetahubsSection || Boolean(visibility.showMetahubsSection)
    }
  }

  return { rootMenuIds, showMetahubsSection }
}, [globalRoles, isSuperuser])

const filteredRootMenuItems = useMemo(() => {
  if (shellVisibility.rootMenuIds === null) return rootMenuItems
  return rootMenuItems.filter(item => shellVisibility.rootMenuIds.has(item.id))
}, [shellVisibility])

const showAdminSection = isSuperuser || canAccessAdminPanel
const showMetahubsSection = isSuperuser || shellVisibility.showMetahubsSection
```

### Step 5.7 — Add `/metapanel` Route and Wrap the Main Shell

**File**: `packages/universo-template-mui/base/src/routes/MainRoutesMUI.tsx` *(existing, modify)*

```tsx
import { MetapanelDashboard } from '@universo/metapanel-frontend'
import { RegisteredUserGuard } from '../components/routing/RegisteredUserGuard'
import { StartAccessGuard } from '../components/routing/StartAccessGuard'

// /start route stays outside MainLayoutMUI, protected by StartAccessGuard/AuthGuard.
// Main shell is wrapped once by RegisteredUserGuard.
```

### Step 5.8 — Register i18n Namespace & Package Entry

**File**: `packages/metapanel-frontend/base/src/index.ts`

```typescript
export { MetapanelDashboard } from './MetapanelDashboard'
```

Add metapanel i18n namespace files under `packages/universo-i18n/base/` for EN and RU locales.

**Checklist:**
- [ ] 5.1 — Create `metapanel-frontend` package with dual-build (tsdown, tsconfig.json + tsconfig.esm.json)
- [ ] 5.2 — MetapanelDashboard with StatCard grid (Applications, MetaHubs, Global Roles)
- [ ] 5.3 — Add explicit `/start` route and root home resolver
- [ ] 5.4 — Add Метапанель to rootMenuItems (first position)
- [ ] 5.5 — Create `RegisteredUserGuard` + `StartAccessGuard` with typed global roles
- [ ] 5.6 — Add section-aware role-based menu filtering in `MenuContent`
- [ ] 5.7 — Add `/metapanel` route and wrap the main shell in `RegisteredUserGuard`
- [ ] 5.8 — Register metapanel-frontend package entry + i18n namespace

---

## Testing Strategy

### Unit Tests

| Package | File | Coverage |
|---|---|---|
| `@universo/types` | `src/abilities/__tests__/index.test.ts` | New subjects map, defineAbilitiesFor with new subjects |
| `@universo/admin-backend` | `src/tests/routes/rolesRoutes.test.ts` | Role copy route (codename validation, permissions copy, transaction rollback, duplicate codename 409) |
| `@universo/admin-backend` | `src/tests/routes/globalUsersRoutes.test.ts` | Multi-role set (superuser exclusivity, self-modification 400, Zod UUID array validation), user creation (Supabase call, role assignment) |
| `@universo/admin-backend` | `src/tests/services/globalAccessService.test.ts` | `setUserRoles` (transaction, superuser clears others, empty roleIds removes all, invalid UUID 400) |
| `@universo/auth-backend` | `src/tests/routes/auth.test.ts` | Registration auto-assigns `registered` role |
| `@universo/start-backend` | `src/tests/routes/onboardingRoutes.test.ts` | Onboarding completion adds `user` role (ENV true), no role when ENV false |
| `@universo/admin-frontend` | `src/components/__tests__/RoleFormDialog.test.tsx` | Create/edit/copy modes, codename validation, no permissions tab, copyPermissions checkbox |
| `@universo/admin-frontend` | `src/pages/__tests__/RoleEdit.test.tsx` | Tab switching, PermissionMatrix on tab 1, Settings on tab 2, superuser lock |
| `@universo/admin-frontend` | `src/components/__tests__/UserFormDialog.test.tsx` | Two tabs (Основное + Роли), EntitySelectionPanel, create mode (email+password), edit mode (read-only info) |
| `@universo/start-frontend` | `src/components/__tests__/CompletionStep.test.tsx` | CTA calls `completeOnboarding`, uses `refreshAbility`, redirects based on roles |
| `@universo/start-frontend` | `src/components/__tests__/OnboardingWizard.test.tsx` | Last data step only calls `syncSelections`, not `completeOnboarding` |
| `@universo/metapanel-frontend` | `src/__tests__/MetapanelDashboard.test.tsx` | Renders 3 stat cards, loading state, correct stat labels |
| `@universo/template-mui` | `src/components/routing/__tests__/RegisteredUserGuard.test.tsx` | Registered-only users are blocked from the main shell; user+registered and superuser pass through |
| `@universo/template-mui` | `src/components/routing/__tests__/StartAccessGuard.test.tsx` | Registered-only users can access `/start`; non-registered users redirect to `/metapanel` |
| `@universo/template-mui` | `src/routes/__tests__/HomeRouteResolver.test.tsx` | `/` resolves guest vs `/start` vs `/metapanel` correctly |

### Integration Tests

| Scenario | Coverage |
|---|---|
| Registration → Role Assignment | Register user → verify `registered` role assigned in DB |
| Onboarding → Role Transition | Complete onboarding with `AUTO_ROLE_AFTER_ONBOARDING=true` → verify `user` role added |
| Onboarding → No Transition | Complete with `AUTO_ROLE_AFTER_ONBOARDING=false` → verify role unchanged |
| Role Copy → Permission Inheritance | Copy role with `copyPermissions=true` → verify permissions duplicated in transaction |
| Role Copy → No Permissions | Copy role with `copyPermissions=false` → verify empty permissions |
| Multi-Role Set → Superuser Exclusivity | Set roles including superuser → verify only superuser remains |
| Multi-Role Set → Permissions Merge | Set 2 non-superuser roles → verify `getFullPermissions` returns merged abilities |
| System Role Guards | Attempt to delete system role → verify 403/400 |
| Menu Filtering | Login as registered-only user → verify only start menu visible |
| Admin User Creation | Create user from admin → verify Supabase user exists + roles assigned |
| Self-Modification Guard | Attempt to modify own roles → verify 400 |
| Data Migration | After migration → verify all onboarded users have `user` role, non-onboarded have `registered` |

### Test Code Example (Backend)

```typescript
// rolesRoutes.test.ts — Role copy
describe('POST /api/v1/admin/roles/:id/copy', () => {
  it('should copy role with permissions in a transaction', async () => {
    const sourceRole = await createTestRole(exec, {
      codename: 'editor',
      permissions: [
        { subject: 'publications', action: 'manage' },
      ],
    })

    const res = await request(app)
      .post(`/api/v1/admin/roles/${sourceRole.id}/copy`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        codename: 'editor_copy',
        name: vlcContent('Editor Copy'),
        copyPermissions: true,
      })

    expect(res.status).toBe(201)
    expect(res.body.data.codename).toBe('editor_copy')
    expect(res.body.data.is_system).toBe(false)
    expect(res.body.data.is_superuser).toBe(false)
    expect(res.body.data.permissionCount).toBe(1)
  })

  it('should reject duplicate codename', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/roles/${existingRole.id}/copy`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ codename: 'superuser', name: vlcContent('Dup') })

    expect(res.status).toBe(409)
  })

  it('should validate codename format via Zod', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/roles/${existingRole.id}/copy`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ codename: '123invalid', name: vlcContent('Test') })

    expect(res.status).toBe(400)
  })
})

// globalUsersRoutes.test.ts — Superuser exclusivity
describe('PUT /api/v1/admin/global-users/:memberId/roles', () => {
  it('should enforce superuser exclusivity', async () => {
    const superuserRole = await getRoleByCodename(exec, 'superuser')
    const userRole = await getRoleByCodename(exec, 'user')

    const res = await request(app)
      .put(`/api/v1/admin/global-users/${targetUserId}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleIds: [superuserRole.id, userRole.id] })

    expect(res.status).toBe(200)
    // Only superuser should remain
    expect(res.body.data.roles).toHaveLength(1)
    expect(res.body.data.roles[0].codename).toBe('superuser')
  })

  it('should reject self-modification', async () => {
    const res = await request(app)
      .put(`/api/v1/admin/global-users/${adminUserId}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleIds: [] })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('own roles')
  })
})
```

### Test Code Example (Frontend)

```tsx
// RegisteredUserGuard.test.tsx
describe('RegisteredUserGuard', () => {
  it('redirects registered-only user to /start', () => {
    mockUseHasGlobalAccess.mockReturnValue({
      globalRoles: [{ codename: 'registered' }],
      hasAnyGlobalRole: true,
      loading: false,
    })
    mockUseAuth.mockReturnValue({ isAuthenticated: true, loading: false })

    render(
      <MemoryRouter initialEntries={['/metapanel']}>
        <Routes>
          <Route path="/metapanel" element={
            <RegisteredUserGuard><div>Dashboard</div></RegisteredUserGuard>
          } />
          <Route path="/start" element={<div>Start</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Start')).toBeInTheDocument()
  })

  it('allows user role through', () => {
    mockUseHasGlobalAccess.mockReturnValue({
      globalRoles: [{ codename: 'user' }, { codename: 'registered' }],
      hasAnyGlobalRole: true,
      loading: false,
    })
    mockUseAuth.mockReturnValue({ isAuthenticated: true, loading: false })

    render(
      <MemoryRouter initialEntries={['/metapanel']}>
        <Routes>
          <Route path="/metapanel" element={
            <RegisteredUserGuard><div>Dashboard</div></RegisteredUserGuard>
          } />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
})
```

---

## i18n Keys Plan

### admin namespace (EN)

```json
{
  "roles.dialog.createTitle": "Create Role",
  "roles.dialog.editTitle": "Edit Role",
  "roles.dialog.copyTitle": "Copy Role",
  "roles.dialog.copyPermissions": "Copy permissions from source role",
  "roles.fields.codename": "Code Name",
  "roles.fields.codenameHint": "Unique identifier (lowercase, letters, digits, underscores)",
  "roles.fields.codenameSystemHint": "System role code name cannot be changed",
  "roles.fields.name": "Name",
  "roles.fields.description": "Description",
  "roles.fields.color": "Color",
  "roles.tabs.permissions": "Permissions",
  "roles.tabs.settings": "Settings",
  "roles.permissions.superuserNotice": "Superuser has full access to all permissions. Permissions cannot be modified.",
  "roles.settings.title": "Role Settings",
  "roles.settings.systemRole": "System Role",
  "roles.settings.customRole": "Custom Role",
  "roles.settings.superuserWarning": "This role grants full platform access. Exercise caution.",
  "roles.settings.systemRoleNotice": "System roles cannot be deleted or have their code name changed.",
  "roles.validation.codenameRequired": "Code name is required (min 2 characters)",
  "roles.validation.codenameFormat": "Must start with a letter, only lowercase letters, digits, underscores",
  "roles.actions.edit": "Edit",
  "roles.actions.copy": "Copy",
  "roles.actions.delete": "Delete",
  "roles.delete.confirmTitle": "Delete Role",
  "roles.delete.confirmDescription": "Are you sure you want to delete this role? This action cannot be undone.",
  "roles.delete.hasUsersHint": "Cannot delete role with assigned users",
  "users.dialog.createTitle": "Create New User",
  "users.dialog.editTitle": "Edit User — {{email}}",
  "users.tabs.basic": "General",
  "users.tabs.roles": "Roles",
  "users.fields.email": "Email",
  "users.fields.password": "Password",
  "users.fields.passwordHint": "Optional — if empty, user will receive an invite email",
  "users.fields.registeredAt": "Registered",
  "users.fields.onboardingStatus": "Onboarding",
  "users.fields.onboardingCompleted": "Completed",
  "users.fields.onboardingPending": "Not completed",
  "users.noRoles": "No roles",
  "users.roles.title": "Assigned Roles",
  "users.roles.addButton": "Add Role",
  "users.roles.dialogTitle": "Select Roles",
  "users.roles.emptyMessage": "No roles assigned",
  "users.roles.noAvailableMessage": "All roles are already assigned",
  "users.roles.searchPlaceholder": "Search roles...",
  "users.roles.removeTitle": "Remove Role",
  "users.roles.nameHeader": "Name",
  "users.roles.codenameHeader": "Code Name"
}
```

### admin namespace (RU)

```json
{
  "roles.dialog.createTitle": "Создать роль",
  "roles.dialog.editTitle": "Редактировать роль",
  "roles.dialog.copyTitle": "Копировать роль",
  "roles.dialog.copyPermissions": "Копировать права из исходной роли",
  "roles.fields.codename": "Кодовое имя",
  "roles.fields.codenameHint": "Уникальный идентификатор (строчные буквы, цифры, подчёркивания)",
  "roles.fields.codenameSystemHint": "Кодовое имя системной роли нельзя изменить",
  "roles.fields.name": "Название",
  "roles.fields.description": "Описание",
  "roles.fields.color": "Цвет",
  "roles.tabs.permissions": "Права доступа",
  "roles.tabs.settings": "Настройки",
  "roles.permissions.superuserNotice": "Суперпользователь имеет полный доступ ко всем правам. Права не могут быть изменены.",
  "roles.settings.title": "Настройки роли",
  "roles.settings.systemRole": "Системная роль",
  "roles.settings.customRole": "Пользовательская роль",
  "roles.settings.superuserWarning": "Эта роль предоставляет полный доступ к платформе. Будьте осторожны.",
  "roles.settings.systemRoleNotice": "Системные роли нельзя удалить или изменить их кодовое имя.",
  "roles.validation.codenameRequired": "Кодовое имя обязательно (минимум 2 символа)",
  "roles.validation.codenameFormat": "Должно начинаться с буквы, только строчные буквы, цифры, подчёркивания",
  "roles.actions.edit": "Редактировать",
  "roles.actions.copy": "Копировать",
  "roles.actions.delete": "Удалить",
  "roles.delete.confirmTitle": "Удалить роль",
  "roles.delete.confirmDescription": "Вы уверены, что хотите удалить эту роль? Это действие нельзя отменить.",
  "roles.delete.hasUsersHint": "Невозможно удалить роль с назначенными пользователями",
  "users.dialog.createTitle": "Создать нового пользователя",
  "users.dialog.editTitle": "Редактировать пользователя — {{email}}",
  "users.tabs.basic": "Основное",
  "users.tabs.roles": "Роли",
  "users.fields.email": "Электронная почта",
  "users.fields.password": "Пароль",
  "users.fields.passwordHint": "Необязательно — если пусто, пользователь получит приглашение по email",
  "users.fields.registeredAt": "Дата регистрации",
  "users.fields.onboardingStatus": "Онбординг",
  "users.fields.onboardingCompleted": "Завершён",
  "users.fields.onboardingPending": "Не завершён",
  "users.noRoles": "Нет ролей",
  "users.roles.title": "Назначенные роли",
  "users.roles.addButton": "Добавить роль",
  "users.roles.dialogTitle": "Выберите роли",
  "users.roles.emptyMessage": "Роли не назначены",
  "users.roles.noAvailableMessage": "Все роли уже назначены",
  "users.roles.searchPlaceholder": "Поиск ролей...",
  "users.roles.removeTitle": "Удалить роль",
  "users.roles.nameHeader": "Название",
  "users.roles.codenameHeader": "Кодовое имя"
}
```

### metapanel namespace (EN)

```json
{
  "dashboard.title": "Control Panel",
  "dashboard.applications": "Applications",
  "dashboard.metahubs": "MetaHubs",
  "dashboard.globalRoles": "Global Roles",
  "dashboard.access": "Access",
  "dashboard.count": "Total"
}
```

### metapanel namespace (RU)

```json
{
  "dashboard.title": "Метапанель",
  "dashboard.applications": "Приложения",
  "dashboard.metahubs": "Метахабы",
  "dashboard.globalRoles": "Глобальные роли",
  "dashboard.access": "Доступ",
  "dashboard.count": "Количество"
}
```

### start namespace additions (EN / RU)

```json
// EN
{ "onboarding.completion.startActing": "Start Acting" }
// RU
{ "onboarding.completion.startActing": "Начать действовать" }
```

### template-mui menu additions

```json
// EN
{ "metapanel": "Control Panel" }
// RU
{ "metapanel": "Метапанель" }
```

---

## File Change Summary

| Phase | Package | Files Changed | Files Created |
|---|---|---|---|
| 0 | `universo-types` | `abilities/index.ts`, `common/admin.ts` | — |
| 1 | `admin-backend` | `platform/migrations/index.ts`, `routes/rolesRoutes.ts`, `routes/globalUsersRoutes.ts`, `services/globalAccessService.ts` | — |
| 1 | `auth-backend` | `routes/auth.ts` | — |
| 1 | `start-backend` | `routes/onboardingRoutes.ts` | — |
| 1 | `universo-core-backend` | `.env.example` | — |
| 2 | `admin-frontend` | `pages/RoleEdit.tsx` (refactor to tabs), `pages/RolesList.tsx` | `components/RoleFormDialog.tsx`, `hooks/useRoleMutations.ts` |
| 3 | `admin-frontend` | `pages/InstanceUsers.tsx` | `components/UserFormDialog.tsx` |
| 4 | `start-frontend` | `components/CompletionStep.tsx` | — |
| 5 | `metapanel-frontend` | — | Entire new package (`base/src/`, `package.json`, `tsconfig.*`) |
| 5 | `universo-template-mui` | `navigation/menuConfigs.ts`, `components/dashboard/MenuContent.tsx`, `routes/MainRoutesMUI.tsx` | `components/routing/RegisteredUserGuard.tsx` |
| 5 | `universo-i18n` | En/Ru files for admin, start, template-mui | New metapanel namespace files |

**Tests Created:**

| Phase | Package | Test Files |
|---|---|---|
| 0 | `universo-types` | `src/abilities/__tests__/subjects.test.ts` |
| 1 | `admin-backend` | Add cases to `rolesRoutes.test.ts`, `globalUsersRoutes.test.ts`, `globalAccessService.test.ts` |
| 1 | `auth-backend` | Add cases to `auth.test.ts` |
| 1 | `start-backend` | Add cases to `onboardingRoutes.test.ts` |
| 2 | `admin-frontend` | `RoleFormDialog.test.tsx`, update `RoleEdit.test.tsx` (tab tests) |
| 3 | `admin-frontend` | `UserFormDialog.test.tsx` |
| 5 | `metapanel-frontend` | `MetapanelDashboard.test.tsx` |
| 5 | `universo-template-mui` | `RegisteredUserGuard.test.tsx` |

---

## Risks & Mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| 1 | Existing users have no roles after migration | HIGH | Step 1.12 one-time data migration seeds roles for all existing users (onboarded → `user`, not onboarded → `registered`). Existing superuser assignments remain. Run idempotent. |
| 2 | RLS context not available during registration | MEDIUM | Step 1.3 uses pool-level `getDbExecutor()` for admin schema writes. Admin schema RLS policies allow service-level access. |
| 3 | Authorization state stale after role transition | LOW | Step 4 uses `useAbility().refreshAbility()` because current permissions are owned by `AbilityContextProvider`, not by TanStack Query. |
| 4 | Codename uniqueness races in copy | LOW | Database unique constraint on `(codename) WHERE _upl_deleted = false AND _app_deleted = false` + Zod validation catches at API layer; backend returns 409. |
| 5 | Метапанель package build order | LOW | Add `metapanel-frontend` to turbo pipeline with correct dependency order. |
| 6 | Registered-only users still reach the wrong root/start flow | MEDIUM | Phase 5 adds explicit `/start`, `StartAccessGuard`, and root home resolver; `RegisteredUserGuard` wraps the whole main shell instead of only `/metapanel`. |
| 7 | Supabase Admin API rate limits | LOW | User creation from admin panel will be rare operation. `writeLimiter` middleware on the endpoint provides additional protection. |
| 8 | Superuser exclusivity race condition | LOW | `setUserRoles()` runs in a single DB transaction — superuser check and role replacement are atomic. |
| 9 | `supabaseAdmin` not available in globalUsersRoutes | MEDIUM | Step 1.9 extends factory config and requires bootstrap wiring from `SUPABASE_URL` + `SERVICE_ROLE_KEY` in `universo-core-backend`. |
| 10 | Dashboard stats contract drifts between AdminBoard and Метапанель | MEDIUM | Phase 1 promotes one dedicated `admin/dashboard/stats` contract consumed by both clients. |
| 11 | `MainGrid` hardcoded cards | LOW | Resolved in AD-5: Метапанель renders `StatCard` + `Grid` directly, not via `MainGrid`. |

---

## Implementation Order (Recommended)

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
  (types)   (DB/API)  (Roles UI)  (Users UI)  (Onboarding)  (Метапанель)
```

Each phase should be validated with:
1. `pnpm --filter <package> build` for touched packages
2. `pnpm --filter <package> test` for touched packages (where test runner exists)
3. `pnpm --filter <package> lint` for touched packages
4. Final `pnpm build` at the root after each phase completes

---

## QA Review Changes (v1 → v3)

Summary of all changes made based on QA analysis:

| # | Issue | Resolution |
|---|---|---|
| 1 | ТЗ п.3: Permissions/Settings should be page tabs, not dialog tabs | **AD-9**: RoleEdit.tsx stays as standalone page, refactored with MUI `<Tabs>`. Dialog only for basic fields. |
| 2 | ТЗ п.5: Third stat card should be "Глобальные роли", not "Publications" | Fixed in Step 5.2 — three cards: Applications, MetaHubs, Global Roles. |
| 3 | ТЗ п.6: Missing admin-side user creation via Supabase | Added **AD-11** + Step 1.9 + factory config extension for `supabaseAdmin`. |
| 4 | ТЗ п.6: Missing superuser exclusive behavior | Added **AD-10** + Step 1.8 `setUserRoles()` enforces exclusivity in transaction. |
| 5 | ТЗ п.6: Missing "Основное" tab in user dialog | Step 3.1 now has two tabs: "Основное" (basic info) + "Роли". |
| 6 | ТЗ п.6: Users without roles not visible in list | Step 1.10 updates `listGlobalUsers` to LEFT JOIN + show roleless users. |
| 7 | ТЗ п.8: Create role → then add permissions inside | Dialog has NO permissions tab. After create → navigate to detail page to add permissions. |
| 8 | `ColorPickerField` doesn't exist | Fixed → uses existing `ColorPicker` from `admin-frontend/components/ColorPicker`. |
| 9 | `getVlcContent()` wrong function name | Fixed → `getVLCString(field, locale)` from `@universo/utils` everywhere. |
| 10 | `MainGrid` doesn't accept `cards` prop | Fixed → MetapanelDashboard uses `StatCard` + `Grid` directly. Documented in AD-5. |
| 11 | Multi-role grant missing transaction wrapper | Fixed → Step 1.8 `setUserRoles()` wraps DELETE+INSERT in `exec.transaction()`. |
| 12 | Route factory pattern not followed correctly | Fixed → Steps 1.6-1.9 work within existing `createRolesRoutes()`/`createGlobalUsersRoutes()` factories. |
| 13 | Missing Zod validation on copy codename | Added `CopyRoleSchema` with `z.string().regex(/^[a-z][a-z0-9_]*$/)` in Step 1.6. |
| 14 | Missing self-modification guard on multi-role endpoint | Added `memberId === currentUserId` check in Step 1.7. |
| 15 | `RegisteredUserGuard` uses `(r: any)` | Fixed → uses typed `GlobalRoleInfo` from `@universo/types` in Step 5.4. |
| 16 | Missing one-time data migration as explicit step | Added Step 1.12 with idempotent SQL. |
| 17 | Plan assumed TanStack Query owned permissions refresh | Fixed → **AD-12** + Phase 4 now use `useAbility().refreshAbility()` from `AbilityContextProvider`. |
| 18 | Completion mutation was duplicated before and after the completion screen | Fixed → **AD-4** + Phase 4 move `completeOnboarding()` exclusively to the completion CTA. |
| 19 | `/start` route and `/` root flow were not aligned with the live router | Fixed → **AD-7** + Phase 5 add explicit `/start`, home resolver, and `StartAccessGuard`. |
| 20 | Menu filtering only covered `rootMenuItems`, not real shell sections | Fixed → **AD-6** + Step 5.6 make filtering section-aware (root items, MetaHubs, Admin). |
| 21 | Метапанель stats were tied to the wrong endpoint contract | Fixed → **AD-13** + Step 1.11 introduce dedicated `admin/dashboard/stats`. |
| 22 | Registration/onboarding role assignment duplicated privileged SQL across feature packages | Fixed → Step 1.3 introduces one injected privileged system-role provisioning helper. |

---

**Next step**: Review and approve this plan. Implementation starts in IMPLEMENT mode.
