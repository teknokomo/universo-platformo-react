export interface SqlMigrationStatement {
    sql: string
    warningMessage?: string
}

export interface SqlMigrationDefinition {
    id: string
    version: string
    summary: string
    up: readonly SqlMigrationStatement[]
    down: readonly SqlMigrationStatement[]
}

const normalizeSql = (value: string): string => value.replace(/\s+/g, ' ').trim()

const codenamePrimaryTextSql = (columnRef: string): string =>
    normalizeSql(
        `COALESCE(${columnRef}->'locales'->(${columnRef}->>'_primary')->>'content', ${columnRef}->'locales'->'en'->>'content', '')`
    )

const ROLE_REGISTERED_CODENAME = `'{
    "_schema": "1",
    "_primary": "en",
    "locales": {
        "en": { "content": "Registered", "version": 1, "isActive": true, "createdAt": "2026-03-17T00:00:00.000Z", "updatedAt": "2026-03-17T00:00:00.000Z" },
        "ru": { "content": "Зарегистрированный", "version": 1, "isActive": true, "createdAt": "2026-03-17T00:00:00.000Z", "updatedAt": "2026-03-17T00:00:00.000Z" }
    }
}'::jsonb`

const ROLE_USER_CODENAME = `'{
    "_schema": "1",
    "_primary": "en",
    "locales": {
        "en": { "content": "User", "version": 1, "isActive": true, "createdAt": "2026-03-17T00:00:00.000Z", "updatedAt": "2026-03-17T00:00:00.000Z" },
        "ru": { "content": "Пользователь", "version": 1, "isActive": true, "createdAt": "2026-03-17T00:00:00.000Z", "updatedAt": "2026-03-17T00:00:00.000Z" }
    }
}'::jsonb`

const ROLE_SUPERUSER_CODENAME = `'{
    "_schema": "1",
    "_primary": "en",
    "locales": {
        "en": { "content": "Superuser", "version": 1, "isActive": true, "createdAt": "2024-12-06T00:00:00.000Z", "updatedAt": "2024-12-06T00:00:00.000Z" },
        "ru": { "content": "Суперпользователь", "version": 1, "isActive": true, "createdAt": "2024-12-06T00:00:00.000Z", "updatedAt": "2024-12-06T00:00:00.000Z" }
    }
}'::jsonb`

const INSTANCE_LOCAL_CODENAME = `'{
    "_schema": "1",
    "_primary": "en",
    "locales": {
        "en": { "content": "Local", "version": 1, "isActive": true, "createdAt": "2024-12-06T00:00:00.000Z", "updatedAt": "2024-12-06T00:00:00.000Z" },
        "ru": { "content": "Локальный", "version": 1, "isActive": true, "createdAt": "2024-12-06T00:00:00.000Z", "updatedAt": "2024-12-06T00:00:00.000Z" }
    }
}'::jsonb`

const createDropPolicyIfTableExistsStatement = (policyName: string, schemaName: string, tableName: string): SqlMigrationStatement => ({
    sql: `
DO $$
BEGIN
    IF to_regclass('${schemaName}.${tableName}') IS NOT NULL THEN
        BEGIN
            EXECUTE format(
                'DROP POLICY IF EXISTS %I ON %I.%I',
                '${policyName}',
                '${schemaName}',
                '${tableName}'
            );
        EXCEPTION
            WHEN undefined_table THEN NULL;
        END;
    END IF;
END $$;
    `
})

