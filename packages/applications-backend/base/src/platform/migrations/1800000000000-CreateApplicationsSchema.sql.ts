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

const AUTH_UID_SQL = `(SELECT auth.uid())`
const IS_SUPERUSER_SQL = `(SELECT admin.is_superuser(${AUTH_UID_SQL}))`

const buildActiveApplicationExistsSql = (applicationIdSql: string, extraPredicate?: string): string =>
    `
EXISTS (
    SELECT 1
    FROM applications.cat_applications a
    WHERE a.id = ${applicationIdSql}
      AND a._upl_deleted = false
      AND a._app_deleted = false
      ${extraPredicate ? `AND ${extraPredicate}` : ''}
)
`.trim()

const buildActiveMembershipExistsSql = (applicationIdSql: string, roles?: readonly ('owner' | 'admin' | 'editor' | 'member')[]): string =>
    `
EXISTS (
    SELECT 1
    FROM applications.rel_application_users au
    WHERE au.application_id = ${applicationIdSql}
      AND au.user_id = ${AUTH_UID_SQL}
      AND au._upl_deleted = false
      AND au._app_deleted = false
      ${roles && roles.length > 0 ? `AND au.role IN (${roles.map((role) => `'${role}'`).join(', ')})` : ''}
)
`.trim()

const APPLICATION_POLICY_NAMES = {
    readVisibleApps: 'Allow users to read visible applications',
    createApps: 'Allow users to create applications',
    updateApps: 'Allow app owners and admins to update applications',
    readMemberships: 'Allow users to read application memberships',
    bootstrapOwnerMemberships: 'Allow application creators to bootstrap owner memberships',
    joinPublicApps: 'Allow users to join public applications',
    insertMemberships: 'Allow app owners and admins to insert memberships',
    updateMemberships: 'Allow app owners and admins to update memberships',
    leaveApplications: 'Allow users to leave applications',
    readConnectors: 'Allow users to read connectors in joined applications',
    insertConnectors: 'Allow app editors to insert connectors',
    updateConnectors: 'Allow app editors to update connectors',
    readConnectorPublications: 'Allow users to read connector publications in joined applications',
    insertConnectorPublications: 'Allow app editors to insert connector publications',
    updateConnectorPublications: 'Allow app editors to update connector publications'
} as const

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
                CREATE TABLE IF NOT EXISTS applications.cat_applications (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    name JSONB NOT NULL DEFAULT '{}',
                    description JSONB DEFAULT '{}',
                    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
                    slug VARCHAR(100),
                    is_public BOOLEAN NOT NULL DEFAULT false,
                    workspaces_enabled BOOLEAN NOT NULL DEFAULT false,
                    schema_name VARCHAR(100),
                    schema_status applications.application_schema_status DEFAULT 'draft',
                    schema_error TEXT,
                    schema_synced_at TIMESTAMPTZ,
                    schema_snapshot JSONB,
                    app_structure_version INTEGER DEFAULT NULL,
                    last_synced_publication_version_id UUID DEFAULT NULL,
                    installed_release_metadata JSONB,
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
                CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_slug_active
                ON applications.cat_applications (slug)
                WHERE _upl_deleted = false AND _app_deleted = false AND slug IS NOT NULL
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_schema_name_active
                ON applications.cat_applications (schema_name)
                WHERE _upl_deleted = false AND _app_deleted = false AND schema_name IS NOT NULL
            `
        },
        {
            sql: `
                CREATE INDEX IF NOT EXISTS idx_applications_deleted
                ON applications.cat_applications (_upl_deleted_at)
                WHERE _upl_deleted = true
            `
        },
        {
            sql: `
                CREATE INDEX IF NOT EXISTS idx_applications_archived
                ON applications.cat_applications (_upl_archived)
                WHERE _upl_archived = true
            `
        },
        {
            sql: `
                CREATE TABLE IF NOT EXISTS applications.cat_connectors (
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
                    FOREIGN KEY (application_id) REFERENCES applications.cat_applications(id) ON DELETE CASCADE
                )
            `
        },
        {
            sql: `
                CREATE TABLE IF NOT EXISTS applications.rel_connector_publications (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    connector_id UUID NOT NULL,
                    publication_id UUID NOT NULL,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    schema_options JSONB NOT NULL DEFAULT '{}'::jsonb,
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
                    FOREIGN KEY (connector_id) REFERENCES applications.cat_connectors(id) ON DELETE CASCADE
                )
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX IF NOT EXISTS idx_connectors_publications_active
                ON applications.rel_connector_publications (connector_id, publication_id)
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
                        ALTER TABLE applications.rel_connector_publications
                        ADD CONSTRAINT fk_cp_publication FOREIGN KEY (publication_id) 
                        REFERENCES metahubs.doc_publications(id) ON DELETE CASCADE;
                    END IF;
                END $$;
            `,
            warningMessage:
                'Warning: Unable to add FK constraint on connectors_publications.publication_id referencing metahubs.doc_publications. Continuing without it.'
        },
        {
            sql: `
                CREATE TABLE IF NOT EXISTS applications.rel_application_users (
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
                    _app_owner_id UUID,
                    _app_access_level VARCHAR(20) NOT NULL DEFAULT 'private',
                    FOREIGN KEY (application_id) REFERENCES applications.cat_applications(id) ON DELETE CASCADE
                )
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_users_active
                ON applications.rel_application_users (application_id, user_id)
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
                        ALTER TABLE applications.rel_application_users
                        ADD CONSTRAINT fk_au_auth_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
                    END IF;
                END $$;
            `,
            warningMessage:
                'Warning: Unable to add FK constraint on applications_users.user_id referencing auth.users. Continuing without it.'
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_au_application ON applications.rel_application_users(application_id)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_au_user ON applications.rel_application_users(user_id)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_connectors_application ON applications.cat_connectors(application_id)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_application_slug ON applications.cat_applications(slug)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_application_schema_name ON applications.cat_applications(schema_name)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_application_schema_status ON applications.cat_applications(schema_status)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_cp_connector ON applications.rel_connector_publications(connector_id)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_cp_publication ON applications.rel_connector_publications(publication_id)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_application_name_gin ON applications.cat_applications USING GIN (name)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_connector_name_gin ON applications.cat_connectors USING GIN (name)`
        },
        {
            sql: `ALTER TABLE applications.cat_applications ENABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `ALTER TABLE applications.rel_application_users ENABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `ALTER TABLE applications.cat_connectors ENABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `ALTER TABLE applications.rel_connector_publications ENABLE ROW LEVEL SECURITY;`
        },
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.readMemberships, 'applications', 'rel_application_users'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.bootstrapOwnerMemberships, 'applications', 'rel_application_users'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.joinPublicApps, 'applications', 'rel_application_users'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.insertMemberships, 'applications', 'rel_application_users'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.updateMemberships, 'applications', 'rel_application_users'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.leaveApplications, 'applications', 'rel_application_users'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.readVisibleApps, 'applications', 'cat_applications'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.createApps, 'applications', 'cat_applications'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.updateApps, 'applications', 'cat_applications'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.readConnectors, 'applications', 'cat_connectors'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.insertConnectors, 'applications', 'cat_connectors'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.updateConnectors, 'applications', 'cat_connectors'),
        createDropPolicyIfTableExistsStatement(
            APPLICATION_POLICY_NAMES.readConnectorPublications,
            'applications',
            'rel_connector_publications'
        ),
        createDropPolicyIfTableExistsStatement(
            APPLICATION_POLICY_NAMES.insertConnectorPublications,
            'applications',
            'rel_connector_publications'
        ),
        createDropPolicyIfTableExistsStatement(
            APPLICATION_POLICY_NAMES.updateConnectorPublications,
            'applications',
            'rel_connector_publications'
        ),
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.readMemberships}" ON applications.rel_application_users
                FOR SELECT
                USING (
                    user_id = ${AUTH_UID_SQL}
                    OR ${buildActiveMembershipExistsSql('applications.rel_application_users.application_id')}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.bootstrapOwnerMemberships}" ON applications.rel_application_users
                FOR INSERT
                WITH CHECK (
                    user_id = ${AUTH_UID_SQL}
                    AND role = 'owner'
                    AND ${buildActiveApplicationExistsSql(
                        'applications.rel_application_users.application_id',
                        `a._upl_created_by = ${AUTH_UID_SQL}`
                    )}
                )
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.joinPublicApps}" ON applications.rel_application_users
                FOR INSERT
                WITH CHECK (
                    user_id = ${AUTH_UID_SQL}
                    AND role = 'member'
                    AND ${buildActiveApplicationExistsSql('applications.rel_application_users.application_id', 'a.is_public = true')}
                )
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.insertMemberships}" ON applications.rel_application_users
                FOR INSERT
                WITH CHECK (
                    (
                        ${buildActiveMembershipExistsSql('applications.rel_application_users.application_id', ['owner', 'admin'])}
                        AND role IN ('member', 'editor', 'admin')
                    )
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.updateMemberships}" ON applications.rel_application_users
                FOR UPDATE
                USING (
                    ${buildActiveMembershipExistsSql('applications.rel_application_users.application_id', ['owner', 'admin'])}
                    OR ${IS_SUPERUSER_SQL}
                )
                WITH CHECK (
                    (
                        role IN ('member', 'editor', 'admin')
                        OR (_upl_deleted = true AND _app_deleted = true)
                    )
                    AND (
                        ${buildActiveMembershipExistsSql('applications.rel_application_users.application_id', ['owner', 'admin'])}
                        OR ${IS_SUPERUSER_SQL}
                    )
                )
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.leaveApplications}" ON applications.rel_application_users
                FOR UPDATE
                USING (
                    user_id = ${AUTH_UID_SQL}
                )
                WITH CHECK (
                    (
                        user_id = ${AUTH_UID_SQL}
                        AND role <> 'owner'
                        AND _upl_deleted = true
                        AND _app_deleted = true
                    )
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.readVisibleApps}" ON applications.cat_applications
                FOR SELECT
                USING (
                    is_public = true
                    OR ${buildActiveMembershipExistsSql('applications.cat_applications.id')}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.createApps}" ON applications.cat_applications
                FOR INSERT
                WITH CHECK (
                    _upl_created_by = ${AUTH_UID_SQL}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.updateApps}" ON applications.cat_applications
                FOR UPDATE
                USING (
                    ${buildActiveMembershipExistsSql('applications.cat_applications.id', ['owner', 'admin'])}
                    OR ${IS_SUPERUSER_SQL}
                )
                WITH CHECK (
                    ${buildActiveMembershipExistsSql('applications.cat_applications.id', ['owner', 'admin'])}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.readConnectors}" ON applications.cat_connectors
                FOR SELECT
                USING (
                    ${buildActiveMembershipExistsSql('applications.cat_connectors.application_id')}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.insertConnectors}" ON applications.cat_connectors
                FOR INSERT
                WITH CHECK (
                    ${buildActiveMembershipExistsSql('applications.cat_connectors.application_id', ['owner', 'admin', 'editor'])}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.updateConnectors}" ON applications.cat_connectors
                FOR UPDATE
                USING (
                    ${buildActiveMembershipExistsSql('applications.cat_connectors.application_id', ['owner', 'admin', 'editor'])}
                    OR ${IS_SUPERUSER_SQL}
                )
                WITH CHECK (
                    ${buildActiveMembershipExistsSql('applications.cat_connectors.application_id', ['owner', 'admin', 'editor'])}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.readConnectorPublications}" ON applications.rel_connector_publications
                FOR SELECT
                USING (
                    ${buildActiveMembershipExistsSql(
                        '(SELECT c.application_id FROM applications.cat_connectors c WHERE c.id = applications.rel_connector_publications.connector_id)'
                    )}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.insertConnectorPublications}" ON applications.rel_connector_publications
                FOR INSERT
                WITH CHECK (
                    ${buildActiveMembershipExistsSql(
                        '(SELECT c.application_id FROM applications.cat_connectors c WHERE c.id = applications.rel_connector_publications.connector_id)',
                        ['owner', 'admin', 'editor']
                    )}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.updateConnectorPublications}" ON applications.rel_connector_publications
                FOR UPDATE
                USING (
                    ${buildActiveMembershipExistsSql(
                        '(SELECT c.application_id FROM applications.cat_connectors c WHERE c.id = applications.rel_connector_publications.connector_id)',
                        ['owner', 'admin', 'editor']
                    )}
                    OR ${IS_SUPERUSER_SQL}
                )
                WITH CHECK (
                    ${buildActiveMembershipExistsSql(
                        '(SELECT c.application_id FROM applications.cat_connectors c WHERE c.id = applications.rel_connector_publications.connector_id)',
                        ['owner', 'admin', 'editor']
                    )}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        }
    ],
    down: [
        createDropPolicyIfTableExistsStatement(
            APPLICATION_POLICY_NAMES.updateConnectorPublications,
            'applications',
            'rel_connector_publications'
        ),
        createDropPolicyIfTableExistsStatement(
            APPLICATION_POLICY_NAMES.insertConnectorPublications,
            'applications',
            'rel_connector_publications'
        ),
        createDropPolicyIfTableExistsStatement(
            APPLICATION_POLICY_NAMES.readConnectorPublications,
            'applications',
            'rel_connector_publications'
        ),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.updateConnectors, 'applications', 'cat_connectors'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.insertConnectors, 'applications', 'cat_connectors'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.readConnectors, 'applications', 'cat_connectors'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.updateApps, 'applications', 'cat_applications'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.createApps, 'applications', 'cat_applications'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.readVisibleApps, 'applications', 'cat_applications'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.leaveApplications, 'applications', 'rel_application_users'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.updateMemberships, 'applications', 'rel_application_users'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.insertMemberships, 'applications', 'rel_application_users'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.joinPublicApps, 'applications', 'rel_application_users'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.bootstrapOwnerMemberships, 'applications', 'rel_application_users'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.readMemberships, 'applications', 'rel_application_users'),
        {
            sql: `ALTER TABLE applications.rel_connector_publications DISABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `ALTER TABLE applications.cat_connectors DISABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `ALTER TABLE applications.cat_applications DISABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `ALTER TABLE applications.rel_application_users DISABLE ROW LEVEL SECURITY;`
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
            sql: `DROP TABLE IF EXISTS applications.rel_connector_publications`
        },
        {
            sql: `DROP TABLE IF EXISTS applications.cat_connectors`
        },
        {
            sql: `DROP TABLE IF EXISTS applications.rel_application_users`
        },
        {
            sql: `DROP TABLE IF EXISTS applications.cat_applications`
        },
        {
            sql: `DROP TYPE IF EXISTS applications.application_schema_status`
        },
        {
            sql: `DROP SCHEMA IF EXISTS applications CASCADE`
        }
    ]
}

