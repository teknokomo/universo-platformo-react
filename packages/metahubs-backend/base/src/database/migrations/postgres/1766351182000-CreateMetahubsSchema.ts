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
 * - metahubs_branches: Isolated per-metahub schemas with structure versioning
 * - templates: Template catalog (system + user templates)
 * - templates_versions: Versioned template manifests with seed data
 * - publications: External interfaces of Metahubs with access control
 * - publications_versions: Versioned snapshots of Metahub schemas
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
        // Note: DATETIME was removed in favor of DATE with dateComposition setting
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE metahubs.attribute_data_type AS ENUM (
                    'STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON'
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
                codename VARCHAR(100) NOT NULL,
                slug VARCHAR(100),
                default_branch_id UUID,
                last_branch_number INT NOT NULL DEFAULT 0,
                is_public BOOLEAN NOT NULL DEFAULT false,

                -- Template provenance (which template was used to create this metahub)
                template_id UUID,
                template_version_id UUID,

                -- Platform-level system fields (_upl_*)
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

                -- Metahub-level system fields (_mhb_*)
                _mhb_published BOOLEAN NOT NULL DEFAULT false,
                _mhb_published_at TIMESTAMPTZ,
                _mhb_published_by UUID,

                _mhb_archived BOOLEAN NOT NULL DEFAULT false,
                _mhb_archived_at TIMESTAMPTZ,
                _mhb_archived_by UUID,

                _mhb_deleted BOOLEAN NOT NULL DEFAULT false,
                _mhb_deleted_at TIMESTAMPTZ,
                _mhb_deleted_by UUID
            )
        `)

        // Partial unique indexes (exclude soft-deleted records at both levels)
        await queryRunner.query(`
            CREATE UNIQUE INDEX idx_metahubs_codename_active
            ON metahubs.metahubs (codename)
            WHERE _upl_deleted = false AND _mhb_deleted = false
        `)
        await queryRunner.query(`
            CREATE UNIQUE INDEX idx_metahubs_slug_active
            ON metahubs.metahubs (slug)
            WHERE _upl_deleted = false AND _mhb_deleted = false AND slug IS NOT NULL
        `)
        // Index for trash queries
        await queryRunner.query(`
            CREATE INDEX idx_metahubs_deleted
            ON metahubs.metahubs (_upl_deleted_at)
            WHERE _upl_deleted = true
        `)
        // Index for archived queries
        await queryRunner.query(`
            CREATE INDEX idx_metahubs_archived
            ON metahubs.metahubs (_upl_archived)
            WHERE _upl_archived = true
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
                structure_version INTEGER NOT NULL DEFAULT 1,

                -- Platform-level system fields (_upl_*)
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

                -- Metahub-level system fields (_mhb_*)
                _mhb_published BOOLEAN NOT NULL DEFAULT false,
                _mhb_published_at TIMESTAMPTZ,
                _mhb_published_by UUID,

                _mhb_archived BOOLEAN NOT NULL DEFAULT false,
                _mhb_archived_at TIMESTAMPTZ,
                _mhb_archived_by UUID,

                _mhb_deleted BOOLEAN NOT NULL DEFAULT false,
                _mhb_deleted_at TIMESTAMPTZ,
                _mhb_deleted_by UUID,

                -- Constraints
                UNIQUE (schema_name),
                FOREIGN KEY (metahub_id) REFERENCES metahubs.metahubs(id) ON DELETE CASCADE,
                FOREIGN KEY (_upl_created_by) REFERENCES auth.users(id) ON DELETE SET NULL
            )
        `)

        // Partial unique indexes for branches (exclude soft-deleted at both levels)
        await queryRunner.query(`
            CREATE UNIQUE INDEX idx_branches_metahub_codename_active
            ON metahubs.metahubs_branches (metahub_id, codename)
            WHERE _upl_deleted = false AND _mhb_deleted = false
        `)
        await queryRunner.query(`
            CREATE UNIQUE INDEX idx_branches_metahub_number_active
            ON metahubs.metahubs_branches (metahub_id, branch_number)
            WHERE _upl_deleted = false AND _mhb_deleted = false
        `)

        await queryRunner.query(`
            ALTER TABLE metahubs.metahubs
            ADD CONSTRAINT fk_metahubs_default_branch
            FOREIGN KEY (default_branch_id) REFERENCES metahubs.metahubs_branches(id) ON DELETE SET NULL
        `)

        // ===== 3.1) Templates table =====
        await queryRunner.query(`
            CREATE TABLE metahubs.templates (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                codename VARCHAR(100) NOT NULL,
                name JSONB NOT NULL DEFAULT '{}',
                description JSONB DEFAULT '{}',
                icon VARCHAR(50),
                is_system BOOLEAN NOT NULL DEFAULT false,
                is_active BOOLEAN NOT NULL DEFAULT true,
                sort_order INTEGER NOT NULL DEFAULT 0,
                active_version_id UUID,

                -- Platform-level system fields (_upl_*)
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
                _upl_locked_reason TEXT
            )
        `)

        // Partial unique on codename (excluding soft-deleted)
        await queryRunner.query(`
            CREATE UNIQUE INDEX idx_templates_codename_active
            ON metahubs.templates (codename)
            WHERE _upl_deleted = false
        `)

        // ===== 3.2) Templates versions table =====
        await queryRunner.query(`
            CREATE TABLE metahubs.templates_versions (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                template_id UUID NOT NULL,
                version_number INTEGER NOT NULL,
                version_label VARCHAR(20) NOT NULL,
                min_structure_version INTEGER NOT NULL DEFAULT 1,
                manifest_json JSONB NOT NULL,
                manifest_hash VARCHAR(64) NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT false,
                changelog JSONB,

                -- Platform-level system fields (_upl_*)
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

                CONSTRAINT fk_template_versions_template
                    FOREIGN KEY (template_id) REFERENCES metahubs.templates(id) ON DELETE CASCADE
            )
        `)

        // Unique version per template
        await queryRunner.query(`
            CREATE UNIQUE INDEX idx_template_versions_number
            ON metahubs.templates_versions (template_id, version_number)
            WHERE _upl_deleted = false
        `)

        // Only one active version per template
        await queryRunner.query(`
            CREATE UNIQUE INDEX uq_template_active_version
            ON metahubs.templates_versions (template_id, is_active)
            WHERE is_active = true
        `)

        // ===== 3.3) Circular FK: templates.active_version_id → templates_versions.id =====
        await queryRunner.query(`
            ALTER TABLE metahubs.templates
            ADD CONSTRAINT fk_templates_active_version
            FOREIGN KEY (active_version_id) REFERENCES metahubs.templates_versions(id) ON DELETE SET NULL
        `)

        // ===== 3.4) Template provenance FKs on metahubs =====
        await queryRunner.query(`
            ALTER TABLE metahubs.metahubs
            ADD CONSTRAINT fk_metahubs_template
            FOREIGN KEY (template_id) REFERENCES metahubs.templates(id) ON DELETE SET NULL
        `)

        await queryRunner.query(`
            ALTER TABLE metahubs.metahubs
            ADD CONSTRAINT fk_metahubs_template_version
            FOREIGN KEY (template_version_id) REFERENCES metahubs.templates_versions(id) ON DELETE SET NULL
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

                -- Platform-level system fields (_upl_*)
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

                -- Metahub-level system fields (_mhb_*)
                _mhb_published BOOLEAN NOT NULL DEFAULT false,
                _mhb_published_at TIMESTAMPTZ,
                _mhb_published_by UUID,

                _mhb_archived BOOLEAN NOT NULL DEFAULT false,
                _mhb_archived_at TIMESTAMPTZ,
                _mhb_archived_by UUID,

                _mhb_deleted BOOLEAN NOT NULL DEFAULT false,
                _mhb_deleted_at TIMESTAMPTZ,
                _mhb_deleted_by UUID,

                -- Constraints
                FOREIGN KEY (metahub_id) REFERENCES metahubs.metahubs(id) ON DELETE CASCADE,
                FOREIGN KEY (active_branch_id) REFERENCES metahubs.metahubs_branches(id) ON DELETE SET NULL
            )
        `)

        // Partial unique index for metahub-user (exclude soft-deleted at both levels)
        await queryRunner.query(`
            CREATE UNIQUE INDEX idx_metahubs_users_active
            ON metahubs.metahubs_users (metahub_id, user_id)
            WHERE _upl_deleted = false AND _mhb_deleted = false
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
                schema_name VARCHAR(100),
                schema_status metahubs.publication_schema_status DEFAULT 'draft',
                schema_error TEXT,
                schema_synced_at TIMESTAMPTZ,
                schema_snapshot JSONB,
                -- Auto-create application flag
                auto_create_application BOOLEAN NOT NULL DEFAULT false,
                -- Active version pointer
                active_version_id UUID,

                -- Platform-level system fields (_upl_*)
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

                -- Metahub-level system fields (_mhb_*)
                _mhb_published BOOLEAN NOT NULL DEFAULT false,
                _mhb_published_at TIMESTAMPTZ,
                _mhb_published_by UUID,

                _mhb_archived BOOLEAN NOT NULL DEFAULT false,
                _mhb_archived_at TIMESTAMPTZ,
                _mhb_archived_by UUID,

                _mhb_deleted BOOLEAN NOT NULL DEFAULT false,
                _mhb_deleted_at TIMESTAMPTZ,
                _mhb_deleted_by UUID,

                -- FK to metahub
                CONSTRAINT fk_publication_metahub FOREIGN KEY (metahub_id)
                    REFERENCES metahubs.metahubs(id) ON DELETE CASCADE
            )
        `)

        // Partial unique index for schema_name (exclude soft-deleted at both levels)
        await queryRunner.query(`
            CREATE UNIQUE INDEX idx_publications_schema_name_active
            ON metahubs.publications (schema_name)
            WHERE _upl_deleted = false AND _mhb_deleted = false AND schema_name IS NOT NULL
        `)

        // Publication versions
        await queryRunner.query(`
            CREATE TABLE "metahubs"."publications_versions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v7(),
                "publication_id" uuid NOT NULL,
                "branch_id" uuid,
                "version_number" integer NOT NULL,
                "name" jsonb NOT NULL DEFAULT '{}',
                "description" jsonb DEFAULT '{}',
                "snapshot_json" jsonb NOT NULL,
                "snapshot_hash" character varying(64) NOT NULL,
                "is_active" boolean NOT NULL DEFAULT false,

                -- Platform-level system fields (_upl_*)
                "_upl_created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "_upl_created_by" uuid,
                "_upl_updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "_upl_updated_by" uuid,
                "_upl_version" integer NOT NULL DEFAULT 1,

                "_upl_archived" boolean NOT NULL DEFAULT false,
                "_upl_archived_at" TIMESTAMPTZ,
                "_upl_archived_by" uuid,

                "_upl_deleted" boolean NOT NULL DEFAULT false,
                "_upl_deleted_at" TIMESTAMPTZ,
                "_upl_deleted_by" uuid,
                "_upl_purge_after" TIMESTAMPTZ,

                "_upl_locked" boolean NOT NULL DEFAULT false,
                "_upl_locked_at" TIMESTAMPTZ,
                "_upl_locked_by" uuid,
                "_upl_locked_reason" text,

                -- Metahub-level system fields (_mhb_*)
                "_mhb_published" boolean NOT NULL DEFAULT false,
                "_mhb_published_at" TIMESTAMPTZ,
                "_mhb_published_by" uuid,

                "_mhb_archived" boolean NOT NULL DEFAULT false,
                "_mhb_archived_at" TIMESTAMPTZ,
                "_mhb_archived_by" uuid,

                "_mhb_deleted" boolean NOT NULL DEFAULT false,
                "_mhb_deleted_at" TIMESTAMPTZ,
                "_mhb_deleted_by" uuid,

                CONSTRAINT "pk_publications_versions" PRIMARY KEY ("id"),
                CONSTRAINT "fk_publications_versions_publication" FOREIGN KEY ("publication_id") REFERENCES "metahubs"."publications"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_publications_versions_user" FOREIGN KEY ("_upl_created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL
            )
        `)

        // Partial unique index for publication version number (exclude soft-deleted at both levels)
        await queryRunner.query(`
            CREATE UNIQUE INDEX idx_publications_versions_number_active
            ON metahubs.publications_versions (publication_id, version_number)
            WHERE _upl_deleted = false AND _mhb_deleted = false
        `)

        // Partial unique index for active version (only one active per publication)
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_active_version" ON "metahubs"."publications_versions" ("publication_id", "is_active")
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

        // Template indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_templates_active ON metahubs.templates (is_active) WHERE is_active = true`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_templates_system ON metahubs.templates (is_system) WHERE is_system = true`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_template_versions_template ON metahubs.templates_versions (template_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_template_versions_hash ON metahubs.templates_versions (manifest_hash)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_metahubs_template ON metahubs.metahubs (template_id)`)

        // GIN indexes for JSONB name fields (for text search)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_metahub_name_gin ON metahubs.metahubs USING GIN (name)`)

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pub_metahub ON metahubs.publications(metahub_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pub_schema_name ON metahubs.publications(schema_name)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pub_status ON metahubs.publications(schema_status)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pub_name_gin ON metahubs.publications USING GIN (name)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_publications_versions_publication ON metahubs.publications_versions(publication_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_publications_versions_branch ON metahubs.publications_versions(branch_id)`)

        // ===== 7) Enable RLS on all tables =====
        await queryRunner.query(`ALTER TABLE metahubs.metahubs ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.metahubs_branches ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.metahubs_users ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.publications ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.publications_versions ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.templates ENABLE ROW LEVEL SECURITY`)
        await queryRunner.query(`ALTER TABLE metahubs.templates_versions ENABLE ROW LEVEL SECURITY`)

        // ===== 8) RLS Policies WITH global admin bypass =====

        // Templates are readable by all authenticated users, writable only by superusers
        await queryRunner.query(`
            CREATE POLICY "templates_read_all" ON metahubs.templates
            FOR SELECT
            USING (true)
        `)

        await queryRunner.query(`
            CREATE POLICY "templates_write_superuser" ON metahubs.templates
            FOR ALL
            USING (admin.is_superuser(auth.uid()))
            WITH CHECK (admin.is_superuser(auth.uid()))
        `)

        await queryRunner.query(`
            CREATE POLICY "template_versions_read_all" ON metahubs.templates_versions
            FOR SELECT
            USING (true)
        `)

        await queryRunner.query(`
            CREATE POLICY "template_versions_write_superuser" ON metahubs.templates_versions
            FOR ALL
            USING (admin.is_superuser(auth.uid()))
            WITH CHECK (admin.is_superuser(auth.uid()))
        `)

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
        await queryRunner.query(`DROP POLICY IF EXISTS "publications_versions_policy" ON metahubs.publications_versions;`)
        await queryRunner.query(`
            CREATE POLICY "publications_versions_policy" ON metahubs.publications_versions
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
        // Drop template RLS policies
        await queryRunner.query(`DROP POLICY IF EXISTS "template_versions_write_superuser" ON metahubs.templates_versions`)
        await queryRunner.query(`DROP POLICY IF EXISTS "template_versions_read_all" ON metahubs.templates_versions`)
        await queryRunner.query(`DROP POLICY IF EXISTS "templates_write_superuser" ON metahubs.templates`)
        await queryRunner.query(`DROP POLICY IF EXISTS "templates_read_all" ON metahubs.templates`)
        await queryRunner.query(`ALTER TABLE metahubs.templates_versions DISABLE ROW LEVEL SECURITY`)
        await queryRunner.query(`ALTER TABLE metahubs.templates DISABLE ROW LEVEL SECURITY`)

        // Drop RLS policies
        await queryRunner.query(`DROP POLICY IF EXISTS "publications_versions_policy" ON metahubs.publications_versions;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "pub_access_via_metahub" ON metahubs.publications;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "branches_access_via_metahub" ON metahubs.metahubs_branches;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their own metahubs" ON metahubs.metahubs;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their metahub memberships" ON metahubs.metahubs_users;`)

        // Disable RLS
        await queryRunner.query(`ALTER TABLE metahubs.metahubs DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.metahubs_branches DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.metahubs_users DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.publications DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE metahubs.publications_versions DISABLE ROW LEVEL SECURITY;`)

        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_publications_versions_publication`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_publications_versions_branch`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_publications_versions_number_active`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_pub_name_gin`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_pub_status`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_pub_schema_name`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_pub_metahub`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_publications_schema_name_active`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.uq_active_version`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_branch_number`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_branch_codename`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_branch_metahub`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_branches_metahub_codename_active`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_branches_metahub_number_active`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_metahub_default_branch`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_mu_active_branch`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_metahub_codename`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_metahubs_codename_active`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_metahubs_slug_active`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_metahubs_deleted`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_metahub_name_gin`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_metahub_slug`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_mu_user`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_mu_metahub`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_metahubs_users_active`)

        // Drop template indexes
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_metahubs_template`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_template_versions_hash`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_template_versions_template`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_templates_system`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_templates_active`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.uq_template_active_version`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_template_versions_number`)
        await queryRunner.query(`DROP INDEX IF EXISTS metahubs.idx_templates_codename_active`)

        // Drop tables
        await queryRunner.query(`DROP TABLE IF EXISTS metahubs.publications_versions`)
        await queryRunner.query(`DROP TABLE IF EXISTS metahubs.publications`)

        // Drop template FKs and tables
        await queryRunner.query(`ALTER TABLE metahubs.metahubs DROP CONSTRAINT IF EXISTS fk_metahubs_template_version`)
        await queryRunner.query(`ALTER TABLE metahubs.metahubs DROP CONSTRAINT IF EXISTS fk_metahubs_template`)
        await queryRunner.query(`ALTER TABLE metahubs.templates DROP CONSTRAINT IF EXISTS fk_templates_active_version`)
        await queryRunner.query(`DROP TABLE IF EXISTS metahubs.templates_versions`)
        await queryRunner.query(`DROP TABLE IF EXISTS metahubs.templates`)

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
