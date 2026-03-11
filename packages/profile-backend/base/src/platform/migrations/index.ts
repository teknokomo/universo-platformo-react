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

export const addProfileMigrationDefinition: SqlMigrationDefinition = {
    id: 'AddProfile1741277504477',
    version: '1741277504477',
    summary: 'Create profiles table, policies, and profile trigger',
    up: [
    {
        sql: `
CREATE TABLE IF NOT EXISTS "profiles" (
                "id" uuid NOT NULL DEFAULT public.uuid_generate_v7(),
                "user_id" uuid NOT NULL UNIQUE,
                "nickname" character varying(50) NOT NULL UNIQUE,
                "first_name" character varying(100),
                "last_name" character varying(100),
                "settings" jsonb NOT NULL DEFAULT '{}',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_profiles" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_profiles_user_id" UNIQUE ("user_id"),
                CONSTRAINT "UQ_profiles_nickname" UNIQUE ("nickname")
            )
        `
    },
    {
        sql: `
CREATE INDEX "idx_profiles_user_id" ON "profiles" ("user_id")
        `
    },
    {
        sql: `
CREATE INDEX "idx_profiles_nickname" ON "profiles" ("nickname")
        `
    },
    {
        sql: `
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
        `
    },
    {
        sql: `
CREATE POLICY "Allow users to view own profile"
            ON "profiles"
            FOR SELECT
            USING ((select auth.uid()) = user_id)
        `
    },
    {
        sql: `
CREATE POLICY "Allow users to update own profile"
            ON "profiles"
            FOR UPDATE
            USING ((select auth.uid()) = user_id)
        `
    },
    {
        sql: `
CREATE POLICY "Allow users to insert own profile"
            ON "profiles"
            FOR INSERT
            WITH CHECK ((select auth.uid()) = user_id)
        `
    },
    {
        sql: `
DO $$
            BEGIN
                -- Safely drop existing trigger if it exists
                DROP TRIGGER IF EXISTS create_profile_trigger ON auth.users;

                -- Check if function exists and create only if needed
                IF NOT EXISTS (
                    SELECT 1 FROM pg_proc p
                    JOIN pg_namespace n ON p.pronamespace = n.oid
                    WHERE p.proname = 'create_user_profile' AND n.nspname = 'public'
                ) THEN
                    -- Create function only if it doesn't exist
                    CREATE OR REPLACE FUNCTION create_user_profile()
                    RETURNS TRIGGER
                    LANGUAGE plpgsql
                    SECURITY DEFINER
                    SET search_path = public, auth
                    AS $func$
                    DECLARE
                        temp_nickname VARCHAR(50);
                        attempt_count INTEGER := 0;
                        max_attempts INTEGER := 5;
                    BEGIN
                        -- Generate unique temporary nickname
                        LOOP
                            attempt_count := attempt_count + 1;
                            temp_nickname := 'user_' || substring(NEW.id::text from 1 for 8);

                            -- Add suffix if nickname already exists
                            IF attempt_count > 1 THEN
                                temp_nickname := temp_nickname || '_' || attempt_count;
                            END IF;

                            -- Try to insert profile with generated nickname and default settings
                            BEGIN
                                INSERT INTO public.profiles (user_id, nickname, settings)
                                VALUES (NEW.id, temp_nickname, '{}');
                                EXIT; -- Success, exit loop
                            EXCEPTION
                                WHEN unique_violation THEN
                                    -- If nickname already exists, try again
                                    IF attempt_count >= max_attempts THEN
                                        -- Use timestamp as fallback
                                        temp_nickname := 'user_' || extract(epoch from now())::bigint;
                                        INSERT INTO public.profiles (user_id, nickname, settings)
                                        VALUES (NEW.id, temp_nickname, '{}');
                                        EXIT;
                                    END IF;
                            END;
                        END LOOP;

                        RETURN NEW;
                    EXCEPTION
                        WHEN OTHERS THEN
                            -- Log error but don't interrupt user creation
                            RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
                            RETURN NEW;
                    END;
                    $func$;
                END IF;

                -- Create trigger (now safely, function exists)
                CREATE TRIGGER create_profile_trigger
                AFTER INSERT ON auth.users
                FOR EACH ROW
                EXECUTE FUNCTION create_user_profile();
            END $$;
        `
    },
    {
        sql: `
CREATE OR REPLACE FUNCTION update_user_email(user_id uuid, new_email text)
            RETURNS void
            LANGUAGE plpgsql
            SECURITY DEFINER
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
            SET search_path = extensions, public, auth
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
            SET search_path = extensions, public, auth
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
            AS $$
            BEGIN
                UPDATE auth.users SET encrypted_password = crypt(new_password, gen_salt('bf')) WHERE id = user_id;
            END;
            $$;
        `
    }
] as const,
    down: [
    {
        sql: `
DROP TRIGGER IF EXISTS create_profile_trigger ON auth.users;
        `
    },
    {
        sql: `
DROP FUNCTION IF EXISTS create_user_profile();
        `
    },
    {
        sql: `
DROP FUNCTION IF EXISTS update_user_email(uuid, text);
        `
    },
    {
        sql: `
DROP FUNCTION IF EXISTS update_user_password(uuid, text);
        `
    },
    {
        sql: `
DROP FUNCTION IF EXISTS verify_user_password(text);
        `
    },
    {
        sql: `
DROP FUNCTION IF EXISTS change_user_password_secure(text, text);
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "Allow users to view own profile" ON "profiles";
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "Allow users to update own profile" ON "profiles";
        `
    },
    {
        sql: `
DROP POLICY IF EXISTS "Allow users to insert own profile" ON "profiles";
        `
    },
    {
        sql: `
DROP TABLE IF EXISTS "profiles";
        `
    }
] as const
}

