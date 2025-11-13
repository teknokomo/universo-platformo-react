import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateUniksSchema1731200000000 implements MigrationInterface {
    name = 'CreateUniksSchema1731200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Enable UUID extension
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)

        // 1) Create dedicated schema for uniks
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS uniks;`)

        // 2) Create core table: uniks
        await queryRunner.query(`
            CREATE TABLE uniks.uniks (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        // 3) Create user-unik relationship table
        await queryRunner.query(`
            CREATE TABLE uniks.uniks_users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                unik_id UUID NOT NULL,
                user_id UUID NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'owner',
                comment TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(unik_id, user_id),
                FOREIGN KEY (unik_id) REFERENCES uniks.uniks(id) ON DELETE CASCADE
            )
        `)

        // 4) Add foreign key for user_id to auth.users
        try {
            await queryRunner.query(`
                ALTER TABLE uniks.uniks_users
                ADD CONSTRAINT fk_uu_auth_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
            `)
        } catch (error) {
            console.warn(
                'Warning: Unable to add FK constraint on uniks_users.user_id referencing auth.users. Continuing without it.',
                error
            )
        }

        // 5) Performance indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_uu_unik ON uniks.uniks_users(unik_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_uu_user ON uniks.uniks_users(user_id)`)

        // 5a) Create trigger to automatically update updated_at timestamp for uniks_users
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION uniks.update_modified_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = now();
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        `)

        await queryRunner.query(`
            CREATE TRIGGER update_uniks_users_modtime
            BEFORE UPDATE ON uniks.uniks_users
            FOR EACH ROW
            EXECUTE FUNCTION uniks.update_modified_column()
        `)

        // 6) Enable RLS on all tables
        await queryRunner.query(`ALTER TABLE uniks.uniks ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE uniks.uniks_users ENABLE ROW LEVEL SECURITY;`)

        // 7) RLS Policies for uniks_users table
        // Allow users to view their own membership and admins/owners to manage all members in their Unik
        await queryRunner.query(`
            CREATE POLICY "Allow members to view and admins to manage memberships" ON uniks.uniks_users
            FOR ALL
            USING (
                user_id = auth.uid()
                OR
                EXISTS (
                    SELECT 1 FROM uniks.uniks_users uu
                    WHERE uu.unik_id = uniks_users.unik_id
                      AND uu.user_id = auth.uid()
                      AND uu.role IN ('owner', 'admin')
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM uniks.uniks_users uu
                    WHERE uu.unik_id = uniks_users.unik_id
                      AND uu.user_id = auth.uid()
                      AND uu.role IN ('owner', 'admin')
                )
            )
        `)

        // 8) RLS Policies for uniks (based on unik-user relationship)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their own uniks" ON uniks.uniks
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM uniks.uniks_users uu
                    WHERE uu.unik_id = uniks.uniks.id AND uu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM uniks.uniks_users uu
                    WHERE uu.unik_id = uniks.uniks.id AND uu.user_id = auth.uid()
                )
            )
        `)

        // 9) Search performance indexes (case-insensitive)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_unik_name_lower 
            ON uniks.uniks (LOWER("name"))
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_unik_description_lower 
            ON uniks.uniks (LOWER("description"))
        `)

        // 10) Attach unik_id to Flowise tables (restored from pre-refactoring migration)
        const flowiseTables = ['credential', 'tool', 'assistant', 'variable', 'apikey', 'document_store', 'custom_template']

        for (const tableName of flowiseTables) {
            // Add unik_id column (idempotent check)
            await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema='public' 
                        AND table_name='${tableName}' 
                        AND column_name='unik_id'
                    ) THEN
                        ALTER TABLE "${tableName}" ADD COLUMN unik_id UUID;
                    END IF;
                END$$;
            `)

            // Add FK constraint to uniks.uniks (with try-catch for idempotency)
            try {
                await queryRunner.query(`
                    ALTER TABLE "${tableName}"
                    ADD CONSTRAINT "FK_${tableName}_unik"
                    FOREIGN KEY (unik_id) REFERENCES uniks.uniks(id) ON DELETE CASCADE;
                `)
            } catch (error) {
                console.warn(`[CreateUniksSchema] FK constraint FK_${tableName}_unik already exists, skipping:`, error)
            }

            // Add index on unik_id for query performance
            await queryRunner.query(`
                CREATE INDEX IF NOT EXISTS "IDX_${tableName}_unik_id" 
                ON "${tableName}" (unik_id);
            `)

            console.log(`✅ [CreateUniksSchema] Added unik_id to ${tableName}`)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Rollback section 10: Remove unik_id from Flowise tables
        const flowiseTables = ['credential', 'tool', 'assistant', 'variable', 'apikey', 'document_store', 'custom_template']

        for (const tableName of flowiseTables) {
            await queryRunner.query(`DROP INDEX IF EXISTS "IDX_${tableName}_unik_id"`)
            await queryRunner.query(`ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "FK_${tableName}_unik"`)
            await queryRunner.query(`ALTER TABLE "${tableName}" DROP COLUMN IF EXISTS unik_id`)
        }

        // Drop search indexes
        await queryRunner.query(`DROP INDEX IF EXISTS uniks.idx_unik_description_lower`)
        await queryRunner.query(`DROP INDEX IF EXISTS uniks.idx_unik_name_lower`)

        // Drop RLS policies first
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow members to view and admins to manage memberships" ON uniks.uniks_users;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their own uniks" ON uniks.uniks;`)

        // Disable RLS
        await queryRunner.query(`ALTER TABLE uniks.uniks DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE uniks.uniks_users DISABLE ROW LEVEL SECURITY;`)

        // Drop trigger and function for updated_at
        await queryRunner.query(`DROP TRIGGER IF EXISTS update_uniks_users_modtime ON uniks.uniks_users`)
        await queryRunner.query(`DROP FUNCTION IF EXISTS uniks.update_modified_column()`)

        // Drop tables (membership table first to avoid FK constraint errors)
        await queryRunner.query(`DROP TABLE IF EXISTS uniks.uniks_users`)
        await queryRunner.query(`DROP TABLE IF EXISTS uniks.uniks`)
        await queryRunner.query(`DROP SCHEMA IF EXISTS uniks CASCADE`)
    }
}
