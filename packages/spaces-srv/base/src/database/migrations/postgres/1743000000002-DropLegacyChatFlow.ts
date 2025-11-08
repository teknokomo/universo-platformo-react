import { MigrationInterface, QueryRunner } from 'typeorm'

export class DropLegacyChatFlow1743000000002 implements MigrationInterface {
    name = 'DropLegacyChatFlow1743000000002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop legacy chat_flow table if it exists (post-migration cleanup)
        await queryRunner.query('DROP TABLE IF EXISTS "public"."chat_flow";')
    }

    public async down(): Promise<void> {
        // no-op: legacy table is not restored
    }
}