export const addOnboardingCompletedMigrationDefinition: SqlMigrationDefinition = {
    id: 'AddOnboardingCompleted1766821477094',
    version: '1766821477094',
    summary: 'Add onboarding completed field to profiles',
    up: [
    {
        sql: `
ALTER TABLE "profiles" 
            ADD COLUMN IF NOT EXISTS "onboarding_completed" BOOLEAN NOT NULL DEFAULT false
        `
    },
    {
        sql: `
CREATE INDEX IF NOT EXISTS "idx_profiles_onboarding_completed" 
            ON "profiles" ("onboarding_completed")
        `
    }
] as const,
    down: [
    {
        sql: `
DROP INDEX IF EXISTS "idx_profiles_onboarding_completed"
        `
    },
    {
        sql: `
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "onboarding_completed"
        `
    }
] as const
}

export const addConsentFieldsMigrationDefinition: SqlMigrationDefinition = {
    id: 'AddConsentFields1767049102876',
    version: '1767049102876',
    summary: 'Add consent fields and indexes to profiles',
    up: [
    {
        sql: `
ALTER TABLE "profiles" 
            ADD COLUMN IF NOT EXISTS "terms_accepted" BOOLEAN NOT NULL DEFAULT false
        `
    },
    {
        sql: `
ALTER TABLE "profiles" 
            ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMP WITH TIME ZONE
        `
    },
    {
        sql: `
ALTER TABLE "profiles" 
            ADD COLUMN IF NOT EXISTS "privacy_accepted" BOOLEAN NOT NULL DEFAULT false
        `
    },
    {
        sql: `
ALTER TABLE "profiles" 
            ADD COLUMN IF NOT EXISTS "privacy_accepted_at" TIMESTAMP WITH TIME ZONE
        `
    },
    {
        sql: `
ALTER TABLE "profiles" 
            ADD COLUMN IF NOT EXISTS "terms_version" VARCHAR(50)
        `
    },
    {
        sql: `
ALTER TABLE "profiles" 
            ADD COLUMN IF NOT EXISTS "privacy_version" VARCHAR(50)
        `
    },
    {
        sql: `
CREATE INDEX IF NOT EXISTS "idx_profiles_terms_accepted" 
            ON "profiles" ("terms_accepted")
        `
    },
    {
        sql: `
CREATE INDEX IF NOT EXISTS "idx_profiles_privacy_accepted" 
            ON "profiles" ("privacy_accepted")
        `
    }
] as const,
    down: [
    {
        sql: `
DROP INDEX IF EXISTS "idx_profiles_privacy_accepted"
        `
    },
    {
        sql: `
DROP INDEX IF EXISTS "idx_profiles_terms_accepted"
        `
    },
    {
        sql: `
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "privacy_version"
        `
    },
    {
        sql: `
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "terms_version"
        `
    },
    {
        sql: `
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "privacy_accepted_at"
        `
    },
    {
        sql: `
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "privacy_accepted"
        `
    },
    {
        sql: `
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "terms_accepted_at"
        `
    },
    {
        sql: `
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "terms_accepted"
        `
    }
] as const
}

