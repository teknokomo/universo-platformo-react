import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUniks1741277504476 implements MigrationInterface {
    name = 'AddUniks1741277504476'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Ensure dedicated schema
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS uniks;`)

        // 2. Create core workspace table
        await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS uniks.uniks (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name varchar NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        );
  `)
        // Ensure updated_at column exists for dev idempotency (in case table was created earlier without it)
        await queryRunner.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema='uniks' AND table_name='uniks' AND column_name='updated_at'
            ) THEN
              ALTER TABLE uniks.uniks ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT now();
            END IF;
          END$$;
        `)

        // 3. Create membership table (renamed to uniks.uniks_users)
        await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS uniks.uniks_users (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid NOT NULL,
          unik_id uuid NOT NULL,
          role varchar NOT NULL DEFAULT 'member',
          CONSTRAINT UQ_uniks_users_user_unik UNIQUE (user_id, unik_id),
          CHECK (user_id IS NOT NULL),
          CHECK (unik_id IS NOT NULL)
        );
      `)

        // 4. Foreign keys (auth.users + uniks.uniks)
        try {
            await queryRunner.query(`
          ALTER TABLE uniks.uniks_users
            ADD CONSTRAINT FK_uniks_users_auth_users
              FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        `)
        } catch (e) {
            console.warn('[uniks] FK (user_id -> auth.users) not added (non-fatal)', e)
        }
        try {
            await queryRunner.query(`
          ALTER TABLE uniks.uniks_users
            ADD CONSTRAINT FK_uniks_users_uniks
              FOREIGN KEY (unik_id) REFERENCES uniks.uniks(id) ON DELETE CASCADE;
        `)
        } catch (e) {
            console.warn('[uniks] FK (unik_id -> uniks.uniks) not added (non-fatal)', e)
        }

        // Helpful indexes for membership lookups
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_uniks_users_unik ON uniks.uniks_users(unik_id);`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_uniks_users_user ON uniks.uniks_users(user_id);`)

        // 5. Attach unik_id to core existing tables (if not already present)
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
            // Add column only if it does not exist (idempotent-ish for dev environments)
            await queryRunner.query(`
              DO $$
              BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM information_schema.columns
                  WHERE table_name='${tbl.tableName}' AND column_name='unik_id'
                ) THEN
                  ALTER TABLE "${tbl.tableName}" ADD COLUMN unik_id uuid;
                  -- Set a temporary value NULL allowed until application sets proper unik; enforce NOT NULL after backfill if needed.
                END IF;
              END$$;
            `)
            // Ensure FK (will fail harmlessly if already exists)
            try {
                await queryRunner.query(`
                ALTER TABLE "${tbl.tableName}" ADD CONSTRAINT FK_${tbl.name}_unik
                  FOREIGN KEY (unik_id) REFERENCES uniks.uniks(id) ON DELETE CASCADE;
              `)
            } catch (e) {
                // Silent log only
                console.warn(`[uniks] FK add skipped for ${tbl.tableName}`, e)
            }
        }

        // 6. Enable RLS
        await queryRunner.query(`ALTER TABLE uniks.uniks ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE uniks.uniks_users ENABLE ROW LEVEL SECURITY;`)

        // 7. Secure policies (membership + auth.uid())
        // Uniks: SELECT limited to members
        await queryRunner.query(`
          CREATE POLICY uniks_select_members ON uniks.uniks
            FOR SELECT USING (
              EXISTS (
                SELECT 1 FROM uniks.uniks_users uu
                WHERE uu.unik_id = uniks.uniks.id AND uu.user_id = auth.uid()
              )
            );
        `)
        // Uniks: INSERT allowed for any authenticated user (application will create membership owner row afterwards)
        await queryRunner.query(`
          CREATE POLICY uniks_insert_owner ON uniks.uniks
            FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
        `)
        // Uniks: UPDATE / DELETE only by owner/admin member
        await queryRunner.query(`
          CREATE POLICY uniks_update_admin ON uniks.uniks
            FOR UPDATE USING (
              EXISTS (
                SELECT 1 FROM uniks.uniks_users uu
                WHERE uu.unik_id = uniks.uniks.id AND uu.user_id = auth.uid() AND uu.role IN ('owner','admin')
              )
            )
            WITH CHECK (
              EXISTS (
                SELECT 1 FROM uniks.uniks_users uu
                WHERE uu.unik_id = uniks.uniks.id AND uu.user_id = auth.uid() AND uu.role IN ('owner','admin')
              )
            );
        `)
        await queryRunner.query(`
          CREATE POLICY uniks_delete_admin ON uniks.uniks
            FOR DELETE USING (
              EXISTS (
                SELECT 1 FROM uniks.uniks_users uu
                WHERE uu.unik_id = uniks.uniks.id AND uu.user_id = auth.uid() AND uu.role IN ('owner','admin')
              )
            );
        `)

        // Membership table policies
        // SELECT: any member of the same unik can read membership rows
        await queryRunner.query(`
          CREATE POLICY uniks_users_select_members ON uniks.uniks_users
            FOR SELECT USING (
              EXISTS (
                SELECT 1 FROM uniks.uniks_users self
                WHERE self.unik_id = uniks.uniks_users.unik_id AND self.user_id = auth.uid()
              )
            );
        `)
        // INSERT: allow self-join (creating initial owner row) or admin/owner adding others
        await queryRunner.query(`
          CREATE POLICY uniks_users_insert ON uniks.uniks_users
            FOR INSERT WITH CHECK (
              user_id = auth.uid() OR EXISTS (
                SELECT 1 FROM uniks.uniks_users uu
                WHERE uu.unik_id = uniks.uniks_users.unik_id AND uu.user_id = auth.uid() AND uu.role IN ('owner','admin')
              )
            );
        `)
        // UPDATE + DELETE: only owner/admin of the same unik
        await queryRunner.query(`
          CREATE POLICY uniks_users_update ON uniks.uniks_users
            FOR UPDATE USING (
              EXISTS (
                SELECT 1 FROM uniks.uniks_users uu
                WHERE uu.unik_id = uniks.uniks_users.unik_id AND uu.user_id = auth.uid() AND uu.role IN ('owner','admin')
              )
            ) WITH CHECK (
              EXISTS (
                SELECT 1 FROM uniks.uniks_users uu
                WHERE uu.unik_id = uniks.uniks_users.unik_id AND uu.user_id = auth.uid() AND uu.role IN ('owner','admin')
              )
            );
        `)
        await queryRunner.query(`
          CREATE POLICY uniks_users_delete ON uniks.uniks_users
            FOR DELETE USING (
              EXISTS (
                SELECT 1 FROM uniks.uniks_users uu
                WHERE uu.unik_id = uniks.uniks_users.unik_id AND uu.user_id = auth.uid() AND uu.role IN ('owner','admin')
              )
            );
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

        // Drop policies (new names)
        const policyDrops = [
            'uniks_select_members',
            'uniks_insert_owner',
            'uniks_update_admin',
            'uniks_delete_admin',
            'uniks_users_select_members',
            'uniks_users_insert',
            'uniks_users_update',
            'uniks_users_delete'
        ]
        for (const p of policyDrops) {
            await queryRunner.query(`DROP POLICY IF EXISTS ${p} ON uniks.uniks;`).catch(() => {})
            await queryRunner.query(`DROP POLICY IF EXISTS ${p} ON uniks.uniks_users;`).catch(() => {})
        }

        for (const tbl of tables) {
            try {
                await queryRunner.query(`ALTER TABLE "${tbl.tableName}" DROP CONSTRAINT IF EXISTS FK_${tbl.name}_unik;`)
                await queryRunner.query(`ALTER TABLE "${tbl.tableName}" DROP COLUMN IF EXISTS unik_id;`)
            } catch (e) {
                console.warn(`[uniks] down(): issue cleaning ${tbl.tableName}`, e)
            }
        }
        await queryRunner.query('DROP TABLE IF EXISTS uniks.uniks_users CASCADE;')
        await queryRunner.query('DROP TABLE IF EXISTS uniks.uniks CASCADE;')
        await queryRunner.query('DROP SCHEMA IF EXISTS uniks CASCADE;')
    }
}
