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

const APPLICATION_ALIAS_POLICY_NAMES = {
    readVisibleApps: 'Allow users to read visible applications',
    readAliases: 'Allow application alias managers to read aliases',
    createAliases: 'Allow application alias managers to create aliases',
    updateAliases: 'Allow application alias managers to update aliases'
} as const

export const addApplicationAliasesMigrationDefinition: SqlMigrationDefinition = {
    id: 'AddApplicationAliases1800000000101',
    version: '1800000000101',
    summary: 'Add deployment-wide application aliases, routing policy and the SECURITY DEFINER runtime reference resolver',
    up: [
        {
            sql: `
ALTER TABLE applications.obj_applications
ADD COLUMN IF NOT EXISTS alias_routing_mode VARCHAR(20) NOT NULL DEFAULT 'direct'
            `
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
CREATE OR REPLACE FUNCTION applications.resolve_application_alias(p_alias TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = applications, pg_catalog, pg_temp
AS $$
    SELECT CASE WHEN COUNT(*) = 1 THEN (ARRAY_AGG(aa.application_id))[1] END
    FROM applications.obj_application_aliases AS aa
    INNER JOIN applications.obj_applications AS a ON a.id = aa.application_id
    WHERE aa.alias = p_alias
      AND aa.released_at IS NULL
      AND aa._upl_deleted = false
      AND aa._app_deleted = false
      AND aa._upl_archived = false
      AND aa._app_archived = false
      AND a._upl_deleted = false
      AND a._app_deleted = false
      AND a._upl_archived = false
      AND a._app_archived = false
$$
            `
        },
        {
            sql: `REVOKE ALL ON FUNCTION applications.resolve_application_alias(TEXT) FROM PUBLIC`
        },
        {
            sql: `
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT EXECUTE ON FUNCTION applications.create_application_alias(UUID, TEXT, BOOLEAN, UUID) TO authenticated;
        GRANT EXECUTE ON FUNCTION applications.update_application_alias_routing_mode(UUID, TEXT, UUID) TO authenticated;
        GRANT EXECUTE ON FUNCTION applications.resolve_application_alias(TEXT) TO authenticated;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION applications.create_application_alias(UUID, TEXT, BOOLEAN, UUID) TO service_role;
        GRANT EXECUTE ON FUNCTION applications.update_application_alias_routing_mode(UUID, TEXT, UUID) TO service_role;
        GRANT EXECUTE ON FUNCTION applications.resolve_application_alias(TEXT) TO service_role;
    END IF;
END $$;
            `
        },
        {
            sql: `ALTER TABLE applications.obj_application_aliases ENABLE ROW LEVEL SECURITY;`
        },
        createDropPolicyIfTableExistsStatement(APPLICATION_ALIAS_POLICY_NAMES.readVisibleApps, 'applications', 'obj_applications'),
        {
            sql: `
CREATE POLICY "${APPLICATION_ALIAS_POLICY_NAMES.readVisibleApps}" ON applications.obj_applications
FOR SELECT
USING (
    is_public = true
    OR ${buildActiveMembershipExistsSql('applications.obj_applications.id')}
    OR ${IS_SUPERUSER_SQL}
    OR ${APPLICATION_ALIAS_READER_SQL}
)
            `
        },
        createDropPolicyIfTableExistsStatement(APPLICATION_ALIAS_POLICY_NAMES.readAliases, 'applications', 'obj_application_aliases'),
        {
            sql: `
CREATE POLICY "${APPLICATION_ALIAS_POLICY_NAMES.readAliases}" ON applications.obj_application_aliases
FOR SELECT
USING (${APPLICATION_ALIAS_READER_SQL})
            `
        },
        createDropPolicyIfTableExistsStatement(APPLICATION_ALIAS_POLICY_NAMES.createAliases, 'applications', 'obj_application_aliases'),
        {
            sql: `
CREATE POLICY "${APPLICATION_ALIAS_POLICY_NAMES.createAliases}" ON applications.obj_application_aliases
FOR INSERT
WITH CHECK (
    ${IS_SUPERUSER_SQL}
    OR ${APPLICATION_ALIAS_PERMISSION_SQL('create')}
    OR ${APPLICATION_ALIAS_PERMISSION_SQL('manage')}
)
            `
        },
        createDropPolicyIfTableExistsStatement(APPLICATION_ALIAS_POLICY_NAMES.updateAliases, 'applications', 'obj_application_aliases'),
        {
            sql: `
CREATE POLICY "${APPLICATION_ALIAS_POLICY_NAMES.updateAliases}" ON applications.obj_application_aliases
FOR UPDATE
USING (${APPLICATION_ALIAS_UPDATER_SQL})
WITH CHECK (${APPLICATION_ALIAS_UPDATER_SQL})
            `
        }
    ] as const,
    down: [
        createDropPolicyIfTableExistsStatement(APPLICATION_ALIAS_POLICY_NAMES.updateAliases, 'applications', 'obj_application_aliases'),
        createDropPolicyIfTableExistsStatement(APPLICATION_ALIAS_POLICY_NAMES.createAliases, 'applications', 'obj_application_aliases'),
        createDropPolicyIfTableExistsStatement(APPLICATION_ALIAS_POLICY_NAMES.readAliases, 'applications', 'obj_application_aliases'),
        createDropPolicyIfTableExistsStatement(APPLICATION_ALIAS_POLICY_NAMES.readVisibleApps, 'applications', 'obj_applications'),
        {
            sql: `
CREATE POLICY "${APPLICATION_ALIAS_POLICY_NAMES.readVisibleApps}" ON applications.obj_applications
FOR SELECT
USING (
    is_public = true
    OR ${buildActiveMembershipExistsSql('applications.obj_applications.id')}
    OR ${IS_SUPERUSER_SQL}
)
            `
        },
        { sql: `ALTER TABLE applications.obj_application_aliases DISABLE ROW LEVEL SECURITY;` },
        { sql: `DROP TRIGGER IF EXISTS applications_validate_application_alias ON applications.obj_application_aliases` },
        { sql: `DROP FUNCTION IF EXISTS applications.validate_application_alias()` },
        { sql: `DROP FUNCTION IF EXISTS applications.create_application_alias(UUID, TEXT, BOOLEAN, UUID)` },
        { sql: `DROP FUNCTION IF EXISTS applications.update_application_alias_routing_mode(UUID, TEXT, UUID)` },
        { sql: `DROP FUNCTION IF EXISTS applications.resolve_application_alias(TEXT)` },
        {
            sql: `DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'applications_alias_routing_mode_ck'
          AND conrelid = 'applications.obj_applications'::regclass
    ) THEN
        ALTER TABLE applications.obj_applications
            DROP CONSTRAINT applications_alias_routing_mode_ck;
    END IF;
END $$;`
        },
        { sql: `DROP INDEX IF EXISTS applications.uq_application_aliases_active_primary` },
        { sql: `DROP INDEX IF EXISTS applications.uq_application_aliases_active_alias` },
        { sql: `DROP TABLE IF EXISTS applications.obj_application_aliases` }
    ] as const
}