const adminLifecycleRoleSeedStatements = [
    {
        sql: `
INSERT INTO admin.cat_roles (codename, description, name, color, is_superuser, is_system)
SELECT *
FROM (
    VALUES
    (
        ${ROLE_REGISTERED_CODENAME},
        '{
            "_schema": "1",
            "_primary": "en",
            "locales": {
                "en": {
                    "content": "Newly registered user before onboarding completion",
                    "version": 1,
                    "isActive": true,
                    "createdAt": "2026-03-17T00:00:00.000Z",
                    "updatedAt": "2026-03-17T00:00:00.000Z"
                },
                "ru": {
                    "content": "Новый зарегистрированный пользователь до завершения онбординга",
                    "version": 1,
                    "isActive": true,
                    "createdAt": "2026-03-17T00:00:00.000Z",
                    "updatedAt": "2026-03-17T00:00:00.000Z"
                }
            }
        }'::jsonb,
        '{
            "_schema": "1",
            "_primary": "en",
            "locales": {
                "en": {
                    "content": "Registered",
                    "version": 1,
                    "isActive": true,
                    "createdAt": "2026-03-17T00:00:00.000Z",
                    "updatedAt": "2026-03-17T00:00:00.000Z"
                },
                "ru": {
                    "content": "Зарегистрированный",
                    "version": 1,
                    "isActive": true,
                    "createdAt": "2026-03-17T00:00:00.000Z",
                    "updatedAt": "2026-03-17T00:00:00.000Z"
                }
            }
        }'::jsonb,
        '#2196f3',
        false,
        true
    ),
    (
        ${ROLE_USER_CODENAME},
        '{
            "_schema": "1",
            "_primary": "en",
            "locales": {
                "en": {
                    "content": "Standard platform user with product access after onboarding",
                    "version": 1,
                    "isActive": true,
                    "createdAt": "2026-03-17T00:00:00.000Z",
                    "updatedAt": "2026-03-17T00:00:00.000Z"
                },
                "ru": {
                    "content": "Стандартный пользователь платформы после завершения онбординга",
                    "version": 1,
                    "isActive": true,
                    "createdAt": "2026-03-17T00:00:00.000Z",
                    "updatedAt": "2026-03-17T00:00:00.000Z"
                }
            }
        }'::jsonb,
        '{
            "_schema": "1",
            "_primary": "en",
            "locales": {
                "en": {
                    "content": "User",
                    "version": 1,
                    "isActive": true,
                    "createdAt": "2026-03-17T00:00:00.000Z",
                    "updatedAt": "2026-03-17T00:00:00.000Z"
                },
                "ru": {
                    "content": "Пользователь",
                    "version": 1,
                    "isActive": true,
                    "createdAt": "2026-03-17T00:00:00.000Z",
                    "updatedAt": "2026-03-17T00:00:00.000Z"
                }
            }
        }'::jsonb,
        '#4caf50',
        false,
        true
    )
) AS seed(codename, description, name, color, is_superuser, is_system)
WHERE NOT EXISTS (
    SELECT 1
    FROM admin.cat_roles existing
    WHERE ${codenamePrimaryTextSql('existing.codename')} = ${codenamePrimaryTextSql('seed.codename')}
      AND existing._upl_deleted = false AND existing._app_deleted = false
)
        `
    },
    {
        sql: `
INSERT INTO admin.rel_role_permissions (role_id, subject, action, conditions, fields)
SELECT r.id, p.subject, p.action, p.conditions, p.fields
FROM admin.cat_roles r
CROSS JOIN (
    VALUES
        ('onboarding', 'read', '{}'::jsonb, ARRAY[]::text[]),
        ('profile', 'read', '{}'::jsonb, ARRAY[]::text[])
) AS p(subject, action, conditions, fields)
WHERE ${codenamePrimaryTextSql('r.codename')} = 'Registered'
  AND r._upl_deleted = false AND r._app_deleted = false
ON CONFLICT (role_id, subject, action) WHERE _upl_deleted = false AND _app_deleted = false
DO UPDATE SET
    conditions = EXCLUDED.conditions,
    fields = EXCLUDED.fields
        `
    },
    {
        sql: `
INSERT INTO admin.rel_role_permissions (role_id, subject, action, conditions, fields)
SELECT r.id, p.subject, p.action, p.conditions, p.fields
FROM admin.cat_roles r
CROSS JOIN (
    VALUES
        ('applications', 'read', '{}'::jsonb, ARRAY[]::text[]),
        ('profile', '*', '{}'::jsonb, ARRAY[]::text[]),
        ('onboarding', 'read', '{}'::jsonb, ARRAY[]::text[])
) AS p(subject, action, conditions, fields)
WHERE ${codenamePrimaryTextSql('r.codename')} = 'User'
  AND r._upl_deleted = false AND r._app_deleted = false
ON CONFLICT (role_id, subject, action) WHERE _upl_deleted = false AND _app_deleted = false
DO UPDATE SET
    conditions = EXCLUDED.conditions,
    fields = EXCLUDED.fields
            `
    },
    {
        sql: `
UPDATE admin.rel_role_permissions rp
SET action = '*'
FROM admin.cat_roles r
WHERE rp.role_id = r.id
    AND ${codenamePrimaryTextSql('r.codename')} = 'User'
    AND r._upl_deleted = false AND r._app_deleted = false
    AND rp.subject = 'profile'
    AND rp.action = 'manage'
    AND rp._upl_deleted = false AND rp._app_deleted = false
            `
    }
] as const satisfies readonly SqlMigrationStatement[]

const adminLifecycleRoleBackfillStatements = [
    {
        sql: `
INSERT INTO admin.rel_user_roles (user_id, role_id, granted_by, comment)
SELECT
    p.user_id,
    r.id,
    p.user_id,
    'migration: auto-assigned user role for onboarded users'
FROM profiles.cat_profiles p
JOIN auth.users u ON u.id = p.user_id
CROSS JOIN admin.cat_roles r
WHERE p.onboarding_completed = true
  AND u.deleted_at IS NULL
    AND ${codenamePrimaryTextSql('r.codename')} = 'User'
  AND r._upl_deleted = false AND r._app_deleted = false
  AND NOT EXISTS (
      SELECT 1
      FROM admin.rel_user_roles aur
      JOIN admin.cat_roles sr ON sr.id = aur.role_id
      WHERE aur.user_id = p.user_id
        AND aur._upl_deleted = false AND aur._app_deleted = false
        AND sr._upl_deleted = false AND sr._app_deleted = false
        AND sr.is_superuser = true
  )
  AND NOT EXISTS (
      SELECT 1 FROM admin.rel_user_roles aur
      WHERE aur.user_id = p.user_id
        AND aur.role_id = r.id
        AND aur._upl_deleted = false AND aur._app_deleted = false
  )
        `
    },
    {
        sql: `
INSERT INTO admin.rel_user_roles (user_id, role_id, granted_by, comment)
SELECT
    p.user_id,
    r.id,
    p.user_id,
    'migration: auto-assigned registered role for pre-onboarding users'
FROM profiles.cat_profiles p
JOIN auth.users u ON u.id = p.user_id
CROSS JOIN admin.cat_roles r
WHERE COALESCE(p.onboarding_completed, false) = false
  AND u.deleted_at IS NULL
    AND ${codenamePrimaryTextSql('r.codename')} = 'Registered'
  AND r._upl_deleted = false AND r._app_deleted = false
  AND NOT EXISTS (
      SELECT 1
      FROM admin.rel_user_roles aur
      JOIN admin.cat_roles sr ON sr.id = aur.role_id
      WHERE aur.user_id = p.user_id
        AND aur._upl_deleted = false AND aur._app_deleted = false
        AND sr._upl_deleted = false AND sr._app_deleted = false
        AND sr.is_superuser = true
  )
  AND NOT EXISTS (
      SELECT 1 FROM admin.rel_user_roles aur
      WHERE aur.user_id = p.user_id
        AND aur.role_id = r.id
        AND aur._upl_deleted = false AND aur._app_deleted = false
  )
        `
    }
] as const satisfies readonly SqlMigrationStatement[]

