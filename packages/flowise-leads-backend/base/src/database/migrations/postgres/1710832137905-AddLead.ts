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
                id uuid NOT NULL DEFAULT uuid_generate_v4(),
                "canvas_id" uuid NOT NULL,
                "chatId" varchar NOT NULL,
                "name" text,
                "email" text,
                "phone" text,
                "points" integer DEFAULT 0 NOT NULL,
                "createdDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_lead_id" PRIMARY KEY (id)
            );`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS lead;`)
    }
}
