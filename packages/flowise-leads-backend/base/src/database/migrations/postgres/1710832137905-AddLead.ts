import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration to create the lead table for storing contact information
 * captured during chat interactions.
 *
 * Note: The leadEmail column for chat_message table is handled separately
 * in flowise-server (1711538016098-AddLeadToChatMessage.ts) as it modifies
 * a table owned by another domain.
 */
export class AddLead1710832137905 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS lead (
                id uuid NOT NULL DEFAULT public.uuid_generate_v7(),
                "canvas_id" uuid,
                "chatId" varchar NOT NULL,
                "name" text,
                "email" text,
                "phone" text,
                "points" integer DEFAULT 0 NOT NULL,
                "createdDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_lead_id" PRIMARY KEY (id)
            );`
        )

        // Add indexes for performance
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_lead_canvas_id" ON lead("canvas_id");`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_lead_created_date" ON lead("createdDate");`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS lead;`)
    }
}
