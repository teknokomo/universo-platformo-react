import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Initial migration for Flowise core tables.
 * NOTE: Tool table creation moved to @universo/flowise-tools-srv
 * NOTE: Credential table creation moved to @universo/flowise-credentials-srv
 * NOTE: ChatMessage table creation moved to @universo/flowise-chatmessage-srv
 */
export class Init1693891895163 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS chat_flow (
                id uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" varchar NOT NULL,
                "flowData" text NOT NULL,
                deployed bool NULL,
                "isPublic" bool NULL,
                apikeyid varchar NULL,
                "chatbotConfig" varchar NULL,
                "createdDate" timestamp NOT NULL DEFAULT now(),
                "updatedDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_3c7cea7d047ac4b91764574cdbf" PRIMARY KEY (id)
            );`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE chat_flow`)
    }
}
