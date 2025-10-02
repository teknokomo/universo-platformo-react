import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddFeedback1707213601923 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS chat_message_feedback (
                id uuid NOT NULL DEFAULT uuid_generate_v4(),
                "canvas_id" uuid NOT NULL,
                "content" text,
                "chatId" varchar NOT NULL,
                "messageId" uuid NOT NULL,
                "rating" varchar NOT NULL,
                "createdDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_98419043dd704f54-9830ab78f9" PRIMARY KEY (id)
            );`
        )
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_chat_message_feedback_canvas_id" ON chat_message_feedback USING btree ("canvas_id");`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_message_feedback_canvas_id"`)
        await queryRunner.query(`DROP TABLE chat_message_feedback`)
    }
}
