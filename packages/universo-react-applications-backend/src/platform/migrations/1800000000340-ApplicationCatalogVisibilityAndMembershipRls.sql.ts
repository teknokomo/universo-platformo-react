import type { SqlMigrationDefinition } from './1800000000000-CreateApplicationsSchema.sql'

const AUTH_UID_SQL = '(SELECT auth.uid())'
const IS_SUPERUSER_SQL = `(SELECT admin.is_superuser(${AUTH_UID_SQL}))`
const APPLICATION_ALIAS_PERMISSION_SQL = (action: 'read' | 'create' | 'update' | 'delete' | 'manage'): string =>
    `(SELECT admin.has_permission(${AUTH_UID_SQL}, 'applicationAliases', '${action}', '{}'::jsonb))`
const APPLICATION_ALIAS_APPLICATION_READER_SQL = `(
    ${IS_SUPERUSER_SQL}
    OR ${['read', 'create', 'update', 'delete', 'manage']
        .map((action) => APPLICATION_ALIAS_PERMISSION_SQL(action as 'read' | 'create' | 'update' | 'delete' | 'manage'))
        .join('\n    OR ')}
)`
const APPLICATION_ALIAS_READER_SQL = `(
    ${IS_SUPERUSER_SQL}
    OR ${APPLICATION_ALIAS_PERMISSION_SQL('read')}
    OR ${APPLICATION_ALIAS_PERMISSION_SQL('manage')}
)`

const activeMembershipSql = (applicationIdSql: string, roles?: readonly ('owner' | 'admin' | 'editor' | 'member')[]): string => {
    const rolesSql = roles?.length ? `ARRAY[${roles.map((role) => `'${role}'`).join(', ')}]::text[]` : 'NULL::text[]'
    return `applications.has_active_application_membership(${applicationIdSql}, ${rolesSql})`
}

const connectorApplicationIdSql =
    '(SELECT c.application_id FROM applications.obj_connectors AS c WHERE c.id = applications.rel_connector_publications.connector_id)'

