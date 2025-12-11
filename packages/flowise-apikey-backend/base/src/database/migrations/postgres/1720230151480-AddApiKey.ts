import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Creates the apikey table for storing API keys in database mode.
 * Note: unik_id column is added by AddUniksAndLinked migration.
 */
export class AddApiKey1720230151480 implements MigrationInterface {
    name = 'AddApiKey1720230151480'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if table already exists (idempotent)
        const tableExists = await queryRunner.hasTable('apikey')
        if (tableExists) {
            console.log('[AddApiKey] Table apikey already exists, skipping creation')
            return
        }

        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS apikey (
                id uuid NOT NULL DEFAULT public.uuid_generate_v7(),
                "apiKey" varchar NOT NULL,
                "apiSecret" varchar NOT NULL,
                "keyName" varchar NOT NULL,
                "updatedDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_96109043dd704f53-9830ab78f0" PRIMARY KEY (id)
            );`
        )
        console.log('[AddApiKey] Created apikey table')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('apikey')
        if (!tableExists) {
            console.log('[AddApiKey] Table apikey does not exist, skipping drop')
            return
        }
        await queryRunner.query(`DROP TABLE apikey`)
    }
}
