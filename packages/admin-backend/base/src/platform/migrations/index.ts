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

export const createAdminSchemaMigrationDefinition: SqlMigrationDefinition = {
    id: 'CreateAdminSchema1733400000000',
    version: '1733400000000',
    summary: 'Create admin platform schema',
    up: [
    {
        sql: `
CREATE SCHEMA IF NOT EXISTS admin
        `
    },
    {
        sql: `
CREATE TABLE IF NOT EXISTS admin.instances (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                codename VARCHAR(100) NOT NULL UNIQUE,
                name JSONB DEFAULT '{}',
                description JSONB,
                url VARCHAR(255),
                status VARCHAR(20) NOT NULL DEFAULT 'active',
                is_local BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT instances_status_check CHECK (status IN ('active', 'inactive', 'maintenance'))
            )
        `
    },
    {
        sql: `
CREATE TABLE IF NOT EXISTS admin.roles (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                codename VARCHAR(50) NOT NULL UNIQUE,
                name JSONB DEFAULT '{}',
                description JSONB,
                color VARCHAR(7) DEFAULT '#9e9e9e',
                is_superuser BOOLEAN DEFAULT false,
                is_system BOOLEAN DEFAULT false,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `
    },
    {
        sql: `
CREATE TABLE IF NOT EXISTS admin.role_permissions (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                role_id UUID NOT NULL REFERENCES admin.roles(id) ON DELETE CASCADE,
                subject VARCHAR(100) NOT NULL,
                action VARCHAR(20) NOT NULL,
                conditions JSONB DEFAULT '{}',
                fields TEXT[] DEFAULT ARRAY[]::TEXT[],
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(role_id, subject, action)
            )
        `
    },
    {
        sql: `
CREATE TABLE IF NOT EXISTS admin.user_roles (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                role_id UUID NOT NULL REFERENCES admin.roles(id) ON DELETE CASCADE,
                granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
                comment TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(user_id, role_id)
            )
        `
    },
    {
        sql: `
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id 
            ON admin.user_roles(user_id)
        `
    },
    {
        sql: `
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id 
            ON admin.role_permissions(role_id)
        `
    },
    {
        sql: `
CREATE INDEX IF NOT EXISTS idx_roles_is_superuser 
            ON admin.roles(is_superuser) WHERE is_superuser = true
        `
    },
    {
        sql: `
CREATE INDEX IF NOT EXISTS idx_instances_name_gin 
            ON admin.instances USING GIN (name)
        `
    },
    {
        sql: `
INSERT INTO admin.roles (codename, description, name, color, is_superuser, is_system)
            VALUES
                (
                    'superuser',
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
            ON CONFLICT (codename) DO UPDATE SET
                name = EXCLUDED.name,
                color = EXCLUDED.color,
                is_superuser = EXCLUDED.is_superuser
        `
    },
    {
        sql: `
INSERT INTO admin.role_permissions (role_id, subject, action)
            SELECT id, '*', '*' FROM admin.roles WHERE codename = 'superuser'
            ON CONFLICT (role_id, subject, action) DO NOTHING
        `
    },
    {
        sql: `
CREATE OR REPLACE FUNCTION admin.has_permission(
                p_user_id UUID DEFAULT NULL,
                p_subject TEXT DEFAULT '*',
                p_action TEXT DEFAULT '*',
                p_context JSONB DEFAULT '{}'
            ) RETURNS BOOLEAN AS $$
            DECLARE
                v_user_id UUID;
            BEGIN
                v_user_id := COALESCE(p_user_id, auth.uid());
                IF v_user_id IS NULL THEN RETURN FALSE; END IF;
                
                RETURN EXISTS (
                    SELECT 1 
                    FROM admin.user_roles ur
                    JOIN admin.role_permissions rp ON ur.role_id = rp.role_id
                    WHERE ur.user_id = v_user_id
                      AND (rp.subject = '*' OR rp.subject = p_subject)
                      AND (rp.action = '*' OR rp.action = p_action)
                );
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER STABLE
        `
    },
    {
        sql: `
CREATE OR REPLACE FUNCTION admin.get_user_permissions(p_user_id UUID)
            RETURNS TABLE (
                role_codename VARCHAR,
                name JSONB,
                color VARCHAR,
                is_superuser BOOLEAN,
                subject VARCHAR,
                action VARCHAR,
                conditions JSONB,
                fields TEXT[]
            ) AS $$
            BEGIN
                RETURN QUERY
                SELECT 
                    r.codename,
                    r.name,
                    r.color,
                    r.is_superuser,
                    rp.subject,
                    rp.action,
                    rp.conditions,
                    rp.fields
                FROM admin.user_roles ur
                JOIN admin.roles r ON ur.role_id = r.id
                JOIN admin.role_permissions rp ON r.id = rp.role_id
                WHERE ur.user_id = p_user_id;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER STABLE
        `
    },
    {
        sql: `
CREATE OR REPLACE FUNCTION admin.is_superuser(p_user_id UUID DEFAULT NULL)
            RETURNS BOOLEAN AS $$
            DECLARE
                v_user_id UUID;
            BEGIN
                v_user_id := COALESCE(p_user_id, auth.uid());
                IF v_user_id IS NULL THEN RETURN FALSE; END IF;
                
                RETURN EXISTS (
                    SELECT 1 
                    FROM admin.user_roles ur
                    JOIN admin.roles r ON ur.role_id = r.id
                    WHERE ur.user_id = v_user_id
                      AND r.is_superuser = true
                );
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER STABLE
        `
    },
    {
        sql: `
CREATE OR REPLACE FUNCTION admin.has_admin_permission(p_user_id UUID DEFAULT NULL)
            RETURNS BOOLEAN AS $$
            DECLARE
                v_user_id UUID;
            BEGIN
                v_user_id := COALESCE(p_user_id, auth.uid());
                IF v_user_id IS NULL THEN RETURN FALSE; END IF;
                
                RETURN EXISTS (
                    SELECT 1 
                    FROM admin.user_roles ur
                    JOIN admin.role_permissions rp ON ur.role_id = rp.role_id
                    WHERE ur.user_id = v_user_id
                      AND (rp.subject = '*' OR rp.subject IN ('roles', 'instances', 'users'))
                      AND (rp.action = 'read' OR rp.action = '*')
                );
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER STABLE
        `
    },
    {
        sql: `
CREATE OR REPLACE FUNCTION admin.get_user_global_roles(p_user_id UUID)
            RETURNS TABLE (
                role_codename VARCHAR,
                name JSONB,
                color VARCHAR
            ) AS $$
            BEGIN
                RETURN QUERY
                SELECT 
                    r.codename,
                    r.name,
                    r.color
                FROM admin.user_roles ur
                JOIN admin.roles r ON ur.role_id = r.id
                WHERE ur.user_id = p_user_id;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER STABLE
        `
    },
    {
        sql: `
ALTER TABLE admin.instances ENABLE ROW LEVEL SECURITY
        `
    },
    {
        sql: `
ALTER TABLE admin.roles ENABLE ROW LEVEL SECURITY
        `
    },
    {
        sql: `
ALTER TABLE admin.role_permissions ENABLE ROW LEVEL SECURITY
        `
    },
    {
        sql: `
ALTER TABLE admin.user_roles ENABLE ROW LEVEL SECURITY
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "admin_access_manage_roles" ON admin.roles
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "admin_access_manage_role_permissions" ON admin.role_permissions
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "admin_access_manage_user_roles" ON admin.user_roles
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "users_read_own_roles" ON admin.user_roles
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "authenticated_read_roles" ON admin.roles
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "instances_select_admin_access" ON admin.instances
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "instances_manage_admin_access" ON admin.instances
        `
    },
    {
        sql: `
CREATE POLICY "authenticated_read_roles" ON admin.roles
            FOR SELECT USING (true)
        `
    },
    {
        sql: `
CREATE POLICY "admin_access_manage_roles" ON admin.roles
            FOR ALL USING (
                (select admin.has_admin_permission((select auth.uid())))
            )
        `
    },
    {
        sql: `
CREATE POLICY "admin_access_manage_role_permissions" ON admin.role_permissions
            FOR ALL USING (
                (select admin.has_admin_permission((select auth.uid())))
            )
        `
    },
    {
        sql: `
CREATE POLICY "users_read_own_roles" ON admin.user_roles
            FOR SELECT USING (user_id = (select auth.uid()))
        `
    },
    {
        sql: `
CREATE POLICY "admin_access_manage_user_roles" ON admin.user_roles
            FOR ALL USING (
                (select admin.has_admin_permission((select auth.uid())))
            )
        `
    },
    {
        sql: `
CREATE POLICY "instances_select_admin_access" ON admin.instances
            FOR SELECT USING (
                (select admin.has_admin_permission((select auth.uid())))
            )
        `
    },
    {
        sql: `
CREATE POLICY "instances_manage_admin_access" ON admin.instances
            FOR ALL USING (
                (select admin.has_admin_permission((select auth.uid())))
            )
        `
    },
    {
        sql: `
INSERT INTO admin.instances (codename, name, description, status, is_local)
            VALUES (
                'local',
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
            ON CONFLICT (codename) DO NOTHING
        `
    },
    {
        sql: `
CREATE TABLE IF NOT EXISTS admin.locales (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                code VARCHAR(10) NOT NULL UNIQUE,
                name JSONB NOT NULL DEFAULT '{}',
                native_name VARCHAR(100),
                is_enabled_content BOOLEAN NOT NULL DEFAULT true,
                is_enabled_ui BOOLEAN NOT NULL DEFAULT false,
                is_default_content BOOLEAN NOT NULL DEFAULT false,
                is_default_ui BOOLEAN NOT NULL DEFAULT false,
                is_system BOOLEAN NOT NULL DEFAULT false,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `
    },
    {
        sql: `
CREATE UNIQUE INDEX IF NOT EXISTS idx_locales_default_content 
            ON admin.locales (is_default_content) WHERE is_default_content = true
        `
    },
    {
        sql: `
CREATE UNIQUE INDEX IF NOT EXISTS idx_locales_default_ui 
            ON admin.locales (is_default_ui) WHERE is_default_ui = true
        `
    },
    {
        sql: `
CREATE INDEX IF NOT EXISTS idx_locales_enabled_content 
            ON admin.locales (is_enabled_content) WHERE is_enabled_content = true
        `
    },
    {
        sql: `
ALTER TABLE admin.locales ENABLE ROW LEVEL SECURITY
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "authenticated_read_locales" ON admin.locales
        `
    },
    {
        sql: `
CREATE POLICY "authenticated_read_locales" ON admin.locales
            FOR SELECT USING (true)
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "admin_access_manage_locales" ON admin.locales
        `
    },
    {
        sql: `
CREATE POLICY "admin_access_manage_locales" ON admin.locales
            FOR ALL USING (
                (select admin.has_admin_permission((select auth.uid())))
            )
        `
    },
    {
        sql: `
INSERT INTO admin.locales (code, name, native_name, is_enabled_content, is_enabled_ui, is_default_content, is_default_ui, is_system, sort_order)
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
            ON CONFLICT (code) DO NOTHING
        `
    },
    {
        sql: `
CREATE TABLE IF NOT EXISTS admin.settings (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                category VARCHAR(50) NOT NULL,
                key VARCHAR(100) NOT NULL,
                value JSONB NOT NULL DEFAULT '{}',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(category, key)
            )
        `
    },
    {
        sql: `
CREATE INDEX IF NOT EXISTS idx_settings_category 
            ON admin.settings (category)
        `
    },
    {
        sql: `
ALTER TABLE admin.settings ENABLE ROW LEVEL SECURITY
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "authenticated_read_settings" ON admin.settings
        `
    },
    {
        sql: `
CREATE POLICY "authenticated_read_settings" ON admin.settings
            FOR SELECT USING (true)
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "admin_access_manage_settings" ON admin.settings
        `
    },
    {
        sql: `
CREATE POLICY "admin_access_manage_settings" ON admin.settings
            FOR ALL USING (
                (select admin.has_admin_permission((select auth.uid())))
            )
        `
    },
    {
        sql: `
INSERT INTO admin.settings (category, key, value)
            VALUES
                ('metahubs', 'codenameStyle', '{"_value": "pascal-case"}'::jsonb),
                ('metahubs', 'codenameAlphabet', '{"_value": "en-ru"}'::jsonb),
                ('metahubs', 'codenameAllowMixedAlphabets', '{"_value": false}'::jsonb),
                ('metahubs', 'codenameLocalizedEnabled', '{"_value": false}'::jsonb)
            ON CONFLICT (category, key) DO NOTHING
        `
    }
] as const,
    down: [
    {
        sql: `
DROP POLICY IF EXISTS "admin_access_manage_settings" ON admin.settings
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "authenticated_read_settings" ON admin.settings
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "admin_access_manage_locales" ON admin.locales
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "authenticated_read_locales" ON admin.locales
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "instances_manage_admin_access" ON admin.instances
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "instances_select_admin_access" ON admin.instances
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "users_read_own_roles" ON admin.user_roles
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "admin_access_manage_user_roles" ON admin.user_roles
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "admin_access_manage_role_permissions" ON admin.role_permissions
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "authenticated_read_roles" ON admin.roles
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "admin_access_manage_roles" ON admin.roles
        `
    },
    {
        sql: `
DROP FUNCTION IF EXISTS admin.get_user_global_roles(UUID)
        `
    },
    {
        sql: `
DROP FUNCTION IF EXISTS admin.has_admin_permission(UUID)
        `
    },
    {
        sql: `
DROP FUNCTION IF EXISTS admin.is_superuser(UUID)
        `
    },
    {
        sql: `
DROP FUNCTION IF EXISTS admin.get_user_permissions(UUID)
        `
    },
    {
        sql: `
DROP FUNCTION IF EXISTS admin.has_permission(UUID, TEXT, TEXT, JSONB)
        `
    },
    {
        sql: `
DROP TABLE IF EXISTS admin.settings CASCADE
        `
    },
    {
        sql: `
DROP TABLE IF EXISTS admin.locales CASCADE
        `
    },
    {
        sql: `
DROP TABLE IF EXISTS admin.user_roles CASCADE
        `
    },
    {
        sql: `
DROP TABLE IF EXISTS admin.role_permissions CASCADE
        `
    },
    {
        sql: `
DROP TABLE IF EXISTS admin.roles CASCADE
        `
    },
    {
        sql: `
DROP TABLE IF EXISTS admin.instances CASCADE
        `
    },
    {
        sql: `
DROP SCHEMA IF EXISTS admin CASCADE
        `
    }
] as const
}