export const addApplicationCatalogVisibilityAndMembershipRlsMigrationDefinition: SqlMigrationDefinition = {
    id: 'AddApplicationCatalogVisibilityAndMembershipRls1800000000340',
    version: '1800000000340',
    summary: 'Add application catalog visibility and non-recursive membership RLS checks',
    up: [
        {
            sql: `
                DROP POLICY IF EXISTS "Allow users to manage their application memberships"
                ON applications.rel_application_users
            `
        },
        {
            sql: `
                DROP POLICY IF EXISTS "Allow users to manage their own applications"
                ON applications.obj_applications
            `
        },
        {
            sql: `
                ALTER TABLE applications.obj_applications
                    ADD COLUMN IF NOT EXISTS show_in_app_list BOOLEAN NOT NULL DEFAULT true
            `
        },
        {
            sql: `
                CREATE OR REPLACE FUNCTION applications.has_active_application_membership(
                    p_application_id UUID,
                    p_roles TEXT[]
                )
                RETURNS BOOLEAN
                LANGUAGE sql
                STABLE
                SECURITY DEFINER
                SET search_path = pg_catalog
                SET row_security = off
                AS $$
                    SELECT p_application_id IS NOT NULL
                       AND EXISTS (
                           SELECT 1
                           FROM applications.rel_application_users AS au
                           WHERE au.application_id = p_application_id
                             AND au.user_id = auth.uid()
                             AND au._upl_deleted = false
                             AND au._app_deleted = false
                             AND au._upl_archived = false
                             AND au._app_archived = false
                             AND (p_roles IS NULL OR au.role = ANY (p_roles))
                       )
                $$
            `
        },
        {
            sql: `REVOKE ALL ON FUNCTION applications.has_active_application_membership(UUID, TEXT[]) FROM PUBLIC`
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                        GRANT EXECUTE ON FUNCTION applications.has_active_application_membership(UUID, TEXT[]) TO authenticated;
                        GRANT USAGE ON SCHEMA applications TO authenticated;
                        GRANT SELECT ON TABLE applications.obj_application_aliases TO authenticated;
                    END IF;

                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
                        GRANT ALL ON TABLE applications.obj_application_aliases TO service_role;
                    END IF;
                END $$;
            `
        },
        {
            sql: `
                CREATE OR REPLACE FUNCTION applications.get_application_alias_for_management(
                    p_alias_id UUID,
                    p_user_id UUID,
                    p_action TEXT
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
                SET search_path = pg_catalog
                SET row_security = off
                AS $$
                DECLARE
                    v_application_id UUID;
                BEGIN
                    IF p_user_id IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
                        RAISE EXCEPTION 'Application alias management actor is invalid' USING ERRCODE = '42501';
                    END IF;

                    IF p_action IS NULL OR p_action NOT IN ('update', 'delete') THEN
                        RAISE EXCEPTION 'Application alias management action is invalid' USING ERRCODE = '42501';
                    END IF;

                    IF NOT (
                        admin.is_superuser(p_user_id)
                        OR admin.has_permission(p_user_id, 'applicationAliases', p_action, '{}'::jsonb)
                        OR admin.has_permission(p_user_id, 'applicationAliases', 'manage', '{}'::jsonb)
                    ) THEN
                        RAISE EXCEPTION 'Application alias management permission denied' USING ERRCODE = '42501';
                    END IF;

                    SELECT aa.application_id
                    INTO v_application_id
                    FROM applications.obj_application_aliases AS aa
                    WHERE aa.id = p_alias_id
                      AND aa._upl_deleted = false
                      AND aa._app_deleted = false
                      AND aa._upl_archived = false
                      AND aa._app_archived = false;

                    IF NOT FOUND THEN
                        RETURN;
                    END IF;

                    PERFORM pg_advisory_xact_lock(hashtext('application-aliases:' || v_application_id::text));

                    RETURN QUERY
                    SELECT aa.id,
                           aa.application_id,
                           aa.alias,
                           aa.is_primary,
                           aa.released_at,
                           aa._upl_created_at,
                           aa._upl_updated_at
                    FROM applications.obj_application_aliases AS aa
                    WHERE aa.id = p_alias_id
                      AND aa._upl_deleted = false
                      AND aa._app_deleted = false
                      AND aa._upl_archived = false
                      AND aa._app_archived = false
                    FOR UPDATE;
                END;
                $$
            `
        },
        {
            sql: `REVOKE ALL ON FUNCTION applications.get_application_alias_for_management(UUID, UUID, TEXT) FROM PUBLIC`
        },
        {
            sql: `
                CREATE OR REPLACE FUNCTION applications.mutate_application_alias(
                    p_alias_id UUID,
                    p_alias TEXT,
                    p_operation TEXT,
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
                SET search_path = pg_catalog
                SET row_security = off
                AS $$
                DECLARE
                    v_application_id UUID;
                    v_required_action TEXT;
                    v_routing_mode TEXT;
                    v_primary_alias_id UUID;
                    v_released_alias applications.obj_application_aliases%ROWTYPE;
                BEGIN
                    IF p_user_id IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
                        RAISE EXCEPTION 'Application alias mutation actor is invalid' USING ERRCODE = '42501';
                    END IF;

                    IF p_operation IS NULL OR p_operation NOT IN ('rename', 'set_primary', 'release') THEN
                        RAISE EXCEPTION 'Application alias mutation operation is invalid' USING ERRCODE = '42501';
                    END IF;

                    v_required_action := CASE WHEN p_operation = 'release' THEN 'delete' ELSE 'update' END;
                    IF NOT (
                        admin.is_superuser(p_user_id)
                        OR admin.has_permission(p_user_id, 'applicationAliases', v_required_action, '{}'::jsonb)
                        OR admin.has_permission(p_user_id, 'applicationAliases', 'manage', '{}'::jsonb)
                    ) THEN
                        RAISE EXCEPTION 'Application alias mutation permission denied' USING ERRCODE = '42501';
                    END IF;

                    IF p_operation = 'rename' AND p_alias IS NULL THEN
                        RAISE EXCEPTION 'Application alias value is required' USING ERRCODE = '22023';
                    END IF;

                    SELECT aa.application_id
                    INTO v_application_id
                    FROM applications.obj_application_aliases AS aa
                    WHERE aa.id = p_alias_id
                      AND aa._upl_deleted = false
                      AND aa._app_deleted = false
                      AND aa._upl_archived = false
                      AND aa._app_archived = false;

                    IF NOT FOUND THEN
                        RETURN;
                    END IF;

                    PERFORM pg_advisory_xact_lock(hashtext('application-aliases:' || v_application_id::text));

                    IF p_operation = 'rename' THEN
                        RETURN QUERY
                        UPDATE applications.obj_application_aliases AS aa
                        SET alias = p_alias,
                            _upl_updated_at = now(),
                            _upl_updated_by = p_user_id,
                            _upl_version = aa._upl_version + 1
                        WHERE aa.id = p_alias_id
                          AND aa.released_at IS NULL
                          AND aa._upl_deleted = false
                          AND aa._app_deleted = false
                          AND aa._upl_archived = false
                          AND aa._app_archived = false
                        RETURNING aa.id, aa.application_id, aa.alias, aa.is_primary, aa.released_at,
                                  aa._upl_created_at, aa._upl_updated_at;
                        RETURN;
                    END IF;

                    IF p_operation = 'set_primary' THEN
                        UPDATE applications.obj_application_aliases AS aa
                        SET is_primary = false,
                            _upl_updated_at = now(),
                            _upl_updated_by = p_user_id,
                            _upl_version = aa._upl_version + 1
                        WHERE aa.application_id = v_application_id
                          AND aa.id <> p_alias_id
                          AND aa.released_at IS NULL
                          AND aa.is_primary = true
                          AND aa._upl_deleted = false
                          AND aa._app_deleted = false
                          AND aa._upl_archived = false
                          AND aa._app_archived = false;

                        RETURN QUERY
                        UPDATE applications.obj_application_aliases AS aa
                        SET is_primary = true,
                            _upl_updated_at = now(),
                            _upl_updated_by = p_user_id,
                            _upl_version = aa._upl_version + 1
                        WHERE aa.id = p_alias_id
                          AND aa.application_id = v_application_id
                          AND aa.released_at IS NULL
                          AND aa._upl_deleted = false
                          AND aa._app_deleted = false
                          AND aa._upl_archived = false
                          AND aa._app_archived = false
                        RETURNING aa.id, aa.application_id, aa.alias, aa.is_primary, aa.released_at,
                                  aa._upl_created_at, aa._upl_updated_at;
                        RETURN;
                    END IF;

                    UPDATE applications.obj_application_aliases AS aa
                    SET is_primary = false,
                        released_at = now(),
                        _upl_updated_at = now(),
                        _upl_updated_by = p_user_id,
                        _upl_version = aa._upl_version + 1
                    WHERE aa.id = p_alias_id
                      AND aa.released_at IS NULL
                      AND aa._upl_deleted = false
                      AND aa._app_deleted = false
                      AND aa._upl_archived = false
                      AND aa._app_archived = false
                    RETURNING aa.* INTO v_released_alias;

                    IF NOT FOUND THEN
                        RETURN;
                    END IF;

                    SELECT a.alias_routing_mode::text
                    INTO v_routing_mode
                    FROM applications.obj_applications AS a
                    WHERE a.id = v_application_id;

                    IF v_routing_mode = 'canonical' THEN
                        SELECT aa.id
                        INTO v_primary_alias_id
                        FROM applications.obj_application_aliases AS aa
                        WHERE aa.application_id = v_application_id
                          AND aa.released_at IS NULL
                          AND aa._upl_deleted = false
                          AND aa._app_deleted = false
                          AND aa._upl_archived = false
                          AND aa._app_archived = false
                        ORDER BY aa.is_primary DESC, aa._upl_created_at ASC, aa.id ASC
                        LIMIT 1
                        FOR UPDATE;

                        IF FOUND THEN
                            UPDATE applications.obj_application_aliases AS aa
                            SET is_primary = (aa.id = v_primary_alias_id),
                                _upl_updated_at = now(),
                                _upl_updated_by = p_user_id,
                                _upl_version = aa._upl_version + 1
                            WHERE aa.application_id = v_application_id
                              AND aa.released_at IS NULL
                              AND aa._upl_deleted = false
                              AND aa._app_deleted = false
                              AND aa._upl_archived = false
                              AND aa._app_archived = false
                              AND aa.is_primary IS DISTINCT FROM (aa.id = v_primary_alias_id);
                        END IF;
                    END IF;

                    id := v_released_alias.id;
                    application_id := v_released_alias.application_id;
                    alias := v_released_alias.alias;
                    is_primary := v_released_alias.is_primary;
                    released_at := v_released_alias.released_at;
                    created_at := v_released_alias._upl_created_at;
                    updated_at := v_released_alias._upl_updated_at;
                    RETURN NEXT;
                    RETURN;
                END;
                $$
            `
        },
        {
            sql: `REVOKE ALL ON FUNCTION applications.mutate_application_alias(UUID, TEXT, TEXT, UUID) FROM PUBLIC`
        },
        {
            sql: `
                CREATE OR REPLACE FUNCTION applications.ensure_application_alias_primary(
                    p_application_id UUID,
                    p_user_id UUID
                )
                RETURNS VOID
                LANGUAGE plpgsql
                SECURITY DEFINER
                SET search_path = pg_catalog
                SET row_security = off
                AS $$
                DECLARE
                    v_primary_alias_id UUID;
                BEGIN
                    IF p_user_id IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
                        RAISE EXCEPTION 'Application alias primary actor is invalid' USING ERRCODE = '42501';
                    END IF;

                    IF p_application_id IS NULL THEN
                        RAISE EXCEPTION 'Application alias primary application is required' USING ERRCODE = '22023';
                    END IF;

                    IF NOT (
                        admin.is_superuser(p_user_id)
                        OR admin.has_permission(p_user_id, 'applicationAliases', 'update', '{}'::jsonb)
                        OR admin.has_permission(p_user_id, 'applicationAliases', 'manage', '{}'::jsonb)
                    ) THEN
                        RAISE EXCEPTION 'Application alias primary permission denied' USING ERRCODE = '42501';
                    END IF;

                    PERFORM pg_advisory_xact_lock(hashtext('application-aliases:' || p_application_id::text));

                    SELECT aa.id
                    INTO v_primary_alias_id
                    FROM applications.obj_application_aliases AS aa
                    WHERE aa.application_id = p_application_id
                      AND aa.released_at IS NULL
                      AND aa._upl_deleted = false
                      AND aa._app_deleted = false
                      AND aa._upl_archived = false
                      AND aa._app_archived = false
                    ORDER BY aa.is_primary DESC, aa._upl_created_at ASC, aa.id ASC
                    LIMIT 1
                    FOR UPDATE;

                    IF NOT FOUND THEN
                        RETURN;
                    END IF;

                    UPDATE applications.obj_application_aliases AS aa
                    SET is_primary = (aa.id = v_primary_alias_id),
                        _upl_updated_at = now(),
                        _upl_updated_by = p_user_id,
                        _upl_version = aa._upl_version + 1
                    WHERE aa.application_id = p_application_id
                      AND aa.released_at IS NULL
                      AND aa._upl_deleted = false
                      AND aa._app_deleted = false
                      AND aa._upl_archived = false
                      AND aa._app_archived = false
                      AND aa.is_primary IS DISTINCT FROM (aa.id = v_primary_alias_id);
                END;
                $$
            `
        },
        {
            sql: `REVOKE ALL ON FUNCTION applications.ensure_application_alias_primary(UUID, UUID) FROM PUBLIC`
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                        GRANT EXECUTE ON FUNCTION applications.get_application_alias_for_management(UUID, UUID, TEXT) TO authenticated;
                        GRANT EXECUTE ON FUNCTION applications.mutate_application_alias(UUID, TEXT, TEXT, UUID) TO authenticated;
                        GRANT EXECUTE ON FUNCTION applications.ensure_application_alias_primary(UUID, UUID) TO authenticated;
                    END IF;
                END $$;
            `
        },
        {
            sql: `
                ALTER POLICY "Allow users to read application memberships"
                ON applications.rel_application_users
                USING (
                    user_id = ${AUTH_UID_SQL}
                    OR ${activeMembershipSql('applications.rel_application_users.application_id')}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                ALTER POLICY "Allow app owners and admins to insert memberships"
                ON applications.rel_application_users
                WITH CHECK (
                    (
                        ${activeMembershipSql('applications.rel_application_users.application_id', ['owner', 'admin'])}
                        AND role IN ('member', 'editor', 'admin')
                    )
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                ALTER POLICY "Allow app owners and admins to update memberships"
                ON applications.rel_application_users
                USING (
                    ${activeMembershipSql('applications.rel_application_users.application_id', ['owner', 'admin'])}
                    OR ${IS_SUPERUSER_SQL}
                )
                WITH CHECK (
                    (
                        role IN ('member', 'editor', 'admin')
                        OR (_upl_deleted = true AND _app_deleted = true)
                    )
                    AND (
                        ${activeMembershipSql('applications.rel_application_users.application_id', ['owner', 'admin'])}
                        OR ${IS_SUPERUSER_SQL}
                    )
                )
            `
        },
        {
            sql: `
                ALTER POLICY "Allow users to read visible applications"
                ON applications.obj_applications
                USING (
                    is_public = true
                    OR ${activeMembershipSql('applications.obj_applications.id')}
                    OR ${IS_SUPERUSER_SQL}
                    OR ${APPLICATION_ALIAS_APPLICATION_READER_SQL}
                )
            `
        },
        {
            sql: `
                ALTER POLICY "Allow application alias managers to read aliases"
                ON applications.obj_application_aliases
                USING (
                    ${APPLICATION_ALIAS_READER_SQL}
                    OR ${activeMembershipSql('applications.obj_application_aliases.application_id', ['owner', 'admin'])}
                )
            `
        },
        {
            sql: `
                ALTER POLICY "Allow app owners and admins to update applications"
                ON applications.obj_applications
                USING (
                    ${activeMembershipSql('applications.obj_applications.id', ['owner', 'admin'])}
                    OR ${IS_SUPERUSER_SQL}
                )
                WITH CHECK (
                    ${activeMembershipSql('applications.obj_applications.id', ['owner', 'admin'])}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                ALTER POLICY "Allow users to read connectors in joined applications"
                ON applications.obj_connectors
                USING (
                    ${activeMembershipSql('applications.obj_connectors.application_id')}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                ALTER POLICY "Allow app editors to insert connectors"
                ON applications.obj_connectors
                WITH CHECK (
                    ${activeMembershipSql('applications.obj_connectors.application_id', ['owner', 'admin', 'editor'])}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                ALTER POLICY "Allow app editors to update connectors"
                ON applications.obj_connectors
                USING (
                    ${activeMembershipSql('applications.obj_connectors.application_id', ['owner', 'admin', 'editor'])}
                    OR ${IS_SUPERUSER_SQL}
                )
                WITH CHECK (
                    ${activeMembershipSql('applications.obj_connectors.application_id', ['owner', 'admin', 'editor'])}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                ALTER POLICY "Allow users to read connector publications in joined applications"
                ON applications.rel_connector_publications
                USING (
                    ${activeMembershipSql(connectorApplicationIdSql)}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                ALTER POLICY "Allow app editors to insert connector publications"
                ON applications.rel_connector_publications
                WITH CHECK (
                    ${activeMembershipSql(connectorApplicationIdSql, ['owner', 'admin', 'editor'])}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        },
        {
            sql: `
                ALTER POLICY "Allow app editors to update connector publications"
                ON applications.rel_connector_publications
                USING (
                    ${activeMembershipSql(connectorApplicationIdSql, ['owner', 'admin', 'editor'])}
                    OR ${IS_SUPERUSER_SQL}
                )
                WITH CHECK (
                    ${activeMembershipSql(connectorApplicationIdSql, ['owner', 'admin', 'editor'])}
                    OR ${IS_SUPERUSER_SQL}
                )
            `
        }
    ],
    down: []
}
