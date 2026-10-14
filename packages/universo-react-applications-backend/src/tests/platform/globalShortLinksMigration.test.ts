import {
    bindGlobalShortLinksToAccessLinkIdentityMigrationDefinition,
    createGlobalShortLinksMigrationDefinition
} from '../../platform/migrations'
import { applicationsSystemAppDefinition } from '../../platform/systemAppDefinition'

const normalizeSql = (value: string): string => value.replace(/\s+/g, ' ').trim()

describe('global short-link platform migration', () => {
    const upSql = normalizeSql(createGlobalShortLinksMigrationDefinition.up.map((statement) => statement.sql).join('\n'))
    const downSql = normalizeSql(createGlobalShortLinksMigrationDefinition.down.map((statement) => statement.sql).join('\n'))

    it('is registered on the applications system app without changing its structure version', () => {
        expect(
            applicationsSystemAppDefinition.migrations.map((entry) => (entry.kind === 'file' ? entry.migration.id : entry.definition.id))
        ).toContain(createGlobalShortLinksMigrationDefinition.id)
        expect(applicationsSystemAppDefinition.structureVersion).toBe('0.1.0')
    })

    it('persists constrained typed targets and UUID v7 identities in the applications schema', () => {
        for (const fragment of [
            'CREATE TABLE IF NOT EXISTS applications.obj_global_short_links',
            'id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7()',
            'global_short_links_id_uuid_v7_ck',
            'global_short_links_slug_format_ck',
            'global_short_links_target_shape_ck',
            'global_short_links_release_actor_ck',
            "'metahub', 'metahubs', 'metapanel', 'oauth', 'privacy', 'profile', 'public'",
            "target_kind = 'application-entry'",
            "target_kind = 'application-section'",
            "section_key IN ('dashboard', 'workspace')",
            "target_kind = 'lms-access-link'",
            'access_link_workspace_id UUID',
            'access_link_workspace_id IS NULL',
            "target_kind = 'application-resource'",
            "resource_target_kind IN ('page', 'object')",
            "entity_type_codename ~ '^[A-Za-z][A-Za-z0-9._-]{0,127}$'",
            'resource_target_kind IS NOT NULL',
            'entity_type_codename IS NOT NULL',
            'REFERENCES applications.obj_applications(id) ON DELETE RESTRICT'
        ]) {
            expect(upSql).toContain(normalizeSql(fragment))
        }
        expect(upSql).not.toContain('target_url')
        expect(upSql).not.toContain('target_table')
    })

    it('enforces active slug uniqueness, release lifecycle, restricted lookup and application-manager RLS', () => {
        for (const fragment of [
            'CREATE UNIQUE INDEX IF NOT EXISTS uq_global_short_links_active_slug',
            'WHERE released_at IS NULL AND _upl_archived = false AND _upl_deleted = false AND _app_archived = false AND _app_deleted = false',
            'CREATE OR REPLACE FUNCTION applications.resolve_global_short_link(p_slug TEXT)',
            'SECURITY DEFINER',
            'SET search_path = pg_catalog, pg_temp',
            'link.released_at IS NULL',
            'app._app_deleted = false',
            'CREATE OR REPLACE FUNCTION applications.guard_global_short_link_release()',
            'OLD.released_at IS NOT NULL',
            'NEW.released_at IS DISTINCT FROM OLD.released_at',
            'CREATE TRIGGER applications_guard_global_short_link_release',
            'GRANT USAGE ON SCHEMA applications TO authenticated',
            'GRANT USAGE ON SCHEMA applications TO service_role',
            'GRANT SELECT ON TABLE applications.obj_global_short_links TO authenticated',
            'GRANT INSERT ( id, slug, target_kind, application_id, section_key, access_link_slug, access_link_workspace_id, resource_target_kind, entity_type_codename, _upl_created_by, _upl_updated_by ) ON TABLE applications.obj_global_short_links TO authenticated',
            'CREATE OR REPLACE FUNCTION applications.can_manage_global_short_link_application(p_application_id UUID)',
            'SECURITY DEFINER',
            "au.role IN ('owner', 'admin')",
            'admin.is_superuser((SELECT auth.uid()))',
            'REVOKE ALL ON FUNCTION applications.can_manage_global_short_link_application(UUID) FROM PUBLIC, anon, authenticated',
            'GRANT EXECUTE ON FUNCTION applications.can_manage_global_short_link_application(UUID) TO authenticated, service_role',
            'CREATE OR REPLACE FUNCTION applications.lock_active_global_short_link_application(p_application_id UUID)',
            'RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = pg_catalog, pg_temp',
            'FOR SHARE',
            'applications.can_manage_global_short_link_application(app.id)',
            'REVOKE ALL ON FUNCTION applications.lock_active_global_short_link_application(UUID) FROM PUBLIC, anon, authenticated',
            'GRANT EXECUTE ON FUNCTION applications.lock_active_global_short_link_application(UUID) TO authenticated, service_role',
            '_upl_created_by = (SELECT auth.uid())',
            'released_by = (SELECT auth.uid())',
            'REVOKE ALL ON FUNCTION applications.resolve_global_short_link(TEXT) FROM PUBLIC, anon, authenticated',
            'GRANT EXECUTE ON FUNCTION applications.resolve_global_short_link(TEXT) TO service_role',
            'ALTER TABLE applications.obj_global_short_links ENABLE ROW LEVEL SECURITY',
            'Allow application managers to read global short links',
            'Allow application managers to create global short links',
            'Allow application managers to release global short links'
        ]) {
            expect(upSql).toContain(normalizeSql(fragment))
        }
        expect(upSql).not.toContain('applicationAliases')
        expect(upSql).not.toContain('admin.has_permission')
        expect(upSql).not.toContain('GRANT EXECUTE ON FUNCTION applications.resolve_global_short_link(TEXT) TO authenticated')
        expect(upSql).not.toContain('resource_type')
        expect(upSql).not.toContain('resource_id')
        expect(downSql).toContain('DROP FUNCTION IF EXISTS applications.resolve_global_short_link(TEXT)')
        expect(downSql).toContain(
            'DROP TRIGGER IF EXISTS applications_guard_global_short_link_release ON applications.obj_global_short_links'
        )
        expect(downSql).toContain('DROP FUNCTION IF EXISTS applications.guard_global_short_link_release()')
        expect(downSql).toContain('DROP TABLE IF EXISTS applications.obj_global_short_links')
        expect(downSql).toContain('DROP FUNCTION IF EXISTS applications.lock_active_global_short_link_application(UUID)')
        expect(downSql).toContain('REVOKE USAGE ON SCHEMA applications FROM authenticated')
        expect(downSql).toContain('REVOKE USAGE ON SCHEMA applications FROM service_role')
    })

    it('scopes SELECT, INSERT and UPDATE to target-application managers and superusers', () => {
        const selectPolicyStart = upSql.indexOf('CREATE POLICY "Allow application managers to read global short links"')
        const insertPolicyStart = upSql.indexOf('CREATE POLICY "Allow application managers to create global short links"')
        const selectPolicySql = upSql.slice(selectPolicyStart, insertPolicyStart)

        expect(selectPolicyStart).toBeGreaterThanOrEqual(0)
        expect(insertPolicyStart).toBeGreaterThan(selectPolicyStart)
        expect(normalizeSql(selectPolicySql)).toContain(
            normalizeSql(
                'USING ((SELECT applications.can_manage_global_short_link_application(applications.obj_global_short_links.application_id)))'
            )
        )
        expect(upSql).toContain('_upl_created_by = (SELECT auth.uid()) AND _upl_updated_by = (SELECT auth.uid())')
        expect(upSql).toContain(
            'AND (SELECT applications.can_manage_global_short_link_application(applications.obj_global_short_links.application_id))'
        )
        expect(upSql).toContain(
            'USING ((SELECT applications.can_manage_global_short_link_application(applications.obj_global_short_links.application_id)))'
        )
        expect(upSql).toContain('released_by = (SELECT auth.uid()) AND _upl_updated_by = (SELECT auth.uid())')
        expect(downSql).toContain('DROP FUNCTION IF EXISTS applications.can_manage_global_short_link_application(UUID)')
    })

    it('binds LMS short links to UUID v7 AccessLink identities and fails closed for unbound rows', () => {
        const migration = bindGlobalShortLinksToAccessLinkIdentityMigrationDefinition
        const migrationUpSql = normalizeSql(migration.up.map((statement) => statement.sql).join('\n'))
        const migrationDownSql = normalizeSql(migration.down.map((statement) => statement.sql).join('\n'))

        expect(migration.id).toBe('BindGlobalShortLinksToAccessLinkIdentity1800000000310')
        expect(migrationUpSql).toContain('ADD COLUMN IF NOT EXISTS access_link_id UUID')
        expect(migrationUpSql).toContain('global_short_links_access_link_identity_ck')
        expect(migrationUpSql).toContain("substring(access_link_id::text FROM 15 FOR 1) = '7'")
        expect(migrationUpSql).toContain('access_link_id UUID')
        expect(migrationUpSql).toContain("AND (link.target_kind <> 'lms-access-link' OR link.access_link_id IS NOT NULL)")
        expect(migrationUpSql).toContain('GRANT INSERT (access_link_id) ON TABLE applications.obj_global_short_links TO authenticated')
        expect(migrationUpSql).toContain('idx_global_short_links_access_link_active')
        expect(migrationDownSql).toContain('DROP COLUMN IF EXISTS access_link_id')
        expect(
            applicationsSystemAppDefinition.migrations.map((entry) => (entry.kind === 'file' ? entry.migration.id : entry.definition.id))
        ).toContain(migration.id)
        expect(applicationsSystemAppDefinition.structureVersion).toBe('0.1.0')
    })
})
