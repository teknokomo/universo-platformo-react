import type { SqlMigrationDefinition } from './1800000000000-CreateApplicationsSchema.sql'

const resolveGlobalShortLinkFunction = (includeAccessLinkId: boolean) => `
    CREATE OR REPLACE FUNCTION applications.resolve_global_short_link(p_slug TEXT)
    RETURNS TABLE (
        id UUID,
        slug TEXT,
        target_kind TEXT,
        application_id UUID,
        section_key TEXT,
        ${includeAccessLinkId ? 'access_link_id UUID,' : ''}
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
            ${includeAccessLinkId ? 'link.access_link_id,' : ''}
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
          ${includeAccessLinkId ? "AND (link.target_kind <> 'lms-access-link' OR link.access_link_id IS NOT NULL)" : ''}
        LIMIT 1
    $$
`

export const bindGlobalShortLinksToAccessLinkIdentityMigrationDefinition: SqlMigrationDefinition = {
    id: 'BindGlobalShortLinksToAccessLinkIdentity1800000000310',
    version: '1800000000310',
    summary: 'Bind public LMS short links to immutable AccessLink identities',
    up: [
        {
            sql: `ALTER TABLE applications.obj_global_short_links ADD COLUMN IF NOT EXISTS access_link_id UUID`
        },
        {
            sql: `
                CREATE INDEX IF NOT EXISTS idx_global_short_links_access_link_active
                ON applications.obj_global_short_links (application_id, access_link_id)
                WHERE target_kind = 'lms-access-link'
                  AND released_at IS NULL
                  AND _upl_archived = false
                  AND _upl_deleted = false
                  AND _app_archived = false
                  AND _app_deleted = false
            `
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'global_short_links_access_link_identity_ck'
                          AND conrelid = 'applications.obj_global_short_links'::regclass
                    ) THEN
                        ALTER TABLE applications.obj_global_short_links
                        ADD CONSTRAINT global_short_links_access_link_identity_ck
                        CHECK (
                            access_link_id IS NULL
                            OR (
                                target_kind = 'lms-access-link'
                                AND substring(access_link_id::text FROM 15 FOR 1) = '7'
                                AND lower(substring(access_link_id::text FROM 20 FOR 1)) IN ('8', '9', 'a', 'b')
                            )
                        );
                    END IF;
                END
                $$
            `
        },
        {
            sql: `DROP FUNCTION applications.resolve_global_short_link(TEXT)`
        },
        {
            sql: resolveGlobalShortLinkFunction(true)
        },
        {
            sql: `REVOKE ALL ON FUNCTION applications.resolve_global_short_link(TEXT) FROM PUBLIC, anon, authenticated`
        },
        {
            sql: `GRANT EXECUTE ON FUNCTION applications.resolve_global_short_link(TEXT) TO service_role`
        },
        {
            sql: `GRANT INSERT (access_link_id) ON TABLE applications.obj_global_short_links TO authenticated`
        }
    ],
    down: [
        {
            sql: `REVOKE INSERT (access_link_id) ON TABLE applications.obj_global_short_links FROM authenticated`
        },
        {
            sql: `DROP FUNCTION applications.resolve_global_short_link(TEXT)`
        },
        {
            sql: resolveGlobalShortLinkFunction(false)
        },
        {
            sql: `REVOKE ALL ON FUNCTION applications.resolve_global_short_link(TEXT) FROM PUBLIC, anon, authenticated`
        },
        {
            sql: `GRANT EXECUTE ON FUNCTION applications.resolve_global_short_link(TEXT) TO service_role`
        },
        {
            sql: `ALTER TABLE applications.obj_global_short_links DROP CONSTRAINT IF EXISTS global_short_links_access_link_identity_ck`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.idx_global_short_links_access_link_active`
        },
        {
            sql: `ALTER TABLE applications.obj_global_short_links DROP COLUMN IF EXISTS access_link_id`
        }
    ]
}
