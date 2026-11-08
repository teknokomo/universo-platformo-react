import type { SqlMigrationDefinition } from './1800000000000-CreateApplicationsSchema.sql'

const AUTH_UID_SQL = '(SELECT auth.uid())'
const IS_SUPERUSER_SQL = `(SELECT admin.is_superuser(${AUTH_UID_SQL}))`

const activeMembershipSql = (applicationIdSql: string, roles?: readonly ('owner' | 'admin' | 'editor' | 'member')[]): string => {
    const rolesSql = roles?.length ? `ARRAY[${roles.map((role) => `'${role}'`).join(', ')}]::text[]` : 'NULL::text[]'
    return `applications.has_active_application_membership(${applicationIdSql}, ${rolesSql})`
}

const dropThemePresetPolicyStatement = (policyName: string, tableName: string) => ({
    sql: `
        DO $$
        BEGIN
            IF to_regclass('applications.${tableName}') IS NOT NULL THEN
                EXECUTE format('DROP POLICY IF EXISTS %I ON applications.%I', '${policyName}', '${tableName}');
            END IF;
        END $$;
    `
})

export const createThemePresetsMigrationDefinition: SqlMigrationDefinition = {
    id: 'CreateThemePresets1800000000350',
    version: '1800000000350',
    summary: 'Create application-scoped theme presets and append-only theme preset audits with membership RLS',
    up: [
        {
            sql: `
                CREATE TABLE IF NOT EXISTS applications.obj_theme_presets (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    application_id UUID NOT NULL REFERENCES applications.obj_applications(id),
                    codename VARCHAR(64) NOT NULL,
                    name JSONB NOT NULL DEFAULT '{}'::jsonb,
                    description JSONB NOT NULL DEFAULT '{}'::jsonb,
                    tokens JSONB NOT NULL,
                    base_preset_id UUID NULL REFERENCES applications.obj_theme_presets(id),
                    base_preset_codename VARCHAR(64) NULL,
                    schema_version INTEGER NOT NULL DEFAULT 1,
                    _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    _upl_created_by UUID,
                    _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    _upl_updated_by UUID,
                    _upl_version INTEGER NOT NULL DEFAULT 1,
                    _upl_archived BOOLEAN NOT NULL DEFAULT false,
                    _upl_archived_at TIMESTAMPTZ,
                    _upl_archived_by UUID,
                    _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                    _upl_deleted_at TIMESTAMPTZ,
                    _upl_deleted_by UUID,
                    _upl_purge_after TIMESTAMPTZ,
                    CONSTRAINT app_theme_presets_codename_ck
                        CHECK (codename ~ '^[a-z][a-z0-9-]{2,63}$'),
                    CONSTRAINT app_theme_presets_tokens_object_ck
                        CHECK (jsonb_typeof(tokens) = 'object'),
                    CONSTRAINT app_theme_presets_tokens_size_ck
                        CHECK (pg_column_size(tokens) <= 65536)
                )
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX IF NOT EXISTS uq_app_theme_presets_codename_active
                    ON applications.obj_theme_presets (application_id, codename)
                    WHERE _upl_deleted = false
            `
        },
        {
            sql: `
                CREATE INDEX IF NOT EXISTS idx_app_theme_presets_application_active
                    ON applications.obj_theme_presets (application_id)
                    WHERE _upl_deleted = false AND _upl_archived = false
            `
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'app_theme_presets_codename_ck'
                    ) THEN
                        ALTER TABLE applications.obj_theme_presets
                            ADD CONSTRAINT app_theme_presets_codename_ck CHECK (codename ~ '^[a-z][a-z0-9-]{2,63}$');
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'app_theme_presets_tokens_object_ck'
                    ) THEN
                        ALTER TABLE applications.obj_theme_presets
                            ADD CONSTRAINT app_theme_presets_tokens_object_ck CHECK (jsonb_typeof(tokens) = 'object');
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'app_theme_presets_tokens_size_ck'
                    ) THEN
                        ALTER TABLE applications.obj_theme_presets
                            ADD CONSTRAINT app_theme_presets_tokens_size_ck CHECK (pg_column_size(tokens) <= 65536);
                    END IF;
                END $$;
            `
        },
        {
            sql: `
                CREATE TABLE IF NOT EXISTS applications.rel_theme_preset_audits (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    application_id UUID NOT NULL REFERENCES applications.obj_applications(id),
                    preset_id UUID NULL REFERENCES applications.obj_theme_presets(id),
                    event_type VARCHAR(48) NOT NULL,
                    changed_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
                    previous_version INTEGER,
                    new_version INTEGER,
                    actor UUID,
                    _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `
        },
        {
            sql: `
                CREATE INDEX IF NOT EXISTS idx_app_theme_preset_audits_application
                    ON applications.rel_theme_preset_audits (application_id, _upl_created_at DESC)
            `
        },
        {
            sql: `
                CREATE OR REPLACE FUNCTION applications.reject_theme_preset_audit_mutation()
                RETURNS trigger
                LANGUAGE plpgsql
                SET search_path = pg_catalog, pg_temp
                AS $$
                BEGIN
                    RAISE EXCEPTION 'Theme preset audit records are immutable'
                        USING ERRCODE = '23514';
                END;
                $$
            `
        },
        {
            sql: `
                DROP TRIGGER IF EXISTS trg_theme_preset_audits_immutable ON applications.rel_theme_preset_audits
            `
        },
        {
            sql: `
                CREATE TRIGGER trg_theme_preset_audits_immutable
                    BEFORE UPDATE OR DELETE ON applications.rel_theme_preset_audits
                    FOR EACH ROW EXECUTE FUNCTION applications.reject_theme_preset_audit_mutation()
            `
        },
        {
            sql: `
                ALTER TABLE applications.obj_theme_presets ENABLE ROW LEVEL SECURITY
            `
        },
        {
            sql: `
                ALTER TABLE applications.rel_theme_preset_audits ENABLE ROW LEVEL SECURITY
            `
        },
        dropThemePresetPolicyStatement('Allow application members to read theme presets', 'obj_theme_presets'),
        {
            sql: `
                CREATE POLICY "Allow application members to read theme presets"
                    ON applications.obj_theme_presets
                    FOR SELECT
                    USING (
                        ${activeMembershipSql('application_id')}
                        OR ${IS_SUPERUSER_SQL}
                    )
            `
        },
        dropThemePresetPolicyStatement('Allow application managers to manage theme presets', 'obj_theme_presets'),
        {
            sql: `
                CREATE POLICY "Allow application managers to manage theme presets"
                    ON applications.obj_theme_presets
                    FOR ALL
                    USING (
                        ${activeMembershipSql('application_id', ['owner', 'admin'])}
                        OR ${IS_SUPERUSER_SQL}
                    )
                    WITH CHECK (
                        ${activeMembershipSql('application_id', ['owner', 'admin'])}
                        OR ${IS_SUPERUSER_SQL}
                    )
            `
        },
        dropThemePresetPolicyStatement('Allow application members to read theme preset audits', 'rel_theme_preset_audits'),
        {
            sql: `
                CREATE POLICY "Allow application members to read theme preset audits"
                    ON applications.rel_theme_preset_audits
                    FOR SELECT
                    USING (
                        ${activeMembershipSql('application_id')}
                        OR ${IS_SUPERUSER_SQL}
                    )
            `
        },
        dropThemePresetPolicyStatement('Allow application managers to insert theme preset audits', 'rel_theme_preset_audits'),
        {
            sql: `
                CREATE POLICY "Allow application managers to insert theme preset audits"
                    ON applications.rel_theme_preset_audits
                    FOR INSERT
                    WITH CHECK (
                        ${activeMembershipSql('application_id', ['owner', 'admin'])}
                        OR ${IS_SUPERUSER_SQL}
                    )
            `
        },
        {
            sql: `REVOKE ALL ON TABLE applications.obj_theme_presets FROM PUBLIC`
        },
        {
            sql: `REVOKE ALL ON TABLE applications.obj_theme_presets FROM anon`
        },
        {
            sql: `REVOKE ALL ON TABLE applications.rel_theme_preset_audits FROM PUBLIC`
        },
        {
            sql: `REVOKE ALL ON TABLE applications.rel_theme_preset_audits FROM anon`
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE applications.obj_theme_presets TO authenticated;
                        GRANT SELECT, INSERT ON TABLE applications.rel_theme_preset_audits TO authenticated;
                    END IF;

                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
                        GRANT ALL ON TABLE applications.obj_theme_presets TO service_role;
                        GRANT ALL ON TABLE applications.rel_theme_preset_audits TO service_role;
                    END IF;
                END $$;
            `
        }
    ],
    down: []
}
