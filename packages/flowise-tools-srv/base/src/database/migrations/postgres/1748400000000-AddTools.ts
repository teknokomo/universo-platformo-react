import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Consolidated migration for Tool table
 * Combines functionality from:
 * - 1693891895163-Init.ts (tool table creation)
 * - 1693997339912-ModifyTool.ts (schema/func type change to TEXT)
 * - 1731200000000-AddUniksAndLinked.ts (unik_id column)
 *
 * This migration is idempotent and safe to run on existing databases.
 */
export class AddTools1748400000000 implements MigrationInterface {
    name = 'AddTools1748400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if table already exists (for existing databases)
        const tableExists = await queryRunner.hasTable('tool')

        if (!tableExists) {
            // Create tool table with all fields consolidated
            await queryRunner.query(`
                CREATE TABLE "public"."tool" (
                    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                    "name" varchar NOT NULL,
                    "description" text NOT NULL,
                    "color" varchar NOT NULL,
                    "iconSrc" varchar NULL,
                    "schema" text NULL,
                    "func" text NULL,
                    "unik_id" uuid NOT NULL,
                    "createdDate" timestamp NOT NULL DEFAULT now(),
                    "updatedDate" timestamp NOT NULL DEFAULT now()
                );
            `)

            console.log('✅ [AddTools] Created tool table')
        } else {
            console.log('ℹ️ [AddTools] Tool table already exists, checking columns...')

            // Ensure unik_id column exists (for databases migrated from old schema)
            const hasUnikId = await queryRunner.hasColumn('tool', 'unik_id')
            if (!hasUnikId) {
                await queryRunner.query(`
                    ALTER TABLE "public"."tool" ADD COLUMN "unik_id" uuid;
                `)
                console.log('✅ [AddTools] Added unik_id column to existing tool table')
            }
        }

        // Add FK constraint to uniks (idempotent)
        try {
            await queryRunner.query(`
                ALTER TABLE "public"."tool"
                ADD CONSTRAINT "FK_tool_unik"
                FOREIGN KEY ("unik_id") REFERENCES uniks.uniks(id) ON DELETE CASCADE;
            `)
            console.log('✅ [AddTools] Added FK constraint FK_tool_unik')
        } catch {
            console.log('ℹ️ [AddTools] FK constraint FK_tool_unik already exists, skipping')
        }

        // Add index on unik_id (idempotent)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_tool_unik_id" ON "public"."tool" ("unik_id");
        `)

        // Enable RLS
        await queryRunner.query(`ALTER TABLE "public"."tool" ENABLE ROW LEVEL SECURITY;`)

        // Create RLS policy (drop first to ensure idempotency)
        await queryRunner.query(`DROP POLICY IF EXISTS "tool_access" ON "public"."tool";`)
        await queryRunner.query(`
            CREATE POLICY "tool_access" ON "public"."tool"
            FOR ALL TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM uniks.uniks_users uu
                    WHERE uu.unik_id = tool.unik_id
                      AND uu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM uniks.uniks_users uu
                    WHERE uu.unik_id = tool.unik_id
                      AND uu.user_id = auth.uid()
                )
            );
        `)
        console.log('✅ [AddTools] Created RLS policy tool_access')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop RLS policy
        await queryRunner.query(`DROP POLICY IF EXISTS "tool_access" ON "public"."tool";`)

        // Disable RLS
        await queryRunner.query(`ALTER TABLE "public"."tool" DISABLE ROW LEVEL SECURITY;`)

        // Drop index
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tool_unik_id";`)

        // Drop FK constraint
        await queryRunner.query(`ALTER TABLE "public"."tool" DROP CONSTRAINT IF EXISTS "FK_tool_unik";`)

        // Drop table
        await queryRunner.query(`DROP TABLE IF EXISTS "public"."tool";`)
    }
}
