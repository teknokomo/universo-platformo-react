/** SQL function and trigger definitions used by the Application bot bindings migration. */

export const applicationBotBindingMutationGuardSql = `
    CREATE OR REPLACE FUNCTION applications.guard_application_bot_binding_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, pg_temp
    AS $$
    BEGIN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'Application bot bindings cannot be physically deleted'
                USING ERRCODE = '23514';
        END IF;

        IF OLD.short_id IS DISTINCT FROM NEW.short_id THEN
            RAISE EXCEPTION 'Application bot binding short_id is immutable'
                USING ERRCODE = '23514';
        END IF;

        IF OLD.released_at IS NOT NULL OR OLD._upl_deleted = true OR OLD._app_deleted = true THEN
            RAISE EXCEPTION 'Released application bot bindings are immutable'
                USING ERRCODE = '23514';
        END IF;

        RETURN NEW;
    END;
    $$
`

export const applicationControlAuditMutationGuardSql = `
    CREATE OR REPLACE FUNCTION applications.reject_application_control_audit_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, pg_temp
    AS $$
    BEGIN
        RAISE EXCEPTION 'Application control audit records are immutable'
            USING ERRCODE = '23514';
    END;
    $$
`

export const applicationBotBindingTruncateGuardSql = `
    CREATE OR REPLACE FUNCTION applications.reject_application_bot_binding_truncate()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, pg_temp
    AS $$
    BEGIN
        RAISE EXCEPTION 'Application bot bindings cannot be truncated'
            USING ERRCODE = '23514';
    END;
    $$
`

export const applicationBotDisplayNameValidationSql = `
    CREATE OR REPLACE FUNCTION applications.is_safe_application_bot_display_name(p_display_name TEXT)
    RETURNS BOOLEAN
    LANGUAGE SQL
    IMMUTABLE
    PARALLEL SAFE
    STRICT
    SET search_path = pg_catalog
    AS $function$
        SELECT char_length(p_display_name) BETWEEN 1 AND 120
            AND p_display_name COLLATE "und-x-icu" !~ '^[[:space:]]|[[:space:]]$'
            AND p_display_name COLLATE "und-x-icu" !~ '[[:cntrl:]@:+]'
            AND char_length(regexp_replace(p_display_name COLLATE "und-x-icu", '[^[:digit:]]', '', 'g')) < 7
            AND p_display_name !~* '(^|[^[:alnum:]])(bearer|token|secret|password|credential|api[[:space:]_-]*key|private[[:space:]_-]*key|init[[:space:]_-]*data)([^[:alnum:]]|$)'
            AND p_display_name !~* '(sk[_-](live|test)[_-][[:alnum:]_-]{12,}|xox[baprs]-[[:alnum:]-]{10,}|gh[pousr]_[[:alnum:]]{20,}|akia[[:alnum:]]{16}|AIza[[:alnum:]_-]{30,}|[0-9]{6,12}:[[:alnum:]_-]{20,})'
    $function$
`

const APPLICATION_BOT_BINDING_RESULT_COLUMNS = `
    id UUID,
    "applicationId" UUID,
    platform TEXT,
    "botUsername" TEXT,
    "displayName" TEXT,
    status TEXT,
    "shortId" TEXT,
    "releasedAt" TIMESTAMPTZ,
    version INTEGER,
    "createdAt" TIMESTAMPTZ,
    "updatedAt" TIMESTAMPTZ
`

const APPLICATION_BOT_BINDING_RESULT_SELECT = `
    b.id,
    b.application_id,
    b.platform::text,
    b.bot_username,
    b.display_name::text,
    b.status::text,
    b.short_id::text,
    b.released_at,
    COALESCE(b._upl_version, 1),
    b._upl_created_at,
    b._upl_updated_at
`

