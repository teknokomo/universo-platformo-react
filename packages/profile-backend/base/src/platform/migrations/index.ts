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

export const addProfileMigrationDefinition: SqlMigrationDefinition = {
    id: 'AddProfile1741277504477',
    version: '1741277504477',
    summary: 'Create profiles table, policies, and profile trigger with full system fields',
    up: [
        {
            sql: `CREATE SCHEMA IF NOT EXISTS "profiles";`
        },
        {
            sql: `
CREATE TABLE IF NOT EXISTS profiles.obj_profiles (
    id UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    user_id UUID NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    settings JSONB NOT NULL DEFAULT '{}',
    onboarding_completed BOOLEAN NOT NULL DEFAULT false,
    terms_accepted BOOLEAN NOT NULL DEFAULT false,
    terms_accepted_at TIMESTAMPTZ,
    privacy_accepted BOOLEAN NOT NULL DEFAULT false,
    privacy_accepted_at TIMESTAMPTZ,
    terms_version VARCHAR(50),
    privacy_version VARCHAR(50),
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
    CONSTRAINT "PK_profiles" PRIMARY KEY (id)
)
        `
        },
        {
            sql: `
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id_active
    ON profiles.obj_profiles (user_id)
    WHERE _upl_deleted = false AND _app_deleted = false
        `
        },
        {
            sql: `
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_nickname_active
    ON profiles.obj_profiles (nickname)
    WHERE _upl_deleted = false AND _app_deleted = false
        `
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles.obj_profiles (user_id)`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_profiles_nickname ON profiles.obj_profiles (nickname)`
        },
        {
            sql: `
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed
    ON profiles.obj_profiles (onboarding_completed)
        `
        },
        {
            sql: `
CREATE INDEX IF NOT EXISTS idx_profiles_terms_accepted
    ON profiles.obj_profiles (terms_accepted)
        `
        },
        {
            sql: `
CREATE INDEX IF NOT EXISTS idx_profiles_privacy_accepted
    ON profiles.obj_profiles (privacy_accepted)
        `
        },
        {
            sql: `ALTER TABLE profiles.obj_profiles ENABLE ROW LEVEL SECURITY;`
        },
        createDropPolicyIfTableExistsStatement('Allow users to view own profile', 'profiles', 'obj_profiles'),
        {
            sql: `
CREATE POLICY "Allow users to view own profile"
    ON profiles.obj_profiles
    FOR SELECT
    USING ((select auth.uid()) = user_id)
        `
        },
        createDropPolicyIfTableExistsStatement('Allow users to update own profile', 'profiles', 'obj_profiles'),
        {
            sql: `
CREATE POLICY "Allow users to update own profile"
    ON profiles.obj_profiles
    FOR UPDATE
    USING ((select auth.uid()) = user_id)
        `
        },
        createDropPolicyIfTableExistsStatement('Allow profile creation for existing users', 'profiles', 'obj_profiles'),
        createDropPolicyIfTableExistsStatement('Allow users to insert own profile', 'profiles', 'obj_profiles'),
        {
            sql: `
CREATE POLICY "Allow users to insert own profile"
    ON profiles.obj_profiles
    FOR INSERT
    WITH CHECK ((select auth.uid()) = user_id)
        `
        },
        // ── Profile trigger (converged with consent fields + system fields) ──
        {
            sql: `
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = profiles, public, auth, pg_temp
AS $func$
DECLARE
    temp_nickname TEXT;
    attempt_count INTEGER := 0;
    max_attempts INTEGER := 5;
    terms_acc BOOLEAN;
    terms_at TIMESTAMPTZ;
    privacy_acc BOOLEAN;
    privacy_at TIMESTAMPTZ;
    terms_ver VARCHAR(50);
    privacy_ver VARCHAR(50);
BEGIN
    BEGIN
        terms_acc := COALESCE((NEW.raw_user_meta_data->>'terms_accepted')::boolean, false);
        terms_at := (NEW.raw_user_meta_data->>'terms_accepted_at')::timestamptz;
        privacy_acc := COALESCE((NEW.raw_user_meta_data->>'privacy_accepted')::boolean, false);
        privacy_at := (NEW.raw_user_meta_data->>'privacy_accepted_at')::timestamptz;
        terms_ver := NEW.raw_user_meta_data->>'terms_version';
        privacy_ver := NEW.raw_user_meta_data->>'privacy_version';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to parse consent data from raw_user_meta_data for user %: %', NEW.id, SQLERRM;
        terms_acc := false;
        privacy_acc := false;
        terms_at := NULL;
        privacy_at := NULL;
        terms_ver := NULL;
        privacy_ver := NULL;
    END;

    LOOP
        attempt_count := attempt_count + 1;
        temp_nickname := 'user_' || substring(NEW.id::text from 1 for 8);

        IF attempt_count > 1 THEN
            temp_nickname := temp_nickname || '_' || attempt_count;
        END IF;

        BEGIN
            INSERT INTO profiles.obj_profiles (
                user_id, nickname, settings,
                terms_accepted, terms_accepted_at,
                privacy_accepted, privacy_accepted_at,
                terms_version, privacy_version,
                _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                _upl_version, _upl_deleted, _app_published, _app_deleted, _app_access_level
            ) VALUES (
                NEW.id, temp_nickname, '{}',
                terms_acc, terms_at,
                privacy_acc, privacy_at,
                terms_ver, privacy_ver,
                now(), NEW.id, now(), NEW.id,
                1, false, true, false, 'private'
            );
            EXIT;
        EXCEPTION
            WHEN unique_violation THEN
                IF attempt_count >= max_attempts THEN
                    temp_nickname := 'user_' || extract(epoch from now())::bigint;
                    INSERT INTO profiles.obj_profiles (
                        user_id, nickname, settings,
                        terms_accepted, terms_accepted_at,
                        privacy_accepted, privacy_accepted_at,
                        terms_version, privacy_version,
                        _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                        _upl_version, _upl_deleted, _app_published, _app_deleted, _app_access_level
                    ) VALUES (
                        NEW.id, temp_nickname, '{}',
                        terms_acc, terms_at,
                        privacy_acc, privacy_at,
                        terms_ver, privacy_ver,
                        now(), NEW.id, now(), NEW.id,
                        1, false, true, false, 'private'
                    );
                    EXIT;
                END IF;
        END;
    END LOOP;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$func$;
        `
        },
        {
            sql: `
DO $$
BEGIN
    DROP TRIGGER IF EXISTS create_profile_trigger ON auth.users;
    CREATE TRIGGER create_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();
END $$;
        `
        },
        // ── Utility functions (unchanged from original) ───────────────
        {
            sql: `
CREATE OR REPLACE FUNCTION update_user_email(user_id uuid, new_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = profiles, public, auth, pg_temp
AS $$
BEGIN
    UPDATE auth.users SET email = new_email WHERE id = user_id;
END;
$$;
        `
        },
        {
            sql: `
CREATE OR REPLACE FUNCTION verify_user_password(password text)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth, pg_temp
AS $$
DECLARE
    user_id uuid;
BEGIN
    user_id := auth.uid();
    RETURN EXISTS (
        SELECT id
        FROM auth.users
        WHERE id = user_id
        AND encrypted_password = crypt(password::text, auth.users.encrypted_password)
    );
END;
$$;
        `
        },
        {
            sql: `
CREATE OR REPLACE FUNCTION change_user_password_secure(
    current_password text,
    new_password text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth, pg_temp
AS $$
DECLARE
    user_id uuid;
    is_valid_password boolean;
BEGIN
    user_id := auth.uid();

    IF user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    IF (new_password = '') IS NOT FALSE THEN
        RAISE EXCEPTION 'New password cannot be empty';
    ELSIF char_length(new_password) < 6 THEN
        RAISE EXCEPTION 'Password must be at least 6 characters long';
    END IF;

    SELECT verify_user_password(current_password) INTO is_valid_password;

    IF NOT is_valid_password THEN
        RAISE EXCEPTION 'Current password is incorrect';
    END IF;

    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf'))
    WHERE id = user_id;

    RETURN '{"success": true, "message": "Password updated successfully"}';
END;
$$;
        `
        },
        {
            sql: `
CREATE OR REPLACE FUNCTION update_user_password(user_id uuid, new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth, pg_temp
AS $$
BEGIN
    UPDATE auth.users SET encrypted_password = crypt(new_password, gen_salt('bf')) WHERE id = user_id;
END;
$$;
        `
        },
        {
            sql: `
DO $$
BEGIN
    REVOKE ALL ON FUNCTION create_user_profile() FROM PUBLIC;
    REVOKE ALL ON FUNCTION update_user_email(uuid, text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION verify_user_password(text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION change_user_password_secure(text, text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION update_user_password(uuid, text) FROM PUBLIC;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT EXECUTE ON FUNCTION verify_user_password(text) TO authenticated;
        GRANT EXECUTE ON FUNCTION change_user_password_secure(text, text) TO authenticated;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION create_user_profile() TO service_role;
        GRANT EXECUTE ON FUNCTION update_user_email(uuid, text) TO service_role;
        GRANT EXECUTE ON FUNCTION verify_user_password(text) TO service_role;
        GRANT EXECUTE ON FUNCTION change_user_password_secure(text, text) TO service_role;
        GRANT EXECUTE ON FUNCTION update_user_password(uuid, text) TO service_role;
    END IF;
END $$;
        `
        }
    ] as const,
    down: [
        { sql: `DROP TRIGGER IF EXISTS create_profile_trigger ON auth.users;` },
        { sql: `DROP FUNCTION IF EXISTS create_user_profile();` },
        { sql: `DROP FUNCTION IF EXISTS update_user_email(uuid, text);` },
        { sql: `DROP FUNCTION IF EXISTS update_user_password(uuid, text);` },
        { sql: `DROP FUNCTION IF EXISTS verify_user_password(text);` },
        { sql: `DROP FUNCTION IF EXISTS change_user_password_secure(text, text);` },
        createDropPolicyIfTableExistsStatement('Allow users to view own profile', 'profiles', 'obj_profiles'),
        createDropPolicyIfTableExistsStatement('Allow users to update own profile', 'profiles', 'obj_profiles'),
        createDropPolicyIfTableExistsStatement('Allow profile creation for existing users', 'profiles', 'obj_profiles'),
        createDropPolicyIfTableExistsStatement('Allow users to insert own profile', 'profiles', 'obj_profiles'),
        { sql: `DROP TABLE IF EXISTS profiles.obj_profiles;` },
        { sql: `DROP SCHEMA IF EXISTS profiles;` }
    ] as const
}

const profileSchemaPreludeStatements = addProfileMigrationDefinition.up.slice(0, 1)
const profileSchemaPostGenerationStatements = addProfileMigrationDefinition.up.slice(2)

export const prepareProfileSchemaSupportMigrationDefinition: SqlMigrationDefinition = {
    id: 'PrepareProfileSchemaSupport1741277504477',
    version: '1741277504477',
    summary: 'Prepare profiles support objects before definition-driven schema generation',
    up: profileSchemaPreludeStatements,
    down: [] as const
}

export const finalizeProfileSchemaSupportMigrationDefinition: SqlMigrationDefinition = {
    id: 'FinalizeProfileSchemaSupport1741277504478',
    version: '1741277504478',
    summary: 'Finalize profiles support objects after definition-driven schema generation',
    up: profileSchemaPostGenerationStatements,
    down: [] as const
}