export const addCodenameAutoConvertMixedSettingMigrationDefinition: SqlMigrationDefinition = {
    id: 'AddCodenameAutoConvertMixedSetting1733500000000',
    version: '1733500000000',
    summary: 'Add admin codename auto convert mixed setting',
    up: [
    {
        sql: `
INSERT INTO admin.settings (category, key, value)
            VALUES ('metahubs', 'codenameAutoConvertMixedAlphabets', '{"_value": true}'::jsonb)
            ON CONFLICT (category, key)
            DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `
    }
] as const,
    down: [
    {
        sql: `
INSERT INTO admin.settings (category, key, value)
            VALUES ('metahubs', 'codenameAutoConvertMixedAlphabets', '{"_value": false}'::jsonb)
            ON CONFLICT (category, key)
            DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `
    }
] as const
}

export const addAdminSoftDeleteColumnsMigrationDefinition: SqlMigrationDefinition = {
    id: 'AddAdminSoftDeleteColumns1800000000300',
    version: '1800000000300',
    summary: 'Add soft-delete columns (_upl_deleted, _upl_deleted_at, _upl_deleted_by) to admin tables; replace hard UNIQUE constraints with partial unique indexes',
    up: [
    // ── Step 1: Add soft-delete columns ──────────────────────────────
    {
        sql: `
ALTER TABLE admin.roles
    ADD COLUMN IF NOT EXISTS _upl_deleted BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS _upl_deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS _upl_deleted_by UUID
        `
    },
    {
        sql: `
ALTER TABLE admin.role_permissions
    ADD COLUMN IF NOT EXISTS _upl_deleted BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS _upl_deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS _upl_deleted_by UUID
        `
    },
    {
        sql: `
ALTER TABLE admin.locales
    ADD COLUMN IF NOT EXISTS _upl_deleted BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS _upl_deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS _upl_deleted_by UUID
        `
    },
    {
        sql: `
ALTER TABLE admin.settings
    ADD COLUMN IF NOT EXISTS _upl_deleted BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS _upl_deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS _upl_deleted_by UUID
        `
    },
    // ── Step 2: Drop hard UNIQUE constraints (they block soft-deleted re-inserts) ──
    {
        sql: `ALTER TABLE admin.roles DROP CONSTRAINT IF EXISTS roles_codename_key`
    },
    {
        sql: `ALTER TABLE admin.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_id_subject_action_key`
    },
    {
        sql: `ALTER TABLE admin.locales DROP CONSTRAINT IF EXISTS locales_code_key`
    },
    {
        sql: `ALTER TABLE admin.settings DROP CONSTRAINT IF EXISTS settings_category_key_key`
    },
    // ── Step 3: Create partial unique indexes (active rows only) ─────
    {
        sql: `
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_codename_active
    ON admin.roles (codename) WHERE _upl_deleted = false
        `
    },
    {
        sql: `
CREATE UNIQUE INDEX IF NOT EXISTS idx_role_permissions_unique_active
    ON admin.role_permissions (role_id, subject, action) WHERE _upl_deleted = false
        `
    },
    {
        sql: `
CREATE UNIQUE INDEX IF NOT EXISTS idx_locales_code_active
    ON admin.locales (code) WHERE _upl_deleted = false
        `
    },
    {
        sql: `
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_category_key_active
    ON admin.settings (category, key) WHERE _upl_deleted = false
        `
    },
    // ── Step 4: Performance indexes for filtering active rows ────────
    {
        sql: `
CREATE INDEX IF NOT EXISTS idx_roles_active
    ON admin.roles (id) WHERE _upl_deleted = false
        `
    },
    {
        sql: `
CREATE INDEX IF NOT EXISTS idx_locales_active
    ON admin.locales (id) WHERE _upl_deleted = false
        `
    },
    {
        sql: `
CREATE INDEX IF NOT EXISTS idx_role_permissions_active
    ON admin.role_permissions (role_id) WHERE _upl_deleted = false
        `
    },
    // ── Step 5: Rebuild default-locale unique indexes with soft-delete guard ──
    {
        sql: `DROP INDEX IF EXISTS admin.idx_locales_default_content`
    },
    {
        sql: `
CREATE UNIQUE INDEX idx_locales_default_content
    ON admin.locales (is_default_content) WHERE is_default_content = true AND _upl_deleted = false
        `
    },
    {
        sql: `DROP INDEX IF EXISTS admin.idx_locales_default_ui`
    },
    {
        sql: `
CREATE UNIQUE INDEX idx_locales_default_ui
    ON admin.locales (is_default_ui) WHERE is_default_ui = true AND _upl_deleted = false
        `
    },
    // ── Step 6: Re-create database functions with soft-delete filters ──
    {
        sql: `
CREATE OR REPLACE FUNCTION admin.has_permission(
    p_user_id UUID DEFAULT NULL,
    p_subject TEXT DEFAULT '*',
    p_action TEXT DEFAULT '*',
    p_context JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    IF v_user_id IS NULL THEN RETURN FALSE; END IF;
    RETURN EXISTS (
        SELECT 1
        FROM admin.user_roles ur
        JOIN admin.role_permissions rp ON ur.role_id = rp.role_id
        WHERE ur.user_id = v_user_id
          AND rp._upl_deleted = false
          AND (rp.subject = '*' OR rp.subject = p_subject)
          AND (rp.action = '*' OR rp.action = p_action)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
        `
    },
    {
        sql: `
CREATE OR REPLACE FUNCTION admin.get_user_permissions(p_user_id UUID)
RETURNS TABLE (
    role_codename VARCHAR,
    name JSONB,
    color VARCHAR,
    is_superuser BOOLEAN,
    subject VARCHAR,
    action VARCHAR,
    conditions JSONB,
    fields TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.codename,
        r.name,
        r.color,
        r.is_superuser,
        rp.subject,
        rp.action,
        rp.conditions,
        rp.fields
    FROM admin.user_roles ur
    JOIN admin.roles r ON ur.role_id = r.id
    JOIN admin.role_permissions rp ON r.id = rp.role_id
    WHERE ur.user_id = p_user_id
      AND r._upl_deleted = false
      AND rp._upl_deleted = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
        `
    },
    {
        sql: `
CREATE OR REPLACE FUNCTION admin.is_superuser(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    IF v_user_id IS NULL THEN RETURN FALSE; END IF;
    RETURN EXISTS (
        SELECT 1
        FROM admin.user_roles ur
        JOIN admin.roles r ON ur.role_id = r.id
        WHERE ur.user_id = v_user_id
          AND r.is_superuser = true
          AND r._upl_deleted = false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
        `
    },
    {
        sql: `
CREATE OR REPLACE FUNCTION admin.has_admin_permission(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    IF v_user_id IS NULL THEN RETURN FALSE; END IF;
    RETURN EXISTS (
        SELECT 1
        FROM admin.user_roles ur
        JOIN admin.role_permissions rp ON ur.role_id = rp.role_id
        WHERE ur.user_id = v_user_id
          AND rp._upl_deleted = false
          AND (rp.subject = '*' OR rp.subject IN ('roles', 'instances', 'users'))
          AND (rp.action = 'read' OR rp.action = '*')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
        `
    },
    {
        sql: `
CREATE OR REPLACE FUNCTION admin.get_user_global_roles(p_user_id UUID)
RETURNS TABLE (
    role_codename VARCHAR,
    name JSONB,
    color VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.codename,
        r.name,
        r.color
    FROM admin.user_roles ur
    JOIN admin.roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
      AND r._upl_deleted = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
        `
    }
] as const,
    down: [
    // ── Reverse Step 6: Restore original database functions (must run before column drops) ──
    {
        sql: `
CREATE OR REPLACE FUNCTION admin.has_permission(
    p_user_id UUID DEFAULT NULL,
    p_subject TEXT DEFAULT '*',
    p_action TEXT DEFAULT '*',
    p_context JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    IF v_user_id IS NULL THEN RETURN FALSE; END IF;
    RETURN EXISTS (
        SELECT 1
        FROM admin.user_roles ur
        JOIN admin.role_permissions rp ON ur.role_id = rp.role_id
        WHERE ur.user_id = v_user_id
          AND (rp.subject = '*' OR rp.subject = p_subject)
          AND (rp.action = '*' OR rp.action = p_action)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
        `
    },
    {
        sql: `
CREATE OR REPLACE FUNCTION admin.get_user_permissions(p_user_id UUID)
RETURNS TABLE (
    role_codename VARCHAR,
    name JSONB,
    color VARCHAR,
    is_superuser BOOLEAN,
    subject VARCHAR,
    action VARCHAR,
    conditions JSONB,
    fields TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.codename,
        r.name,
        r.color,
        r.is_superuser,
        rp.subject,
        rp.action,
        rp.conditions,
        rp.fields
    FROM admin.user_roles ur
    JOIN admin.roles r ON ur.role_id = r.id
    JOIN admin.role_permissions rp ON r.id = rp.role_id
    WHERE ur.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
        `
    },
    {
        sql: `
CREATE OR REPLACE FUNCTION admin.is_superuser(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    IF v_user_id IS NULL THEN RETURN FALSE; END IF;
    RETURN EXISTS (
        SELECT 1
        FROM admin.user_roles ur
        JOIN admin.roles r ON ur.role_id = r.id
        WHERE ur.user_id = v_user_id
          AND r.is_superuser = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
        `
    },
    {
        sql: `
CREATE OR REPLACE FUNCTION admin.has_admin_permission(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    IF v_user_id IS NULL THEN RETURN FALSE; END IF;
    RETURN EXISTS (
        SELECT 1
        FROM admin.user_roles ur
        JOIN admin.role_permissions rp ON ur.role_id = rp.role_id
        WHERE ur.user_id = v_user_id
          AND (rp.subject = '*' OR rp.subject IN ('roles', 'instances', 'users'))
          AND (rp.action = 'read' OR rp.action = '*')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
        `
    },
    {
        sql: `
CREATE OR REPLACE FUNCTION admin.get_user_global_roles(p_user_id UUID)
RETURNS TABLE (
    role_codename VARCHAR,
    name JSONB,
    color VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.codename,
        r.name,
        r.color
    FROM admin.user_roles ur
    JOIN admin.roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
        `
    },
    // ── Reverse Step 5: Restore original default-locale indexes ──────
    {
        sql: `DROP INDEX IF EXISTS admin.idx_locales_default_ui`
    },
    {
        sql: `
CREATE UNIQUE INDEX idx_locales_default_ui
    ON admin.locales (is_default_ui) WHERE is_default_ui = true
        `
    },
    {
        sql: `DROP INDEX IF EXISTS admin.idx_locales_default_content`
    },
    {
        sql: `
CREATE UNIQUE INDEX idx_locales_default_content
    ON admin.locales (is_default_content) WHERE is_default_content = true
        `
    },
    // ── Reverse Step 4: Drop performance indexes ─────────────────────
    {
        sql: `DROP INDEX IF EXISTS admin.idx_role_permissions_active`
    },
    {
        sql: `DROP INDEX IF EXISTS admin.idx_locales_active`
    },
    {
        sql: `DROP INDEX IF EXISTS admin.idx_roles_active`
    },
    // ── Reverse Step 3: Drop partial unique indexes ──────────────────
    {
        sql: `DROP INDEX IF EXISTS admin.idx_settings_category_key_active`
    },
    {
        sql: `DROP INDEX IF EXISTS admin.idx_locales_code_active`
    },
    {
        sql: `DROP INDEX IF EXISTS admin.idx_role_permissions_unique_active`
    },
    {
        sql: `DROP INDEX IF EXISTS admin.idx_roles_codename_active`
    },
    // ── Reverse Step 2: Restore hard UNIQUE constraints ──────────────
    {
        sql: `ALTER TABLE admin.settings ADD CONSTRAINT settings_category_key_key UNIQUE (category, key)`
    },
    {
        sql: `ALTER TABLE admin.locales ADD CONSTRAINT locales_code_key UNIQUE (code)`
    },
    {
        sql: `ALTER TABLE admin.role_permissions ADD CONSTRAINT role_permissions_role_id_subject_action_key UNIQUE (role_id, subject, action)`
    },
    {
        sql: `ALTER TABLE admin.roles ADD CONSTRAINT roles_codename_key UNIQUE (codename)`
    },
    // ── Reverse Step 1: Drop soft-delete columns ─────────────────────
    {
        sql: `
ALTER TABLE admin.settings
    DROP COLUMN IF EXISTS _upl_deleted,
    DROP COLUMN IF EXISTS _upl_deleted_at,
    DROP COLUMN IF EXISTS _upl_deleted_by
        `
    },
    {
        sql: `
ALTER TABLE admin.locales
    DROP COLUMN IF EXISTS _upl_deleted,
    DROP COLUMN IF EXISTS _upl_deleted_at,
    DROP COLUMN IF EXISTS _upl_deleted_by
        `
    },
    {
        sql: `
ALTER TABLE admin.role_permissions
    DROP COLUMN IF EXISTS _upl_deleted,
    DROP COLUMN IF EXISTS _upl_deleted_at,
    DROP COLUMN IF EXISTS _upl_deleted_by
        `
    },
    {
        sql: `
ALTER TABLE admin.roles
    DROP COLUMN IF EXISTS _upl_deleted,
    DROP COLUMN IF EXISTS _upl_deleted_at,
    DROP COLUMN IF EXISTS _upl_deleted_by
        `
    }
] as const
}
