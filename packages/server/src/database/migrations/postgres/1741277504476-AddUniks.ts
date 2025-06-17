import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUniks1741277504476 implements MigrationInterface {
    name = 'AddUniks1741277504476'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create "uniks" (workspace) table
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "uniks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_uniks" PRIMARY KEY ("id")
      )
    `)

        // 2. Create "user_uniks" table for linking users with workspaces
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_uniks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "unik_id" uuid NOT NULL,
        "role" character varying NOT NULL DEFAULT 'member',
        CONSTRAINT "PK_user_uniks" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_uniks_user_uniq" UNIQUE ("user_id", "unik_id"),
        CHECK ("user_id" IS NOT NULL),
        CHECK ("unik_id" IS NOT NULL)
      )
    `)

        // Try to add foreign key for "user_id", referencing auth.users table
        try {
            await queryRunner.query(`
        ALTER TABLE "user_uniks"
          ADD CONSTRAINT "FK_user_uniks_auth_users"
            FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE
      `)
        } catch (error) {
            console.warn('Warning: Unable to add FK constraint on user_uniks.user_id referencing auth.users. Continuing without it.', error)
        }

        // Add foreign key for "unik_id", referencing "uniks" table
        try {
            await queryRunner.query(`
        ALTER TABLE "user_uniks"
          ADD CONSTRAINT "FK_user_uniks_uniks"
            FOREIGN KEY ("unik_id") REFERENCES "uniks"("id") ON DELETE CASCADE
      `)
        } catch (error) {
            console.warn('Warning: Unable to add FK constraint on user_uniks.unik_id referencing uniks. Continuing without it.', error)
        }

        // 3. For each main table, add "unik_id" (NOT NULL) column and foreign key on "uniks" table
        const tables = [
            { name: 'chat_flow', tableName: 'chat_flow' },
            { name: 'credential', tableName: 'credential' },
            { name: 'tool', tableName: 'tool' },
            { name: 'assistant', tableName: 'assistant' },
            { name: 'variable', tableName: 'variable' },
            { name: 'apikey', tableName: 'apikey' },
            { name: 'document_store', tableName: 'document_store' },
            { name: 'custom_template', tableName: 'custom_template' }
        ]

        for (const tbl of tables) {
            await queryRunner.query(`
        ALTER TABLE "${tbl.tableName}"
          ADD COLUMN "unik_id" uuid NOT NULL
      `)
            await queryRunner.query(`
        ALTER TABLE "${tbl.tableName}"
          ADD CONSTRAINT "FK_${tbl.name}_unik"
            FOREIGN KEY ("unik_id") REFERENCES "uniks"("id")
              ON DELETE CASCADE
      `)
        }

        // 4. Enable Row-Level Security (RLS) for created tables
        await queryRunner.query(`ALTER TABLE "uniks" ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE "user_uniks" ENABLE ROW LEVEL SECURITY;`)
        for (const tbl of tables) {
            await queryRunner.query(`ALTER TABLE "${tbl.tableName}" ENABLE ROW LEVEL SECURITY;`)
        }

        // 5. Add policies for "uniks" table
        await queryRunner.query(`
      CREATE POLICY "Allow select uniks for authenticated users"
      ON "uniks"
      FOR SELECT
      USING (auth.role() = 'authenticated')
    `)
        await queryRunner.query(`
      CREATE POLICY "Allow insert uniks for authenticated users"
      ON "uniks"
      FOR INSERT
      WITH CHECK (true)
    `)
        await queryRunner.query(`
      CREATE POLICY "Allow update uniks for authenticated users"
      ON "uniks"
      FOR UPDATE
      USING (auth.role() = 'authenticated')
    `)
        await queryRunner.query(`
      CREATE POLICY "Allow delete uniks for authenticated users"
      ON "uniks"
      FOR DELETE
      USING (auth.role() = 'authenticated')
    `)

        // 6. Add policies for "user_uniks" table
        await queryRunner.query(`
      CREATE POLICY "Allow select user_uniks for authenticated users"
      ON "user_uniks"
      FOR SELECT
      USING (auth.role() = 'authenticated')
    `)
        await queryRunner.query(`
      CREATE POLICY "Allow insert user_uniks for authenticated users"
      ON "user_uniks"
      FOR INSERT
      WITH CHECK (true)
    `)
        await queryRunner.query(`
      CREATE POLICY "Allow update user_uniks for authenticated users"
      ON "user_uniks"
      FOR UPDATE
      USING (auth.role() = 'authenticated')
    `)
        await queryRunner.query(`
      CREATE POLICY "Allow delete user_uniks for authenticated users"
      ON "user_uniks"
      FOR DELETE
      USING (auth.role() = 'authenticated')
    `)

        // 7. Create SQL functions for user email/password updates
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

        // Create secure password verification function
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

        // Create secure password change function
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
                -- Get current user ID
                user_id := auth.uid();
                
                -- Check user is authenticated
                IF user_id IS NULL THEN
                    RAISE EXCEPTION 'User not authenticated';
                END IF;
                
                -- Validate new password
                IF (new_password = '') IS NOT FALSE THEN
                    RAISE EXCEPTION 'New password cannot be empty';
                ELSIF char_length(new_password) < 6 THEN
                    RAISE EXCEPTION 'Password must be at least 6 characters long';
                END IF;
                
                -- Verify current password
                SELECT verify_user_password(current_password) INTO is_valid_password;
                
                IF NOT is_valid_password THEN
                    RAISE EXCEPTION 'Current password is incorrect';
                END IF;
                
                -- Update password
                UPDATE auth.users 
                SET encrypted_password = crypt(new_password, gen_salt('bf'))
                WHERE id = user_id;
                
                RETURN '{"success": true, "message": "Password updated successfully"}';
            END;
            $$;
        `)

        // Keep old function for backward compatibility (deprecated)
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
        const tables = [
            { name: 'chat_flow', tableName: 'chat_flow' },
            { name: 'credential', tableName: 'credential' },
            { name: 'tool', tableName: 'tool' },
            { name: 'assistant', tableName: 'assistant' },
            { name: 'variable', tableName: 'variable' },
            { name: 'apikey', tableName: 'apikey' },
            { name: 'document_store', tableName: 'document_store' },
            { name: 'custom_template', tableName: 'custom_template' }
        ]

        // Drop policies for "uniks" and "user_uniks" tables
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow select uniks for authenticated users" ON "uniks";`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow insert uniks for authenticated users" ON "uniks";`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow update uniks for authenticated users" ON "uniks";`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow delete uniks for authenticated users" ON "uniks";`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow select user_uniks for authenticated users" ON "user_uniks";`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow insert user_uniks for authenticated users" ON "user_uniks";`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow update user_uniks for authenticated users" ON "user_uniks";`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow delete user_uniks for authenticated users" ON "user_uniks";`)

        // Drop SQL functions for user email/password updates
        await queryRunner.query(`DROP FUNCTION IF EXISTS update_user_email(uuid, text);`)
        await queryRunner.query(`DROP FUNCTION IF EXISTS update_user_password(uuid, text);`)
        await queryRunner.query(`DROP FUNCTION IF EXISTS verify_user_password(text);`)
        await queryRunner.query(`DROP FUNCTION IF EXISTS change_user_password_secure(text, text);`)

        for (const tbl of tables) {
            await queryRunner.query(`
        ALTER TABLE "${tbl.tableName}" DROP CONSTRAINT IF EXISTS "FK_${tbl.name}_unik"
      `)
            await queryRunner.query(`
        ALTER TABLE "${tbl.tableName}" DROP COLUMN IF EXISTS "unik_id"
      `)
        }
        await queryRunner.query(`DROP TABLE IF EXISTS "user_uniks"`)
        await queryRunner.query(`DROP TABLE IF EXISTS "uniks"`)
    }
}
