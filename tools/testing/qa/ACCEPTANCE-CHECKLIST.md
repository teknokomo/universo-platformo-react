# Acceptance Checklist — Database Hardening & Soft-Delete

This checklist verifies the full product journey on a **fresh database** after applying all database hardening changes (Phases 1–13).

## Prerequisites

- PostgreSQL (Supabase) running and accessible
- `.env` configured with correct `DATABASE_HOST`, `DATABASE_PORT=5432`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`
- All packages built: `pnpm build`

## 1. Fresh-Database Bootstrap

```bash
# 1a. Start the backend (runs all platform migrations automatically)
pnpm start

# 1b. Verify migration output in logs:
#   - "Running platform migration: CreateAdminSchema1733400000000"
#   - "Running platform migration: AddAdminSoftDeleteColumns1800000000300"
#   - "Running platform migration: OptimizeRlsPolicies ..."
#   - All migrations complete with no errors
```

## 2. Admin Panel Verification

- [ ] **2.1** Open `/admin` — admin panel loads
- [ ] **2.2** Navigate to Roles — list of system roles visible (admin, superadmin, editor, viewer)
- [ ] **2.3** Create a new role with codename, permissions, and color
- [ ] **2.4** Edit the new role — change permissions, verify save works
- [ ] **2.5** Delete the non-system role — succeeds with 200
- [ ] **2.6** Verify deleted role no longer appears in role list (soft-deleted, not physically removed)
- [ ] **2.7** Navigate to Locales — en/ru system locales visible
- [ ] **2.8** Create a new locale (e.g., `de`) — succeeds
- [ ] **2.9** Delete the new locale — succeeds with 204
- [ ] **2.10** Navigate to Settings — settings visible by category
- [ ] **2.11** Create/update a setting — upsert works
- [ ] **2.12** Delete a setting — succeeds

## 3. Metahubs Flow

- [ ] **3.1** Open `/metahubs` — metahubs dashboard loads
- [ ] **3.2** Create a new metahub with a name
- [ ] **3.3** Create the first branch — `mhb_*_b1` schema created
- [ ] **3.4** Configure a basic template structure (e.g., Shopping List with Title and Description attributes)
- [ ] **3.5** Save the template/structure — no errors
- [ ] **3.6** Verify `mhb_*_b1` schema tables exist in the database

## 4. Publication & Application Flow

- [ ] **4.1** Create a publication/version from the metahub branch
- [ ] **4.2** Create an application — `app_*` schema created
- [ ] **4.3** Create a connector linking the application to the publication
- [ ] **4.4** Verify `app_*` schema is created and contains expected tables
- [ ] **4.5** Verify runtime data/schema sync completes (no partial state on connector creation)

## 5. RLS & Security Verification

- [ ] **5.1** Verify RLS policies are active on admin tables (`admin.roles`, `admin.locales`, `admin.settings`)
- [ ] **5.2** Verify unauthenticated access to admin routes returns 401
- [ ] **5.3** Verify non-admin user access to admin routes returns 403
- [ ] **5.4** Verify superuser bypasses permission checks
- [ ] **5.5** Verify database functions (`admin.has_permission`, `admin.is_superuser`) respect soft-delete filters

## 6. Health & Stability

- [ ] **6.1** Hit `GET /api/v1/health/db` — returns `{ status: 'ok', latencyMs: ... }`
- [ ] **6.2** Verify Knex connection pool reports healthy state in logs
- [ ] **6.3** Verify graceful shutdown releases connections (send SIGTERM, check logs)

## 7. Post-Verification

After completing all checks:
- [ ] Update `memory-bank/progress.md` with acceptance results and date
- [ ] Mark Phase 12 complete in `memory-bank/tasks.md`

## Rerun Instructions

To rerun this acceptance flow after migration changes:

```bash
# 1. Build all packages
pnpm build

# 2. Start the backend (migrations run automatically)
pnpm start

# 3. Walk through the checklist above
# 4. For automated migration validation:
pnpm --filter @universo/migrations-platform test
```
