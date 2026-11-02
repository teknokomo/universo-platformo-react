import { createApplicationBotBindingsMigrationDefinition } from '../../platform/migrations'

const normalizeSql = (value: string): string => value.replace(/\s+/g, ' ').trim()

describe('application bot bindings migration security boundary', () => {
    it('pins every SECURITY DEFINER function search path and removes authenticated direct-write grants', () => {
        const upSql = createApplicationBotBindingsMigrationDefinition.up.map((statement) => normalizeSql(statement.sql)).join('\n')
        const definerCount = (upSql.match(/SECURITY DEFINER/gu) ?? []).length
        const pinnedSearchPathCount = (upSql.match(/SET search_path = pg_catalog, applications, auth, admin, pg_temp/gu) ?? []).length

        expect(definerCount).toBeGreaterThan(0)
        expect(pinnedSearchPathCount).toBe(definerCount)
        expect(upSql).toContain('REVOKE INSERT')
        expect(upSql).not.toMatch(/GRANT (?:INSERT|UPDATE).*TO authenticated/gu)
        expect(upSql).toContain('applications.create_application_bot_binding')
        expect(upSql).toContain('applications.release_application_bot_binding')
        expect(upSql).toContain('applications.audit_application_catalog_visibility_change')
        expect(upSql).toContain(
            'REVOKE ALL ON FUNCTION applications.record_application_catalog_visibility_audit(UUID, TEXT, INTEGER, INTEGER, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated, service_role'
        )
        expect(upSql).toContain(
            'GRANT EXECUTE ON FUNCTION applications.record_application_catalog_visibility_audit(UUID, TEXT, INTEGER, INTEGER, BOOLEAN, BOOLEAN) TO authenticated, service_role'
        )
        expect(upSql).toContain('uq_application_control_audits_catalog_initialized')
        expect(upSql).toContain('OLD.show_in_app_list IS NOT DISTINCT FROM NEW.show_in_app_list')
        expect(upSql).not.toContain("ELSIF p_event_type = 'catalog_visibility_changed'")
        expect(upSql).toContain('COALESCE(v_application._upl_version, 1) <> 1')
        expect(upSql).toContain("jsonb_exists(p_patch, 'botUsername')")
        expect(upSql).toContain("jsonb_exists(p_patch, 'displayName')")
        expect(upSql).toContain("jsonb_exists(p_patch, 'status')")
        expect(upSql).toContain('applications.is_safe_application_bot_display_name')
        expect(upSql).toContain('b.display_name::text')
        expect(upSql).toContain('b.short_id::text')
        expect(upSql).toContain('extensions.gen_random_bytes(16)')
        expect(upSql).not.toContain('uuid_send(gen_random_uuid())')
        expect(upSql).toContain('COLLATE "und-x-icu"')
        expect(upSql).toContain("'[^[:digit:]]'")
        expect(upSql).not.toContain("'updatedBy', v_current._upl_updated_by")
        expect(upSql).toContain('ck_application_bot_bindings_display_name_safe')
        expect(
            upSql.match(
                /INSERT INTO applications\.rel_application_control_audits \( id, application_id, binding_id, event_type, changed_fields, previous_version, new_version, previous_show_in_app_list, new_show_in_app_list,/gu
            )
        ).toHaveLength(4)
        expect(upSql).toContain('COALESCE(v_updated._upl_version, 1), NULL, NULL, v_actor, v_actor')
        expect(upSql).toContain('REVOKE ALL ON FUNCTION applications.is_safe_application_bot_display_name(TEXT)')
        expect(upSql).not.toMatch(/p_patch\s+\?/u)
    })

    it('removes the truncate guard trigger before its function', () => {
        const downStatements = createApplicationBotBindingsMigrationDefinition.down.map((statement) => normalizeSql(statement.sql))
        const triggerDrop = downStatements.indexOf(
            'DROP TRIGGER IF EXISTS application_bot_bindings_reject_truncate ON applications.rel_application_bot_bindings'
        )
        const functionDrop = downStatements.indexOf('DROP FUNCTION IF EXISTS applications.reject_application_bot_binding_truncate()')

        expect(triggerDrop).toBeGreaterThanOrEqual(0)
        expect(functionDrop).toBeGreaterThan(triggerDrop)
    })

    it('drops the display-name check before its database validator', () => {
        const downStatements = createApplicationBotBindingsMigrationDefinition.down.map((statement) => normalizeSql(statement.sql))
        const constraintDrop = downStatements.findIndex((statement) => statement.includes('ck_application_bot_bindings_display_name_safe'))
        const functionDrop = downStatements.findIndex((statement) =>
            statement.includes('DROP FUNCTION IF EXISTS applications.is_safe_application_bot_display_name(TEXT)')
        )

        expect(constraintDrop).toBeGreaterThanOrEqual(0)
        expect(functionDrop).toBeGreaterThan(constraintDrop)
    })
})
