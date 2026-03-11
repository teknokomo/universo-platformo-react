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

export const createApplicationsSchemaMigrationDefinition: SqlMigrationDefinition = {
    id: 'CreateApplicationsSchema1800000000000',
    version: '1800000000000',
    summary: 'Create applications platform schema',
    up: [
        {
            sql: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`
        },
        {
            sql: `CREATE SCHEMA IF NOT EXISTS applications;`
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'application_schema_status' AND typnamespace = 'applications'::regnamespace) THEN
                        CREATE TYPE applications.application_schema_status AS ENUM (
                            'draft',
                            'pending',
                            'synced',
                            'outdated',
                            'error',
                            'update_available',
                            'maintenance'
                        );
                    END IF;
                END $$;
            `
        },
        {
            sql: `
                CREATE TABLE IF NOT EXISTS applications.applications (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    name JSONB NOT NULL DEFAULT '{}',
                    description JSONB DEFAULT '{}',
                    slug VARCHAR(100),
                    is_public BOOLEAN NOT NULL DEFAULT false,
                    schema_name VARCHAR(100),
                    schema_status applications.application_schema_status DEFAULT 'draft',
                    schema_error TEXT,
                    schema_synced_at TIMESTAMPTZ,
                    schema_snapshot JSONB,
                    app_structure_version INTEGER DEFAULT NULL,
                    last_synced_publication_version_id UUID DEFAULT NULL,
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
                CREATE UNIQUE INDEX idx_applications_slug_active
                ON applications.applications (slug)
                WHERE _upl_deleted = false AND slug IS NOT NULL
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX idx_applications_schema_name_active
                ON applications.applications (schema_name)
                WHERE _upl_deleted = false AND schema_name IS NOT NULL
            `
        },
        {
            sql: `
                CREATE INDEX idx_applications_deleted
                ON applications.applications (_upl_deleted_at)
                WHERE _upl_deleted = true
            `
        },
        {
            sql: `
                CREATE INDEX idx_applications_archived
                ON applications.applications (_upl_archived)
                WHERE _upl_archived = true
            `
        },
        {
            sql: `
                CREATE TABLE IF NOT EXISTS applications.connectors (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    application_id UUID NOT NULL,
                    name JSONB NOT NULL DEFAULT '{}',
                    description JSONB DEFAULT '{}',
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    is_single_metahub BOOLEAN NOT NULL DEFAULT true,
                    is_required_metahub BOOLEAN NOT NULL DEFAULT true,
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
                    FOREIGN KEY (application_id) REFERENCES applications.applications(id) ON DELETE CASCADE
                )
            `
        },
        {
            sql: `
                CREATE TABLE IF NOT EXISTS applications.connectors_publications (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    connector_id UUID NOT NULL,
                    publication_id UUID NOT NULL,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    _upl_created_by UUID,
                    _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    _upl_updated_by UUID,
                    _upl_version INTEGER NOT NULL DEFAULT 1,
                    _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                    _upl_deleted_at TIMESTAMPTZ,
                    _upl_deleted_by UUID,
                    _app_published BOOLEAN NOT NULL DEFAULT true,
                    _app_published_at TIMESTAMPTZ,
                    _app_published_by UUID,
                    _app_archived BOOLEAN NOT NULL DEFAULT false,
                    _app_archived_at TIMESTAMPTZ,
                    _app_archived_by UUID,
                    _app_deleted BOOLEAN NOT NULL DEFAULT false,
                    _app_deleted_at TIMESTAMPTZ,
                    _app_deleted_by UUID,
                    FOREIGN KEY (connector_id) REFERENCES applications.connectors(id) ON DELETE CASCADE
                )
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX idx_connectors_publications_active
                ON applications.connectors_publications (connector_id, publication_id)
                WHERE _upl_deleted = false AND _app_deleted = false
            `
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'fk_cp_publication'
                    ) THEN
                        ALTER TABLE applications.connectors_publications
                        ADD CONSTRAINT fk_cp_publication FOREIGN KEY (publication_id) 
                        REFERENCES metahubs.publications(id) ON DELETE CASCADE;
                    END IF;
                END $$;
            `,
            warningMessage:
                'Warning: Unable to add FK constraint on connectors_publications.publication_id referencing metahubs.publications. Continuing without it.'
        },
        {
            sql: `
                CREATE TABLE IF NOT EXISTS applications.applications_users (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    application_id UUID NOT NULL,
                    user_id UUID NOT NULL,
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
                    FOREIGN KEY (application_id) REFERENCES applications.applications(id) ON DELETE CASCADE
                )
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX idx_applications_users_active
                ON applications.applications_users (application_id, user_id)
                WHERE _upl_deleted = false AND _app_deleted = false
            `
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'fk_au_auth_user'
                    ) THEN
                        ALTER TABLE applications.applications_users
                        ADD CONSTRAINT fk_au_auth_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
                    END IF;
                END $$;
            `,
            warningMessage:
                'Warning: Unable to add FK constraint on applications_users.user_id referencing auth.users. Continuing without it.'
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_au_application ON applications.applications_users(application_id)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_au_user ON applications.applications_users(user_id)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_connectors_application ON applications.connectors(application_id)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_application_slug ON applications.applications(slug)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_application_schema_name ON applications.applications(schema_name)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_application_schema_status ON applications.applications(schema_status)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_cp_connector ON applications.connectors_publications(connector_id)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_cp_publication ON applications.connectors_publications(publication_id)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_application_name_gin ON applications.applications USING GIN (name)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_connector_name_gin ON applications.connectors USING GIN (name)`
        },
        {
            sql: `ALTER TABLE applications.applications ENABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `ALTER TABLE applications.applications_users ENABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `ALTER TABLE applications.connectors ENABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `ALTER TABLE applications.connectors_publications ENABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `DROP POLICY IF EXISTS "Allow users to manage their application memberships" ON applications.applications_users;`
        },
        {
            sql: `
                CREATE POLICY "Allow users to manage their application memberships" ON applications.applications_users
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
            sql: `DROP POLICY IF EXISTS "Allow users to manage their own applications" ON applications.applications;`
        },
        {
            sql: `
                CREATE POLICY "Allow users to manage their own applications" ON applications.applications
                FOR ALL
                USING (
                    is_public = true
                    OR EXISTS (
                        SELECT 1 FROM applications.applications_users au
                        WHERE au.application_id = applications.applications.id AND au.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))
                )
                WITH CHECK (
                    EXISTS (
                        SELECT 1 FROM applications.applications_users au
                        WHERE au.application_id = applications.applications.id AND au.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))
                )
            `
        },
        {
            sql: `DROP POLICY IF EXISTS "Allow users to manage connectors in their applications" ON applications.connectors;`
        },
        {
            sql: `
                CREATE POLICY "Allow users to manage connectors in their applications" ON applications.connectors
                FOR ALL
                USING (
                    EXISTS (
                        SELECT 1 FROM applications.applications a
                        LEFT JOIN applications.applications_users au ON a.id = au.application_id
                        WHERE a.id = applications.connectors.application_id 
                        AND (a.is_public = true OR au.user_id = (select auth.uid()))
                    )
                    OR (select admin.is_superuser((select auth.uid())))
                )
                WITH CHECK (
                    EXISTS (
                        SELECT 1 FROM applications.applications_users au
                        WHERE au.application_id = applications.connectors.application_id AND au.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))
                )
            `
        },
        {
            sql: `DROP POLICY IF EXISTS "Allow users to manage connector-publication links" ON applications.connectors_publications;`
        },
        {
            sql: `
                CREATE POLICY "Allow users to manage connector-publication links" ON applications.connectors_publications
                FOR ALL
                USING (
                    EXISTS (
                        SELECT 1 FROM applications.connectors c
                        JOIN applications.applications_users au ON c.application_id = au.application_id
                        WHERE c.id = applications.connectors_publications.connector_id AND au.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))
                )
                WITH CHECK (
                    EXISTS (
                        SELECT 1 FROM applications.connectors c
                        JOIN applications.applications_users au ON c.application_id = au.application_id
                        WHERE c.id = applications.connectors_publications.connector_id AND au.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))
                )
            `
        }
    ],
    down: [
        {
            sql: `DROP POLICY IF EXISTS "Allow users to manage connector-publication links" ON applications.connectors_publications;`
        },
        {
            sql: `DROP POLICY IF EXISTS "Allow users to manage connectors in their applications" ON applications.connectors;`
        },
        {
            sql: `DROP POLICY IF EXISTS "Allow users to manage their own applications" ON applications.applications;`
        },
        {
            sql: `DROP POLICY IF EXISTS "Allow users to manage their application memberships" ON applications.applications_users;`
        },
        {
            sql: `ALTER TABLE applications.connectors_publications DISABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `ALTER TABLE applications.connectors DISABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `ALTER TABLE applications.applications DISABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `ALTER TABLE applications.applications_users DISABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.idx_connector_name_gin`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.idx_application_name_gin`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.idx_cp_publication`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.idx_cp_connector`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.idx_connectors_publications_active`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.idx_application_schema_status`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.idx_application_schema_name`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.idx_applications_schema_name_active`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.idx_applications_slug_active`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.idx_applications_deleted`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.idx_applications_users_active`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.idx_application_slug`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.idx_connectors_application`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.idx_au_user`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.idx_au_application`
        },
        {
            sql: `DROP TABLE IF EXISTS applications.connectors_publications`
        },
        {
            sql: `DROP TABLE IF EXISTS applications.connectors`
        },
        {
            sql: `DROP TABLE IF EXISTS applications.applications_users`
        },
        {
            sql: `DROP TABLE IF EXISTS applications.applications`
        },
        {
            sql: `DROP TYPE IF EXISTS applications.application_schema_status`
        },
        {
            sql: `DROP SCHEMA IF EXISTS applications CASCADE`
        }
    ]
}