export const createAdminSchemaMigrationDefinition: SqlMigrationDefinition = {
    id: 'CreateAdminSchema1733400000000',
    version: '1733400000000',
    summary: 'Create admin platform schema with full system fields',
    up: [
        {
            sql: `CREATE SCHEMA IF NOT EXISTS admin`
        },
        {
            sql: `
CREATE TABLE IF NOT EXISTS admin.cfg_instances (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
    codename JSONB NOT NULL,
    name JSONB NOT NULL DEFAULT '{}',
    description JSONB DEFAULT '{}',
    url VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    is_local BOOLEAN NOT NULL DEFAULT false,
    _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_created_by UUID,
    _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_updated_by UUID,
    _upl_version INTEGER NOT NULL DEFAULT 1,
    _upl_archived BOOLEAN NOT NULL DEFAULT false,
    _upl_archived_at TIMESTAMPTZ,
    _upl_archived_by UUID,
    _upl_deleted BOOLEAN NOT NULL DEFAULT false,
    _upl_deleted_at TIMESTAMPTZ,
    _upl_deleted_by UUID,
    _upl_purge_after TIMESTAMPTZ,
    _upl_locked BOOLEAN NOT NULL DEFAULT false,
    _upl_locked_at TIMESTAMPTZ,
    _upl_locked_by UUID,
    _upl_locked_reason TEXT,
    _app_published BOOLEAN NOT NULL DEFAULT true,
    _app_published_at TIMESTAMPTZ,
    _app_published_by UUID,
    _app_archived BOOLEAN NOT NULL DEFAULT false,
    _app_archived_at TIMESTAMPTZ,
    _app_archived_by UUID,
    _app_deleted BOOLEAN NOT NULL DEFAULT false,
    _app_deleted_at TIMESTAMPTZ,
    _app_deleted_by UUID,
    _app_owner_id UUID,
    _app_access_level VARCHAR(20) NOT NULL DEFAULT 'private',
    CONSTRAINT instances_status_check CHECK (status IN ('active', 'inactive', 'maintenance'))
)
        `
        },
        {
            sql: `
CREATE TABLE IF NOT EXISTS admin.cat_roles (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
    codename JSONB NOT NULL,
    name JSONB DEFAULT '{}',
    description JSONB,
    color VARCHAR(7) DEFAULT '#9e9e9e',
    is_superuser BOOLEAN DEFAULT false,
    is_system BOOLEAN DEFAULT false,
    _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_created_by UUID,
    _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_updated_by UUID,
    _upl_version INTEGER NOT NULL DEFAULT 1,
    _upl_archived BOOLEAN NOT NULL DEFAULT false,
    _upl_archived_at TIMESTAMPTZ,
    _upl_archived_by UUID,
    _upl_deleted BOOLEAN NOT NULL DEFAULT false,
    _upl_deleted_at TIMESTAMPTZ,
    _upl_deleted_by UUID,
    _upl_purge_after TIMESTAMPTZ,
    _upl_locked BOOLEAN NOT NULL DEFAULT false,
    _upl_locked_at TIMESTAMPTZ,
    _upl_locked_by UUID,
    _upl_locked_reason TEXT,
    _app_published BOOLEAN NOT NULL DEFAULT true,
    _app_published_at TIMESTAMPTZ,
    _app_published_by UUID,
    _app_archived BOOLEAN NOT NULL DEFAULT false,
    _app_archived_at TIMESTAMPTZ,
    _app_archived_by UUID,
    _app_deleted BOOLEAN NOT NULL DEFAULT false,
    _app_deleted_at TIMESTAMPTZ,
    _app_deleted_by UUID,
    _app_owner_id UUID,
    _app_access_level VARCHAR(20) NOT NULL DEFAULT 'private'
)
        `
        },
        {
            sql: `
CREATE TABLE IF NOT EXISTS admin.rel_role_permissions (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
    role_id UUID NOT NULL REFERENCES admin.cat_roles(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    action VARCHAR(20) NOT NULL,
    conditions JSONB DEFAULT '{}',
    fields TEXT[] DEFAULT ARRAY[]::TEXT[],
    _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_created_by UUID,
    _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_updated_by UUID,
    _upl_version INTEGER NOT NULL DEFAULT 1,
    _upl_archived BOOLEAN NOT NULL DEFAULT false,
    _upl_archived_at TIMESTAMPTZ,
    _upl_archived_by UUID,
    _upl_deleted BOOLEAN NOT NULL DEFAULT false,
    _upl_deleted_at TIMESTAMPTZ,
    _upl_deleted_by UUID,
    _upl_purge_after TIMESTAMPTZ,
    _upl_locked BOOLEAN NOT NULL DEFAULT false,
    _upl_locked_at TIMESTAMPTZ,
    _upl_locked_by UUID,
    _upl_locked_reason TEXT,
    _app_published BOOLEAN NOT NULL DEFAULT true,
    _app_published_at TIMESTAMPTZ,
    _app_published_by UUID,
    _app_archived BOOLEAN NOT NULL DEFAULT false,
    _app_archived_at TIMESTAMPTZ,
    _app_archived_by UUID,
    _app_deleted BOOLEAN NOT NULL DEFAULT false,
    _app_deleted_at TIMESTAMPTZ,
    _app_deleted_by UUID,
    _app_owner_id UUID,
    _app_access_level VARCHAR(20) NOT NULL DEFAULT 'private'
)
        `
        },
        {
            sql: `
CREATE TABLE IF NOT EXISTS admin.rel_user_roles (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES admin.cat_roles(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    comment TEXT,
    _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_created_by UUID,
    _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_updated_by UUID,
    _upl_version INTEGER NOT NULL DEFAULT 1,
    _upl_archived BOOLEAN NOT NULL DEFAULT false,
    _upl_archived_at TIMESTAMPTZ,
    _upl_archived_by UUID,
    _upl_deleted BOOLEAN NOT NULL DEFAULT false,
    _upl_deleted_at TIMESTAMPTZ,
    _upl_deleted_by UUID,
    _upl_purge_after TIMESTAMPTZ,
    _upl_locked BOOLEAN NOT NULL DEFAULT false,
    _upl_locked_at TIMESTAMPTZ,
    _upl_locked_by UUID,
    _upl_locked_reason TEXT,
    _app_published BOOLEAN NOT NULL DEFAULT true,
    _app_published_at TIMESTAMPTZ,
    _app_published_by UUID,
    _app_archived BOOLEAN NOT NULL DEFAULT false,
    _app_archived_at TIMESTAMPTZ,
    _app_archived_by UUID,
    _app_deleted BOOLEAN NOT NULL DEFAULT false,
    _app_deleted_at TIMESTAMPTZ,
    _app_deleted_by UUID,
    _app_owner_id UUID,
    _app_access_level VARCHAR(20) NOT NULL DEFAULT 'private'
)
        `
        },
        // ── Partial unique indexes (active rows only) ─────────────────
        {
            sql: `
CREATE UNIQUE INDEX IF NOT EXISTS idx_cfg_instances_codename_active
    ON admin.cfg_instances (${codenamePrimaryTextSql('codename')})
    WHERE _upl_deleted = false AND _app_deleted = false
        `
        },
        {
            sql: `
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_codename_active
    ON admin.cat_roles (${codenamePrimaryTextSql('codename')})
    WHERE _upl_deleted = false AND _app_deleted = false
        `
        },
        {
            sql: `
CREATE UNIQUE INDEX IF NOT EXISTS idx_role_permissions_unique_active
    ON admin.rel_role_permissions (role_id, subject, action)
    WHERE _upl_deleted = false AND _app_deleted = false
        `
        },
        {
            sql: `
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_unique_active
    ON admin.rel_user_roles (user_id, role_id)
    WHERE _upl_deleted = false AND _app_deleted = false
        `
        },
        // ── Performance indexes ───────────────────────────────────────
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON admin.rel_user_roles(user_id)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON admin.rel_role_permissions(role_id)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_roles_is_superuser ON admin.cat_roles(is_superuser) WHERE is_superuser = true`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_instances_name_gin ON admin.cfg_instances USING GIN (name)`
        },
        {
            sql: `
CREATE INDEX IF NOT EXISTS idx_roles_active
    ON admin.cat_roles (id) WHERE _upl_deleted = false AND _app_deleted = false
        `
        },
        {
            sql: `
CREATE INDEX IF NOT EXISTS idx_role_permissions_active
    ON admin.rel_role_permissions (role_id) WHERE _upl_deleted = false AND _app_deleted = false
        `
        },
        {
            sql: `
CREATE INDEX IF NOT EXISTS idx_cfg_instances_upl_deleted
    ON admin.cfg_instances (_upl_deleted_at) WHERE _upl_deleted = true
        `
        },
        {
            sql: `
CREATE INDEX IF NOT EXISTS idx_cfg_instances_app_deleted
    ON admin.cfg_instances (_app_deleted_at) WHERE _app_deleted = true
        `
        },
        // ── Seed: superuser role ──────────────────────────────────────
        {
            sql: `
INSERT INTO admin.cat_roles (codename, description, name, color, is_superuser, is_system)
SELECT *
FROM (
    VALUES
    (
        ${ROLE_SUPERUSER_CODENAME},
        '{
            "_schema": "1",
            "_primary": "en",
            "locales": {
                "en": {
                    "content": "Full platform access with permission bypass - root user",
                    "version": 1,
                    "isActive": true,
                    "createdAt": "2024-12-06T00:00:00.000Z",
                    "updatedAt": "2024-12-06T00:00:00.000Z"
                },
                "ru": {
                    "content": "Полный доступ к платформе с обходом прав — root-пользователь",
                    "version": 1,
                    "isActive": true,
                    "createdAt": "2024-12-06T00:00:00.000Z",
                    "updatedAt": "2024-12-06T00:00:00.000Z"
                }
            }
        }'::jsonb,
        '{
            "_schema": "1",
            "_primary": "en",
            "locales": {
                "en": {
                    "content": "Super User",
                    "version": 1,
                    "isActive": true,
                    "createdAt": "2024-12-06T00:00:00.000Z",
                    "updatedAt": "2024-12-06T00:00:00.000Z"
                },
                "ru": {
                    "content": "Суперпользователь",
                    "version": 1,
                    "isActive": true,
                    "createdAt": "2024-12-06T00:00:00.000Z",
                    "updatedAt": "2024-12-06T00:00:00.000Z"
                }
            }
        }'::jsonb,
        '#d32f2f',
        true,
        true
    )
) AS seed(codename, description, name, color, is_superuser, is_system)
WHERE NOT EXISTS (
    SELECT 1
    FROM admin.cat_roles existing
    WHERE ${codenamePrimaryTextSql('existing.codename')} = ${codenamePrimaryTextSql('seed.codename')}
      AND existing._upl_deleted = false AND existing._app_deleted = false
)
        `
        },
        // ── Seed: wildcard permission for superuser ───────────────────
        {
            sql: `
INSERT INTO admin.rel_role_permissions (role_id, subject, action)
SELECT id, '*', '*' FROM admin.cat_roles
WHERE ${codenamePrimaryTextSql('codename')} = 'Superuser' AND _upl_deleted = false AND _app_deleted = false
ON CONFLICT (role_id, subject, action) WHERE _upl_deleted = false AND _app_deleted = false
DO NOTHING
        `
        },
        // ── SECURITY DEFINER functions (converged with dual-flag) ─────
        {
            sql: `
CREATE OR REPLACE FUNCTION admin.has_permission(
    p_user_id UUID DEFAULT NULL,
    p_subject TEXT DEFAULT '*',
    p_action TEXT DEFAULT '*',
    p_context JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
DECLARE
    v_auth_user_id UUID;
    v_user_id UUID;
BEGIN
    v_auth_user_id := auth.uid();
    IF v_auth_user_id IS NOT NULL AND p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_auth_user_id THEN
        RAISE EXCEPTION 'Authenticated sessions may inspect only their own permissions'
            USING ERRCODE = '42501';
    END IF;
    v_user_id := COALESCE(p_user_id, v_auth_user_id);
    IF v_user_id IS NULL THEN RETURN FALSE; END IF;
    RETURN EXISTS (
        SELECT 1
        FROM admin.rel_user_roles ur
        JOIN admin.cat_roles r ON ur.role_id = r.id
        JOIN admin.rel_role_permissions rp ON r.id = rp.role_id
        WHERE ur.user_id = v_user_id
          AND ur._upl_deleted = false AND ur._app_deleted = false
          AND r._upl_deleted = false AND r._app_deleted = false
          AND rp._upl_deleted = false AND rp._app_deleted = false
          AND (rp.subject = '*' OR rp.subject = p_subject)
          AND (rp.action = '*' OR rp.action = 'manage' OR rp.action = p_action)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = admin, public, auth, pg_temp STABLE
        `
        },
        {
            sql: `
CREATE OR REPLACE FUNCTION admin.get_user_permissions(p_user_id UUID)
RETURNS TABLE (
    role_codename TEXT,
    name JSONB,
    color TEXT,
    is_superuser BOOLEAN,
    subject TEXT,
    action TEXT,
    conditions JSONB,
    fields TEXT[]
) AS $$
DECLARE
    v_auth_user_id UUID;
    v_user_id UUID;
BEGIN
    v_auth_user_id := auth.uid();
    IF v_auth_user_id IS NOT NULL AND p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_auth_user_id THEN
        RAISE EXCEPTION 'Authenticated sessions may inspect only their own permissions'
            USING ERRCODE = '42501';
    END IF;
    v_user_id := COALESCE(p_user_id, v_auth_user_id);
    IF v_user_id IS NULL THEN RETURN; END IF;
    RETURN QUERY
    SELECT
        ${codenamePrimaryTextSql('r.codename')},
        r.name,
        r.color::TEXT,
        r.is_superuser,
        rp.subject::TEXT,
        rp.action::TEXT,
        rp.conditions,
        rp.fields
    FROM admin.rel_user_roles ur
    JOIN admin.cat_roles r ON ur.role_id = r.id
    JOIN admin.rel_role_permissions rp ON r.id = rp.role_id
    WHERE ur.user_id = v_user_id
      AND ur._upl_deleted = false AND ur._app_deleted = false
      AND r._upl_deleted = false AND r._app_deleted = false
      AND rp._upl_deleted = false AND rp._app_deleted = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = admin, public, auth, pg_temp STABLE
        `
        },
        {
            sql: `
CREATE OR REPLACE FUNCTION admin.is_superuser(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_auth_user_id UUID;
    v_user_id UUID;
BEGIN
    v_auth_user_id := auth.uid();
    IF v_auth_user_id IS NOT NULL AND p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_auth_user_id THEN
        RAISE EXCEPTION 'Authenticated sessions may inspect only their own superuser state'
            USING ERRCODE = '42501';
    END IF;
    v_user_id := COALESCE(p_user_id, v_auth_user_id);
    IF v_user_id IS NULL THEN RETURN FALSE; END IF;
    RETURN EXISTS (
        SELECT 1
        FROM admin.rel_user_roles ur
        JOIN admin.cat_roles r ON ur.role_id = r.id
        WHERE ur.user_id = v_user_id
          AND r.is_superuser = true
          AND ur._upl_deleted = false AND ur._app_deleted = false
          AND r._upl_deleted = false AND r._app_deleted = false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = admin, public, auth, pg_temp STABLE
        `
        },
        {
            sql: `
CREATE OR REPLACE FUNCTION admin.has_admin_permission(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_auth_user_id UUID;
    v_user_id UUID;
BEGIN
    v_auth_user_id := auth.uid();
    IF v_auth_user_id IS NOT NULL AND p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_auth_user_id THEN
        RAISE EXCEPTION 'Authenticated sessions may inspect only their own admin access'
            USING ERRCODE = '42501';
    END IF;
    v_user_id := COALESCE(p_user_id, v_auth_user_id);
    IF v_user_id IS NULL THEN RETURN FALSE; END IF;
    RETURN EXISTS (
        SELECT 1
        FROM admin.rel_user_roles ur
        JOIN admin.cat_roles r ON ur.role_id = r.id
        JOIN admin.rel_role_permissions rp ON r.id = rp.role_id
        WHERE ur.user_id = v_user_id
          AND ur._upl_deleted = false AND ur._app_deleted = false
          AND r._upl_deleted = false AND r._app_deleted = false
          AND rp._upl_deleted = false AND rp._app_deleted = false
          AND (rp.subject = '*' OR rp.subject IN ('roles', 'instances', 'users'))
          AND (rp.action = 'read' OR rp.action = '*')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = admin, public, auth, pg_temp STABLE
        `
        },
        {
            sql: `
CREATE OR REPLACE FUNCTION admin.get_user_global_roles(p_user_id UUID)
RETURNS TABLE (
    role_codename TEXT,
    name JSONB,
    color TEXT
) AS $$
DECLARE
    v_auth_user_id UUID;
    v_user_id UUID;
BEGIN
    v_auth_user_id := auth.uid();
    IF v_auth_user_id IS NOT NULL AND p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_auth_user_id THEN
        RAISE EXCEPTION 'Authenticated sessions may inspect only their own global roles'
            USING ERRCODE = '42501';
    END IF;
    v_user_id := COALESCE(p_user_id, v_auth_user_id);
    IF v_user_id IS NULL THEN RETURN; END IF;
    RETURN QUERY
    SELECT
        ${codenamePrimaryTextSql('r.codename')},
        r.name,
        r.color::TEXT
    FROM admin.rel_user_roles ur
    JOIN admin.cat_roles r ON ur.role_id = r.id
    WHERE ur.user_id = v_user_id
      AND ur._upl_deleted = false AND ur._app_deleted = false
            AND r._upl_deleted = false AND r._app_deleted = false
        ORDER BY
                CASE WHEN r.is_superuser THEN 0 ELSE 1 END,
                LOWER(${codenamePrimaryTextSql('r.codename')}),
                r.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = admin, public, auth, pg_temp STABLE
        `
        },
        {
            sql: `
DO $$
BEGIN
    REVOKE ALL ON FUNCTION admin.has_permission(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
    REVOKE ALL ON FUNCTION admin.get_user_permissions(UUID) FROM PUBLIC;
    REVOKE ALL ON FUNCTION admin.is_superuser(UUID) FROM PUBLIC;
    REVOKE ALL ON FUNCTION admin.has_admin_permission(UUID) FROM PUBLIC;
    REVOKE ALL ON FUNCTION admin.get_user_global_roles(UUID) FROM PUBLIC;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT EXECUTE ON FUNCTION admin.has_permission(UUID, TEXT, TEXT, JSONB) TO authenticated;
        GRANT EXECUTE ON FUNCTION admin.get_user_permissions(UUID) TO authenticated;
        GRANT EXECUTE ON FUNCTION admin.is_superuser(UUID) TO authenticated;
        GRANT EXECUTE ON FUNCTION admin.has_admin_permission(UUID) TO authenticated;
        GRANT EXECUTE ON FUNCTION admin.get_user_global_roles(UUID) TO authenticated;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION admin.has_permission(UUID, TEXT, TEXT, JSONB) TO service_role;
        GRANT EXECUTE ON FUNCTION admin.get_user_permissions(UUID) TO service_role;
        GRANT EXECUTE ON FUNCTION admin.is_superuser(UUID) TO service_role;
        GRANT EXECUTE ON FUNCTION admin.has_admin_permission(UUID) TO service_role;
        GRANT EXECUTE ON FUNCTION admin.get_user_global_roles(UUID) TO service_role;
    END IF;
END $$;
        `
        },
        // ── Enable RLS ────────────────────────────────────────────────
        { sql: `ALTER TABLE admin.cfg_instances ENABLE ROW LEVEL SECURITY` },
        { sql: `ALTER TABLE admin.cat_roles ENABLE ROW LEVEL SECURITY` },
        { sql: `ALTER TABLE admin.rel_role_permissions ENABLE ROW LEVEL SECURITY` },
        { sql: `ALTER TABLE admin.rel_user_roles ENABLE ROW LEVEL SECURITY` },
        // ── RLS policies ──────────────────────────────────────────────
        createDropPolicyIfTableExistsStatement('authenticated_read_roles', 'admin', 'cat_roles'),
        {
            sql: `
CREATE POLICY "authenticated_read_roles" ON admin.cat_roles
    FOR SELECT USING (true)
        `
        },
        createDropPolicyIfTableExistsStatement('admin_access_manage_roles', 'admin', 'cat_roles'),
        {
            sql: `
CREATE POLICY "admin_access_manage_roles" ON admin.cat_roles
    FOR ALL USING (
        (select admin.has_admin_permission((select auth.uid())))
    )
        `
        },
        createDropPolicyIfTableExistsStatement('admin_access_manage_role_permissions', 'admin', 'rel_role_permissions'),
        {
            sql: `
CREATE POLICY "admin_access_manage_role_permissions" ON admin.rel_role_permissions
    FOR ALL USING (
        (select admin.has_admin_permission((select auth.uid())))
    )
        `
        },
        createDropPolicyIfTableExistsStatement('users_read_own_roles', 'admin', 'rel_user_roles'),
        {
            sql: `
CREATE POLICY "users_read_own_roles" ON admin.rel_user_roles
    FOR SELECT USING (user_id = (select auth.uid()))
        `
        },
        createDropPolicyIfTableExistsStatement('admin_access_manage_user_roles', 'admin', 'rel_user_roles'),
        {
            sql: `
CREATE POLICY "admin_access_manage_user_roles" ON admin.rel_user_roles
    FOR ALL USING (
        (select admin.has_admin_permission((select auth.uid())))
    )
        `
        },
        createDropPolicyIfTableExistsStatement('instances_select_admin_access', 'admin', 'cfg_instances'),
        {
            sql: `
CREATE POLICY "instances_select_admin_access" ON admin.cfg_instances
    FOR SELECT USING (
        (select admin.has_admin_permission((select auth.uid())))
    )
        `
        },
        createDropPolicyIfTableExistsStatement('instances_manage_admin_access', 'admin', 'cfg_instances'),
        {
            sql: `
CREATE POLICY "instances_manage_admin_access" ON admin.cfg_instances
    FOR ALL USING (
        (select admin.has_admin_permission((select auth.uid())))
    )
        `
        },
        // ── Seed: local instance ──────────────────────────────────────
        {
            sql: `
INSERT INTO admin.cfg_instances (codename, name, description, status, is_local)
VALUES (
    ${INSTANCE_LOCAL_CODENAME},
    '{
        "_schema": "1",
        "_primary": "en",
        "locales": {
            "en": {
                "content": "Local",
                "version": 1,
                "isActive": true,
                "createdAt": "2024-12-06T00:00:00.000Z",
                "updatedAt": "2024-12-06T00:00:00.000Z"
            },
            "ru": {
                "content": "Локальный",
                "version": 1,
                "isActive": true,
                "createdAt": "2024-12-06T00:00:00.000Z",
                "updatedAt": "2024-12-06T00:00:00.000Z"
            }
        }
    }'::jsonb,
    '{
        "_schema": "1",
        "_primary": "en",
        "locales": {
            "en": {
                "content": "Current local installation",
                "version": 1,
                "isActive": true,
                "createdAt": "2024-12-06T00:00:00.000Z",
                "updatedAt": "2024-12-06T00:00:00.000Z"
            },
            "ru": {
                "content": "Текущая локальная установка",
                "version": 1,
                "isActive": true,
                "createdAt": "2024-12-06T00:00:00.000Z",
                "updatedAt": "2024-12-06T00:00:00.000Z"
            }
        }
    }'::jsonb,
    'active',
    true
)
ON CONFLICT DO NOTHING
        `
        },
        // ── cfg_locales table ─────────────────────────────────────────
        {
            sql: `
CREATE TABLE IF NOT EXISTS admin.cfg_locales (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
    code VARCHAR(10) NOT NULL,
    name JSONB NOT NULL DEFAULT '{}',
    native_name VARCHAR(100),
    is_enabled_content BOOLEAN NOT NULL DEFAULT true,
    is_enabled_ui BOOLEAN NOT NULL DEFAULT false,
    is_default_content BOOLEAN NOT NULL DEFAULT false,
    is_default_ui BOOLEAN NOT NULL DEFAULT false,
    is_system BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_created_by UUID,
    _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_updated_by UUID,
    _upl_version INTEGER NOT NULL DEFAULT 1,
    _upl_archived BOOLEAN NOT NULL DEFAULT false,
    _upl_archived_at TIMESTAMPTZ,
    _upl_archived_by UUID,
    _upl_deleted BOOLEAN NOT NULL DEFAULT false,
    _upl_deleted_at TIMESTAMPTZ,
    _upl_deleted_by UUID,
    _upl_purge_after TIMESTAMPTZ,
    _upl_locked BOOLEAN NOT NULL DEFAULT false,
    _upl_locked_at TIMESTAMPTZ,
    _upl_locked_by UUID,
    _upl_locked_reason TEXT,
    _app_published BOOLEAN NOT NULL DEFAULT true,
    _app_published_at TIMESTAMPTZ,
    _app_published_by UUID,
    _app_archived BOOLEAN NOT NULL DEFAULT false,
    _app_archived_at TIMESTAMPTZ,
    _app_archived_by UUID,
    _app_deleted BOOLEAN NOT NULL DEFAULT false,
    _app_deleted_at TIMESTAMPTZ,
    _app_deleted_by UUID,
    _app_owner_id UUID,
    _app_access_level VARCHAR(20) NOT NULL DEFAULT 'private'
)
        `
        },
        {
            sql: `
CREATE UNIQUE INDEX IF NOT EXISTS idx_locales_code_active
    ON admin.cfg_locales (code)
    WHERE _upl_deleted = false AND _app_deleted = false
        `
        },
        {
            sql: `
CREATE UNIQUE INDEX IF NOT EXISTS idx_locales_default_content
    ON admin.cfg_locales (is_default_content)
    WHERE is_default_content = true AND _upl_deleted = false AND _app_deleted = false
        `
        },
        {
            sql: `
CREATE UNIQUE INDEX IF NOT EXISTS idx_locales_default_ui
    ON admin.cfg_locales (is_default_ui)
    WHERE is_default_ui = true AND _upl_deleted = false AND _app_deleted = false
        `
        },
        {
            sql: `
CREATE INDEX IF NOT EXISTS idx_locales_enabled_content
    ON admin.cfg_locales (is_enabled_content) WHERE is_enabled_content = true
        `
        },
        {
            sql: `
CREATE INDEX IF NOT EXISTS idx_locales_active
    ON admin.cfg_locales (id) WHERE _upl_deleted = false AND _app_deleted = false
        `
        },
        { sql: `ALTER TABLE admin.cfg_locales ENABLE ROW LEVEL SECURITY` },
        createDropPolicyIfTableExistsStatement('authenticated_read_locales', 'admin', 'cfg_locales'),
        {
            sql: `
CREATE POLICY "authenticated_read_locales" ON admin.cfg_locales
    FOR SELECT USING (true)
        `
        },
        createDropPolicyIfTableExistsStatement('admin_access_manage_locales', 'admin', 'cfg_locales'),
        {
            sql: `
CREATE POLICY "admin_access_manage_locales" ON admin.cfg_locales
    FOR ALL USING (
        (select admin.has_admin_permission((select auth.uid())))
    )
        `
        },
        // ── Seed: locales ─────────────────────────────────────────────
        {
            sql: `
INSERT INTO admin.cfg_locales (code, name, native_name, is_enabled_content, is_enabled_ui, is_default_content, is_default_ui, is_system, sort_order)
VALUES
    (
        'en',
        '{
            "_schema": "1",
            "_primary": "en",
            "locales": {
                "en": {"content": "English", "version": 1, "isActive": true, "createdAt": "2024-12-13T00:00:00.000Z", "updatedAt": "2024-12-13T00:00:00.000Z"},
                "ru": {"content": "Английский", "version": 1, "isActive": true, "createdAt": "2024-12-13T00:00:00.000Z", "updatedAt": "2024-12-13T00:00:00.000Z"}
            }
        }'::jsonb,
        'English',
        true,
        true,
        true,
        true,
        true,
        1
    ),
    (
        'ru',
        '{
            "_schema": "1",
            "_primary": "en",
            "locales": {
                "en": {"content": "Russian", "version": 1, "isActive": true, "createdAt": "2024-12-13T00:00:00.000Z", "updatedAt": "2024-12-13T00:00:00.000Z"},
                "ru": {"content": "Русский", "version": 1, "isActive": true, "createdAt": "2024-12-13T00:00:00.000Z", "updatedAt": "2024-12-13T00:00:00.000Z"}
            }
        }'::jsonb,
        'Русский',
        true,
        true,
        false,
        false,
        true,
        2
    )
ON CONFLICT (code) WHERE _upl_deleted = false AND _app_deleted = false
DO NOTHING
        `
        },
        // ── cfg_settings table ────────────────────────────────────────
        {
            sql: `
CREATE TABLE IF NOT EXISTS admin.cfg_settings (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
    category VARCHAR(50) NOT NULL,
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL DEFAULT '{}',
    _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_created_by UUID,
    _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_updated_by UUID,
    _upl_version INTEGER NOT NULL DEFAULT 1,
    _upl_archived BOOLEAN NOT NULL DEFAULT false,
    _upl_archived_at TIMESTAMPTZ,
    _upl_archived_by UUID,
    _upl_deleted BOOLEAN NOT NULL DEFAULT false,
    _upl_deleted_at TIMESTAMPTZ,
    _upl_deleted_by UUID,
    _upl_purge_after TIMESTAMPTZ,
    _upl_locked BOOLEAN NOT NULL DEFAULT false,
    _upl_locked_at TIMESTAMPTZ,
    _upl_locked_by UUID,
    _upl_locked_reason TEXT,
    _app_published BOOLEAN NOT NULL DEFAULT true,
    _app_published_at TIMESTAMPTZ,
    _app_published_by UUID,
    _app_archived BOOLEAN NOT NULL DEFAULT false,
    _app_archived_at TIMESTAMPTZ,
    _app_archived_by UUID,
    _app_deleted BOOLEAN NOT NULL DEFAULT false,
    _app_deleted_at TIMESTAMPTZ,
    _app_deleted_by UUID,
    _app_owner_id UUID,
    _app_access_level VARCHAR(20) NOT NULL DEFAULT 'private'
)
        `
        },
        {
            sql: `
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_category_key_active
    ON admin.cfg_settings (category, key)
    WHERE _upl_deleted = false AND _app_deleted = false
        `
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_settings_category ON admin.cfg_settings (category)`
        },
        { sql: `ALTER TABLE admin.cfg_settings ENABLE ROW LEVEL SECURITY` },
        createDropPolicyIfTableExistsStatement('authenticated_read_settings', 'admin', 'cfg_settings'),
        {
            sql: `
CREATE POLICY "authenticated_read_settings" ON admin.cfg_settings
    FOR SELECT USING (true)
        `
        },
        createDropPolicyIfTableExistsStatement('admin_access_manage_settings', 'admin', 'cfg_settings'),
        {
            sql: `
CREATE POLICY "admin_access_manage_settings" ON admin.cfg_settings
    FOR ALL USING (
        (select admin.has_admin_permission((select auth.uid())))
    )
        `
        },
        // ── Seed: settings (includes folded codenameAutoConvertMixedAlphabets) ──
        {
            sql: `
INSERT INTO admin.cfg_settings (category, key, value)
VALUES
    ('metahubs', 'codenameStyle', '{"_value": "pascal-case"}'::jsonb),
    ('metahubs', 'codenameAlphabet', '{"_value": "en-ru"}'::jsonb),
    ('metahubs', 'codenameAllowMixedAlphabets', '{"_value": false}'::jsonb),
    ('metahubs', 'codenameAutoConvertMixedAlphabets', '{"_value": true}'::jsonb),
    ('metahubs', 'platformSystemAttributesConfigurable', '{"_value": false}'::jsonb),
    ('metahubs', 'platformSystemAttributesRequired', '{"_value": true}'::jsonb),
    ('metahubs', 'platformSystemAttributesIgnoreMetahubSettings', '{"_value": true}'::jsonb)
ON CONFLICT (category, key) WHERE _upl_deleted = false AND _app_deleted = false
DO NOTHING
        `
        }
    ] as const,
    down: [
        createDropPolicyIfTableExistsStatement('admin_access_manage_settings', 'admin', 'cfg_settings'),
        createDropPolicyIfTableExistsStatement('authenticated_read_settings', 'admin', 'cfg_settings'),
        createDropPolicyIfTableExistsStatement('admin_access_manage_locales', 'admin', 'cfg_locales'),
        createDropPolicyIfTableExistsStatement('authenticated_read_locales', 'admin', 'cfg_locales'),
        createDropPolicyIfTableExistsStatement('instances_manage_admin_access', 'admin', 'cfg_instances'),
        createDropPolicyIfTableExistsStatement('instances_select_admin_access', 'admin', 'cfg_instances'),
        createDropPolicyIfTableExistsStatement('users_read_own_roles', 'admin', 'rel_user_roles'),
        createDropPolicyIfTableExistsStatement('admin_access_manage_user_roles', 'admin', 'rel_user_roles'),
        createDropPolicyIfTableExistsStatement('admin_access_manage_role_permissions', 'admin', 'rel_role_permissions'),
        createDropPolicyIfTableExistsStatement('authenticated_read_roles', 'admin', 'cat_roles'),
        createDropPolicyIfTableExistsStatement('admin_access_manage_roles', 'admin', 'cat_roles'),
        { sql: `DROP FUNCTION IF EXISTS admin.get_user_global_roles(UUID)` },
        { sql: `DROP FUNCTION IF EXISTS admin.has_admin_permission(UUID)` },
        { sql: `DROP FUNCTION IF EXISTS admin.is_superuser(UUID)` },
        { sql: `DROP FUNCTION IF EXISTS admin.get_user_permissions(UUID)` },
        { sql: `DROP FUNCTION IF EXISTS admin.has_permission(UUID, TEXT, TEXT, JSONB)` },
        { sql: `DROP TABLE IF EXISTS admin.cfg_locales CASCADE` },
        { sql: `DROP TABLE IF EXISTS admin.rel_user_roles CASCADE` },
        { sql: `DROP TABLE IF EXISTS admin.rel_role_permissions CASCADE` },
        { sql: `DROP TABLE IF EXISTS admin.cat_roles CASCADE` },
        { sql: `DROP TABLE IF EXISTS admin.cfg_instances CASCADE` },
        { sql: `DROP SCHEMA IF EXISTS admin CASCADE` }
    ] as const
}

const adminSchemaPreludeStatements = createAdminSchemaMigrationDefinition.up.filter(
    (statement) => normalizeSql(statement.sql) === 'CREATE SCHEMA IF NOT EXISTS admin'
)

const adminSchemaPostGenerationStatements = createAdminSchemaMigrationDefinition.up.filter(
    (statement) => !normalizeSql(statement.sql).startsWith('CREATE TABLE IF NOT EXISTS admin.')
)

export const prepareAdminSchemaSupportMigrationDefinition: SqlMigrationDefinition = {
    id: 'PrepareAdminSchemaSupport1733400000000',
    version: '1733400000000',
    summary: 'Prepare admin support objects before definition-driven schema generation',
    up: adminSchemaPreludeStatements,
    down: [] as const
}

export const finalizeAdminSchemaSupportMigrationDefinition: SqlMigrationDefinition = {
    id: 'FinalizeAdminSchemaSupport1733400000001',
    version: '1733400000001',
    summary: 'Finalize admin support objects after definition-driven schema generation',
    up: adminSchemaPostGenerationStatements,
    down: [] as const
}

export const seedAdminLifecycleRolesMigrationDefinition: SqlMigrationDefinition = {
    id: 'SeedAdminLifecycleRoles1733400000002',
    version: '1733400000002',
    summary: 'Seed registered and user lifecycle roles plus backfill assignments for existing profiles',
    up: [...adminLifecycleRoleSeedStatements, ...adminLifecycleRoleBackfillStatements],
    down: [] as const
}
