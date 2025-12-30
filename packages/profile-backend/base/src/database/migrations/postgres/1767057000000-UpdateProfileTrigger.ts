import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration: UpdateProfileTriggerAndRLS
 *
 * This migration consolidates trigger function and RLS policy updates for profile creation:
 * 1. Updates the INSERT RLS policy to allow profile creation for valid auth.users entries
 *    (instead of requiring auth.uid() = user_id, which fails during trigger execution)
 * 2. Updates the create_user_profile() trigger function with:
 *    - SECURITY DEFINER to bypass RLS during profile creation
 *    - SET search_path = public for security (prevents search_path injection)
 *    - Consent field extraction from raw_user_meta_data
 *
 * See: https://supabase.com/docs/guides/auth/managing-user-data
 * See: https://supabase.com/docs/guides/troubleshooting/dashboard-errors-when-managing-users-N1ls4A
 */
export class UpdateProfileTrigger1767057000000 implements MigrationInterface {
    name = 'UpdateProfileTrigger1767057000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Step 1: Update RLS INSERT policy
        // Problem: The original policy requires auth.uid() = user_id, which fails because:
        // - Trigger on auth.users runs BEFORE auth.uid() is available
        // - Node.js TypeORM queries don't have auth.uid() context
        // Solution: Allow INSERT if user_id exists in auth.users (validates the FK)
        await queryRunner.query(`
            DROP POLICY IF EXISTS "Allow users to insert own profile" ON "profiles";
        `)

        await queryRunner.query(`
            CREATE POLICY "Allow profile creation for existing users"
            ON "profiles"
            FOR INSERT
            WITH CHECK (
                EXISTS (SELECT 1 FROM auth.users WHERE id = user_id)
            );
        `)

        // Step 2: Update trigger function with SECURITY DEFINER and fixed search_path
        // This ensures the function runs with owner privileges and avoids search_path issues
        await queryRunner.query(`
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
                consent_ver VARCHAR(50);
            BEGIN
                -- Extract consent data from raw_user_meta_data (passed during signUp)
                BEGIN
                    terms_acc := COALESCE((NEW.raw_user_meta_data->>'terms_accepted')::boolean, false);
                    terms_at := (NEW.raw_user_meta_data->>'terms_accepted_at')::timestamptz;
                    privacy_acc := COALESCE((NEW.raw_user_meta_data->>'privacy_accepted')::boolean, false);
                    privacy_at := (NEW.raw_user_meta_data->>'privacy_accepted_at')::timestamptz;
                    consent_ver := NEW.raw_user_meta_data->>'consent_version';
                EXCEPTION WHEN OTHERS THEN
                    -- Log parsing errors for debugging, but don't block registration
                    RAISE NOTICE 'Failed to parse consent data from raw_user_meta_data for user %: %', NEW.id, SQLERRM;
                    terms_acc := false;
                    privacy_acc := false;
                    terms_at := NULL;
                    privacy_at := NULL;
                    consent_ver := NULL;
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
                            consent_version
                        )
                        VALUES (
                            NEW.id, 
                            temp_nickname, 
                            '{}',
                            terms_acc,
                            terms_at,
                            privacy_acc,
                            privacy_at,
                            consent_ver
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
                                    consent_version
                                )
                                VALUES (
                                    NEW.id, 
                                    temp_nickname, 
                                    '{}',
                                    terms_acc,
                                    terms_at,
                                    privacy_acc,
                                    privacy_at,
                                    consent_ver
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
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Restore original restrictive INSERT policy
        await queryRunner.query(`
            DROP POLICY IF EXISTS "Allow profile creation for existing users" ON "profiles";
        `)

        await queryRunner.query(`
            CREATE POLICY "Allow users to insert own profile"
            ON "profiles"
            FOR INSERT
            WITH CHECK (auth.uid() = user_id);
        `)

        // Restore original function without consent fields
        await queryRunner.query(`
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
        `)
    }
}