const applicationsSchemaPreludeStatements = createApplicationsSchemaMigrationDefinition.up.slice(0, 3)
const applicationsSchemaPostStatements = createApplicationsSchemaMigrationDefinition.up.filter(
    (statement, index) => !applicationsSchemaPreludeStatements.includes(statement) && ![3, 8, 9, 12].includes(index)
)

export const prepareApplicationsSchemaSupportMigrationDefinition: SqlMigrationDefinition = {
    id: 'PrepareApplicationsSchemaSupport1800000000000',
    version: '1800000000000',
    summary: 'Prepare applications fixed-schema support objects before definition-driven table generation',
    up: applicationsSchemaPreludeStatements,
    down: [
        {
            sql: `DROP TYPE IF EXISTS applications.application_schema_status`
        },
        {
            sql: `DROP SCHEMA IF EXISTS applications CASCADE`
        }
    ] as const
}

export const finalizeApplicationsSchemaSupportMigrationDefinition: SqlMigrationDefinition = {
    id: 'FinalizeApplicationsSchemaSupport1800000000001',
    version: '1800000000001',
    summary: 'Finalize applications fixed-schema support objects after definition-driven table generation',
    up: applicationsSchemaPostStatements,
    down: [] as const
}

export const addApplicationSettingsMigrationDefinition: SqlMigrationDefinition = {
    id: 'AddApplicationSettings1800000000100',
    version: '1800000000100',
    summary: 'Add persisted application settings storage for control-panel dialog configuration',
    up: [
        {
            sql: `
ALTER TABLE applications.cat_applications
ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;
            `
        },
        {
            sql: `
UPDATE applications.cat_applications
SET settings = '{}'::jsonb
WHERE settings IS NULL;
            `
        }
    ] as const,
    down: [
        {
            sql: `
ALTER TABLE applications.cat_applications
DROP COLUMN IF EXISTS settings;
            `
        }
    ] as const
}
