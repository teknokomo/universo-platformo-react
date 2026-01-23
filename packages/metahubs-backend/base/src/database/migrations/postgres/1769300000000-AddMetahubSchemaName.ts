import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddMetahubSchemaName1769300000000 implements MigrationInterface {
    name = 'AddMetahubSchemaName1769300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "metahubs"."metahubs" ADD "schema_name" character varying(63)`
        )
        await queryRunner.query(
            `ALTER TABLE "metahubs"."metahubs" ADD CONSTRAINT "UQ_metahubs_schema_name" UNIQUE ("schema_name")`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "metahubs"."metahubs" DROP CONSTRAINT "UQ_metahubs_schema_name"`
        )
        await queryRunner.query(`ALTER TABLE "metahubs"."metahubs" DROP COLUMN "schema_name"`)
    }
}