export const applicationControlBoundarySql = `
CREATE OR REPLACE FUNCTION applications.require_application_control_manager(p_application_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, applications, auth, admin, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_global_manager BOOLEAN;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Authenticated actor is required for Application control mutations'
            USING ERRCODE = '42501';
    END IF;

    PERFORM 1
    FROM applications.obj_applications AS a
    WHERE a.id = p_application_id
      AND a._upl_archived = false
      AND a._upl_deleted = false
      AND a._app_archived = false
      AND a._app_deleted = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application was not found or is already deleted'
            USING ERRCODE = 'P0002';
    END IF;

    v_global_manager := COALESCE(admin.is_superuser(v_actor), false)
        OR COALESCE(admin.has_permission(v_actor, 'applications', 'update', '{}'::jsonb), false)
        OR COALESCE(admin.has_permission(v_actor, 'applications', 'delete', '{}'::jsonb), false);

    IF NOT v_global_manager THEN
        PERFORM 1
        FROM applications.rel_application_users AS au
        WHERE au.application_id = p_application_id
          AND au.user_id = v_actor
          AND au.role IN ('owner', 'admin')
          AND au._upl_archived = false
          AND au._upl_deleted = false
          AND au._app_archived = false
          AND au._app_deleted = false
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Application owner or admin access is required'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN v_actor;
END;
$$;

CREATE OR REPLACE FUNCTION applications.create_application_bot_binding(
    p_application_id UUID,
    p_platform TEXT,
    p_bot_username TEXT,
    p_display_name TEXT
)
RETURNS TABLE (${APPLICATION_BOT_BINDING_RESULT_COLUMNS})
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, applications, auth, admin, pg_temp
AS $$
DECLARE
    v_actor UUID;
    v_binding applications.rel_application_bot_bindings%ROWTYPE;
    v_attempt INTEGER;
    v_short_id TEXT;
BEGIN
    v_actor := applications.require_application_control_manager(p_application_id);

    IF p_display_name IS NOT NULL AND NOT applications.is_safe_application_bot_display_name(p_display_name) THEN
        RAISE EXCEPTION 'Invalid Application bot binding display name'
            USING ERRCODE = '22023';
    END IF;

    IF p_platform NOT IN ('max', 'telegram') OR p_bot_username IS NULL OR p_bot_username <> lower(p_bot_username) THEN
        RAISE EXCEPTION 'Invalid Application bot binding identity'
            USING ERRCODE = '22023';
    END IF;

    IF NOT (
        (p_platform = 'telegram' AND p_bot_username ~ '^[a-z0-9_]{5,32}$')
        OR (
            p_platform = 'max'
            AND char_length(p_bot_username) BETWEEN 11 AND 60
            AND (p_bot_username ~ '^[a-z][a-z0-9_]{7,56}bot$' OR p_bot_username ~ '^[a-z][a-z0-9_]{6,55}_bot$')
        )
    ) THEN
        RAISE EXCEPTION 'Invalid Application bot binding identity'
            USING ERRCODE = '22023';
    END IF;

    FOR v_attempt IN 1..5 LOOP
        v_short_id := rtrim(translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/', '-_'), '=');
        INSERT INTO applications.rel_application_bot_bindings (
            id, application_id, platform, bot_username, display_name, status, short_id,
            _upl_created_by, _upl_updated_by
        )
        VALUES (
            public.uuid_generate_v7(), p_application_id, p_platform, p_bot_username, p_display_name,
            'draft', v_short_id, v_actor, v_actor
        )
        ON CONFLICT (short_id) DO NOTHING
        RETURNING * INTO v_binding;

        IF FOUND THEN
            INSERT INTO applications.rel_application_control_audits (
                id, application_id, binding_id, event_type, changed_fields, previous_version, new_version,
                previous_show_in_app_list, new_show_in_app_list,
                _upl_created_by, _upl_updated_by
            )
            VALUES (
                public.uuid_generate_v7(), p_application_id, v_binding.id, 'bot_binding_created',
                '["platform", "bot_username", "display_name"]'::jsonb, NULL, 1, NULL, NULL, v_actor, v_actor
            );

            RETURN QUERY SELECT ${APPLICATION_BOT_BINDING_RESULT_SELECT}
                FROM applications.rel_application_bot_bindings AS b
                WHERE b.id = v_binding.id;
            RETURN;
        END IF;
    END LOOP;

    RAISE EXCEPTION 'Could not allocate a unique Application bot binding identifier'
        USING ERRCODE = '23505';
END;
$$;

CREATE OR REPLACE FUNCTION applications.update_application_bot_binding(
    p_application_id UUID,
    p_binding_id UUID,
    p_expected_version INTEGER,
    p_patch JSONB
)
RETURNS TABLE (${APPLICATION_BOT_BINDING_RESULT_COLUMNS})
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, applications, auth, admin, pg_temp
AS $$
DECLARE
    v_actor UUID;
    v_current applications.rel_application_bot_bindings%ROWTYPE;
    v_updated applications.rel_application_bot_bindings%ROWTYPE;
    v_bot_username TEXT;
    v_display_name TEXT;
    v_status TEXT;
    v_changed_fields TEXT[] := ARRAY[]::TEXT[];
    v_event_type TEXT;
BEGIN
    v_actor := applications.require_application_control_manager(p_application_id);

    IF p_expected_version IS NULL OR p_expected_version < 1
        OR p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' OR p_patch = '{}'::jsonb
        OR EXISTS (
            SELECT 1 FROM jsonb_object_keys(p_patch) AS patch_key
            WHERE patch_key NOT IN ('botUsername', 'displayName', 'status')
        )
        OR (jsonb_exists(p_patch, 'botUsername') AND jsonb_typeof(p_patch->'botUsername') <> 'string')
        OR (jsonb_exists(p_patch, 'displayName') AND jsonb_typeof(p_patch->'displayName') NOT IN ('string', 'null'))
        OR (jsonb_exists(p_patch, 'status') AND jsonb_typeof(p_patch->'status') <> 'string') THEN
        RAISE EXCEPTION 'Invalid Application bot binding update'
            USING ERRCODE = '22023';
    END IF;

    SELECT b.* INTO v_current
    FROM applications.rel_application_bot_bindings AS b
    WHERE b.application_id = p_application_id
      AND b.id = p_binding_id
      AND b.released_at IS NULL
      AND b._upl_archived = false
      AND b._upl_deleted = false
      AND b._app_archived = false
      AND b._app_deleted = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF COALESCE(v_current._upl_version, 1) <> p_expected_version THEN
        RAISE EXCEPTION 'Application bot binding version conflict'
            USING ERRCODE = '40001',
                DETAIL = jsonb_build_object(
                    'expectedVersion', p_expected_version,
                    'actualVersion', COALESCE(v_current._upl_version, 1),
                    'updatedAt', v_current._upl_updated_at
                )::text;
    END IF;

    v_bot_username := CASE WHEN jsonb_exists(p_patch, 'botUsername') THEN p_patch->>'botUsername' ELSE v_current.bot_username END;
    v_display_name := CASE WHEN jsonb_exists(p_patch, 'displayName') THEN p_patch->>'displayName' ELSE v_current.display_name END;
    v_status := CASE WHEN jsonb_exists(p_patch, 'status') THEN p_patch->>'status' ELSE v_current.status::text END;

    IF v_bot_username IS DISTINCT FROM v_current.bot_username THEN
        v_changed_fields := array_append(v_changed_fields, 'bot_username');
    END IF;
    IF v_display_name IS DISTINCT FROM v_current.display_name THEN
        v_changed_fields := array_append(v_changed_fields, 'display_name');
    END IF;
    IF v_status IS DISTINCT FROM v_current.status::text THEN
        v_changed_fields := array_append(v_changed_fields, 'status');
    END IF;

    IF cardinality(v_changed_fields) = 0 THEN
        RETURN QUERY SELECT ${APPLICATION_BOT_BINDING_RESULT_SELECT.replace(/b\./gu, 'v_current.')};
        RETURN;
    END IF;

    IF v_bot_username IS NULL OR v_bot_username <> lower(v_bot_username)
        OR (v_display_name IS DISTINCT FROM v_current.display_name
            AND v_display_name IS NOT NULL
            AND NOT applications.is_safe_application_bot_display_name(v_display_name))
        OR NOT (
            (v_current.platform = 'telegram' AND v_bot_username ~ '^[a-z0-9_]{5,32}$')
            OR (
                v_current.platform = 'max'
                AND char_length(v_bot_username) BETWEEN 11 AND 60
                AND (v_bot_username ~ '^[a-z][a-z0-9_]{7,56}bot$' OR v_bot_username ~ '^[a-z][a-z0-9_]{6,55}_bot$')
            )
        )
        OR v_status NOT IN ('draft', 'active', 'disabled') THEN
        RAISE EXCEPTION 'Invalid Application bot binding update'
            USING ERRCODE = '22023';
    END IF;

    UPDATE applications.rel_application_bot_bindings AS b
    SET bot_username = v_bot_username,
        display_name = v_display_name,
        status = v_status,
        _upl_updated_by = v_actor,
        _upl_updated_at = now(),
        _upl_version = COALESCE(v_current._upl_version, 1) + 1
    WHERE b.id = v_current.id
    RETURNING b.* INTO v_updated;

    v_event_type := CASE WHEN 'status' = ANY(v_changed_fields) THEN 'bot_binding_status_changed' ELSE 'bot_binding_updated' END;
    INSERT INTO applications.rel_application_control_audits (
        id, application_id, binding_id, event_type, changed_fields, previous_version, new_version,
        previous_show_in_app_list, new_show_in_app_list,
        _upl_created_by, _upl_updated_by
    )
    VALUES (
        public.uuid_generate_v7(), p_application_id, v_updated.id, v_event_type, to_jsonb(v_changed_fields),
        COALESCE(v_current._upl_version, 1), COALESCE(v_updated._upl_version, 1), NULL, NULL, v_actor, v_actor
    );

    RETURN QUERY SELECT ${APPLICATION_BOT_BINDING_RESULT_SELECT.replace(/b\./gu, 'v_updated.')};
END;
$$;

CREATE OR REPLACE FUNCTION applications.release_application_bot_binding(
    p_application_id UUID,
    p_binding_id UUID,
    p_expected_version INTEGER
)
RETURNS TABLE (${APPLICATION_BOT_BINDING_RESULT_COLUMNS})
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, applications, auth, admin, pg_temp
AS $$
DECLARE
    v_actor UUID;
    v_current applications.rel_application_bot_bindings%ROWTYPE;
    v_released applications.rel_application_bot_bindings%ROWTYPE;
    v_released_at TIMESTAMPTZ := now();
BEGIN
    v_actor := applications.require_application_control_manager(p_application_id);

    IF p_expected_version IS NULL OR p_expected_version < 1 THEN
        RAISE EXCEPTION 'expectedVersion is required for Application bot binding release'
            USING ERRCODE = '22023';
    END IF;

    SELECT b.* INTO v_current
    FROM applications.rel_application_bot_bindings AS b
    WHERE b.application_id = p_application_id
      AND b.id = p_binding_id
      AND b.released_at IS NULL
      AND b._upl_archived = false
      AND b._upl_deleted = false
      AND b._app_archived = false
      AND b._app_deleted = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF COALESCE(v_current._upl_version, 1) <> p_expected_version THEN
        RAISE EXCEPTION 'Application bot binding version conflict'
            USING ERRCODE = '40001',
                DETAIL = jsonb_build_object(
                    'expectedVersion', p_expected_version,
                    'actualVersion', COALESCE(v_current._upl_version, 1),
                    'updatedAt', v_current._upl_updated_at
                )::text;
    END IF;

    UPDATE applications.rel_application_bot_bindings AS b
    SET status = 'disabled',
        released_at = v_released_at,
        released_by = v_actor,
        _upl_updated_by = v_actor,
        _upl_updated_at = v_released_at,
        _upl_version = COALESCE(v_current._upl_version, 1) + 1,
        _upl_deleted = true,
        _upl_deleted_at = v_released_at,
        _upl_deleted_by = v_actor,
        _app_deleted = true,
        _app_deleted_at = v_released_at,
        _app_deleted_by = v_actor
    WHERE b.id = v_current.id
    RETURNING b.* INTO v_released;

    INSERT INTO applications.rel_application_control_audits (
        id, application_id, binding_id, event_type, changed_fields, previous_version, new_version,
        previous_show_in_app_list, new_show_in_app_list,
        _upl_created_by, _upl_updated_by
    )
    VALUES (
        public.uuid_generate_v7(), p_application_id, v_released.id, 'bot_binding_released',
        '["status", "released_at", "released_by", "_upl_deleted", "_upl_deleted_at", "_upl_deleted_by", "_app_deleted", "_app_deleted_at", "_app_deleted_by"]'::jsonb,
        COALESCE(v_current._upl_version, 1), COALESCE(v_released._upl_version, 1), NULL, NULL, v_actor, v_actor
    );

    RETURN QUERY SELECT ${APPLICATION_BOT_BINDING_RESULT_SELECT.replace(/b\./gu, 'v_released.')};
END;
$$;

CREATE OR REPLACE FUNCTION applications.release_application_bot_bindings_for_application(p_application_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, applications, auth, admin, pg_temp
AS $$
DECLARE
    v_actor UUID;
    v_released_count INTEGER;
BEGIN
    v_actor := applications.require_application_control_manager(p_application_id);

    WITH eligible AS MATERIALIZED (
        SELECT b.id, COALESCE(b._upl_version, 1) AS previous_version
        FROM applications.rel_application_bot_bindings AS b
        WHERE b.application_id = p_application_id
          AND b.released_at IS NULL
        FOR UPDATE
    ), released AS (
        UPDATE applications.rel_application_bot_bindings AS b
        SET status = 'disabled',
            released_at = now(),
            released_by = v_actor,
            _upl_updated_by = v_actor,
            _upl_updated_at = now(),
            _upl_version = COALESCE(b._upl_version, 1) + 1,
            _upl_deleted = true,
            _upl_deleted_at = now(),
            _upl_deleted_by = v_actor,
            _app_deleted = true,
            _app_deleted_at = now(),
            _app_deleted_by = v_actor
        FROM eligible AS e
        WHERE b.id = e.id
        RETURNING b.id, b.application_id, e.previous_version, COALESCE(b._upl_version, 1) AS new_version
    ), audits AS (
        INSERT INTO applications.rel_application_control_audits (
            id, application_id, binding_id, event_type, changed_fields, previous_version, new_version,
            previous_show_in_app_list, new_show_in_app_list,
            _upl_created_by, _upl_updated_by
        )
        SELECT
            public.uuid_generate_v7(), r.application_id, r.id, 'bot_binding_application_deleted',
            '["status", "released_at", "released_by", "_upl_deleted", "_upl_deleted_at", "_upl_deleted_by", "_app_deleted", "_app_deleted_at", "_app_deleted_by"]'::jsonb,
            r.previous_version, r.new_version, NULL, NULL, v_actor, v_actor
        FROM released AS r
        RETURNING binding_id
    )
    SELECT count(*)::INTEGER INTO v_released_count
    FROM released AS r
    INNER JOIN audits AS a ON a.binding_id = r.id;

    RETURN COALESCE(v_released_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION applications.record_application_catalog_visibility_audit(
    p_application_id UUID,
    p_event_type TEXT,
    p_previous_version INTEGER,
    p_new_version INTEGER,
    p_previous_value BOOLEAN,
    p_new_value BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, applications, auth, admin, pg_temp
AS $$
DECLARE
    v_actor UUID;
    v_application applications.obj_applications%ROWTYPE;
    v_audit_id UUID := public.uuid_generate_v7();
BEGIN
    v_actor := applications.require_application_control_manager(p_application_id);

    SELECT a.* INTO v_application
    FROM applications.obj_applications AS a
    WHERE a.id = p_application_id;

    IF p_event_type = 'catalog_visibility_initialized' THEN
        IF p_previous_version IS NOT NULL OR p_new_version IS DISTINCT FROM 1
            OR p_previous_value IS NOT NULL OR p_new_value IS DISTINCT FROM v_application.show_in_app_list
            OR COALESCE(v_application._upl_version, 1) <> 1
            OR v_application._upl_created_by IS DISTINCT FROM v_actor THEN
            RAISE EXCEPTION 'Invalid Application catalog initialization audit'
                USING ERRCODE = '42501';
        END IF;
    ELSE
        RAISE EXCEPTION 'Unsupported Application catalog audit event'
            USING ERRCODE = '42501';
    END IF;

    INSERT INTO applications.rel_application_control_audits (
        id, application_id, event_type, changed_fields, previous_version, new_version,
        previous_show_in_app_list, new_show_in_app_list, _upl_created_by, _upl_updated_by
    )
    VALUES (
        v_audit_id, p_application_id, p_event_type, '["show_in_app_list"]'::jsonb,
        p_previous_version, p_new_version, p_previous_value, p_new_value, v_actor, v_actor
    );

    RETURN v_audit_id;
END;
$$;
`

