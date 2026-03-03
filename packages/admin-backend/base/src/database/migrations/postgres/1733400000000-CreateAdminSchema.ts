import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Consolidated Admin Schema Migration
 *
 * Creates the complete admin schema with:
 * - instances: Platform instances (Local, remote future)
 * - roles: System and custom roles with metadata (display_name, color, is_superuser)
 * - role_permissions: Permission assignments with wildcard support
 * - user_roles: User-to-role assignments
 * - locales: Dynamic locale management for VLC and UI
 * - settings: Platform-wide configuration (codename defaults, etc.)
 * - PostgreSQL functions for permission checking (CASL integration)
 * - RLS policies for security
 *
 * System roles created:
 * - superuser: Full platform access with bypass (* → *), is_superuser = true
 *
 * Architecture:
 * - is_superuser: Grants full bypass of all permission checks (only for superuser role)
 * - Admin access: Computed from permissions (roles:read, instances:read, or users:read grants admin panel access)
 * - permissions: Granular CRUD permissions on modules (e.g., metaverses:*, settings:showAllItems)
 *
 * Default instances:
 * - Local: Current installation (pre-seeded)
 *
 * System locales:
 * - en (English), ru (Russian) — both content and UI enabled
 *
 * Default settings:
 * - metahubs.codenameStyle: 'pascal-case'
 * - metahubs.codenameAlphabet: 'en-ru'
 * - metahubs.codenameAllowMixedAlphabets: false
 * - metahubs.codenameLocalizedEnabled: false
 */
