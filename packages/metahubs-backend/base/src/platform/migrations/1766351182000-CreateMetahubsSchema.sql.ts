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

export const createMetahubsSchemaMigrationDefinition: SqlMigrationDefinition = {
    id: 'CreateMetahubsSchema1766351182000',
    version: '1766351182000',
    summary: 'Create metahubs platform schema',
    up: [
        { sql: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` },
        { sql: `CREATE SCHEMA IF NOT EXISTS metahubs;` },
        {
            sql: `
                DO $$ BEGIN
                    CREATE TYPE metahubs.attribute_data_type AS ENUM (
                        'STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON'
                    );
                EXCEPTION
                    WHEN duplicate_object THEN NULL;
                END $$
            `
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'publication_access_mode' AND typnamespace = 'metahubs'::regnamespace) THEN
                        CREATE TYPE metahubs.publication_access_mode AS ENUM (
                            'full',
                            'restricted'
                        );
                    END IF;
                END $$;
            `
        },
        {
            sql: `
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
            `
        },
        {
            sql: `
                CREATE TABLE metahubs.metahubs (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    name JSONB NOT NULL DEFAULT '{}',
                    description JSONB DEFAULT '{}',
                    codename VARCHAR(100) NOT NULL,
                    codename_localized JSONB,
                    slug VARCHAR(100),
                    default_branch_id UUID,
                    last_branch_number INT NOT NULL DEFAULT 0,
                    is_public BOOLEAN NOT NULL DEFAULT false,
                    template_id UUID,
                    template_version_id UUID,
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
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX idx_metahubs_codename_active
                ON metahubs.metahubs (codename)
                WHERE _upl_deleted = false AND _mhb_deleted = false
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX idx_metahubs_slug_active
                ON metahubs.metahubs (slug)
                WHERE _upl_deleted = false AND _mhb_deleted = false AND slug IS NOT NULL
            `
        },
        {
            sql: `
                CREATE INDEX idx_metahubs_deleted
                ON metahubs.metahubs (_upl_deleted_at)
                WHERE _upl_deleted = true
            `
        },
        {
            sql: `
                CREATE INDEX idx_metahubs_archived
                ON metahubs.metahubs (_upl_archived)
                WHERE _upl_archived = true
            `
        },
        {
            sql: `
                CREATE TABLE metahubs.metahubs_branches (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    metahub_id UUID NOT NULL,
                    source_branch_id UUID,
                    name JSONB NOT NULL DEFAULT '{}',
                    description JSONB DEFAULT '{}',
                    codename VARCHAR(100) NOT NULL,
                    codename_localized JSONB,
                    branch_number INT NOT NULL,
                    schema_name VARCHAR(100) NOT NULL,
                    structure_version VARCHAR(20) NOT NULL DEFAULT '0.1.0',
                    last_template_version_id UUID,
                    last_template_version_label VARCHAR(20),
                    last_template_synced_at TIMESTAMPTZ,
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
                    _mhb_published BOOLEAN NOT NULL DEFAULT false,
                    _mhb_published_at TIMESTAMPTZ,
                    _mhb_published_by UUID,
                    _mhb_archived BOOLEAN NOT NULL DEFAULT false,
                    _mhb_archived_at TIMESTAMPTZ,
                    _mhb_archived_by UUID,
                    _mhb_deleted BOOLEAN NOT NULL DEFAULT false,
                    _mhb_deleted_at TIMESTAMPTZ,
                    _mhb_deleted_by UUID,
                    UNIQUE (schema_name),
                    FOREIGN KEY (metahub_id) REFERENCES metahubs.metahubs(id) ON DELETE CASCADE,
                    FOREIGN KEY (_upl_created_by) REFERENCES auth.users(id) ON DELETE SET NULL
                )
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX idx_branches_metahub_codename_active
                ON metahubs.metahubs_branches (metahub_id, codename)
                WHERE _upl_deleted = false AND _mhb_deleted = false
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX idx_branches_metahub_number_active
                ON metahubs.metahubs_branches (metahub_id, branch_number)
                WHERE _upl_deleted = false AND _mhb_deleted = false
            `
        },
        {
            sql: `
                ALTER TABLE metahubs.metahubs
                ADD CONSTRAINT fk_metahubs_default_branch
                FOREIGN KEY (default_branch_id) REFERENCES metahubs.metahubs_branches(id) ON DELETE SET NULL
            `
        },
        {
            sql: `
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
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX idx_templates_codename_active
                ON metahubs.templates (codename)
                WHERE _upl_deleted = false
            `
        },
        {
            sql: `
                CREATE TABLE metahubs.templates_versions (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    template_id UUID NOT NULL,
                    version_number INTEGER NOT NULL,
                    version_label VARCHAR(20) NOT NULL,
                    min_structure_version VARCHAR(20) NOT NULL DEFAULT '0.1.0',
                    manifest_json JSONB NOT NULL,
                    manifest_hash VARCHAR(64) NOT NULL,
                    is_active BOOLEAN NOT NULL DEFAULT false,
                    changelog JSONB,
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
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX idx_template_versions_number
                ON metahubs.templates_versions (template_id, version_number)
                WHERE _upl_deleted = false
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX uq_template_active_version
                ON metahubs.templates_versions (template_id, is_active)
                WHERE is_active = true
            `
        },
        {
            sql: `
                ALTER TABLE metahubs.templates
                ADD CONSTRAINT fk_templates_active_version
                FOREIGN KEY (active_version_id) REFERENCES metahubs.templates_versions(id) ON DELETE SET NULL
            `
        },
        {
            sql: `
                ALTER TABLE metahubs.metahubs
                ADD CONSTRAINT fk_metahubs_template
                FOREIGN KEY (template_id) REFERENCES metahubs.templates(id) ON DELETE SET NULL
            `
        },
        {
            sql: `
                ALTER TABLE metahubs.metahubs
                ADD CONSTRAINT fk_metahubs_template_version
                FOREIGN KEY (template_version_id) REFERENCES metahubs.templates_versions(id) ON DELETE SET NULL
            `
        },
        {
            sql: `
                ALTER TABLE metahubs.metahubs_branches
                ADD CONSTRAINT fk_branches_last_template_version
                FOREIGN KEY (last_template_version_id) REFERENCES metahubs.templates_versions(id) ON DELETE SET NULL
            `
        },
        {
            sql: `
                CREATE TABLE metahubs.metahubs_users (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    metahub_id UUID NOT NULL,
                    user_id UUID NOT NULL,
                    active_branch_id UUID,
                    role VARCHAR(50) NOT NULL DEFAULT 'owner',
                    comment JSONB,
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
                    _mhb_published BOOLEAN NOT NULL DEFAULT false,
                    _mhb_published_at TIMESTAMPTZ,
                    _mhb_published_by UUID,
                    _mhb_archived BOOLEAN NOT NULL DEFAULT false,
                    _mhb_archived_at TIMESTAMPTZ,
                    _mhb_archived_by UUID,
                    _mhb_deleted BOOLEAN NOT NULL DEFAULT false,
                    _mhb_deleted_at TIMESTAMPTZ,
                    _mhb_deleted_by UUID,
                    FOREIGN KEY (metahub_id) REFERENCES metahubs.metahubs(id) ON DELETE CASCADE,
                    FOREIGN KEY (active_branch_id) REFERENCES metahubs.metahubs_branches(id) ON DELETE SET NULL
                )
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX idx_metahubs_users_active
                ON metahubs.metahubs_users (metahub_id, user_id)
                WHERE _upl_deleted = false AND _mhb_deleted = false
            `
        },
        {
            sql: `
                ALTER TABLE metahubs.metahubs_users
                ADD CONSTRAINT fk_mu_auth_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
            `,
            warningMessage: 'Warning: Unable to add FK constraint on metahubs_users.user_id referencing auth.users. Continuing without it.'
        },
        {
            sql: `
                CREATE TABLE IF NOT EXISTS metahubs.publications (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    metahub_id UUID NOT NULL,
                    name JSONB NOT NULL DEFAULT '{}',
                    description JSONB DEFAULT '{}',
                    access_mode metahubs.publication_access_mode NOT NULL DEFAULT 'full',
                    access_config JSONB DEFAULT '{}',
                    schema_name VARCHAR(100),
                    schema_status metahubs.publication_schema_status DEFAULT 'draft',
                    schema_error TEXT,
                    schema_synced_at TIMESTAMPTZ,
                    schema_snapshot JSONB,
                    auto_create_application BOOLEAN NOT NULL DEFAULT false,
                    active_version_id UUID,
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
                    _mhb_published BOOLEAN NOT NULL DEFAULT false,
                    _mhb_published_at TIMESTAMPTZ,
                    _mhb_published_by UUID,
                    _mhb_archived BOOLEAN NOT NULL DEFAULT false,
                    _mhb_archived_at TIMESTAMPTZ,
                    _mhb_archived_by UUID,
                    _mhb_deleted BOOLEAN NOT NULL DEFAULT false,
                    _mhb_deleted_at TIMESTAMPTZ,
                    _mhb_deleted_by UUID,
                    CONSTRAINT fk_publication_metahub FOREIGN KEY (metahub_id)
                        REFERENCES metahubs.metahubs(id) ON DELETE CASCADE
                )
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX idx_publications_schema_name_active
                ON metahubs.publications (schema_name)
                WHERE _upl_deleted = false AND _mhb_deleted = false AND schema_name IS NOT NULL
            `
        },
        {
            sql: `
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
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX idx_publications_versions_number_active
                ON metahubs.publications_versions (publication_id, version_number)
                WHERE _upl_deleted = false AND _mhb_deleted = false
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX "uq_active_version" ON "metahubs"."publications_versions" ("publication_id", "is_active")
                WHERE is_active = true
            `
        },
        { sql: `CREATE INDEX IF NOT EXISTS idx_mu_metahub ON metahubs.metahubs_users(metahub_id)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_mu_user ON metahubs.metahubs_users(user_id)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_mu_active_branch ON metahubs.metahubs_users(active_branch_id)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_metahub_slug ON metahubs.metahubs(slug)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_metahub_codename ON metahubs.metahubs(codename)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_metahub_default_branch ON metahubs.metahubs(default_branch_id)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_branch_metahub ON metahubs.metahubs_branches(metahub_id)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_branch_codename ON metahubs.metahubs_branches(codename)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_branch_number ON metahubs.metahubs_branches(branch_number)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_branch_source ON metahubs.metahubs_branches(source_branch_id)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_templates_active ON metahubs.templates (is_active) WHERE is_active = true` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_templates_system ON metahubs.templates (is_system) WHERE is_system = true` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_template_versions_template ON metahubs.templates_versions (template_id)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_template_versions_hash ON metahubs.templates_versions (manifest_hash)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_metahubs_template ON metahubs.metahubs (template_id)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_metahub_name_gin ON metahubs.metahubs USING GIN (name)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_pub_metahub ON metahubs.publications(metahub_id)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_pub_schema_name ON metahubs.publications(schema_name)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_pub_status ON metahubs.publications(schema_status)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_pub_name_gin ON metahubs.publications USING GIN (name)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_publications_versions_publication ON metahubs.publications_versions(publication_id)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_publications_versions_branch ON metahubs.publications_versions(branch_id)` },
        { sql: `ALTER TABLE metahubs.metahubs ENABLE ROW LEVEL SECURITY;` },
        { sql: `ALTER TABLE metahubs.metahubs_branches ENABLE ROW LEVEL SECURITY;` },
        { sql: `ALTER TABLE metahubs.metahubs_users ENABLE ROW LEVEL SECURITY;` },
        { sql: `ALTER TABLE metahubs.publications ENABLE ROW LEVEL SECURITY;` },
        { sql: `ALTER TABLE metahubs.publications_versions ENABLE ROW LEVEL SECURITY;` },
        { sql: `ALTER TABLE metahubs.templates ENABLE ROW LEVEL SECURITY` },
        { sql: `ALTER TABLE metahubs.templates_versions ENABLE ROW LEVEL SECURITY` },
        {
            sql: `
                CREATE POLICY "templates_read_all" ON metahubs.templates
                FOR SELECT
                USING (true)
            `
        },
        {
            sql: `
                CREATE POLICY "templates_write_superuser" ON metahubs.templates
                FOR ALL
                USING ((select admin.is_superuser((select auth.uid()))))
                WITH CHECK ((select admin.is_superuser((select auth.uid()))))
            `
        },
        {
            sql: `
                CREATE POLICY "template_versions_read_all" ON metahubs.templates_versions
                FOR SELECT
                USING (true)
            `
        },
        {
            sql: `
                CREATE POLICY "template_versions_write_superuser" ON metahubs.templates_versions
                FOR ALL
                USING ((select admin.is_superuser((select auth.uid()))))
                WITH CHECK ((select admin.is_superuser((select auth.uid()))))
            `
        },
        {
            sql: `
                CREATE POLICY "Allow users to manage their metahub memberships" ON metahubs.metahubs_users
                FOR ALL
                USING (
                    user_id = (select auth.uid()) 
                    OR (select admin.is_superuser((select auth.uid())))
                )
                WITH CHECK (
                    user_id = (select auth.uid())
                    OR (select admin.is_superuser((select auth.uid())))
                )
            `
        },
        {
            sql: `
                CREATE POLICY "Allow users to manage their own metahubs" ON metahubs.metahubs
                FOR ALL
                USING (
                    is_public = true
                    OR EXISTS (
                        SELECT 1 FROM metahubs.metahubs_users mu
                        WHERE mu.metahub_id = metahubs.metahubs.id AND mu.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))
                )
                WITH CHECK (
                    EXISTS (
                        SELECT 1 FROM metahubs.metahubs_users mu
                        WHERE mu.metahub_id = metahubs.metahubs.id AND mu.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))
                )
            `
        },
        { sql: `DROP POLICY IF EXISTS "branches_access_via_metahub" ON metahubs.metahubs_branches;` },
        {
            sql: `
                CREATE POLICY "branches_access_via_metahub" ON metahubs.metahubs_branches
                FOR ALL
                USING (
                    EXISTS (
                        SELECT 1 FROM metahubs.metahubs_users mu
                        WHERE mu.metahub_id = metahubs.metahubs_branches.metahub_id AND mu.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))
                )
                WITH CHECK (
                    EXISTS (
                        SELECT 1 FROM metahubs.metahubs_users mu
                        WHERE mu.metahub_id = metahubs.metahubs_branches.metahub_id AND mu.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))
                )
            `
        },
        { sql: `DROP POLICY IF EXISTS "pub_access_via_metahub" ON metahubs.publications;` },
        {
            sql: `
                CREATE POLICY "pub_access_via_metahub" ON metahubs.publications
                FOR ALL
                USING (
                    EXISTS (
                        SELECT 1 FROM metahubs.metahubs_users mu
                        WHERE mu.metahub_id = metahubs.publications.metahub_id AND mu.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))
                )
                WITH CHECK (
                    EXISTS (
                        SELECT 1 FROM metahubs.metahubs_users mu
                        WHERE mu.metahub_id = metahubs.publications.metahub_id AND mu.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))
                )
            `
        },
        { sql: `DROP POLICY IF EXISTS "publications_versions_policy" ON metahubs.publications_versions;` },
        {
            sql: `
                CREATE POLICY "publications_versions_policy" ON metahubs.publications_versions
                USING (
                    publication_id IN (
                        SELECT p.id FROM metahubs.publications p
                        JOIN metahubs.metahubs_users mu ON p.metahub_id = mu.metahub_id
                        WHERE mu.user_id = (select auth.uid())
                    )
                )
                WITH CHECK (
                    publication_id IN (
                        SELECT p.id FROM metahubs.publications p
                        JOIN metahubs.metahubs_users mu ON p.metahub_id = mu.metahub_id
                        WHERE mu.user_id = (select auth.uid())
                    )
                )
            `
        }
    ],
    down: [
        { sql: `DROP POLICY IF EXISTS "template_versions_write_superuser" ON metahubs.templates_versions` },
        { sql: `DROP POLICY IF EXISTS "template_versions_read_all" ON metahubs.templates_versions` },
        { sql: `DROP POLICY IF EXISTS "templates_write_superuser" ON metahubs.templates` },
        { sql: `DROP POLICY IF EXISTS "templates_read_all" ON metahubs.templates` },
        { sql: `ALTER TABLE metahubs.templates_versions DISABLE ROW LEVEL SECURITY` },
        { sql: `ALTER TABLE metahubs.templates DISABLE ROW LEVEL SECURITY` },
        { sql: `DROP POLICY IF EXISTS "publications_versions_policy" ON metahubs.publications_versions;` },
        { sql: `DROP POLICY IF EXISTS "pub_access_via_metahub" ON metahubs.publications;` },
        { sql: `DROP POLICY IF EXISTS "branches_access_via_metahub" ON metahubs.metahubs_branches;` },
        { sql: `DROP POLICY IF EXISTS "Allow users to manage their own metahubs" ON metahubs.metahubs;` },
        { sql: `DROP POLICY IF EXISTS "Allow users to manage their metahub memberships" ON metahubs.metahubs_users;` },
        { sql: `ALTER TABLE metahubs.metahubs DISABLE ROW LEVEL SECURITY;` },
        { sql: `ALTER TABLE metahubs.metahubs_branches DISABLE ROW LEVEL SECURITY;` },
        { sql: `ALTER TABLE metahubs.metahubs_users DISABLE ROW LEVEL SECURITY;` },
        { sql: `ALTER TABLE metahubs.publications DISABLE ROW LEVEL SECURITY;` },
        { sql: `ALTER TABLE metahubs.publications_versions DISABLE ROW LEVEL SECURITY;` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_publications_versions_publication` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_publications_versions_branch` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_publications_versions_number_active` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_pub_name_gin` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_pub_status` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_pub_schema_name` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_pub_metahub` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_publications_schema_name_active` },
        { sql: `DROP INDEX IF EXISTS metahubs.uq_active_version` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_branch_number` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_branch_codename` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_branch_metahub` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_branches_metahub_codename_active` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_branches_metahub_number_active` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_metahub_default_branch` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_mu_active_branch` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_metahub_codename` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_metahubs_codename_active` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_metahubs_slug_active` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_metahubs_deleted` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_metahub_name_gin` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_metahub_slug` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_mu_user` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_mu_metahub` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_metahubs_users_active` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_metahubs_template` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_template_versions_hash` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_template_versions_template` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_templates_system` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_templates_active` },
        { sql: `DROP INDEX IF EXISTS metahubs.uq_template_active_version` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_template_versions_number` },
        { sql: `DROP INDEX IF EXISTS metahubs.idx_templates_codename_active` },
        { sql: `DROP TABLE IF EXISTS metahubs.publications_versions` },
        { sql: `DROP TABLE IF EXISTS metahubs.publications` },
        { sql: `ALTER TABLE metahubs.metahubs_branches DROP CONSTRAINT IF EXISTS fk_branches_last_template_version` },
        { sql: `ALTER TABLE metahubs.metahubs DROP CONSTRAINT IF EXISTS fk_metahubs_template_version` },
        { sql: `ALTER TABLE metahubs.metahubs DROP CONSTRAINT IF EXISTS fk_metahubs_template` },
        { sql: `ALTER TABLE metahubs.templates DROP CONSTRAINT IF EXISTS fk_templates_active_version` },
        { sql: `DROP TABLE IF EXISTS metahubs.templates_versions` },
        { sql: `DROP TABLE IF EXISTS metahubs.templates` },
        { sql: `ALTER TABLE metahubs.metahubs DROP CONSTRAINT IF EXISTS fk_metahubs_default_branch` },
        { sql: `DROP TABLE IF EXISTS metahubs.metahubs_users` },
        { sql: `DROP TABLE IF EXISTS metahubs.metahubs_branches` },
        { sql: `DROP TABLE IF EXISTS metahubs.metahubs` },
        { sql: `DROP TYPE IF EXISTS metahubs.publication_schema_status` },
        { sql: `DROP TYPE IF EXISTS metahubs.publication_access_mode` },
        { sql: `DROP TYPE IF EXISTS metahubs.attribute_data_type` },
        { sql: `DROP SCHEMA IF EXISTS metahubs CASCADE` }
    ]
}
