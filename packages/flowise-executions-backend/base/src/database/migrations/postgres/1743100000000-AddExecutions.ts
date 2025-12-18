import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration for Execution table creation.
 * Creates the execution table for tracking agent flow executions.
 *
 * NOTE: TypeORM orders migrations by the numeric timestamp in the class name.
 * This migration must run AFTER spaces/canvases migration (AddSpacesAndCanvases1743000000000)
 * because it has an FK constraint to the "public"."canvases" table.
 *
 * Adapted from Flowise 3.0.12 with modifications:
 * - Changed agentflowId to canvas_id (FK to canvases table)
 * - Added soft delete support (is_deleted, deleted_date)
 * - Removed workspaceId column (using canvas relationship)
 */
export class AddExecutions1743100000000 implements MigrationInterface {
    name = 'AddExecutions1743100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('execution')

        if (!tableExists) {
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS "public"."execution" (
                    "id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                    "executionData" text NOT NULL,
                    "state" varchar(20) NOT NULL,
                    "canvas_id" uuid NOT NULL,
                    "sessionId" varchar(255) NOT NULL,
                    "action" text NULL,
                    "isPublic" boolean DEFAULT false,
                    "createdDate" timestamp NOT NULL DEFAULT now(),
                    "updatedDate" timestamp NOT NULL DEFAULT now(),
                    "stoppedDate" timestamp NULL,
                    "is_deleted" boolean DEFAULT false,
                    "deleted_date" timestamp NULL,
                    CONSTRAINT "FK_execution_canvas" FOREIGN KEY ("canvas_id")
                        REFERENCES "public"."canvases"("id") ON DELETE CASCADE
                );

                CREATE INDEX "IDX_execution_canvas_id" ON "public"."execution"("canvas_id");
                CREATE INDEX "IDX_execution_sessionId" ON "public"."execution"("sessionId");
                CREATE INDEX "IDX_execution_state" ON "public"."execution"("state");
            `)
            console.log('✅ [AddExecutions] Created execution table with canvas_id FK')
        } else {
            console.log('ℹ️ [AddExecutions] Execution table already exists, skipping creation')
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "public"."execution";`)
        console.log('✅ [AddExecutions] Dropped execution table')
    }
}
