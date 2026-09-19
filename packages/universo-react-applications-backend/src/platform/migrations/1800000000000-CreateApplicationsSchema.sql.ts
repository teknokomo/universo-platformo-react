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
const APPLICATION_ALIAS_PERMISSION_SQL = (action: 'read' | 'create' | 'update' | 'delete' | 'manage'): string =>
    `(SELECT admin.has_permission(${AUTH_UID_SQL}, 'applicationAliases', '${action}', '{}'::jsonb))`
const APPLICATION_ALIAS_READER_SQL = `(${IS_SUPERUSER_SQL} OR ${['read', 'create', 'update', 'delete', 'manage']
    .map((action) => APPLICATION_ALIAS_PERMISSION_SQL(action as 'read' | 'create' | 'update' | 'delete' | 'manage'))
    .join(' OR ')})`
// CASL semantics: `manage` implies every action. Alias release is a
// delete-authorized lifecycle operation implemented as a soft UPDATE
// (`released_at`), so the UPDATE backstop accepts update, delete and manage.
// The API controller still authorizes rename/setPrimary/behavior as `update`
// and release as `delete` independently.
const APPLICATION_ALIAS_UPDATER_SQL = `(${IS_SUPERUSER_SQL} OR ${APPLICATION_ALIAS_PERMISSION_SQL(
    'update'
)} OR ${APPLICATION_ALIAS_PERMISSION_SQL('delete')} OR ${APPLICATION_ALIAS_PERMISSION_SQL('manage')})`

