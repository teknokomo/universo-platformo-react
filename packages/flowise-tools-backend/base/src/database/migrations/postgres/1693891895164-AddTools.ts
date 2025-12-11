import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration for Tool table creation.
 * Creates the base tool table structure.
 * 
 * NOTE: unik_id column and RLS policy are added by AddUniksAndLinked migration
 * which runs later and handles all Flowise table integrations with Uniks.
 * 
 * This migration runs right after Init (1693891895163).
 */
export class AddTools1693891895164 implements MigrationInterface {
    name = 'AddTools1693891895164'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if table already exists (for existing databases)
        const tableExists = await queryRunner.hasTable('tool')

        if (!tableExists) {
            // Create tool table (unik_id will be added by AddUniksAndLinked migration)
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS "public"."tool" (
                    "id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    "name" varchar NOT NULL,
                    "description" text NOT NULL,
                    "color" varchar NOT NULL,
                    "iconSrc" varchar NULL,
                    "schema" text NULL,
                    "func" text NULL,
                    "createdDate" timestamp NOT NULL DEFAULT now(),
                    "updatedDate" timestamp NOT NULL DEFAULT now()
                );
            `)
            console.log('✅ [AddTools] Created tool table')
        } else {
            console.log('ℹ️ [AddTools] Tool table already exists, skipping creation')
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop table
        await queryRunner.query(`DROP TABLE IF EXISTS "public"."tool";`)
    }
}
