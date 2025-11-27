import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Initial migration for Flowise core tables.
 * NOTE: Tool table creation moved to @universo/flowise-tools-srv (1748400000000-AddTools.ts)
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
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS chat_message (
                id uuid NOT NULL DEFAULT uuid_generate_v4(),
                "role" varchar NOT NULL,
                "canvas_id" uuid NOT NULL,
                "content" text NOT NULL,
                "sourceDocuments" varchar NULL,
                "createdDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_3cc0d85193aade457d3077dd06b" PRIMARY KEY (id)
            );`
        )
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_chat_message_canvas_id" ON chat_message USING btree ("canvas_id");`)
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS credential (
                id uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" varchar NOT NULL,
                "credentialName" varchar NOT NULL,
                "encryptedData" varchar NOT NULL,
                "createdDate" timestamp NOT NULL DEFAULT now(),
                "updatedDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_3a5169bcd3d5463cefeec78be82" PRIMARY KEY (id)
            );`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_message_canvas_id"`)
        await queryRunner.query(`DROP TABLE chat_flow`)
        await queryRunner.query(`DROP TABLE chat_message`)
        await queryRunner.query(`DROP TABLE credential`)
    }
}