export const updateProfileTriggerMigrationDefinition: SqlMigrationDefinition = {
    id: 'UpdateProfileTrigger1767057000000',
    version: '1767057000000',
    summary: 'Update profile creation trigger and policies',
    up: [
    {
        sql: `
DROP POLICY IF EXISTS "Allow users to insert own profile" ON "profiles";
        `
    },
    {
        sql: `
CREATE POLICY "Allow profile creation for existing users"
            ON "profiles"
            FOR INSERT
            WITH CHECK (
                EXISTS (SELECT 1 FROM auth.users WHERE id = user_id)
            );
        `
    },
    {
        sql: `
CREATE OR REPLACE FUNCTION create_user_profile()
            RETURNS TRIGGER
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path = public
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
                -- Extract consent data from raw_user_meta_data (passed during signUp)
                BEGIN
                    terms_acc := COALESCE((NEW.raw_user_meta_data->>'terms_accepted')::boolean, false);
                    terms_at := (NEW.raw_user_meta_data->>'terms_accepted_at')::timestamptz;
                    privacy_acc := COALESCE((NEW.raw_user_meta_data->>'privacy_accepted')::boolean, false);
                    privacy_at := (NEW.raw_user_meta_data->>'privacy_accepted_at')::timestamptz;
                    terms_ver := NEW.raw_user_meta_data->>'terms_version';
                    privacy_ver := NEW.raw_user_meta_data->>'privacy_version';
                EXCEPTION WHEN OTHERS THEN
                    -- Log parsing errors for debugging, but don't block registration
                    RAISE NOTICE 'Failed to parse consent data from raw_user_meta_data for user %: %', NEW.id, SQLERRM;
                    terms_acc := false;
                    privacy_acc := false;
                    terms_at := NULL;
                    privacy_at := NULL;
                    terms_ver := NULL;
                    privacy_ver := NULL;
                END;

                -- Generate unique temporary nickname
                LOOP
                    attempt_count := attempt_count + 1;
                    temp_nickname := 'user_' || substring(NEW.id::text from 1 for 8);

                    IF attempt_count > 1 THEN
                        temp_nickname := temp_nickname || '_' || attempt_count;
                    END IF;

                    BEGIN
                        INSERT INTO profiles (
                            user_id, 
                            nickname, 
                            settings,
                            terms_accepted,
                            terms_accepted_at,
                            privacy_accepted,
                            privacy_accepted_at,
                            terms_version,
                            privacy_version
                        )
                        VALUES (
                            NEW.id, 
                            temp_nickname, 
                            '{}',
                            terms_acc,
                            terms_at,
                            privacy_acc,
                            privacy_at,
                            terms_ver,
                            privacy_ver
                        );
                        EXIT; -- Success
                    EXCEPTION
                        WHEN unique_violation THEN
                            IF attempt_count >= max_attempts THEN
                                -- Use timestamp as fallback for truly unique nickname
                                temp_nickname := 'user_' || extract(epoch from now())::bigint;
                                INSERT INTO profiles (
                                    user_id, 
                                    nickname, 
                                    settings,
                                    terms_accepted,
                                    terms_accepted_at,
                                    privacy_accepted,
                                    privacy_accepted_at,
                                    terms_version,
                                    privacy_version
                                )
                                VALUES (
                                    NEW.id, 
                                    temp_nickname, 
                                    '{}',
                                    terms_acc,
                                    terms_at,
                                    privacy_acc,
                                    privacy_at,
                                    terms_ver,
                                    privacy_ver
                                );
                                EXIT;
                            END IF;
                    END;
                END LOOP;

                RETURN NEW;
            EXCEPTION
                WHEN OTHERS THEN
                    -- Log error but don't block user signup (fail-open strategy)
                    -- Profile will be created by Node.js fallback if trigger fails
                    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
                    RETURN NEW;
            END;
            $func$;
        `
    }
] as const,
    down: [
    {
        sql: `
DROP POLICY IF EXISTS "Allow profile creation for existing users" ON "profiles";
        `
    },
    {
        sql: `
CREATE POLICY "Allow users to insert own profile"
            ON "profiles"
            FOR INSERT
            WITH CHECK ((select auth.uid()) = user_id);
        `
    },
    {
        sql: `
CREATE OR REPLACE FUNCTION create_user_profile()
            RETURNS TRIGGER
            LANGUAGE plpgsql
            AS $func$
            DECLARE
                temp_nickname TEXT;
                attempt_count INTEGER := 0;
                max_attempts INTEGER := 5;
            BEGIN
                -- Generate unique temporary nickname
                LOOP
                    attempt_count := attempt_count + 1;
                    temp_nickname := 'user_' || substring(NEW.id::text from 1 for 8);

                    IF attempt_count > 1 THEN
                        temp_nickname := temp_nickname || '_' || attempt_count;
                    END IF;

                    BEGIN
                        INSERT INTO public.profiles (user_id, nickname, settings)
                        VALUES (NEW.id, temp_nickname, '{}');
                        EXIT;
                    EXCEPTION
                        WHEN unique_violation THEN
                            IF attempt_count >= max_attempts THEN
                                temp_nickname := 'user_' || extract(epoch from now())::bigint;
                                INSERT INTO public.profiles (user_id, nickname, settings)
                                VALUES (NEW.id, temp_nickname, '{}');
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
    }
] as const
}
