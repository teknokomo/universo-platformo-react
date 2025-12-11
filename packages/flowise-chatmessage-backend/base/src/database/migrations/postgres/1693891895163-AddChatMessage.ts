/**
 * Consolidated migration for chat_message and chat_message_feedback tables.
 * Creates tables with all columns if they don't exist,
 * or adds missing columns to existing tables.
 *
 * This migration consolidates:
 * - 1693891895163-Init (initial chat_message table - partial)
 * - 1693996694528-ModifyChatMessage
 * - 1694658756136-AddChatHistory (chatType, chatId, memoryType, sessionId columns)
 * - 1699481607341-AddUsedToolsToChatMessage
 * - 1700271021237-AddFileAnnotationsToChatMessage
 * - 1701788586491-AddFileUploadsToChatMessage
 * - 1707213601923-AddFeedback (chat_message_feedback table)
 * - 1710497452584-FieldTypes (chat_message/feedback field types only)
 * - 1711538016098-AddLeadToChatMessage
 * - 1714679514451-AddAgentReasoningToChatMessage
 * - 1721078251523-AddActionToChatMessage
 * - 1726156258465-AddArtifactsToChatMessage
 * - 1726666309552-AddFollowUpPrompts
 */
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddChatMessage1693891895163 implements MigrationInterface {
    name = 'AddChatMessage1693891895163'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create chat_message table with all columns (uuid types from the start)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS chat_message (
                id uuid NOT NULL DEFAULT public.uuid_generate_v7(),
                "role" varchar NOT NULL,
                "canvas_id" uuid NOT NULL,
                "content" text NOT NULL,
                "sourceDocuments" text NULL,
                "usedTools" text NULL,
                "fileAnnotations" text NULL,
                "agentReasoning" text NULL,
                "fileUploads" text NULL,
                "artifacts" text NULL,
                "action" text NULL,
                "chatType" varchar NULL,
                "chatId" varchar NULL,
                "memoryType" varchar NULL,
                "sessionId" varchar NULL,
                "leadEmail" text NULL,
                "followUpPrompts" text NULL,
                "createdDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_chat_message" PRIMARY KEY (id)
            );
        `)

        // Create index on canvas_id
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_chat_message_canvas_id" 
            ON chat_message USING btree ("canvas_id");
        `)

        // Create chat_message_feedback table with uuid messageId
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS chat_message_feedback (
                id uuid NOT NULL DEFAULT public.uuid_generate_v7(),
                "canvas_id" uuid NOT NULL,
                "chatId" varchar NOT NULL,
                "messageId" uuid NOT NULL,
                "rating" varchar NOT NULL,
                "content" text NULL,
                "createdDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_chat_message_feedback" PRIMARY KEY (id),
                CONSTRAINT "UQ_chat_message_feedback_messageId" UNIQUE ("messageId")
            );
        `)

        // Create indices for feedback table
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_chat_message_feedback_canvas_id" 
            ON chat_message_feedback USING btree ("canvas_id");
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_chat_message_feedback_chatId" 
            ON chat_message_feedback USING btree ("chatId");
        `)

        // Add columns if they don't exist (for existing databases migrating from old schema)
        const columnsToAdd = [
            { name: 'usedTools', type: 'text' },
            { name: 'fileAnnotations', type: 'text' },
            { name: 'fileUploads', type: 'text' },
            { name: 'agentReasoning', type: 'text' },
            { name: 'artifacts', type: 'text' },
            { name: 'action', type: 'text' },
            { name: 'chatType', type: 'varchar' },
            { name: 'chatId', type: 'varchar' },
            { name: 'memoryType', type: 'varchar' },
            { name: 'sessionId', type: 'varchar' },
            { name: 'leadEmail', type: 'text' },
            { name: 'followUpPrompts', type: 'text' }
        ]

        for (const col of columnsToAdd) {
            await queryRunner.query(`
                ALTER TABLE "chat_message" 
                ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type} NULL;
            `)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_message_feedback_chatId"`)
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_message_feedback_canvas_id"`)
        await queryRunner.query(`DROP TABLE IF EXISTS chat_message_feedback`)
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_message_canvas_id"`)
        await queryRunner.query(`DROP TABLE IF EXISTS chat_message`)
    }
}
