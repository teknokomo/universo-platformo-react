import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Consolidated RBAC Migration for Admin System
 *
 * Creates the complete admin schema with:
 * - roles: System and custom roles with metadata (display_name, color, has_global_access)
 * - role_permissions: Permission assignments with wildcard support
 * - user_roles: User-to-role assignments
 * - PostgreSQL functions for permission checking (CASL integration)
 * - RLS policies for security
 *
 * System roles created:
 * - superadmin: Full platform access (* → *)
 * - supermoderator: Platform-wide moderation (read, update, delete)
 */
export class CreateAdminRBAC1733400000000 implements MigrationInterface {
    name = 'CreateAdminRBAC1733400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ═══════════════════════════════════════════════════════════════
        // 1. CREATE ADMIN SCHEMA
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS admin`)

        // ═══════════════════════════════════════════════════════════════
        // 2. ROLES TABLE (with metadata columns)
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS admin.roles (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(50) NOT NULL UNIQUE,
                description TEXT,
                display_name JSONB DEFAULT '{}',
                color VARCHAR(7) DEFAULT '#9e9e9e',
                has_global_access BOOLEAN DEFAULT false,
                is_system BOOLEAN DEFAULT false,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)

        // ═══════════════════════════════════════════════════════════════
        // 3. ROLE PERMISSIONS TABLE (with wildcard and ABAC support)
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS admin.role_permissions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                role_id UUID NOT NULL REFERENCES admin.roles(id) ON DELETE CASCADE,
                module VARCHAR(100) NOT NULL,
                action VARCHAR(20) NOT NULL,
                conditions JSONB DEFAULT '{}',
                fields TEXT[] DEFAULT ARRAY[]::TEXT[],
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(role_id, module, action)
            )
        `)

        // ═══════════════════════════════════════════════════════════════
        // 4. USER ROLES TABLE
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS admin.user_roles (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                role_id UUID NOT NULL REFERENCES admin.roles(id) ON DELETE CASCADE,
                granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
                comment TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(user_id, role_id)
            )
        `)

        // ═══════════════════════════════════════════════════════════════
        // 5. INDEXES
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
            CREATE INDEX IF NOT EXISTS idx_roles_has_global_access 
            ON admin.roles(has_global_access) WHERE has_global_access = true
        `)

        // ═══════════════════════════════════════════════════════════════
        // 6. CREATE SYSTEM ROLES WITH METADATA
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
            INSERT INTO admin.roles (name, description, display_name, color, has_global_access, is_system)
            VALUES
                (
                    'superadmin',
                    'Full platform access - all modules, all actions',
                    '{"en": "Super Administrator", "ru": "Суперадминистратор"}'::jsonb,
                    '#ad1457',
                    true,
                    true
                ),
                (
                    'supermoderator',
                    'Platform-wide moderation - read, update, delete all',
                    '{"en": "Super Moderator", "ru": "Супермодератор"}'::jsonb,
                    '#e65100',
                    true,
                    true
                )
            ON CONFLICT (name) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                color = EXCLUDED.color,
                has_global_access = EXCLUDED.has_global_access
        `)

        // Superadmin: * → * (everything)
        await queryRunner.query(`
            INSERT INTO admin.role_permissions (role_id, module, action)
            SELECT id, '*', '*' FROM admin.roles WHERE name = 'superadmin'
            ON CONFLICT (role_id, module, action) DO NOTHING
        `)

        // Supermoderator: * → read, update, delete (no create)
        await queryRunner.query(`
            INSERT INTO admin.role_permissions (role_id, module, action)
            SELECT id, '*', unnest(ARRAY['read', 'update', 'delete'])
            FROM admin.roles WHERE name = 'supermoderator'
            ON CONFLICT (role_id, module, action) DO NOTHING
        `)

        // ═══════════════════════════════════════════════════════════════
        // 7. has_permission FUNCTION (with wildcard support)
        // Uses SECURITY DEFINER to bypass RLS when checking permissions
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION admin.has_permission(
                p_module TEXT,
                p_action TEXT,
                p_context JSONB DEFAULT '{}'
            ) RETURNS BOOLEAN AS $$
            DECLARE
                v_user_id UUID;
            BEGIN
                v_user_id := auth.uid();
                IF v_user_id IS NULL THEN RETURN FALSE; END IF;
                
                RETURN EXISTS (
                    SELECT 1 
                    FROM admin.user_roles ur
                    JOIN admin.role_permissions rp ON ur.role_id = rp.role_id
                    WHERE ur.user_id = v_user_id
                      AND (rp.module = '*' OR rp.module = p_module)
                      AND (rp.action = '*' OR rp.action = p_action)
                );
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER STABLE
        `)

        // ═══════════════════════════════════════════════════════════════
        // 8. get_user_permissions FUNCTION (for CASL, with metadata)
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION admin.get_user_permissions(p_user_id UUID)
            RETURNS TABLE (
                role_name VARCHAR,
                display_name JSONB,
                color VARCHAR,
                has_global_access BOOLEAN,
                module VARCHAR,
                action VARCHAR,
                conditions JSONB,
                fields TEXT[]
            ) AS $$
            BEGIN
                RETURN QUERY
                SELECT 
                    r.name,
                    r.display_name,
                    r.color,
                    r.has_global_access,
                    rp.module,
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
        // 9. has_global_access FUNCTION
        // Uses SECURITY DEFINER to bypass RLS when checking user roles
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION admin.has_global_access(p_user_id UUID DEFAULT NULL)
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
                      AND r.has_global_access = true
                );
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER STABLE
        `)

        // ═══════════════════════════════════════════════════════════════
        // 10. get_user_global_roles FUNCTION
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION admin.get_user_global_roles(p_user_id UUID)
            RETURNS TABLE (
                role_name VARCHAR,
                display_name JSONB,
                color VARCHAR
            ) AS $$
            BEGIN
                RETURN QUERY
                SELECT 
                    r.name,
                    r.display_name,
                    r.color
                FROM admin.user_roles ur
                JOIN admin.roles r ON ur.role_id = r.id
                WHERE ur.user_id = p_user_id
                  AND r.has_global_access = true;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER STABLE
        `)

        // ═══════════════════════════════════════════════════════════════
        // 11. ENABLE RLS
        // ═══════════════════════════════════════════════════════════════
        await queryRunner.query(`ALTER TABLE admin.roles ENABLE ROW LEVEL SECURITY`)
        await queryRunner.query(`ALTER TABLE admin.role_permissions ENABLE ROW LEVEL SECURITY`)
        await queryRunner.query(`ALTER TABLE admin.user_roles ENABLE ROW LEVEL SECURITY`)

        // ═══════════════════════════════════════════════════════════════
        // 12. RLS POLICIES
        // ═══════════════════════════════════════════════════════════════
        // Drop existing policies if they exist (for idempotent migration)
        await queryRunner.query(`DROP POLICY IF EXISTS "global_access_manage_roles" ON admin.roles`)
        await queryRunner.query(`DROP POLICY IF EXISTS "global_access_manage_role_permissions" ON admin.role_permissions`)
        await queryRunner.query(`DROP POLICY IF EXISTS "global_access_manage_user_roles" ON admin.user_roles`)
        await queryRunner.query(`DROP POLICY IF EXISTS "users_read_own_roles" ON admin.user_roles`)
        await queryRunner.query(`DROP POLICY IF EXISTS "authenticated_read_roles" ON admin.roles`)

        // Allow authenticated users to read roles table (needed for UI to show role names)
        await queryRunner.query(`
            CREATE POLICY "authenticated_read_roles" ON admin.roles
            FOR SELECT USING (true)
        `)

        // Only users with global access can manage (INSERT, UPDATE, DELETE) roles
        await queryRunner.query(`
            CREATE POLICY "global_access_manage_roles" ON admin.roles
            FOR ALL USING (
                admin.has_global_access(auth.uid())
            )
        `)

        await queryRunner.query(`
            CREATE POLICY "global_access_manage_role_permissions" ON admin.role_permissions
            FOR ALL USING (
                admin.has_global_access(auth.uid())
            )
        `)

        // Users can read their own role assignments
        await queryRunner.query(`
            CREATE POLICY "users_read_own_roles" ON admin.user_roles
            FOR SELECT USING (user_id = auth.uid())
        `)

        // Only users with global access can manage (INSERT, UPDATE, DELETE) user_roles
        await queryRunner.query(`
            CREATE POLICY "global_access_manage_user_roles" ON admin.user_roles
            FOR ALL USING (
                admin.has_global_access(auth.uid())
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop policies
        await queryRunner.query(`DROP POLICY IF EXISTS "users_read_own_roles" ON admin.user_roles`)
        await queryRunner.query(`DROP POLICY IF EXISTS "global_access_manage_user_roles" ON admin.user_roles`)
        await queryRunner.query(`DROP POLICY IF EXISTS "global_access_manage_role_permissions" ON admin.role_permissions`)
        await queryRunner.query(`DROP POLICY IF EXISTS "authenticated_read_roles" ON admin.roles`)
        await queryRunner.query(`DROP POLICY IF EXISTS "global_access_manage_roles" ON admin.roles`)

        // Drop functions
        await queryRunner.query(`DROP FUNCTION IF EXISTS admin.get_user_global_roles(UUID)`)
        await queryRunner.query(`DROP FUNCTION IF EXISTS admin.has_global_access(UUID)`)
        await queryRunner.query(`DROP FUNCTION IF EXISTS admin.get_user_permissions(UUID)`)
        await queryRunner.query(`DROP FUNCTION IF EXISTS admin.has_permission(TEXT, TEXT, JSONB)`)

        // Drop tables (in reverse FK order)
        await queryRunner.query(`DROP TABLE IF EXISTS admin.user_roles CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS admin.role_permissions CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS admin.roles CASCADE`)

        // Drop schema
        await queryRunner.query(`DROP SCHEMA IF EXISTS admin CASCADE`)
    }
}
