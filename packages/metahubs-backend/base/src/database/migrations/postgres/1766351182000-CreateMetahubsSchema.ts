import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration: Create Metahubs Schema (Metadata-Driven Platform)
 *
 * Creates the metahubs schema for a metadata-driven platform similar to 1C:Enterprise.
 * Uses JSONB for dynamic data storage and VersionedLocalizedContent for i18n.
 *
 * Schema includes:
 * - metahubs: Main configuration entity (like a "database")
 * - metahubs_users: User-metahub membership (roles: owner, member, viewer)
 * - publications: External interfaces of Metahubs with access control
 * - publication_versions: Versioned snapshots of Metahub schemas
 *
 * Note: Hubs, Catalogs, Attributes and Elements are stored in isolated per-metahub schemas
 * (e.g., mhb_<metahubId>) using tables: _mhb_hubs, _mhb_objects, _mhb_attributes.
 *
 * IMPORTANT: This migration must run AFTER admin.CreateAdminRBAC (1733400000000)
 * which creates the admin schema and is_superuser() function.
 */
export class CreateMetahubsSchema1766351182000 implements MigrationInterface {
    name = 'CreateMetahubsSchema1766351182000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Enable UUID extension
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)

        // ===== 1) Create schema =====
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS metahubs;`)

        // ===== 2) Create ENUM for attribute data types =====
        // Use DO block to check if type exists before creating
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE metahubs.attribute_data_type AS ENUM (
                    'STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'DATETIME', 'REF', 'JSON'
                );
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$
        `)

        // ===== 2.1) Create enums for publications =====
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'publication_access_mode' AND typnamespace = 'metahubs'::regnamespace) THEN
                    CREATE TYPE metahubs.publication_access_mode AS ENUM (
                        'full',
                        'restricted'
                    );
                END IF;
            END $$;
        `)

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'publication_schema_status' AND typnamespace = 'metahubs'::regnamespace) THEN
                    CREATE TYPE metahubs.publication_schema_status AS ENUM (
                        'draft',
                        'pending',
                        'synced',
                        'outdated',
                        'error'
                    );
                END IF;
            END $$;
        `)

        // ===== 3) Core tables =====

        // Metahub - main configuration container
        await queryRunner.query(`
            CREATE TABLE metahubs.metahubs (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                name JSONB NOT NULL DEFAULT '{}',
                description JSONB DEFAULT '{}',
                codename VARCHAR(100) NOT NULL UNIQUE,
                slug VARCHAR(100) UNIQUE,
                default_branch_id UUID,
                last_branch_number INT NOT NULL DEFAULT 0,
                is_public BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        // Metahub branches
        await queryRunner.query(`
            CREATE TABLE metahubs.metahubs_branches (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                metahub_id UUID NOT NULL,
                source_branch_id UUID,
                name JSONB NOT NULL DEFAULT '{}',
                description JSONB DEFAULT '{}',
                codename VARCHAR(100) NOT NULL,
                branch_number INT NOT NULL,
                schema_name VARCHAR(100) NOT NULL,
                created_by UUID,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE (metahub_id, codename),
                UNIQUE (metahub_id, branch_number),
                UNIQUE (schema_name),
                FOREIGN KEY (metahub_id) REFERENCES metahubs.metahubs(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
            )
        `)

        await queryRunner.query(`
            ALTER TABLE metahubs.metahubs
            ADD CONSTRAINT fk_metahubs_default_branch
            FOREIGN KEY (default_branch_id) REFERENCES metahubs.metahubs_branches(id) ON DELETE SET NULL
        `)

        // ===== 4) User-metahub relationship table =====
        await queryRunner.query(`
            CREATE TABLE metahubs.metahubs_users (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                metahub_id UUID NOT NULL,
                user_id UUID NOT NULL,
                active_branch_id UUID,
                role VARCHAR(50) NOT NULL DEFAULT 'owner',
                comment TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(metahub_id, user_id),
                FOREIGN KEY (metahub_id) REFERENCES metahubs.metahubs(id) ON DELETE CASCADE,
                FOREIGN KEY (active_branch_id) REFERENCES metahubs.metahubs_branches(id) ON DELETE SET NULL
            )
        `)

        // ===== 5) Foreign key to auth.users =====
        try {
            await queryRunner.query(`
                ALTER TABLE metahubs.metahubs_users
                ADD CONSTRAINT fk_mu_auth_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
            `)
        } catch (error) {
            console.warn(
                'Warning: Unable to add FK constraint on metahubs_users.user_id referencing auth.users. Continuing without it.',
                error
            )
        }

        // ===== 5) Publications =====
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS metahubs.publications (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                metahub_id UUID NOT NULL,
                name JSONB NOT NULL DEFAULT '{}',
                description JSONB DEFAULT '{}',
                -- Access control
                access_mode metahubs.publication_access_mode NOT NULL DEFAULT 'full',
                access_config JSONB DEFAULT '{}',
                -- Schema sync fields (moved from applications.applications)
                schema_name VARCHAR(100) UNIQUE,
                schema_status metahubs.publication_schema_status DEFAULT 'draft',
                schema_error TEXT,
                schema_synced_at TIMESTAMPTZ,
                schema_snapshot JSONB,
                -- Auto-create application flag
                auto_create_application BOOLEAN NOT NULL DEFAULT false,
                -- Active version pointer
                active_version_id UUID,
                -- Timestamps
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now(),
                -- FK to metahub
                CONSTRAINT fk_publication_metahub FOREIGN KEY (metahub_id)
                    REFERENCES metahubs.metahubs(id) ON DELETE CASCADE
            )
        `)

        // Publication versions
        await queryRunner.query(`
            CREATE TABLE "metahubs"."publication_versions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v7(),
                "publication_id" uuid NOT NULL,
                "branch_id" uuid,
                "version_number" integer NOT NULL,
                "name" jsonb NOT NULL DEFAULT '{}',
                "description" jsonb DEFAULT '{}',
                "snapshot_json" jsonb NOT NULL,
                "snapshot_hash" character varying(64) NOT NULL,
                "is_active" boolean NOT NULL DEFAULT false,
                "created_by" uuid,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "pk_publication_versions" PRIMARY KEY ("id"),
                CONSTRAINT "fk_publication_versions_publication" FOREIGN KEY ("publication_id") REFERENCES "metahubs"."publications"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_publication_versions_user" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL,
                CONSTRAINT "uq_publication_version" UNIQUE ("publication_id", "version_number")
            )
        `)

        // Partial unique index for active version (only one active per publication)
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_active_version" ON "metahubs"."publication_versions" ("publication_id", "is_active") 
            WHERE is_active = true
        `)

        // ===== 6) Performance indexes =====
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_mu_metahub ON metahubs.metahubs_users(metahub_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_mu_user ON metahubs.metahubs_users(user_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_mu_active_branch ON metahubs.metahubs_users(active_branch_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_metahub_slug ON metahubs.metahubs(slug)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_metahub_codename ON metahubs.metahubs(codename)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_metahub_default_branch ON metahubs.metahubs(default_branch_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_branch_metahub ON metahubs.metahubs_branches(metahub_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_branch_codename ON metahubs.metahubs_branches(codename)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_branch_number ON metahubs.metahubs_branches(branch_number)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_branch_source ON metahubs.metahubs_branches(source_branch_id)`)

        // GIN indexes for JSONB name fields (for text search)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_metahub_name_gin ON metahubs.metahubs USING GIN (name)`)

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pub_metahub ON metahubs.publications(metahub_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pub_schema_name ON metahubs.publications(schema_name)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pub_status ON metahubs.publications(schema_status)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pub_name_gin ON metahubs.publications USING GIN (name)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_publication_versions_publication ON metahubs.publication_versions(publication_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_publication_versions_branch ON metahubs.publication_versions(branch_id)`)

        // ===== 7) Enable RLS on all tables =====
        await queryRunner.query(`ALTER TABLE metahubs.metahubs ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.metahubs_branches ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.metahubs_users ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.publications ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.publication_versions ENABLE ROW LEVEL SECURITY;`)

        // ===== 8) RLS Policies WITH global admin bypass =====

        // Policy for metahubs_users
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their metahub memberships" ON metahubs.metahubs_users
            FOR ALL
            USING (
                user_id = auth.uid() 
                OR admin.is_superuser(auth.uid())
            )
            WITH CHECK (
                user_id = auth.uid()
                OR admin.is_superuser(auth.uid())
            )
        `)

        // Policy for metahubs (including public access for is_public=true)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their own metahubs" ON metahubs.metahubs
            FOR ALL
            USING (
                is_public = true
                OR EXISTS (
                    SELECT 1 FROM metahubs.metahubs_users mu
                    WHERE mu.metahub_id = metahubs.metahubs.id AND mu.user_id = auth.uid()
                )
                OR admin.is_superuser(auth.uid())
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM metahubs.metahubs_users mu
                    WHERE mu.metahub_id = metahubs.metahubs.id AND mu.user_id = auth.uid()
                )
                OR admin.is_superuser(auth.uid())
            )
        `)

        // Policy for metahubs_branches - access via metahub membership
        await queryRunner.query(`DROP POLICY IF EXISTS "branches_access_via_metahub" ON metahubs.metahubs_branches;`)
        await queryRunner.query(`
            CREATE POLICY "branches_access_via_metahub" ON metahubs.metahubs_branches
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM metahubs.metahubs_users mu
                    WHERE mu.metahub_id = metahubs.metahubs_branches.metahub_id AND mu.user_id = auth.uid()
                )
                OR admin.is_superuser(auth.uid())
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM metahubs.metahubs_users mu
                    WHERE mu.metahub_id = metahubs.metahubs_branches.metahub_id AND mu.user_id = auth.uid()
                )
                OR admin.is_superuser(auth.uid())
            )
        `)

        // Publications policy - access via metahub membership
        await queryRunner.query(`DROP POLICY IF EXISTS "pub_access_via_metahub" ON metahubs.publications;`)
        await queryRunner.query(`
            CREATE POLICY "pub_access_via_metahub" ON metahubs.publications
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM metahubs.metahubs_users mu
                    WHERE mu.metahub_id = metahubs.publications.metahub_id AND mu.user_id = auth.uid()
                )
                OR admin.is_superuser(auth.uid())
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM metahubs.metahubs_users mu
                    WHERE mu.metahub_id = metahubs.publications.metahub_id AND mu.user_id = auth.uid()
                )
                OR admin.is_superuser(auth.uid())
            )
        `)

        // Publication versions policy - access via metahub membership
        await queryRunner.query(`DROP POLICY IF EXISTS "publication_versions_policy" ON metahubs.publication_versions;`)
        await queryRunner.query(`
            CREATE POLICY "publication_versions_policy" ON metahubs.publication_versions
            USING (
                publication_id IN (
                    SELECT p.id FROM metahubs.publications p
                    JOIN metahubs.metahubs_users mu ON p.metahub_id = mu.metahub_id
                    WHERE mu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                publication_id IN (
                    SELECT p.id FROM metahubs.publications p
                    JOIN metahubs.metahubs_users mu ON p.metahub_id = mu.metahub_id
                    WHERE mu.user_id = auth.uid()
                )
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop RLS policies
        await queryRunner.query(`DROP POLICY IF EXISTS "publication_versions_policy" ON metahubs.publication_versions;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "pub_access_via_metahub" ON metahubs.publications;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "branches_access_via_metahub" ON metahubs.metahubs_branches;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their own metahubs" ON metahubs.metahubs;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their metahub memberships" ON metahubs.metahubs_users;`)

        // Disable RLS
        await queryRunner.query(`ALTER TABLE metahubs.metahubs DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.metahubs_branches DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.metahubs_users DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.publications DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.publication_versions DISABLE ROW LEVEL SECURITY;`)

        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_publication_versions_publication`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_publication_versions_branch`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_pub_name_gin`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_pub_status`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_pub_schema_name`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_pub_metahub`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.uq_active_version`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_branch_number`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_branch_codename`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_branch_metahub`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_metahub_default_branch`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_mu_active_branch`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_metahub_codename`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_metahub_name_gin`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_metahub_slug`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_mu_user`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_mu_metahub`)

        // Drop tables
        await queryRunner.query(`DROP TABLE IF EXISTS metahubs.publication_versions`)
        await queryRunner.query(`DROP TABLE IF EXISTS metahubs.publications`)
        await queryRunner.query(`ALTER TABLE metahubs.metahubs DROP CONSTRAINT IF EXISTS fk_metahubs_default_branch`)
        await queryRunner.query(`DROP TABLE IF EXISTS metahubs.metahubs_users`)
        await queryRunner.query(`DROP TABLE IF EXISTS metahubs.metahubs_branches`)
        await queryRunner.query(`DROP TABLE IF EXISTS metahubs.metahubs`)

        // Drop ENUM type
        await queryRunner.query(`DROP TYPE IF EXISTS metahubs.publication_schema_status`)
        await queryRunner.query(`DROP TYPE IF EXISTS metahubs.publication_access_mode`)
        await queryRunner.query(`DROP TYPE IF EXISTS metahubs.attribute_data_type`)

        // Drop schema
        await queryRunner.query(`DROP SCHEMA IF EXISTS metahubs CASCADE`)
    }
}
