import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddChatHistory1694658756136 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "chat_message" ADD COLUMN IF NOT EXISTS "chatType" VARCHAR NOT NULL DEFAULT 'INTERNAL', ADD COLUMN IF NOT EXISTS "chatId" VARCHAR, ADD COLUMN IF NOT EXISTS "memoryType" VARCHAR, ADD COLUMN IF NOT EXISTS "sessionId" VARCHAR;`
        )
        const results: { id: string; canvas_id: string }[] = await queryRunner.query(`WITH RankedMessages AS (
                SELECT
                    "canvas_id",
                    "id",
                    "createdDate",
                    ROW_NUMBER() OVER (PARTITION BY "canvas_id" ORDER BY "createdDate") AS row_num
                FROM "chat_message"
            )
            SELECT "canvas_id", "id"
            FROM RankedMessages
            WHERE row_num = 1;`)
        for (const chatMessage of results) {
            await queryRunner.query(
                `UPDATE "chat_message" SET "chatId" = '${chatMessage.id}' WHERE "canvas_id" = '${chatMessage.canvas_id}'`
            )
        }
        await queryRunner.query(`ALTER TABLE "chat_message" ALTER COLUMN "chatId" SET NOT NULL;`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "chat_message" DROP COLUMN "chatType", DROP COLUMN "chatId", DROP COLUMN "memoryType", DROP COLUMN "sessionId";`
        )
    }
}
