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

export const createMetahubsSchemaMigrationDefinition: SqlMigrationDefinition = {
    id: 'CreateMetahubsSchema1766351182000',
    version: '1766351182000',
    summary: 'Create metahubs platform schema with full system fields',
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
        // ── cat_metahubs ──
        {
            sql: `
                CREATE TABLE metahubs.cat_metahubs (
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
                CREATE UNIQUE INDEX IF NOT EXISTS idx_metahubs_codename_active
                ON metahubs.cat_metahubs (codename)
                WHERE _upl_deleted = false AND _app_deleted = false
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX IF NOT EXISTS idx_metahubs_slug_active
                ON metahubs.cat_metahubs (slug)
                WHERE _upl_deleted = false AND _app_deleted = false AND slug IS NOT NULL
            `
        },
        {
            sql: `
                CREATE INDEX IF NOT EXISTS idx_metahubs_deleted
                ON metahubs.cat_metahubs (_upl_deleted_at)
                WHERE _upl_deleted = true
            `
        },
        {
            sql: `
                CREATE INDEX IF NOT EXISTS idx_metahubs_archived
                ON metahubs.cat_metahubs (_upl_archived)
                WHERE _upl_archived = true
            `
        },
        // ── cat_metahub_branches ──
        {
            sql: `
                CREATE TABLE metahubs.cat_metahub_branches (
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
                    FOREIGN KEY (metahub_id) REFERENCES metahubs.cat_metahubs(id) ON DELETE CASCADE,
                    FOREIGN KEY (_upl_created_by) REFERENCES auth.users(id) ON DELETE SET NULL
                )
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_schema_name_active
                ON metahubs.cat_metahub_branches (schema_name)
                WHERE _upl_deleted = false AND _app_deleted = false
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_metahub_codename_active
                ON metahubs.cat_metahub_branches (metahub_id, codename)
                WHERE _upl_deleted = false AND _app_deleted = false
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_metahub_number_active
                ON metahubs.cat_metahub_branches (metahub_id, branch_number)
                WHERE _upl_deleted = false AND _app_deleted = false
            `
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'fk_metahubs_default_branch'
                    ) THEN
                        ALTER TABLE metahubs.cat_metahubs
                        ADD CONSTRAINT fk_metahubs_default_branch
                        FOREIGN KEY (default_branch_id) REFERENCES metahubs.cat_metahub_branches(id) ON DELETE SET NULL;
                    END IF;
                END $$;
            `
        },
        // ── cat_templates (Group B: add _app_* block + fold definition_type) ──
        {
            sql: `
                CREATE TABLE metahubs.cat_templates (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    codename VARCHAR(100) NOT NULL,
                    name JSONB NOT NULL DEFAULT '{}',
                    description JSONB DEFAULT '{}',
                    icon VARCHAR(50),
                    is_system BOOLEAN NOT NULL DEFAULT false,
                    is_active BOOLEAN NOT NULL DEFAULT true,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    active_version_id UUID,
                    definition_type TEXT NOT NULL DEFAULT 'metahub_template',
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
                COMMENT ON COLUMN metahubs.cat_templates.definition_type IS
                'Distinguishes template kind: metahub_template, application_template, or custom. Supports the unified application-definition model where Metahubs are a specialization.'
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_codename_active
                ON metahubs.cat_templates (codename)
                WHERE _upl_deleted = false AND _app_deleted = false
            `
        },
        // ── doc_template_versions (Group B: add _app_* block) ──
        {
            sql: `
                CREATE TABLE metahubs.doc_template_versions (
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
                    CONSTRAINT fk_template_versions_template
                        FOREIGN KEY (template_id) REFERENCES metahubs.cat_templates(id) ON DELETE CASCADE
                )
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX IF NOT EXISTS idx_template_versions_number
                ON metahubs.doc_template_versions (template_id, version_number)
                WHERE _upl_deleted = false AND _app_deleted = false
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX IF NOT EXISTS uq_template_active_version
                ON metahubs.doc_template_versions (template_id, is_active)
                WHERE is_active = true
            `
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'fk_templates_active_version'
                    ) THEN
                        ALTER TABLE metahubs.cat_templates
                        ADD CONSTRAINT fk_templates_active_version
                        FOREIGN KEY (active_version_id) REFERENCES metahubs.doc_template_versions(id) ON DELETE SET NULL;
                    END IF;
                END $$;
            `
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'fk_metahubs_template'
                    ) THEN
                        ALTER TABLE metahubs.cat_metahubs
                        ADD CONSTRAINT fk_metahubs_template
                        FOREIGN KEY (template_id) REFERENCES metahubs.cat_templates(id) ON DELETE SET NULL;
                    END IF;
                END $$;
            `
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'fk_metahubs_template_version'
                    ) THEN
                        ALTER TABLE metahubs.cat_metahubs
                        ADD CONSTRAINT fk_metahubs_template_version
                        FOREIGN KEY (template_version_id) REFERENCES metahubs.doc_template_versions(id) ON DELETE SET NULL;
                    END IF;
                END $$;
            `
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'fk_branches_last_template_version'
                    ) THEN
                        ALTER TABLE metahubs.cat_metahub_branches
                        ADD CONSTRAINT fk_branches_last_template_version
                        FOREIGN KEY (last_template_version_id) REFERENCES metahubs.doc_template_versions(id) ON DELETE SET NULL;
                    END IF;
                END $$;
            `
        },
        // ── rel_metahub_users ──
        {
            sql: `
                CREATE TABLE metahubs.rel_metahub_users (
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
                    FOREIGN KEY (metahub_id) REFERENCES metahubs.cat_metahubs(id) ON DELETE CASCADE,
                    FOREIGN KEY (active_branch_id) REFERENCES metahubs.cat_metahub_branches(id) ON DELETE SET NULL
                )
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX IF NOT EXISTS idx_metahubs_users_active
                ON metahubs.rel_metahub_users (metahub_id, user_id)
                WHERE _upl_deleted = false AND _app_deleted = false
            `
        },
        {
            sql: `
                ALTER TABLE metahubs.rel_metahub_users
                ADD CONSTRAINT fk_mu_auth_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
            `,
            warningMessage: 'Warning: Unable to add FK constraint on metahubs_users.user_id referencing auth.users. Continuing without it.'
        },
        // ── doc_publications ──
        {
            sql: `
                CREATE TABLE IF NOT EXISTS metahubs.doc_publications (
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
                    CONSTRAINT fk_publication_metahub FOREIGN KEY (metahub_id)
                        REFERENCES metahubs.cat_metahubs(id) ON DELETE CASCADE
                )
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX IF NOT EXISTS idx_publications_schema_name_active
                ON metahubs.doc_publications (schema_name)
                WHERE _upl_deleted = false AND _app_deleted = false AND schema_name IS NOT NULL
            `
        },
        // ── doc_publication_versions ──
        {
            sql: `
                CREATE TABLE metahubs.doc_publication_versions (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    publication_id UUID NOT NULL,
                    branch_id UUID,
                    version_number INTEGER NOT NULL,
                    name JSONB NOT NULL DEFAULT '{}',
                    description JSONB DEFAULT '{}',
                    snapshot_json JSONB NOT NULL,
                    snapshot_hash VARCHAR(64) NOT NULL,
                    is_active BOOLEAN NOT NULL DEFAULT false,
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
                    CONSTRAINT fk_publications_versions_publication
                        FOREIGN KEY (publication_id) REFERENCES metahubs.doc_publications(id) ON DELETE CASCADE,
                    CONSTRAINT fk_publications_versions_user
                        FOREIGN KEY (_upl_created_by) REFERENCES auth.users(id) ON DELETE SET NULL
                )
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX IF NOT EXISTS idx_publications_versions_number_active
                ON metahubs.doc_publication_versions (publication_id, version_number)
                WHERE _upl_deleted = false AND _app_deleted = false
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX IF NOT EXISTS uq_active_version ON metahubs.doc_publication_versions (publication_id, is_active)
                WHERE is_active = true
            `
        },
        // ── Performance indexes ──
        { sql: `CREATE INDEX IF NOT EXISTS idx_mu_metahub ON metahubs.rel_metahub_users(metahub_id)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_mu_user ON metahubs.rel_metahub_users(user_id)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_mu_active_branch ON metahubs.rel_metahub_users(active_branch_id)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_metahub_slug ON metahubs.cat_metahubs(slug)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_metahub_codename ON metahubs.cat_metahubs(codename)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_metahub_default_branch ON metahubs.cat_metahubs(default_branch_id)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_branch_metahub ON metahubs.cat_metahub_branches(metahub_id)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_branch_codename ON metahubs.cat_metahub_branches(codename)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_branch_number ON metahubs.cat_metahub_branches(branch_number)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_branch_source ON metahubs.cat_metahub_branches(source_branch_id)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_templates_active ON metahubs.cat_templates (is_active) WHERE is_active = true` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_templates_system ON metahubs.cat_templates (is_system) WHERE is_system = true` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_template_versions_template ON metahubs.doc_template_versions (template_id)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_template_versions_hash ON metahubs.doc_template_versions (manifest_hash)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_metahubs_template ON metahubs.cat_metahubs (template_id)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_metahub_name_gin ON metahubs.cat_metahubs USING GIN (name)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_pub_metahub ON metahubs.doc_publications(metahub_id)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_pub_schema_name ON metahubs.doc_publications(schema_name)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_pub_status ON metahubs.doc_publications(schema_status)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_pub_name_gin ON metahubs.doc_publications USING GIN (name)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_publications_versions_publication ON metahubs.doc_publication_versions(publication_id)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_publications_versions_branch ON metahubs.doc_publication_versions(branch_id)` },
        // ── RLS ──
        { sql: `ALTER TABLE metahubs.cat_metahubs ENABLE ROW LEVEL SECURITY;` },
        { sql: `ALTER TABLE metahubs.cat_metahub_branches ENABLE ROW LEVEL SECURITY;` },
        { sql: `ALTER TABLE metahubs.rel_metahub_users ENABLE ROW LEVEL SECURITY;` },
        { sql: `ALTER TABLE metahubs.doc_publications ENABLE ROW LEVEL SECURITY;` },
        { sql: `ALTER TABLE metahubs.doc_publication_versions ENABLE ROW LEVEL SECURITY;` },
        { sql: `ALTER TABLE metahubs.cat_templates ENABLE ROW LEVEL SECURITY` },
        { sql: `ALTER TABLE metahubs.doc_template_versions ENABLE ROW LEVEL SECURITY` },
        // ── RLS policies ──
        createDropPolicyIfTableExistsStatement('templates_read_all', 'metahubs', 'cat_templates'),
        {
            sql: `
                CREATE POLICY "templates_read_all" ON metahubs.cat_templates
                FOR SELECT
                USING (true)
            `
        },
        createDropPolicyIfTableExistsStatement('templates_write_superuser', 'metahubs', 'cat_templates'),
        {
            sql: `
                CREATE POLICY "templates_write_superuser" ON metahubs.cat_templates
                FOR ALL
                USING ((select admin.is_superuser((select auth.uid()))))
                WITH CHECK ((select admin.is_superuser((select auth.uid()))))
            `
        },
        createDropPolicyIfTableExistsStatement('template_versions_read_all', 'metahubs', 'doc_template_versions'),
        {
            sql: `
                CREATE POLICY "template_versions_read_all" ON metahubs.doc_template_versions
                FOR SELECT
                USING (true)
            `
        },
        createDropPolicyIfTableExistsStatement('template_versions_write_superuser', 'metahubs', 'doc_template_versions'),
        {
            sql: `
                CREATE POLICY "template_versions_write_superuser" ON metahubs.doc_template_versions
                FOR ALL
                USING ((select admin.is_superuser((select auth.uid()))))
                WITH CHECK ((select admin.is_superuser((select auth.uid()))))
            `
        },
        createDropPolicyIfTableExistsStatement('Allow users to manage their metahub memberships', 'metahubs', 'rel_metahub_users'),
        {
            sql: `
                CREATE POLICY "Allow users to manage their metahub memberships" ON metahubs.rel_metahub_users
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
        createDropPolicyIfTableExistsStatement('Allow users to manage their own metahubs', 'metahubs', 'cat_metahubs'),
        {
            sql: `
                CREATE POLICY "Allow users to manage their own metahubs" ON metahubs.cat_metahubs
                FOR ALL
                USING (
                    is_public = true
                    OR EXISTS (
                        SELECT 1 FROM metahubs.rel_metahub_users mu
                        WHERE mu.metahub_id = metahubs.cat_metahubs.id AND mu.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))
                )
                WITH CHECK (
                    EXISTS (
                        SELECT 1 FROM metahubs.rel_metahub_users mu
                        WHERE mu.metahub_id = metahubs.cat_metahubs.id AND mu.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))
                )
            `
        },
        createDropPolicyIfTableExistsStatement('branches_access_via_metahub', 'metahubs', 'cat_metahub_branches'),
        {
            sql: `
                CREATE POLICY "branches_access_via_metahub" ON metahubs.cat_metahub_branches
                FOR ALL
                USING (
                    EXISTS (
                        SELECT 1 FROM metahubs.rel_metahub_users mu
                        WHERE mu.metahub_id = metahubs.cat_metahub_branches.metahub_id AND mu.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))
                )
                WITH CHECK (
                    EXISTS (
                        SELECT 1 FROM metahubs.rel_metahub_users mu
                        WHERE mu.metahub_id = metahubs.cat_metahub_branches.metahub_id AND mu.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))
                )
            `
        },
        createDropPolicyIfTableExistsStatement('pub_access_via_metahub', 'metahubs', 'doc_publications'),
        {
            sql: `
                CREATE POLICY "pub_access_via_metahub" ON metahubs.doc_publications
                FOR ALL
                USING (
                    EXISTS (
                        SELECT 1 FROM metahubs.rel_metahub_users mu
                        WHERE mu.metahub_id = metahubs.doc_publications.metahub_id AND mu.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))
                )
                WITH CHECK (
                    EXISTS (
                        SELECT 1 FROM metahubs.rel_metahub_users mu
                        WHERE mu.metahub_id = metahubs.doc_publications.metahub_id AND mu.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))
                )
            `
        },
        createDropPolicyIfTableExistsStatement('publications_versions_policy', 'metahubs', 'doc_publication_versions'),
        {
            sql: `
                CREATE POLICY "publications_versions_policy" ON metahubs.doc_publication_versions
                USING (
                    publication_id IN (
                        SELECT p.id FROM metahubs.doc_publications p
                        JOIN metahubs.rel_metahub_users mu ON p.metahub_id = mu.metahub_id
                        WHERE mu.user_id = (select auth.uid())
                    )
                )
                WITH CHECK (
                    publication_id IN (
                        SELECT p.id FROM metahubs.doc_publications p
                        JOIN metahubs.rel_metahub_users mu ON p.metahub_id = mu.metahub_id
                        WHERE mu.user_id = (select auth.uid())
                    )
                )
            `
        }
    ],
    down: [
        createDropPolicyIfTableExistsStatement('template_versions_write_superuser', 'metahubs', 'doc_template_versions'),
        createDropPolicyIfTableExistsStatement('template_versions_read_all', 'metahubs', 'doc_template_versions'),
        createDropPolicyIfTableExistsStatement('templates_write_superuser', 'metahubs', 'cat_templates'),
        createDropPolicyIfTableExistsStatement('templates_read_all', 'metahubs', 'cat_templates'),
        { sql: `ALTER TABLE metahubs.doc_template_versions DISABLE ROW LEVEL SECURITY` },
        { sql: `ALTER TABLE metahubs.cat_templates DISABLE ROW LEVEL SECURITY` },
        createDropPolicyIfTableExistsStatement('publications_versions_policy', 'metahubs', 'doc_publication_versions'),
        createDropPolicyIfTableExistsStatement('pub_access_via_metahub', 'metahubs', 'doc_publications'),
        createDropPolicyIfTableExistsStatement('branches_access_via_metahub', 'metahubs', 'cat_metahub_branches'),
        createDropPolicyIfTableExistsStatement('Allow users to manage their own metahubs', 'metahubs', 'cat_metahubs'),
        createDropPolicyIfTableExistsStatement('Allow users to manage their metahub memberships', 'metahubs', 'rel_metahub_users'),
        { sql: `ALTER TABLE metahubs.cat_metahubs DISABLE ROW LEVEL SECURITY;` },
        { sql: `ALTER TABLE metahubs.cat_metahub_branches DISABLE ROW LEVEL SECURITY;` },
        { sql: `ALTER TABLE metahubs.rel_metahub_users DISABLE ROW LEVEL SECURITY;` },
        { sql: `ALTER TABLE metahubs.doc_publications DISABLE ROW LEVEL SECURITY;` },
        { sql: `ALTER TABLE metahubs.doc_publication_versions DISABLE ROW LEVEL SECURITY;` },
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
        { sql: `DROP INDEX IF EXISTS metahubs.idx_branches_schema_name_active` },
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
        { sql: `DROP TABLE IF EXISTS metahubs.doc_publication_versions` },
        { sql: `DROP TABLE IF EXISTS metahubs.doc_publications` },
        { sql: `ALTER TABLE metahubs.cat_metahub_branches DROP CONSTRAINT IF EXISTS fk_branches_last_template_version` },
        { sql: `ALTER TABLE metahubs.cat_metahubs DROP CONSTRAINT IF EXISTS fk_metahubs_template_version` },
        { sql: `ALTER TABLE metahubs.cat_metahubs DROP CONSTRAINT IF EXISTS fk_metahubs_template` },
        { sql: `ALTER TABLE metahubs.cat_templates DROP CONSTRAINT IF EXISTS fk_templates_active_version` },
        { sql: `DROP TABLE IF EXISTS metahubs.doc_template_versions` },
        { sql: `DROP TABLE IF EXISTS metahubs.cat_templates` },
        { sql: `ALTER TABLE metahubs.cat_metahubs DROP CONSTRAINT IF EXISTS fk_metahubs_default_branch` },
        { sql: `DROP TABLE IF EXISTS metahubs.rel_metahub_users` },
        { sql: `DROP TABLE IF EXISTS metahubs.cat_metahub_branches` },
        { sql: `DROP TABLE IF EXISTS metahubs.cat_metahubs` },
        { sql: `DROP TYPE IF EXISTS metahubs.publication_schema_status` },
        { sql: `DROP TYPE IF EXISTS metahubs.publication_access_mode` },
        { sql: `DROP TYPE IF EXISTS metahubs.attribute_data_type` },
        { sql: `DROP SCHEMA IF EXISTS metahubs CASCADE` }
    ]
}

const metahubsSchemaPreludeStatements = createMetahubsSchemaMigrationDefinition.up.slice(0, 5)
const metahubsSchemaPostGenerationStatements = createMetahubsSchemaMigrationDefinition.up.filter(
    (statement, index) => index >= 5 && !normalizeSql(statement.sql).startsWith('CREATE TABLE ')
)

export const prepareMetahubsSchemaSupportMigrationDefinition: SqlMigrationDefinition = {
    id: 'PrepareMetahubsSchemaSupport1766351182000',
    version: '1766351182000',
    summary: 'Prepare metahubs support objects before definition-driven schema generation',
    up: metahubsSchemaPreludeStatements,
    down: [] as const
}

export const finalizeMetahubsSchemaSupportMigrationDefinition: SqlMigrationDefinition = {
    id: 'FinalizeMetahubsSchemaSupport1766351182001',
    version: '1766351182001',
    summary: 'Finalize metahubs support objects after definition-driven schema generation',
    up: metahubsSchemaPostGenerationStatements,
    down: [] as const
}