export const applicationCatalogVisibilityAuditTriggerSql = `
CREATE OR REPLACE FUNCTION applications.audit_application_catalog_visibility_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, applications, auth, admin, pg_temp
SET row_security = off
AS $$
DECLARE
    v_actor UUID := auth.uid();
BEGIN
    IF OLD.show_in_app_list IS NOT DISTINCT FROM NEW.show_in_app_list THEN
        RETURN NEW;
    END IF;

    IF v_actor IS NULL OR NEW._upl_updated_by IS DISTINCT FROM v_actor THEN
        RAISE EXCEPTION 'Application catalog visibility actor is invalid'
            USING ERRCODE = '42501';
    END IF;

    PERFORM applications.require_application_control_manager(NEW.id);

    IF COALESCE(NEW._upl_version, 1) <> COALESCE(OLD._upl_version, 1) + 1 THEN
        RAISE EXCEPTION 'Application catalog visibility version is invalid'
            USING ERRCODE = '40001';
    END IF;

    INSERT INTO applications.rel_application_control_audits (
        id, application_id, event_type, changed_fields, previous_version, new_version,
        previous_show_in_app_list, new_show_in_app_list, _upl_created_by, _upl_updated_by
    )
    VALUES (
        public.uuid_generate_v7(), NEW.id, 'catalog_visibility_changed', '["show_in_app_list"]'::jsonb,
        COALESCE(OLD._upl_version, 1), COALESCE(NEW._upl_version, 1),
        OLD.show_in_app_list, NEW.show_in_app_list, v_actor, v_actor
    );

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION applications.audit_application_catalog_visibility_change() FROM PUBLIC, anon, authenticated, service_role;
`
