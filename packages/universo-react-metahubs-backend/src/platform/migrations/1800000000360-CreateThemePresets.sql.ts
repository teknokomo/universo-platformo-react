import type { SqlMigrationDefinition } from './1766351182000-CreateMetahubsSchema.sql'

const AUTH_UID_SQL = '(SELECT auth.uid())'
const IS_SUPERUSER_SQL = `(SELECT admin.is_superuser(${AUTH_UID_SQL}))`

const metahubMembershipSql = (metahubIdColumn: string, roles?: readonly ('owner' | 'admin' | 'editor' | 'member')[]): string => {
    const roleCondition = roles?.length ? `AND mu.role IN (${roles.map((role) => `'${role}'`).join(', ')})` : ''
    return `EXISTS (
                        SELECT 1
                        FROM metahubs.rel_metahub_users mu
                        JOIN metahubs.obj_metahubs m ON m.id = mu.metahub_id
                        WHERE mu.metahub_id = ${metahubIdColumn}
                          AND mu.user_id = ${AUTH_UID_SQL}
                          ${roleCondition}
                          AND mu._upl_deleted = false
                          AND mu._app_deleted = false
                          AND m._upl_deleted = false
                          AND m._app_deleted = false
                    )`
}

const dropThemePresetPolicyStatement = (policyName: string, tableName: string) => ({
    sql: `
DO $$
BEGIN
    IF to_regclass('metahubs.${tableName}') IS NOT NULL THEN
        BEGIN
            EXECUTE format(
                'DROP POLICY IF EXISTS %I ON %I.%I',
                '${policyName}',
                'metahubs',
                '${tableName}'
            );
        EXCEPTION
            WHEN undefined_table THEN NULL;
        END;
    END IF;
END $$;
    `
})

