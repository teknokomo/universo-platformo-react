import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration for CustomTemplate table creation.
 *
 * Creates the custom_template table for storing user-created templates.
 * Templates can be of type 'Canvas' or 'Tool'.
 *
 * NOTE: unik_id column, FK constraint, and index are added later by
 * the AddUniksAndLinked migration from @universo/uniks-backend package.
 * This follows the same pattern as tool, credential, assistant, etc.
 */
export class AddCustomTemplate1725629836652 implements MigrationInterface {
    name = 'AddCustomTemplate1725629836652'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('custom_template')

        if (!tableExists) {
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS "public"."custom_template" (
                    "id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    "name" varchar NOT NULL,
                    "flowData" text NOT NULL,
                    "description" text,
                    "badge" text,
                    "framework" text,
                    "usecases" text,
                    "type" text,
                    "createdDate" timestamptz NOT NULL DEFAULT now(),
                    "updatedDate" timestamptz NOT NULL DEFAULT now()
                );
            `)
            console.log('✅ [AddCustomTemplate] Created custom_template table')

            // Enable RLS
            await queryRunner.query(`ALTER TABLE "public"."custom_template" ENABLE ROW LEVEL SECURITY;`)

            // RLS policy for authenticated users
            await queryRunner.query(`DROP POLICY IF EXISTS custom_template_select ON "public"."custom_template";`)
            await queryRunner.query(`
                CREATE POLICY custom_template_select ON "public"."custom_template"
                FOR SELECT TO authenticated USING (true);
            `)
            console.log('✅ [AddCustomTemplate] RLS enabled with select policy')
        } else {
            console.log('ℹ️ [AddCustomTemplate] custom_template table already exists, skipping creation')
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP POLICY IF EXISTS custom_template_select ON "public"."custom_template";`)
        await queryRunner.query(`DROP TABLE IF EXISTS "public"."custom_template";`)
    }
}