const buildActiveApplicationExistsSql = (applicationIdSql: string, extraPredicate?: string): string =>
    `
EXISTS (
    SELECT 1
    FROM applications.obj_applications a
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
    updateConnectorPublications: 'Allow app editors to update connector publications',
    readAliases: 'Allow application alias managers to read aliases',
    createAliases: 'Allow application alias managers to create aliases',
    updateAliases: 'Allow application alias managers to update aliases'
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
                CREATE TABLE IF NOT EXISTS applications.obj_applications (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    name JSONB NOT NULL DEFAULT '{}',
                    description JSONB DEFAULT '{}',
                    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
                    is_public BOOLEAN NOT NULL DEFAULT false,
                    workspaces_enabled BOOLEAN NOT NULL DEFAULT false,
                    alias_routing_mode VARCHAR(20) NOT NULL DEFAULT 'direct',
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
                    _app_access_level VARCHAR(20) NOT NULL DEFAULT 'private',
                    CONSTRAINT applications_alias_routing_mode_ck CHECK (alias_routing_mode IN ('direct', 'canonical'))
                )
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_schema_name_active
                ON applications.obj_applications (schema_name)
                WHERE _upl_deleted = false AND _app_deleted = false AND schema_name IS NOT NULL
            `
        },
        {
            sql: `
                CREATE INDEX IF NOT EXISTS idx_applications_deleted
                ON applications.obj_applications (_upl_deleted_at)
                WHERE _upl_deleted = true
            `
        },
        {
            sql: `
                CREATE INDEX IF NOT EXISTS idx_applications_archived
                ON applications.obj_applications (_upl_archived)
                WHERE _upl_archived = true
            `
        },
        {
            sql: `
                CREATE TABLE IF NOT EXISTS applications.obj_connectors (
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
                    FOREIGN KEY (application_id) REFERENCES applications.obj_applications(id) ON DELETE CASCADE
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
                    FOREIGN KEY (connector_id) REFERENCES applications.obj_connectors(id) ON DELETE CASCADE
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
                    FOREIGN KEY (application_id) REFERENCES applications.obj_applications(id) ON DELETE CASCADE
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
            sql: `CREATE INDEX IF NOT EXISTS idx_connectors_application ON applications.obj_connectors(application_id)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_application_schema_name ON applications.obj_applications(schema_name)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_application_schema_status ON applications.obj_applications(schema_status)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_cp_connector ON applications.rel_connector_publications(connector_id)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_cp_publication ON applications.rel_connector_publications(publication_id)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_application_name_gin ON applications.obj_applications USING GIN (name)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_connector_name_gin ON applications.obj_connectors USING GIN (name)`
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'applications_alias_routing_mode_ck'
                          AND conrelid = 'applications.obj_applications'::regclass
                    ) THEN
                        ALTER TABLE applications.obj_applications
                            ADD CONSTRAINT applications_alias_routing_mode_ck
                            CHECK (alias_routing_mode IN ('direct', 'canonical'));
                    END IF;
                END $$;
            `
        },
        {
            sql: `
                CREATE TABLE IF NOT EXISTS applications.obj_application_aliases (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    application_id UUID NOT NULL,
                    alias VARCHAR(63) NOT NULL,
                    is_primary BOOLEAN NOT NULL DEFAULT false,
                    released_at TIMESTAMPTZ,
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
                    CONSTRAINT fk_application_alias_application
                        FOREIGN KEY (application_id)
                        REFERENCES applications.obj_applications(id)
                        ON DELETE RESTRICT,
                    CONSTRAINT application_alias_format_ck
                        CHECK (alias ~ '^([a-z0-9]|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$'),
                    CONSTRAINT application_alias_released_primary_ck
                        CHECK (released_at IS NULL OR is_primary = false)
                )
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX IF NOT EXISTS uq_application_aliases_active_alias
                ON applications.obj_application_aliases (alias)
                WHERE released_at IS NULL
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX IF NOT EXISTS uq_application_aliases_active_primary
                ON applications.obj_application_aliases (application_id)
                WHERE is_primary = true
                  AND released_at IS NULL
                  AND _upl_deleted = false
                  AND _app_deleted = false
                  AND _upl_archived = false
                  AND _app_archived = false
            `
        },
        {
            sql: `
                CREATE OR REPLACE FUNCTION applications.validate_application_alias()
                RETURNS trigger
                LANGUAGE plpgsql
                SECURITY DEFINER
                SET search_path = pg_catalog, applications
                AS $$
                BEGIN
                    IF NEW.alias IS DISTINCT FROM lower(NEW.alias)
                       OR NEW.alias !~ '^([a-z0-9]|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$' THEN
                        RAISE EXCEPTION 'Application alias has an invalid format' USING ERRCODE = '23514';
                    END IF;

                    IF NEW.alias ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                       OR NEW.alias = ANY (ARRAY[
                           'admin', 'api', 'applications', 'auth', 'dashboard', 'instances',
                           'login', 'logout', 'metahubs', 'metapanel', 'privacy', 'public',
                           'settings', 'start', 'terms'
                       ]) THEN
                        RAISE EXCEPTION 'Application alias is reserved' USING ERRCODE = '23514';
                    END IF;

                    IF TG_OP = 'UPDATE' AND NEW.application_id IS DISTINCT FROM OLD.application_id THEN
                        RAISE EXCEPTION 'Application alias ownership is immutable' USING ERRCODE = '42501';
                    END IF;

                    IF NEW.released_at IS NOT NULL AND NEW.is_primary THEN
                        RAISE EXCEPTION 'Released application aliases cannot be primary' USING ERRCODE = '23514';
                    END IF;

                    RETURN NEW;
                END;
                $$
            `
        },
        {
            sql: `REVOKE ALL ON FUNCTION applications.validate_application_alias() FROM PUBLIC`
        },
        {
            sql: `
                DROP TRIGGER IF EXISTS applications_validate_application_alias ON applications.obj_application_aliases;
                CREATE TRIGGER applications_validate_application_alias
                BEFORE INSERT OR UPDATE OF application_id, alias, is_primary, released_at
                ON applications.obj_application_aliases
                FOR EACH ROW
                EXECUTE FUNCTION applications.validate_application_alias()
            `
        },
        {
            sql: `
                CREATE OR REPLACE FUNCTION applications.create_application_alias(
                    p_application_id UUID,
                    p_alias TEXT,
                    p_make_primary BOOLEAN,
                    p_user_id UUID
                )
                RETURNS TABLE(
                    id UUID,
                    application_id UUID,
                    alias VARCHAR(63),
                    is_primary BOOLEAN,
                    released_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ,
                    updated_at TIMESTAMPTZ
                )
                LANGUAGE plpgsql
                SECURITY DEFINER
                SET search_path = extensions, applications, auth, pg_temp
                AS $$
                DECLARE
                    v_routing_mode TEXT;
                    v_is_primary BOOLEAN;
                BEGIN
                    IF p_user_id IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
                        RAISE EXCEPTION 'Application alias actor is invalid' USING ERRCODE = '42501';
                    END IF;

                    IF NOT (
                        admin.is_superuser(p_user_id)
                        OR admin.has_permission(p_user_id, 'applicationAliases', 'create', '{}'::jsonb)
                        OR admin.has_permission(p_user_id, 'applicationAliases', 'manage', '{}'::jsonb)
                    ) THEN
                        RAISE EXCEPTION 'Application alias create permission denied' USING ERRCODE = '42501';
                    END IF;

                    IF COALESCE(p_make_primary, false) AND NOT (
                        admin.is_superuser(p_user_id)
                        OR admin.has_permission(p_user_id, 'applicationAliases', 'update', '{}'::jsonb)
                        OR admin.has_permission(p_user_id, 'applicationAliases', 'manage', '{}'::jsonb)
                    ) THEN
                        RAISE EXCEPTION 'Application alias primary permission denied' USING ERRCODE = '42501';
                    END IF;

                    PERFORM pg_advisory_xact_lock(hashtext('application-aliases:' || p_application_id::text));

                    SELECT a.alias_routing_mode::text
                    INTO v_routing_mode
                    FROM applications.obj_applications AS a
                    WHERE a.id = p_application_id
                      AND a._upl_deleted = false
                      AND a._app_deleted = false
                      AND a._upl_archived = false
                      AND a._app_archived = false
                    FOR UPDATE;

                    IF NOT FOUND THEN
                        RAISE EXCEPTION 'Application alias owner is unavailable' USING ERRCODE = '42501';
                    END IF;

                    SELECT COALESCE(p_make_primary, false)
                        OR (
                            v_routing_mode = 'canonical'
                            AND NOT EXISTS (
                                SELECT 1
                                FROM applications.obj_application_aliases AS existing_alias
                                WHERE existing_alias.application_id = p_application_id
                                  AND existing_alias.released_at IS NULL
                                  AND existing_alias._upl_deleted = false
                                  AND existing_alias._app_deleted = false
                                  AND existing_alias._upl_archived = false
                                  AND existing_alias._app_archived = false
                            )
                        )
                    INTO v_is_primary;

                    IF v_is_primary THEN
                        UPDATE applications.obj_application_aliases AS existing_primary
                        SET is_primary = false,
                            _upl_updated_at = now(),
                            _upl_updated_by = p_user_id,
                            _upl_version = existing_primary._upl_version + 1
                        WHERE existing_primary.application_id = p_application_id
                          AND existing_primary.released_at IS NULL
                          AND existing_primary.is_primary = true
                          AND existing_primary._upl_deleted = false
                          AND existing_primary._app_deleted = false
                          AND existing_primary._upl_archived = false
                          AND existing_primary._app_archived = false;
                    END IF;

                    RETURN QUERY
                    INSERT INTO applications.obj_application_aliases (
                        id,
                        application_id,
                        alias,
                        is_primary,
                        released_at,
                        _upl_created_at,
                        _upl_created_by,
                        _upl_updated_at,
                        _upl_updated_by,
                        _upl_version
                    )
                    VALUES (public.uuid_generate_v7(), p_application_id, p_alias, v_is_primary, NULL, now(), p_user_id, now(), p_user_id, 1)
                    RETURNING
                        obj_application_aliases.id,
                        obj_application_aliases.application_id,
                        obj_application_aliases.alias,
                        obj_application_aliases.is_primary,
                        obj_application_aliases.released_at,
                        obj_application_aliases._upl_created_at,
                        obj_application_aliases._upl_updated_at;
                END;
                $$
            `
        },
        {
            sql: `REVOKE ALL ON FUNCTION applications.create_application_alias(UUID, TEXT, BOOLEAN, UUID) FROM PUBLIC`
        },
        {
            sql: `
                CREATE OR REPLACE FUNCTION applications.update_application_alias_routing_mode(
                    p_application_id UUID,
                    p_routing_mode TEXT,
                    p_user_id UUID
                )
                RETURNS TABLE("applicationId" UUID, "routingMode" TEXT)
                LANGUAGE plpgsql
                SECURITY DEFINER
                SET search_path = extensions, applications, auth, pg_temp
                AS $$
                BEGIN
                    IF p_user_id IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
                        RAISE EXCEPTION 'Application alias policy actor is invalid' USING ERRCODE = '42501';
                    END IF;

                    IF NOT (
                        admin.is_superuser(p_user_id)
                        OR admin.has_permission(p_user_id, 'applicationAliases', 'update', '{}'::jsonb)
                        OR admin.has_permission(p_user_id, 'applicationAliases', 'manage', '{}'::jsonb)
                    ) THEN
                        RAISE EXCEPTION 'Application alias policy permission denied' USING ERRCODE = '42501';
                    END IF;

                    RETURN QUERY
                    UPDATE applications.obj_applications AS a
                    SET alias_routing_mode = p_routing_mode,
                        _upl_updated_at = now(),
                        _upl_updated_by = p_user_id,
                        _upl_version = a._upl_version + 1
                    WHERE a.id = p_application_id
                      AND a._upl_deleted = false
                      AND a._app_deleted = false
                      AND a._upl_archived = false
                      AND a._app_archived = false
                    RETURNING a.id, a.alias_routing_mode::text;
                END;
                $$
            `
        },
        {
            sql: `REVOKE ALL ON FUNCTION applications.update_application_alias_routing_mode(UUID, TEXT, UUID) FROM PUBLIC`
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                        GRANT EXECUTE ON FUNCTION applications.create_application_alias(UUID, TEXT, BOOLEAN, UUID) TO authenticated;
                        GRANT EXECUTE ON FUNCTION applications.update_application_alias_routing_mode(UUID, TEXT, UUID) TO authenticated;
                    END IF;

                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
                        GRANT EXECUTE ON FUNCTION applications.create_application_alias(UUID, TEXT, BOOLEAN, UUID) TO service_role;
                        GRANT EXECUTE ON FUNCTION applications.update_application_alias_routing_mode(UUID, TEXT, UUID) TO service_role;
                    END IF;
                END $$;
            `
        },
        {
            sql: `ALTER TABLE applications.obj_applications ENABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `ALTER TABLE applications.rel_application_users ENABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `ALTER TABLE applications.obj_connectors ENABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `ALTER TABLE applications.rel_connector_publications ENABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `ALTER TABLE applications.obj_application_aliases ENABLE ROW LEVEL SECURITY;`
        },
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.readMemberships, 'applications', 'rel_application_users'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.bootstrapOwnerMemberships, 'applications', 'rel_application_users'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.joinPublicApps, 'applications', 'rel_application_users'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.insertMemberships, 'applications', 'rel_application_users'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.updateMemberships, 'applications', 'rel_application_users'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.leaveApplications, 'applications', 'rel_application_users'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.readVisibleApps, 'applications', 'obj_applications'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.createApps, 'applications', 'obj_applications'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.updateApps, 'applications', 'obj_applications'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.readConnectors, 'applications', 'obj_connectors'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.insertConnectors, 'applications', 'obj_connectors'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.updateConnectors, 'applications', 'obj_connectors'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.readAliases, 'applications', 'obj_application_aliases'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.createAliases, 'applications', 'obj_application_aliases'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.updateAliases, 'applications', 'obj_application_aliases'),
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
                CREATE POLICY "${APPLICATION_POLICY_NAMES.readVisibleApps}" ON applications.obj_applications
                FOR SELECT
                USING (
                    is_public = true
                    OR ${buildActiveMembershipExistsSql('applications.obj_applications.id')}
                    OR ${IS_SUPERUSER_SQL}
                    OR ${APPLICATION_ALIAS_READER_SQL}
                )
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.readAliases}" ON applications.obj_application_aliases
                FOR SELECT
                USING (${APPLICATION_ALIAS_READER_SQL})
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.createAliases}" ON applications.obj_application_aliases
                FOR INSERT
                WITH CHECK (
                    ${IS_SUPERUSER_SQL}
                    OR ${APPLICATION_ALIAS_PERMISSION_SQL('create')}
                    OR ${APPLICATION_ALIAS_PERMISSION_SQL('manage')}
                )
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.updateAliases}" ON applications.obj_application_aliases
                FOR UPDATE
                USING (${APPLICATION_ALIAS_UPDATER_SQL})
                WITH CHECK (${APPLICATION_ALIAS_UPDATER_SQL})
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.createApps}" ON applications.obj_applications
                FOR INSERT
                WITH CHECK (
                    _upl_created_by = ${AUTH_UID_SQL}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.updateApps}" ON applications.obj_applications
                FOR UPDATE
                USING (
                    ${buildActiveMembershipExistsSql('applications.obj_applications.id', ['owner', 'admin'])}
                    OR ${IS_SUPERUSER_SQL}
                )
                WITH CHECK (
                    ${buildActiveMembershipExistsSql('applications.obj_applications.id', ['owner', 'admin'])}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.readConnectors}" ON applications.obj_connectors
                FOR SELECT
                USING (
                    ${buildActiveMembershipExistsSql('applications.obj_connectors.application_id')}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.insertConnectors}" ON applications.obj_connectors
                FOR INSERT
                WITH CHECK (
                    ${buildActiveMembershipExistsSql('applications.obj_connectors.application_id', ['owner', 'admin', 'editor'])}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                CREATE POLICY "${APPLICATION_POLICY_NAMES.updateConnectors}" ON applications.obj_connectors
                FOR UPDATE
                USING (
                    ${buildActiveMembershipExistsSql('applications.obj_connectors.application_id', ['owner', 'admin', 'editor'])}
                    OR ${IS_SUPERUSER_SQL}
                )
                WITH CHECK (
                    ${buildActiveMembershipExistsSql('applications.obj_connectors.application_id', ['owner', 'admin', 'editor'])}
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
                        '(SELECT c.application_id FROM applications.obj_connectors c WHERE c.id = applications.rel_connector_publications.connector_id)'
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
                        '(SELECT c.application_id FROM applications.obj_connectors c WHERE c.id = applications.rel_connector_publications.connector_id)',
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
                        '(SELECT c.application_id FROM applications.obj_connectors c WHERE c.id = applications.rel_connector_publications.connector_id)',
                        ['owner', 'admin', 'editor']
                    )}
                    OR ${IS_SUPERUSER_SQL}
                )
                WITH CHECK (
                    ${buildActiveMembershipExistsSql(
                        '(SELECT c.application_id FROM applications.obj_connectors c WHERE c.id = applications.rel_connector_publications.connector_id)',
                        ['owner', 'admin', 'editor']
                    )}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        }
    ],
    down: [
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.updateAliases, 'applications', 'obj_application_aliases'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.createAliases, 'applications', 'obj_application_aliases'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.readAliases, 'applications', 'obj_application_aliases'),
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
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.updateConnectors, 'applications', 'obj_connectors'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.insertConnectors, 'applications', 'obj_connectors'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.readConnectors, 'applications', 'obj_connectors'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.updateApps, 'applications', 'obj_applications'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.createApps, 'applications', 'obj_applications'),
        createDropPolicyIfTableExistsStatement(APPLICATION_POLICY_NAMES.readVisibleApps, 'applications', 'obj_applications'),
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
            sql: `ALTER TABLE applications.obj_connectors DISABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `ALTER TABLE applications.obj_applications DISABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `ALTER TABLE applications.rel_application_users DISABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `ALTER TABLE applications.obj_application_aliases DISABLE ROW LEVEL SECURITY;`
        },
        {
            sql: `DROP TRIGGER IF EXISTS applications_validate_application_alias ON applications.obj_application_aliases`
        },
        {
            sql: `DROP FUNCTION IF EXISTS applications.validate_application_alias()`
        },
        {
            sql: `DROP FUNCTION IF EXISTS applications.create_application_alias(UUID, TEXT, BOOLEAN, UUID)`
        },
        {
            sql: `DROP FUNCTION IF EXISTS applications.update_application_alias_routing_mode(UUID, TEXT, UUID)`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.uq_application_aliases_active_primary`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.uq_application_aliases_active_alias`
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
            sql: `DROP INDEX IF EXISTS applications.idx_applications_deleted`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.idx_applications_users_active`
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
            sql: `DROP TABLE IF EXISTS applications.obj_connectors`
        },
        {
            sql: `DROP TABLE IF EXISTS applications.rel_application_users`
        },
        {
            sql: `DROP TABLE IF EXISTS applications.obj_application_aliases`
        },
        {
            sql: `DROP TABLE IF EXISTS applications.obj_applications`
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
const definitionGeneratedTableStatementRe =
    /CREATE TABLE IF NOT EXISTS applications\.(?:obj_applications|obj_connectors|rel_connector_publications|rel_application_users)\b/iu
const applicationsSchemaPostStatements = createApplicationsSchemaMigrationDefinition.up.filter(
    (statement) => !applicationsSchemaPreludeStatements.includes(statement) && !definitionGeneratedTableStatementRe.test(statement.sql)
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
ALTER TABLE applications.obj_applications
ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;
            `
        },
        {
            sql: `
UPDATE applications.obj_applications
SET settings = '{}'::jsonb
WHERE settings IS NULL;
            `
        }
    ] as const,
    down: [
        {
            sql: `
ALTER TABLE applications.obj_applications
DROP COLUMN IF EXISTS settings;
            `
        }
    ] as const
}