export class CreateAdminSchema1733400000000 implements MigrationInterface {
    name = 'CreateAdminSchema1733400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ═══════════════════════════════════════════════════════════════
        // 0. CREATE ADMIN SCHEMA
        // ═══════════════════════════════════════════════════════════════
        // Note: UUID v7 function (public.uuid_generate_v7) is created by
        // infrastructure migration 1500000000000-InitializeUuidV7Function
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS admin`)

        // ═══════════════════════════════════════════════════════════════
        // 1. INSTANCES TABLE (platform instances)
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
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
        `)

        // ═══════════════════════════════════════════════════════════════
        // 3. ROLES TABLE (with metadata columns)
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
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
        `)

        // ═══════════════════════════════════════════════════════════════
        // 4. ROLE PERMISSIONS TABLE (with wildcard and ABAC support)
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
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
        `)

        // ═══════════════════════════════════════════════════════════════
        // 5. USER ROLES TABLE
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS admin.user_roles (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                role_id UUID NOT NULL REFERENCES admin.roles(id) ON DELETE CASCADE,
                granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
                comment TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(user_id, role_id)
            )
        `)

        // ═══════════════════════════════════════════════════════════════
        // 6. INDEXES
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_user_roles_user_id 
            ON admin.user_roles(user_id)
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id 
            ON admin.role_permissions(role_id)
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_roles_is_superuser 
            ON admin.roles(is_superuser) WHERE is_superuser = true
        `)
        // GIN index for efficient JSONB search on name
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_instances_name_gin 
            ON admin.instances USING GIN (name)
        `)

        // ═══════════════════════════════════════════════════════════════
        // 7. CREATE SYSTEM ROLES WITH METADATA
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
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
        `)

        // Superuser: * → * (everything, but this is mainly for UI/documentation - bypass is in code)
        await queryRunner.query(`
            INSERT INTO admin.role_permissions (role_id, subject, action)
            SELECT id, '*', '*' FROM admin.roles WHERE codename = 'superuser'
            ON CONFLICT (role_id, subject, action) DO NOTHING
        `)

        // ═══════════════════════════════════════════════════════════════
        // 8. has_permission FUNCTION (with wildcard support)
        // Uses SECURITY DEFINER to bypass RLS when checking permissions
        // Accepts optional p_user_id; falls back to auth.uid() for RLS context
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
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
        `)

        // ═══════════════════════════════════════════════════════════════
        // 9. get_user_permissions FUNCTION (for CASL, with metadata)
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
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
        `)

        // ═══════════════════════════════════════════════════════════════
        // 10. is_superuser FUNCTION
        // Checks if user has is_superuser = true role (full bypass)
        // Uses SECURITY DEFINER to bypass RLS when checking user roles
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
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
        `)

        // ═══════════════════════════════════════════════════════════════
        // 11. has_admin_permission FUNCTION
        // Checks if user can access /admin/* panel
        // True if user has any permission on roles, instances, or users modules (with read or wildcard action)
        // Uses SECURITY DEFINER to bypass RLS when checking user roles
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
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
        `)

        // ═══════════════════════════════════════════════════════════════
        // 12. get_user_global_roles FUNCTION
        // Returns all roles for a user (not filtered by admin access)
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
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
        `)

        // ═══════════════════════════════════════════════════════════════
        // 12. ENABLE RLS
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`ALTER TABLE admin.instances ENABLE ROW LEVEL SECURITY`)
        await queryRunner.query(`ALTER TABLE admin.roles ENABLE ROW LEVEL SECURITY`)
        await queryRunner.query(`ALTER TABLE admin.role_permissions ENABLE ROW LEVEL SECURITY`)
        await queryRunner.query(`ALTER TABLE admin.user_roles ENABLE ROW LEVEL SECURITY`)

        // ═══════════════════════════════════════════════════════════════
        // 13. RLS POLICIES
        // ═══════════════════════════════════════════════════════════════
        // Drop existing policies if they exist (for idempotent migration)
        await queryRunner.query(`DROP POLICY IF EXISTS "admin_access_manage_roles" ON admin.roles`)
        await queryRunner.query(`DROP POLICY IF EXISTS "admin_access_manage_role_permissions" ON admin.role_permissions`)
        await queryRunner.query(`DROP POLICY IF EXISTS "admin_access_manage_user_roles" ON admin.user_roles`)
        await queryRunner.query(`DROP POLICY IF EXISTS "users_read_own_roles" ON admin.user_roles`)
        await queryRunner.query(`DROP POLICY IF EXISTS "authenticated_read_roles" ON admin.roles`)
        await queryRunner.query(`DROP POLICY IF EXISTS "instances_select_admin_access" ON admin.instances`)
        await queryRunner.query(`DROP POLICY IF EXISTS "instances_manage_admin_access" ON admin.instances`)

        // Allow authenticated users to read roles table (needed for UI to show role names)
        await queryRunner.query(`
            CREATE POLICY "authenticated_read_roles" ON admin.roles
            FOR SELECT USING (true)
        `)

        // Only users with admin access can manage (INSERT, UPDATE, DELETE) roles
        await queryRunner.query(`
            CREATE POLICY "admin_access_manage_roles" ON admin.roles
            FOR ALL USING (
                admin.has_admin_permission(auth.uid())
            )
        `)

        await queryRunner.query(`
            CREATE POLICY "admin_access_manage_role_permissions" ON admin.role_permissions
            FOR ALL USING (
                admin.has_admin_permission(auth.uid())
            )
        `)

        // Users can read their own role assignments
        await queryRunner.query(`
            CREATE POLICY "users_read_own_roles" ON admin.user_roles
            FOR SELECT USING (user_id = auth.uid())
        `)

        // Only users with admin access can manage (INSERT, UPDATE, DELETE) user_roles
        await queryRunner.query(`
            CREATE POLICY "admin_access_manage_user_roles" ON admin.user_roles
            FOR ALL USING (
                admin.has_admin_permission(auth.uid())
            )
        `)

        // Users with admin access can read instances
        await queryRunner.query(`
            CREATE POLICY "instances_select_admin_access" ON admin.instances
            FOR SELECT USING (
                admin.has_admin_permission(auth.uid())
            )
        `)

        // Users with admin access can manage instances
        await queryRunner.query(`
            CREATE POLICY "instances_manage_admin_access" ON admin.instances
            FOR ALL USING (
                admin.has_admin_permission(auth.uid())
            )
        `)

        // ═══════════════════════════════════════════════════════════════
        // 14. SEED LOCAL INSTANCE
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
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
        `)

        // ═══════════════════════════════════════════════════════════════
        // 15. LOCALES TABLE (dynamic language management)
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
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
        `)

        // Partial unique index: only one default content locale
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_locales_default_content 
            ON admin.locales (is_default_content) WHERE is_default_content = true
        `)

        // Partial unique index: only one default UI locale
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_locales_default_ui 
            ON admin.locales (is_default_ui) WHERE is_default_ui = true
        `)

        // Index for enabled content locales (frequent query)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_locales_enabled_content 
            ON admin.locales (is_enabled_content) WHERE is_enabled_content = true
        `)

        // Enable RLS on locales
        await queryRunner.query(`ALTER TABLE admin.locales ENABLE ROW LEVEL SECURITY`)

        // Locales are readable by all authenticated users
        await queryRunner.query(`DROP POLICY IF EXISTS "authenticated_read_locales" ON admin.locales`)
        await queryRunner.query(`
            CREATE POLICY "authenticated_read_locales" ON admin.locales
            FOR SELECT USING (true)
        `)

        // Only admins can manage locales
        await queryRunner.query(`DROP POLICY IF EXISTS "admin_access_manage_locales" ON admin.locales`)
        await queryRunner.query(`
            CREATE POLICY "admin_access_manage_locales" ON admin.locales
            FOR ALL USING (
                admin.has_admin_permission(auth.uid())
            )
        `)

        // Seed system locales (en, ru)
        await queryRunner.query(`
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
        `)

        // ═══════════════════════════════════════════════════════════════
        // 16. SETTINGS TABLE (admin-level platform settings)
        // Key-value store for platform-wide configuration.
        // Used for metahub codename defaults, application defaults, etc.
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS admin.settings (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                category VARCHAR(50) NOT NULL,
                key VARCHAR(100) NOT NULL,
                value JSONB NOT NULL DEFAULT '{}',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(category, key)
            )
        `)

        // Index for fast lookup by category
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_settings_category 
            ON admin.settings (category)
        `)

        // Enable RLS on settings
        await queryRunner.query(`ALTER TABLE admin.settings ENABLE ROW LEVEL SECURITY`)

        // Settings are readable by all authenticated users
        await queryRunner.query(`DROP POLICY IF EXISTS "authenticated_read_settings" ON admin.settings`)
        await queryRunner.query(`
            CREATE POLICY "authenticated_read_settings" ON admin.settings
            FOR SELECT USING (true)
        `)

        // Only admins can manage settings
        await queryRunner.query(`DROP POLICY IF EXISTS "admin_access_manage_settings" ON admin.settings`)
        await queryRunner.query(`
            CREATE POLICY "admin_access_manage_settings" ON admin.settings
            FOR ALL USING (
                admin.has_admin_permission(auth.uid())
            )
        `)

        // Seed default metahub codename settings
        await queryRunner.query(`
            INSERT INTO admin.settings (category, key, value)
            VALUES
                ('metahubs', 'codenameStyle', '{"_value": "pascal-case"}'::jsonb),
                ('metahubs', 'codenameAlphabet', '{"_value": "en-ru"}'::jsonb),
                ('metahubs', 'codenameAllowMixedAlphabets', '{"_value": false}'::jsonb),
                ('metahubs', 'codenameLocalizedEnabled', '{"_value": false}'::jsonb)
            ON CONFLICT (category, key) DO NOTHING
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop policies
        await queryRunner.query(`DROP POLICY IF EXISTS "admin_access_manage_settings" ON admin.settings`)
        await queryRunner.query(`DROP POLICY IF EXISTS "authenticated_read_settings" ON admin.settings`)
        await queryRunner.query(`DROP POLICY IF EXISTS "admin_access_manage_locales" ON admin.locales`)
        await queryRunner.query(`DROP POLICY IF EXISTS "authenticated_read_locales" ON admin.locales`)
        await queryRunner.query(`DROP POLICY IF EXISTS "instances_manage_admin_access" ON admin.instances`)
        await queryRunner.query(`DROP POLICY IF EXISTS "instances_select_admin_access" ON admin.instances`)
        await queryRunner.query(`DROP POLICY IF EXISTS "users_read_own_roles" ON admin.user_roles`)
        await queryRunner.query(`DROP POLICY IF EXISTS "admin_access_manage_user_roles" ON admin.user_roles`)
        await queryRunner.query(`DROP POLICY IF EXISTS "admin_access_manage_role_permissions" ON admin.role_permissions`)
        await queryRunner.query(`DROP POLICY IF EXISTS "authenticated_read_roles" ON admin.roles`)
        await queryRunner.query(`DROP POLICY IF EXISTS "admin_access_manage_roles" ON admin.roles`)

        // Drop functions
        await queryRunner.query(`DROP FUNCTION IF EXISTS admin.get_user_global_roles(UUID)`)
        await queryRunner.query(`DROP FUNCTION IF EXISTS admin.has_admin_permission(UUID)`)
        await queryRunner.query(`DROP FUNCTION IF EXISTS admin.is_superuser(UUID)`)
        await queryRunner.query(`DROP FUNCTION IF EXISTS admin.get_user_permissions(UUID)`)
        await queryRunner.query(`DROP FUNCTION IF EXISTS admin.has_permission(UUID, TEXT, TEXT, JSONB)`)

        // Drop tables (in reverse FK order)
        await queryRunner.query(`DROP TABLE IF EXISTS admin.settings CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS admin.locales CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS admin.user_roles CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS admin.role_permissions CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS admin.roles CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS admin.instances CASCADE`)

        // Drop schema
        // Note: UUID v7 function (public.uuid_generate_v7) is managed by
        // infrastructure migration 1500000000000-InitializeUuidV7Function
        await queryRunner.query(`DROP SCHEMA IF EXISTS admin CASCADE`)
    }
}
