import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddProfile1741277504477 implements MigrationInterface {
    name = 'AddProfile1741277504477'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create profiles table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "profiles" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL UNIQUE,
                "nickname" character varying(50),
                "first_name" character varying(100),
                "last_name" character varying(100),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_profiles" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_profiles_user_id" UNIQUE ("user_id")
            )
        `)

        // 2. Add index for user_id lookup performance
        await queryRunner.query(`
            CREATE INDEX "idx_profiles_user_id" ON "profiles" ("user_id")
        `)

        // 3. Enable Row-Level Security for data privacy
        await queryRunner.query(`ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;`)

        // 4. Add RLS policies for profile access control
        await queryRunner.query(`
            CREATE POLICY "Allow users to view own profile"
            ON "profiles"
            FOR SELECT
            USING (auth.uid() = user_id)
        `)

        await queryRunner.query(`
            CREATE POLICY "Allow users to update own profile"
            ON "profiles"
            FOR UPDATE
            USING (auth.uid() = user_id)
        `)

        await queryRunner.query(`
            CREATE POLICY "Allow users to insert own profile"
            ON "profiles"
            FOR INSERT
            WITH CHECK (auth.uid() = user_id)
        `)

        // 5. Create profile management function for automatic profile creation
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION create_user_profile()
            RETURNS TRIGGER
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path = public, auth
            AS $$
            BEGIN
                -- Insert profile with RLS bypass through SECURITY DEFINER
                -- and explicit user_id from NEW.id
                INSERT INTO public.profiles (user_id)
                VALUES (NEW.id);
                RETURN NEW;
            EXCEPTION
                WHEN OTHERS THEN
                    -- Log error but don't interrupt user creation
                    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
                    RETURN NEW;
            END;
            $$;
        `)

        // 6. Create trigger for automatic profile creation on user registration
        await queryRunner.query(`
            CREATE TRIGGER create_profile_trigger
            AFTER INSERT ON auth.users
            FOR EACH ROW
            EXECUTE FUNCTION create_user_profile();
        `)

        // 7. Create profile-specific SQL functions (moved from Uniks migration)
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION update_user_email(user_id uuid, new_email text)
            RETURNS void
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            BEGIN
                UPDATE auth.users SET email = new_email WHERE id = user_id;
            END;
            $$;
        `)

        await queryRunner.query(`
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
        `)

        await queryRunner.query(`
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
        `)

        // 8. Keep backward compatibility function (deprecated)
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION update_user_password(user_id uuid, new_password text)
            RETURNS void
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            BEGIN
                UPDATE auth.users SET encrypted_password = crypt(new_password, gen_salt('bf')) WHERE id = user_id;
            END;
            $$;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop trigger and function
        await queryRunner.query(`DROP TRIGGER IF EXISTS create_profile_trigger ON auth.users;`)
        await queryRunner.query(`DROP FUNCTION IF EXISTS create_user_profile();`)

        // Drop profile-related SQL functions
        await queryRunner.query(`DROP FUNCTION IF EXISTS update_user_email(uuid, text);`)
        await queryRunner.query(`DROP FUNCTION IF EXISTS update_user_password(uuid, text);`)
        await queryRunner.query(`DROP FUNCTION IF EXISTS verify_user_password(text);`)
        await queryRunner.query(`DROP FUNCTION IF EXISTS change_user_password_secure(text, text);`)

        // Drop RLS policies
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to view own profile" ON "profiles";`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to update own profile" ON "profiles";`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to insert own profile" ON "profiles";`)

        // Drop table
        await queryRunner.query(`DROP TABLE IF EXISTS "profiles";`)
    }
}
