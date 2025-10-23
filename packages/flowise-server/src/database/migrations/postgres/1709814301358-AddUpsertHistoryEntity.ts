import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUpsertHistoryEntity1709814301358 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS upsert_history (
                id uuid NOT NULL DEFAULT uuid_generate_v4(),
                "canvas_id" uuid NOT NULL,
                "result" text NOT NULL,
                "flowData" text NOT NULL,
                "date" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_37327b22b6e246319bd5eeb0e88" PRIMARY KEY (id)
            );`
        )
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_upsert_history_canvas_id" ON upsert_history USING btree ("canvas_id");`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_upsert_history_canvas_id"`)
        await queryRunner.query(`DROP TABLE upsert_history`)
    }
}
