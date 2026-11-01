import type { SqlMigrationDefinition } from './1800000000000-CreateApplicationsSchema.sql'
import {
    applicationBotBindingMutationGuardSql,
    applicationBotBindingTruncateGuardSql,
    applicationControlAuditMutationGuardSql,
    applicationControlBoundarySql,
    applicationCatalogVisibilityAuditTriggerSql,
    applicationBotDisplayNameValidationSql
} from './applicationBotBindingsMigrationSql'

const AUTH_UID_SQL = `(SELECT auth.uid())`
const IS_SUPERUSER_SQL = `(SELECT admin.is_superuser(${AUTH_UID_SQL}))`
const GLOBAL_APPLICATION_MANAGER_SQL = `(
    ${IS_SUPERUSER_SQL}
    OR (SELECT admin.has_permission(${AUTH_UID_SQL}, 'applications', 'update', '{}'::jsonb))
    OR (SELECT admin.has_permission(${AUTH_UID_SQL}, 'applications', 'delete', '{}'::jsonb))
)`

const applicationManagerPolicy = (applicationIdSql: string): string => `(
    ${GLOBAL_APPLICATION_MANAGER_SQL}
    OR EXISTS (
        SELECT 1
        FROM applications.rel_application_users AS au
        WHERE au.application_id = ${applicationIdSql}
          AND au.user_id = ${AUTH_UID_SQL}
          AND au.role IN ('owner', 'admin')
          AND au._upl_archived = false
          AND au._upl_deleted = false
          AND au._app_archived = false
          AND au._app_deleted = false
    )
)`

