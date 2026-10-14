import type { SqlMigrationDefinition } from './1800000000000-CreateApplicationsSchema.sql'

const GLOBAL_SHORT_LINK_APPLICATION_MANAGER_SQL = `(SELECT applications.can_manage_global_short_link_application(applications.obj_global_short_links.application_id))`

/**
 * Management of a global short link follows its target application's
 * manageApplication membership role; platform superusers retain a bypass.
 * The resolver exposes only the typed destination of an active slug.
 */
export const createGlobalShortLinksMigrationDefinition: SqlMigrationDefinition = {
    id: 'CreateGlobalShortLinks1800000000290',
    version: '1800000000290',
    summary: 'Create the platform-wide typed short-link registry',
    up: [
        {
            sql: `
                CREATE TABLE IF NOT EXISTS applications.obj_global_short_links (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    slug VARCHAR(63) NOT NULL,
                    target_kind VARCHAR(32) NOT NULL,
                    application_id UUID NOT NULL,
                    section_key VARCHAR(32),
                    access_link_slug VARCHAR(255),
                    access_link_workspace_id UUID,
                    resource_target_kind VARCHAR(16),
                    entity_type_codename VARCHAR(128),
                    released_at TIMESTAMPTZ,
                    released_by UUID,
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
                    _app_archived BOOLEAN NOT NULL DEFAULT false,
                    _app_archived_at TIMESTAMPTZ,
                    _app_archived_by UUID,
                    _app_deleted BOOLEAN NOT NULL DEFAULT false,
                    _app_deleted_at TIMESTAMPTZ,
                    _app_deleted_by UUID,
                    CONSTRAINT global_short_links_application_fk
                        FOREIGN KEY (application_id)
                        REFERENCES applications.obj_applications(id)
                        ON DELETE RESTRICT,
                    CONSTRAINT global_short_links_release_actor_ck
                        CHECK (released_at IS NULL OR released_by IS NOT NULL),
                    CONSTRAINT global_short_links_id_uuid_v7_ck
                        CHECK (
                            substring(id::text FROM 15 FOR 1) = '7'
                            AND lower(substring(id::text FROM 20 FOR 1)) IN ('8', '9', 'a', 'b')
                        ),
                    CONSTRAINT global_short_links_slug_format_ck
                        CHECK (
                            slug ~ '^([a-z0-9]|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$'
                            AND slug NOT IN (
                                'a', 'admin', 'api', 'applications', 'assets', 'auth', 'callback',
                                'dashboard', 'health', 'instances', 'l', 'login', 'logout',
                                'metahub', 'metahubs', 'metapanel', 'oauth', 'privacy', 'profile', 'public', 'robots',
                                'settings', 'start', 'status', 'terms', 'uploads', 'webhooks', 'well-known'
                            )
                            AND (
                                slug !~ '^[0-9a-f]{32}$'
                                OR (
                                    substring(slug FROM 13 FOR 1) = '7'
                                    AND substring(slug FROM 17 FOR 1) IN ('8', '9', 'a', 'b')
                                )
                            )
                            AND (
                                slug !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                                OR (
                                    substring(slug FROM 15 FOR 1) = '7'
                                    AND substring(slug FROM 20 FOR 1) IN ('8', '9', 'a', 'b')
                                )
                            )
                        ),
                    CONSTRAINT global_short_links_application_uuid_v7_ck
                        CHECK (
                            substring(application_id::text FROM 15 FOR 1) = '7'
                            AND lower(substring(application_id::text FROM 20 FOR 1)) IN ('8', '9', 'a', 'b')
                        ),
                    CONSTRAINT global_short_links_target_shape_ck
                        CHECK (
                            (
                                target_kind = 'application-entry'
                                AND section_key IS NULL
                                AND access_link_slug IS NULL
                                AND access_link_workspace_id IS NULL
                                AND resource_target_kind IS NULL
                                AND entity_type_codename IS NULL
                            )
                            OR (
                                target_kind = 'application-section'
                                AND section_key IS NOT NULL
                                AND section_key IN ('dashboard', 'workspace')
                                AND access_link_slug IS NULL
                                AND access_link_workspace_id IS NULL
                                AND resource_target_kind IS NULL
                                AND entity_type_codename IS NULL
                            )
                            OR (
                                target_kind = 'lms-access-link'
                                AND section_key IS NULL
                                AND access_link_slug IS NOT NULL
                                AND access_link_slug ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,254}$'
                                AND (
                                    access_link_workspace_id IS NULL
                                    OR (
                                        substring(access_link_workspace_id::text FROM 15 FOR 1) = '7'
                                        AND lower(substring(access_link_workspace_id::text FROM 20 FOR 1)) IN ('8', '9', 'a', 'b')
                                    )
                                )
                                AND resource_target_kind IS NULL
                                AND entity_type_codename IS NULL
                            )
                            OR (
                                target_kind = 'application-resource'
                                AND section_key IS NULL
                                AND access_link_slug IS NULL
                                AND access_link_workspace_id IS NULL
                                AND resource_target_kind IS NOT NULL
                                AND resource_target_kind IN ('page', 'object')
                                AND entity_type_codename IS NOT NULL
                                AND entity_type_codename ~ '^[A-Za-z][A-Za-z0-9._-]{0,127}$'
                            )
                        )
                )
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX IF NOT EXISTS uq_global_short_links_active_slug
                ON applications.obj_global_short_links (slug)
                WHERE released_at IS NULL
                  AND _upl_archived = false
                  AND _upl_deleted = false
                  AND _app_archived = false
                  AND _app_deleted = false
            `
        },
        {
            sql: `
                CREATE INDEX IF NOT EXISTS idx_global_short_links_application_active
                ON applications.obj_global_short_links (application_id, _upl_created_at DESC)
                WHERE _upl_archived = false
                  AND _upl_deleted = false
                  AND _app_archived = false
                  AND _app_deleted = false
            `
        },
        {
            sql: `
                CREATE OR REPLACE FUNCTION applications.resolve_global_short_link(p_slug TEXT)
                RETURNS TABLE (
                    id UUID,
                    slug TEXT,
                    target_kind TEXT,
                    application_id UUID,
                    section_key TEXT,
                    access_link_slug TEXT,
                    access_link_workspace_id UUID,
                    resource_target_kind TEXT,
                    entity_type_codename TEXT
                )
                LANGUAGE sql
                SECURITY DEFINER
                STABLE
                SET search_path = pg_catalog, pg_temp
                AS $$
                    SELECT
                        link.id,
                        link.slug::text,
                        link.target_kind::text,
                        link.application_id,
                        link.section_key::text,
                        link.access_link_slug::text,
                        link.access_link_workspace_id,
                        link.resource_target_kind::text,
                        link.entity_type_codename::text
                    FROM applications.obj_global_short_links AS link
                    INNER JOIN applications.obj_applications AS app ON app.id = link.application_id
                    WHERE link.slug = lower(btrim(p_slug))
                      AND link.released_at IS NULL
                      AND link._upl_archived = false
                      AND link._upl_deleted = false
                      AND link._app_archived = false
                      AND link._app_deleted = false
                      AND app._upl_archived = false
                      AND app._upl_deleted = false
                      AND app._app_archived = false
                      AND app._app_deleted = false
                    LIMIT 1
                $$
            `
        },
        {
            sql: `REVOKE ALL ON FUNCTION applications.resolve_global_short_link(TEXT) FROM PUBLIC, anon, authenticated`
        },
        {
            sql: `
                CREATE OR REPLACE FUNCTION applications.guard_global_short_link_release()
                RETURNS trigger
                LANGUAGE plpgsql
                SET search_path = pg_catalog, pg_temp
                AS $$
                BEGIN
                    IF OLD.released_at IS NOT NULL
                       AND (
                           NEW.released_at IS DISTINCT FROM OLD.released_at
                           OR NEW.released_by IS DISTINCT FROM OLD.released_by
                       ) THEN
                        RAISE EXCEPTION 'A released global short link cannot be reactivated or reassigned'
                            USING ERRCODE = '23514';
                    END IF;

                    IF NEW.released_at IS NOT NULL AND NEW.released_by IS NULL THEN
                        RAISE EXCEPTION 'A released global short link requires a release actor'
                            USING ERRCODE = '23514';
                    END IF;

                    RETURN NEW;
                END;
                $$
            `
        },
        {
            sql: `REVOKE ALL ON FUNCTION applications.guard_global_short_link_release() FROM PUBLIC`
        },
        {
            sql: `
                CREATE TRIGGER applications_guard_global_short_link_release
                BEFORE UPDATE OF released_at, released_by
                ON applications.obj_global_short_links
                FOR EACH ROW
                EXECUTE FUNCTION applications.guard_global_short_link_release()
            `
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
                        GRANT EXECUTE ON FUNCTION applications.resolve_global_short_link(TEXT) TO service_role;
                    END IF;
                END $$
            `
        },
        {
            sql: `ALTER TABLE applications.obj_global_short_links ENABLE ROW LEVEL SECURITY`
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                        GRANT USAGE ON SCHEMA applications TO authenticated;
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
                        GRANT USAGE ON SCHEMA applications TO service_role;
                    END IF;
                END $$
            `
        },
        {
            sql: `
                REVOKE ALL ON TABLE applications.obj_global_short_links FROM PUBLIC, anon, authenticated
            `
        },
        {
            sql: `GRANT SELECT ON TABLE applications.obj_global_short_links TO authenticated`
        },
        {
            sql: `
                GRANT INSERT (
                    id, slug, target_kind, application_id, section_key, access_link_slug,
                    access_link_workspace_id,
                    resource_target_kind, entity_type_codename,
                    _upl_created_by, _upl_updated_by
                ) ON TABLE applications.obj_global_short_links TO authenticated
            `
        },
        {
            sql: `
                GRANT UPDATE (released_at, released_by, _upl_updated_at, _upl_updated_by, _upl_version)
                ON TABLE applications.obj_global_short_links TO authenticated
            `
        },
        {
            sql: `GRANT ALL ON TABLE applications.obj_global_short_links TO service_role`
        },
        {
            sql: `
                CREATE OR REPLACE FUNCTION applications.can_manage_global_short_link_application(p_application_id UUID)
                RETURNS BOOLEAN
                LANGUAGE sql
                SECURITY DEFINER
                STABLE
                SET search_path = pg_catalog, pg_temp
                AS $$
                    SELECT
                        (SELECT admin.is_superuser((SELECT auth.uid())))
                        OR EXISTS (
                            SELECT 1
                            FROM applications.obj_applications AS app
                            INNER JOIN applications.rel_application_users AS au ON au.application_id = app.id
                            WHERE app.id = p_application_id
                              AND au.user_id = (SELECT auth.uid())
                              AND au.role IN ('owner', 'admin')
                              AND au._upl_archived = false
                              AND au._upl_deleted = false
                              AND au._app_archived = false
                              AND au._app_deleted = false
                              AND app._upl_archived = false
                              AND app._upl_deleted = false
                              AND app._app_archived = false
                              AND app._app_deleted = false
                        )
                $$
            `
        },
        {
            sql: `REVOKE ALL ON FUNCTION applications.can_manage_global_short_link_application(UUID) FROM PUBLIC, anon, authenticated`
        },
        {
            sql: `GRANT EXECUTE ON FUNCTION applications.can_manage_global_short_link_application(UUID) TO authenticated, service_role`
        },
        {
            sql: `
                CREATE OR REPLACE FUNCTION applications.lock_active_global_short_link_application(p_application_id UUID)
                RETURNS BOOLEAN
                LANGUAGE plpgsql
                SECURITY DEFINER
                VOLATILE
                SET search_path = pg_catalog, pg_temp
                AS $$
                DECLARE
                    locked_application_id UUID;
                BEGIN
                    SELECT app.id
                    INTO locked_application_id
                    FROM applications.obj_applications AS app
                    WHERE app.id = p_application_id
                      AND app._upl_deleted = false
                      AND app._app_deleted = false
                      AND applications.can_manage_global_short_link_application(app.id)
                    FOR SHARE;

                    RETURN locked_application_id IS NOT NULL;
                END
                $$
            `
        },
        {
            sql: `REVOKE ALL ON FUNCTION applications.lock_active_global_short_link_application(UUID) FROM PUBLIC, anon, authenticated`
        },
        {
            sql: `GRANT EXECUTE ON FUNCTION applications.lock_active_global_short_link_application(UUID) TO authenticated, service_role`
        },
        {
            sql: `
                CREATE POLICY "Allow application managers to read global short links"
                ON applications.obj_global_short_links
                FOR SELECT
                USING (${GLOBAL_SHORT_LINK_APPLICATION_MANAGER_SQL})
            `
        },
        {
            sql: `
                CREATE POLICY "Allow application managers to create global short links"
                ON applications.obj_global_short_links
                FOR INSERT
                WITH CHECK (
                    _upl_created_by = (SELECT auth.uid())
                    AND _upl_updated_by = (SELECT auth.uid())
                    AND ${GLOBAL_SHORT_LINK_APPLICATION_MANAGER_SQL}
                )
            `
        },
        {
            sql: `
                CREATE POLICY "Allow application managers to release global short links"
                ON applications.obj_global_short_links
                FOR UPDATE
                USING (${GLOBAL_SHORT_LINK_APPLICATION_MANAGER_SQL})
                WITH CHECK (
                    (
                        released_by = (SELECT auth.uid())
                        AND _upl_updated_by = (SELECT auth.uid())
                    )
                    AND ${GLOBAL_SHORT_LINK_APPLICATION_MANAGER_SQL}
                )
            `
        }
    ],
    down: [
        {
            sql: `DROP FUNCTION IF EXISTS applications.resolve_global_short_link(TEXT)`
        },
        {
            sql: `DROP TRIGGER IF EXISTS applications_guard_global_short_link_release ON applications.obj_global_short_links`
        },
        {
            sql: `DROP FUNCTION IF EXISTS applications.guard_global_short_link_release()`
        },
        {
            sql: `DROP TABLE IF EXISTS applications.obj_global_short_links`
        },
        {
            sql: `DROP FUNCTION IF EXISTS applications.lock_active_global_short_link_application(UUID)`
        },
        {
            sql: `DROP FUNCTION IF EXISTS applications.can_manage_global_short_link_application(UUID)`
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                        REVOKE USAGE ON SCHEMA applications FROM authenticated;
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
                        REVOKE USAGE ON SCHEMA applications FROM service_role;
                    END IF;
                END $$
            `
        }
    ]
}