export const createThemePresetsMigrationDefinition: SqlMigrationDefinition = {
    id: 'CreateThemePresets1800000000360',
    version: '1800000000360',
    summary: 'Create metahub-scoped theme presets and append-only theme preset audits with membership RLS',
    up: [
        {
            sql: `
                CREATE TABLE IF NOT EXISTS metahubs.obj_theme_presets (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    metahub_id UUID NOT NULL REFERENCES metahubs.obj_metahubs(id),
                    codename VARCHAR(64) NOT NULL,
                    name JSONB NOT NULL DEFAULT '{}'::jsonb,
                    description JSONB NOT NULL DEFAULT '{}'::jsonb,
                    tokens JSONB NOT NULL,
                    base_preset_id UUID NULL REFERENCES metahubs.obj_theme_presets(id),
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
                    CONSTRAINT theme_presets_codename_ck
                        CHECK (codename ~ '^[a-z][a-z0-9-]{2,63}$'),
                    CONSTRAINT theme_presets_tokens_object_ck
                        CHECK (jsonb_typeof(tokens) = 'object'),
                    CONSTRAINT theme_presets_tokens_size_ck
                        CHECK (pg_column_size(tokens) <= 65536)
                )
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX IF NOT EXISTS uq_theme_presets_codename_active
                    ON metahubs.obj_theme_presets (metahub_id, codename)
                    WHERE _upl_deleted = false
            `
        },
        {
            sql: `
                CREATE INDEX IF NOT EXISTS idx_theme_presets_metahub_active
                    ON metahubs.obj_theme_presets (metahub_id)
                    WHERE _upl_deleted = false AND _upl_archived = false
            `
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'theme_presets_codename_ck'
                    ) THEN
                        ALTER TABLE metahubs.obj_theme_presets
                            ADD CONSTRAINT theme_presets_codename_ck CHECK (codename ~ '^[a-z][a-z0-9-]{2,63}$');
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'theme_presets_tokens_object_ck'
                    ) THEN
                        ALTER TABLE metahubs.obj_theme_presets
                            ADD CONSTRAINT theme_presets_tokens_object_ck CHECK (jsonb_typeof(tokens) = 'object');
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'theme_presets_tokens_size_ck'
                    ) THEN
                        ALTER TABLE metahubs.obj_theme_presets
                            ADD CONSTRAINT theme_presets_tokens_size_ck CHECK (pg_column_size(tokens) <= 65536);
                    END IF;
                END $$;
            `
        },
        {
            sql: `
                CREATE TABLE IF NOT EXISTS metahubs.rel_theme_preset_audits (
                    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    metahub_id UUID NOT NULL REFERENCES metahubs.obj_metahubs(id),
                    preset_id UUID NULL REFERENCES metahubs.obj_theme_presets(id),
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
                CREATE INDEX IF NOT EXISTS idx_theme_preset_audits_metahub
                    ON metahubs.rel_theme_preset_audits (metahub_id, _upl_created_at DESC)
            `
        },
        {
            sql: `
                CREATE OR REPLACE FUNCTION metahubs.reject_theme_preset_audit_mutation()
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
                DROP TRIGGER IF EXISTS trg_theme_preset_audits_immutable ON metahubs.rel_theme_preset_audits
            `
        },
        {
            sql: `
                CREATE TRIGGER trg_theme_preset_audits_immutable
                    BEFORE UPDATE OR DELETE ON metahubs.rel_theme_preset_audits
                    FOR EACH ROW EXECUTE FUNCTION metahubs.reject_theme_preset_audit_mutation()
            `
        },
        {
            sql: `
                ALTER TABLE metahubs.obj_theme_presets ENABLE ROW LEVEL SECURITY
            `
        },
        {
            sql: `
                ALTER TABLE metahubs.rel_theme_preset_audits ENABLE ROW LEVEL SECURITY
            `
        },
        dropThemePresetPolicyStatement('Allow metahub members to read theme presets', 'obj_theme_presets'),
        {
            sql: `
                CREATE POLICY "Allow metahub members to read theme presets"
                    ON metahubs.obj_theme_presets
                    FOR SELECT
                    USING (
                        ${metahubMembershipSql('metahubs.obj_theme_presets.metahub_id')}
                        OR ${IS_SUPERUSER_SQL}
                    )
            `
        },
        dropThemePresetPolicyStatement('Allow metahub managers to manage theme presets', 'obj_theme_presets'),
        {
            sql: `
                CREATE POLICY "Allow metahub managers to manage theme presets"
                    ON metahubs.obj_theme_presets
                    FOR ALL
                    USING (
                        ${metahubMembershipSql('metahubs.obj_theme_presets.metahub_id', ['owner', 'admin'])}
                        OR ${IS_SUPERUSER_SQL}
                    )
                    WITH CHECK (
                        ${metahubMembershipSql('metahubs.obj_theme_presets.metahub_id', ['owner', 'admin'])}
                        OR ${IS_SUPERUSER_SQL}
                    )
            `
        },
        dropThemePresetPolicyStatement('Allow metahub members to read theme preset audits', 'rel_theme_preset_audits'),
        {
            sql: `
                CREATE POLICY "Allow metahub members to read theme preset audits"
                    ON metahubs.rel_theme_preset_audits
                    FOR SELECT
                    USING (
                        ${metahubMembershipSql('metahubs.rel_theme_preset_audits.metahub_id')}
                        OR ${IS_SUPERUSER_SQL}
                    )
            `
        },
        dropThemePresetPolicyStatement('Allow metahub managers to insert theme preset audits', 'rel_theme_preset_audits'),
        {
            sql: `
                CREATE POLICY "Allow metahub managers to insert theme preset audits"
                    ON metahubs.rel_theme_preset_audits
                    FOR INSERT
                    WITH CHECK (
                        ${metahubMembershipSql('metahubs.rel_theme_preset_audits.metahub_id', ['owner', 'admin'])}
                        OR ${IS_SUPERUSER_SQL}
                    )
            `
        },
        {
            sql: `REVOKE ALL ON TABLE metahubs.obj_theme_presets FROM PUBLIC`
        },
        {
            sql: `REVOKE ALL ON TABLE metahubs.obj_theme_presets FROM anon`
        },
        {
            sql: `REVOKE ALL ON TABLE metahubs.rel_theme_preset_audits FROM PUBLIC`
        },
        {
            sql: `REVOKE ALL ON TABLE metahubs.rel_theme_preset_audits FROM anon`
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE metahubs.obj_theme_presets TO authenticated;
                        GRANT SELECT, INSERT ON TABLE metahubs.rel_theme_preset_audits TO authenticated;
                    END IF;

                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
                        GRANT ALL ON TABLE metahubs.obj_theme_presets TO service_role;
                        GRANT ALL ON TABLE metahubs.rel_theme_preset_audits TO service_role;
                    END IF;
                END $$;
            `
        }
    ],
    down: []
}