export const createApplicationBotBindingsMigrationDefinition: SqlMigrationDefinition = {
    id: 'CreateApplicationBotBindings1800000000320',
    version: '1800000000320',
    summary: 'Enforce durable Application bot binding and control audit contracts',
    up: [
        { sql: applicationBotDisplayNameValidationSql },
        {
            sql: `
                REVOKE ALL ON FUNCTION applications.is_safe_application_bot_display_name(TEXT)
                    FROM PUBLIC, anon, authenticated, service_role;
                GRANT EXECUTE ON FUNCTION applications.is_safe_application_bot_display_name(TEXT)
                    TO service_role
            `
        },
        {
            sql: `
                ALTER TABLE applications.rel_application_bot_bindings
                    DROP CONSTRAINT IF EXISTS fk_rel_application_bot_bindings_application_id,
                    ADD CONSTRAINT fk_rel_application_bot_bindings_application_id
                        FOREIGN KEY (application_id)
                        REFERENCES applications.obj_applications(id)
                        ON DELETE RESTRICT
            `
        },
        {
            sql: `
                ALTER TABLE applications.rel_application_control_audits
                    DROP CONSTRAINT IF EXISTS fk_rel_application_control_audits_application_id,
                    ADD CONSTRAINT fk_rel_application_control_audits_application_id
                        FOREIGN KEY (application_id)
                        REFERENCES applications.obj_applications(id)
                        ON DELETE RESTRICT,
                    DROP CONSTRAINT IF EXISTS fk_rel_application_control_audits_binding_id,
                    ADD CONSTRAINT fk_rel_application_control_audits_binding_id
                        FOREIGN KEY (binding_id)
                        REFERENCES applications.rel_application_bot_bindings(id)
                        ON DELETE RESTRICT
            `
        },
        {
            sql: `
                ALTER TABLE applications.rel_application_bot_bindings
                    ADD CONSTRAINT ck_application_bot_bindings_platform
                        CHECK (platform IN ('max', 'telegram')),
                    ADD CONSTRAINT ck_application_bot_bindings_display_name_safe
                        CHECK (display_name IS NULL OR applications.is_safe_application_bot_display_name(display_name)),
                    ADD CONSTRAINT ck_application_bot_bindings_status
                        CHECK (status IN ('draft', 'active', 'disabled')),
                    ADD CONSTRAINT ck_application_bot_bindings_username_canonical
                        CHECK (
                            bot_username = lower(bot_username)
                            AND (
                                (platform = 'telegram' AND bot_username ~ '^[a-z0-9_]{5,32}$')
                                OR (
                                    platform = 'max'
                                    AND char_length(bot_username) BETWEEN 11 AND 60
                                    AND (
                                        bot_username ~ '^[a-z][a-z0-9_]{7,56}bot$'
                                        OR bot_username ~ '^[a-z][a-z0-9_]{6,55}_bot$'
                                    )
                                )
                            )
                        ),
                    ADD CONSTRAINT ck_application_bot_bindings_short_id
                        CHECK (short_id ~ '^[A-Za-z0-9_-]{22}$')
            `
        },
        {
            sql: `
                ALTER TABLE applications.rel_application_bot_bindings
                    ADD CONSTRAINT ck_application_bot_bindings_id_uuid_v7
                        CHECK (id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
                    ADD CONSTRAINT ck_application_bot_bindings_release_state
                        CHECK (
                            (
                                released_at IS NULL
                                AND released_by IS NULL
                                AND _upl_deleted = false
                                AND _upl_deleted_at IS NULL
                                AND _upl_deleted_by IS NULL
                                AND _app_deleted = false
                                AND _app_deleted_at IS NULL
                                AND _app_deleted_by IS NULL
                            )
                            OR (
                                released_at IS NOT NULL
                                AND released_by IS NOT NULL
                                AND status = 'disabled'
                                AND _upl_deleted = true
                                AND _upl_deleted_at = released_at
                                AND _upl_deleted_by = released_by
                                AND _app_deleted = true
                                AND _app_deleted_at = released_at
                                AND _app_deleted_by = released_by
                                AND _upl_updated_at = released_at
                                AND _upl_updated_by = released_by
                            )
                        )
            `
        },
        {
            sql: `
                ALTER TABLE applications.rel_application_control_audits
                    ADD CONSTRAINT ck_application_control_audits_event_type
                        CHECK (event_type IN (
                            'catalog_visibility_initialized',
                            'catalog_visibility_changed',
                            'bot_binding_created',
                            'bot_binding_updated',
                            'bot_binding_status_changed',
                            'bot_binding_released',
                            'bot_binding_application_deleted'
                        )),
                    ADD CONSTRAINT ck_application_control_audits_changed_fields
                        CHECK (jsonb_typeof(changed_fields) = 'array'),
                    ADD CONSTRAINT ck_application_control_audits_id_uuid_v7
                        CHECK (id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
                    ADD CONSTRAINT ck_application_control_audits_event_shape
                        CHECK (
                            (
                                event_type LIKE 'bot_binding_%'
                                AND binding_id IS NOT NULL
                                AND previous_show_in_app_list IS NULL
                                AND new_show_in_app_list IS NULL
                            )
                            OR (
                                event_type = 'catalog_visibility_initialized'
                                AND binding_id IS NULL
                                AND previous_version IS NULL
                                AND new_version IS NOT NULL
                                AND new_version = 1
                                AND previous_show_in_app_list IS NULL
                                AND new_show_in_app_list IS NOT NULL
                            )
                            OR (
                                event_type = 'catalog_visibility_changed'
                                AND binding_id IS NULL
                                AND previous_version IS NOT NULL
                                AND new_version = previous_version + 1
                                AND previous_show_in_app_list IS NOT NULL
                                AND new_show_in_app_list IS NOT NULL
                                AND previous_show_in_app_list <> new_show_in_app_list
                            )
                        )
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX uq_application_bot_bindings_identity
                    ON applications.rel_application_bot_bindings (application_id, platform, bot_username)
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX uq_application_bot_bindings_short_id
                    ON applications.rel_application_bot_bindings (short_id)
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX uq_application_control_audits_binding_version
                    ON applications.rel_application_control_audits (binding_id, new_version)
                    WHERE binding_id IS NOT NULL AND new_version IS NOT NULL
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX uq_application_control_audits_catalog_initialized
                    ON applications.rel_application_control_audits (application_id)
                    WHERE event_type = 'catalog_visibility_initialized'
            `
        },
        {
            sql: `
                CREATE UNIQUE INDEX uq_application_control_audits_catalog_changed_version
                    ON applications.rel_application_control_audits (application_id, new_version)
                    WHERE event_type = 'catalog_visibility_changed'
            `
        },
        { sql: applicationBotBindingMutationGuardSql },
        {
            sql: `
                DROP TRIGGER IF EXISTS application_bot_bindings_guard_mutation
                    ON applications.rel_application_bot_bindings;
                CREATE TRIGGER application_bot_bindings_guard_mutation
                    BEFORE UPDATE OR DELETE ON applications.rel_application_bot_bindings
                    FOR EACH ROW EXECUTE FUNCTION applications.guard_application_bot_binding_mutation()
            `
        },
        { sql: applicationBotBindingTruncateGuardSql },
        {
            sql: `
                DROP TRIGGER IF EXISTS application_bot_bindings_reject_truncate
                    ON applications.rel_application_bot_bindings;
                CREATE TRIGGER application_bot_bindings_reject_truncate
                    BEFORE TRUNCATE ON applications.rel_application_bot_bindings
                    FOR EACH STATEMENT EXECUTE FUNCTION applications.reject_application_bot_binding_truncate()
            `
        },
        { sql: applicationControlAuditMutationGuardSql },
        {
            sql: `
                DROP TRIGGER IF EXISTS application_control_audits_reject_row_mutation
                    ON applications.rel_application_control_audits;
                CREATE TRIGGER application_control_audits_reject_row_mutation
                    BEFORE UPDATE OR DELETE ON applications.rel_application_control_audits
                    FOR EACH ROW EXECUTE FUNCTION applications.reject_application_control_audit_mutation();
                DROP TRIGGER IF EXISTS application_control_audits_reject_truncate
                    ON applications.rel_application_control_audits;
                CREATE TRIGGER application_control_audits_reject_truncate
                    BEFORE TRUNCATE ON applications.rel_application_control_audits
                    FOR EACH STATEMENT EXECUTE FUNCTION applications.reject_application_control_audit_mutation()
            `
        },
        {
            sql: `ALTER TABLE applications.rel_application_bot_bindings ENABLE ROW LEVEL SECURITY`
        },
        {
            sql: `ALTER TABLE applications.rel_application_control_audits ENABLE ROW LEVEL SECURITY`
        },
        { sql: applicationControlBoundarySql },
        { sql: applicationCatalogVisibilityAuditTriggerSql },
        {
            sql: `
                DROP TRIGGER IF EXISTS application_catalog_visibility_audit
                    ON applications.obj_applications;
                CREATE TRIGGER application_catalog_visibility_audit
                    AFTER UPDATE OF show_in_app_list ON applications.obj_applications
                    FOR EACH ROW EXECUTE FUNCTION applications.audit_application_catalog_visibility_change()
            `
        },
        {
            sql: `
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                        GRANT USAGE ON SCHEMA applications TO authenticated;
                        GRANT SELECT (
                            application_id,
                            user_id,
                            role,
                            _upl_archived,
                            _upl_deleted,
                            _app_archived,
                            _app_deleted
                        ) ON TABLE applications.rel_application_users TO authenticated;
                    END IF;

                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
                        GRANT USAGE ON SCHEMA applications TO service_role;
                    END IF;
                END $$
            `
        },
        {
            sql: `REVOKE ALL ON TABLE applications.rel_application_bot_bindings FROM PUBLIC, anon, authenticated`
        },
        {
            sql: `
                REVOKE INSERT (
                    id, application_id, platform, bot_username, display_name, status, short_id,
                    _upl_created_by, _upl_updated_by
                ), UPDATE (
                    bot_username, display_name, status, released_at, released_by,
                    _upl_updated_by, _upl_updated_at, _upl_version, _upl_deleted, _upl_deleted_at,
                    _upl_deleted_by, _app_deleted, _app_deleted_at, _app_deleted_by
                ) ON TABLE applications.rel_application_bot_bindings FROM PUBLIC, anon, authenticated
            `
        },
        {
            sql: `GRANT SELECT ON TABLE applications.rel_application_bot_bindings TO authenticated`
        },
        {
            sql: `REVOKE ALL ON TABLE applications.rel_application_control_audits FROM PUBLIC, anon, authenticated`
        },
        {
            sql: `
                REVOKE INSERT (
                    id, application_id, binding_id, event_type, changed_fields, previous_version, new_version,
                    previous_show_in_app_list, new_show_in_app_list, _upl_created_by, _upl_updated_by
                ) ON TABLE applications.rel_application_control_audits FROM PUBLIC, anon, authenticated
            `
        },
        {
            sql: `GRANT SELECT ON TABLE applications.rel_application_control_audits TO authenticated`
        },
        {
            sql: `GRANT ALL ON TABLE applications.rel_application_bot_bindings TO service_role`
        },
        {
            sql: `GRANT ALL ON TABLE applications.rel_application_control_audits TO service_role`
        },
        {
            sql: `DROP POLICY IF EXISTS "Allow application managers to read bot bindings" ON applications.rel_application_bot_bindings`
        },
        {
            sql: `
                CREATE POLICY "Allow application managers to read bot bindings"
                    ON applications.rel_application_bot_bindings
                    FOR SELECT
                    USING (${applicationManagerPolicy('rel_application_bot_bindings.application_id')})
            `
        },
        {
            sql: `DROP POLICY IF EXISTS "Allow application managers to create bot bindings" ON applications.rel_application_bot_bindings`
        },
        {
            sql: `DROP POLICY IF EXISTS "Allow application managers to update bot bindings" ON applications.rel_application_bot_bindings`
        },
        {
            sql: `DROP POLICY IF EXISTS "Allow application managers to read control audits" ON applications.rel_application_control_audits`
        },
        {
            sql: `
                CREATE POLICY "Allow application managers to read control audits"
                    ON applications.rel_application_control_audits
                    FOR SELECT
                    USING (${applicationManagerPolicy('rel_application_control_audits.application_id')})
            `
        },
        {
            sql: `DROP POLICY IF EXISTS "Allow application managers to write control audits" ON applications.rel_application_control_audits`
        },
        {
            sql: `REVOKE ALL ON FUNCTION applications.require_application_control_manager(UUID) FROM PUBLIC, anon, authenticated, service_role`
        },
        {
            sql: `
                REVOKE ALL ON FUNCTION applications.create_application_bot_binding(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
                REVOKE ALL ON FUNCTION applications.update_application_bot_binding(UUID, UUID, INTEGER, JSONB) FROM PUBLIC, anon;
                REVOKE ALL ON FUNCTION applications.release_application_bot_binding(UUID, UUID, INTEGER) FROM PUBLIC, anon;
                REVOKE ALL ON FUNCTION applications.release_application_bot_bindings_for_application(UUID) FROM PUBLIC, anon;
                REVOKE ALL ON FUNCTION applications.record_application_catalog_visibility_audit(UUID, TEXT, INTEGER, INTEGER, BOOLEAN, BOOLEAN)
                    FROM PUBLIC, anon, authenticated, service_role
            `
        },
        {
            sql: `
                GRANT EXECUTE ON FUNCTION applications.create_application_bot_binding(UUID, TEXT, TEXT, TEXT) TO authenticated;
                GRANT EXECUTE ON FUNCTION applications.update_application_bot_binding(UUID, UUID, INTEGER, JSONB) TO authenticated;
                GRANT EXECUTE ON FUNCTION applications.release_application_bot_binding(UUID, UUID, INTEGER) TO authenticated;
                GRANT EXECUTE ON FUNCTION applications.release_application_bot_bindings_for_application(UUID) TO authenticated
            `
        },
        {
            sql: `
                GRANT EXECUTE ON FUNCTION applications.record_application_catalog_visibility_audit(UUID, TEXT, INTEGER, INTEGER, BOOLEAN, BOOLEAN)
                    TO authenticated, service_role
            `
        }
    ],
    down: [
        {
            sql: `REVOKE ALL ON TABLE applications.rel_application_bot_bindings FROM PUBLIC, anon, authenticated, service_role`
        },
        {
            sql: `REVOKE ALL ON TABLE applications.rel_application_control_audits FROM PUBLIC, anon, authenticated, service_role`
        },
        {
            sql: `
                REVOKE ALL ON FUNCTION applications.create_application_bot_binding(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
                REVOKE ALL ON FUNCTION applications.update_application_bot_binding(UUID, UUID, INTEGER, JSONB) FROM PUBLIC, anon, authenticated, service_role;
                REVOKE ALL ON FUNCTION applications.release_application_bot_binding(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated, service_role;
                REVOKE ALL ON FUNCTION applications.release_application_bot_bindings_for_application(UUID) FROM PUBLIC, anon, authenticated, service_role;
                REVOKE ALL ON FUNCTION applications.record_application_catalog_visibility_audit(UUID, TEXT, INTEGER, INTEGER, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated, service_role;
                REVOKE ALL ON FUNCTION applications.audit_application_catalog_visibility_change() FROM PUBLIC, anon, authenticated, service_role;
                REVOKE ALL ON FUNCTION applications.require_application_control_manager(UUID) FROM PUBLIC, anon, authenticated, service_role
            `
        },
        {
            sql: `
                DROP TRIGGER IF EXISTS application_catalog_visibility_audit ON applications.obj_applications;
                DROP FUNCTION IF EXISTS applications.audit_application_catalog_visibility_change()
            `
        },
        {
            sql: `
                DROP FUNCTION IF EXISTS applications.record_application_catalog_visibility_audit(UUID, TEXT, INTEGER, INTEGER, BOOLEAN, BOOLEAN);
                DROP FUNCTION IF EXISTS applications.release_application_bot_bindings_for_application(UUID);
                DROP FUNCTION IF EXISTS applications.release_application_bot_binding(UUID, UUID, INTEGER);
                DROP FUNCTION IF EXISTS applications.update_application_bot_binding(UUID, UUID, INTEGER, JSONB);
                DROP FUNCTION IF EXISTS applications.create_application_bot_binding(UUID, TEXT, TEXT, TEXT);
                DROP FUNCTION IF EXISTS applications.require_application_control_manager(UUID)
            `
        },
        {
            sql: `
                REVOKE SELECT (
                    application_id,
                    user_id,
                    role,
                    _upl_archived,
                    _upl_deleted,
                    _app_archived,
                    _app_deleted
                ) ON TABLE applications.rel_application_users FROM authenticated
            `
        },
        {
            sql: `DROP TRIGGER IF EXISTS application_bot_bindings_reject_truncate ON applications.rel_application_bot_bindings`
        },
        {
            sql: `DROP FUNCTION IF EXISTS applications.reject_application_bot_binding_truncate()`
        },
        {
            sql: `DROP TRIGGER IF EXISTS application_bot_bindings_guard_mutation ON applications.rel_application_bot_bindings`
        },
        {
            sql: `DROP FUNCTION IF EXISTS applications.guard_application_bot_binding_mutation()`
        },
        {
            sql: `DROP TRIGGER IF EXISTS application_control_audits_reject_row_mutation ON applications.rel_application_control_audits`
        },
        {
            sql: `DROP TRIGGER IF EXISTS application_control_audits_reject_truncate ON applications.rel_application_control_audits`
        },
        {
            sql: `DROP FUNCTION IF EXISTS applications.reject_application_control_audit_mutation()`
        },
        {
            sql: `DROP POLICY IF EXISTS "Allow application managers to read bot bindings" ON applications.rel_application_bot_bindings`
        },
        {
            sql: `DROP POLICY IF EXISTS "Allow application managers to create bot bindings" ON applications.rel_application_bot_bindings`
        },
        {
            sql: `DROP POLICY IF EXISTS "Allow application managers to update bot bindings" ON applications.rel_application_bot_bindings`
        },
        {
            sql: `DROP POLICY IF EXISTS "Allow application managers to read control audits" ON applications.rel_application_control_audits`
        },
        {
            sql: `DROP POLICY IF EXISTS "Allow application managers to write control audits" ON applications.rel_application_control_audits`
        },
        {
            sql: `
                ALTER TABLE applications.rel_application_bot_bindings
                    DROP CONSTRAINT IF EXISTS ck_application_bot_bindings_display_name_safe,
                    DROP CONSTRAINT IF EXISTS ck_application_bot_bindings_platform,
                    DROP CONSTRAINT IF EXISTS ck_application_bot_bindings_status,
                    DROP CONSTRAINT IF EXISTS ck_application_bot_bindings_username_canonical,
                    DROP CONSTRAINT IF EXISTS ck_application_bot_bindings_short_id,
                    DROP CONSTRAINT IF EXISTS ck_application_bot_bindings_id_uuid_v7,
                    DROP CONSTRAINT IF EXISTS ck_application_bot_bindings_release_state,
                    DROP CONSTRAINT IF EXISTS fk_rel_application_bot_bindings_application_id,
                    ADD CONSTRAINT fk_rel_application_bot_bindings_application_id
                        FOREIGN KEY (application_id)
                        REFERENCES applications.obj_applications(id)
                        ON DELETE SET NULL
            `
        },
        {
            sql: `
                ALTER TABLE applications.rel_application_control_audits
                    DROP CONSTRAINT IF EXISTS ck_application_control_audits_event_type,
                    DROP CONSTRAINT IF EXISTS ck_application_control_audits_changed_fields,
                    DROP CONSTRAINT IF EXISTS ck_application_control_audits_id_uuid_v7,
                    DROP CONSTRAINT IF EXISTS ck_application_control_audits_event_shape,
                    DROP CONSTRAINT IF EXISTS fk_rel_application_control_audits_application_id,
                    ADD CONSTRAINT fk_rel_application_control_audits_application_id
                        FOREIGN KEY (application_id)
                        REFERENCES applications.obj_applications(id)
                        ON DELETE SET NULL,
                    DROP CONSTRAINT IF EXISTS fk_rel_application_control_audits_binding_id,
                    ADD CONSTRAINT fk_rel_application_control_audits_binding_id
                        FOREIGN KEY (binding_id)
                        REFERENCES applications.rel_application_bot_bindings(id)
                        ON DELETE SET NULL
            `
        },
        {
            sql: `DROP INDEX IF EXISTS applications.uq_application_bot_bindings_identity`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.uq_application_bot_bindings_short_id`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.uq_application_control_audits_binding_version`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.uq_application_control_audits_catalog_initialized`
        },
        {
            sql: `DROP INDEX IF EXISTS applications.uq_application_control_audits_catalog_changed_version`
        },
        {
            sql: `ALTER TABLE applications.rel_application_bot_bindings DISABLE ROW LEVEL SECURITY`
        },
        {
            sql: `ALTER TABLE applications.rel_application_control_audits DISABLE ROW LEVEL SECURITY`
        },
        {
            sql: `
                REVOKE ALL ON FUNCTION applications.is_safe_application_bot_display_name(TEXT)
                    FROM PUBLIC, anon, authenticated, service_role;
                DROP FUNCTION IF EXISTS applications.is_safe_application_bot_display_name(TEXT)
            `
        }
    ]
}
