import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddResources1741277700000 implements MigrationInterface {
    name = 'AddResources1741277700000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "resource_category" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "slug" character varying NOT NULL,
                "parent_category_id" uuid,
                "title_en" character varying NOT NULL,
                "title_ru" character varying NOT NULL,
                "description_en" text,
                "description_ru" text,
                CONSTRAINT "PK_resource_category" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_resource_category_slug" UNIQUE ("slug")
            )
        `)
        await queryRunner.query(`
            CREATE TABLE "resource_state" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "code" character varying NOT NULL,
                "label" character varying NOT NULL,
                CONSTRAINT "PK_resource_state" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_resource_state_code" UNIQUE ("code")
            )
        `)
        await queryRunner.query(`
            CREATE TABLE "storage_type" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "code" character varying NOT NULL,
                "label" character varying NOT NULL,
                CONSTRAINT "PK_storage_type" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_storage_type_code" UNIQUE ("code")
            )
        `)
        await queryRunner.query(`
            CREATE TABLE "resource" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "category_id" uuid NOT NULL,
                "state_id" uuid NOT NULL,
                "storage_type_id" uuid NOT NULL,
                "slug" character varying NOT NULL,
                "title_en" character varying NOT NULL,
                "title_ru" character varying NOT NULL,
                "description_en" text,
                "description_ru" text,
                "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_resource" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_resource_slug" UNIQUE ("slug")
            )
        `)
        await queryRunner.query(`
            CREATE TABLE "resource_revision" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "resource_id" uuid NOT NULL,
                "version" integer NOT NULL,
                "data" jsonb NOT NULL,
                "author_id" uuid,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_resource_revision" PRIMARY KEY ("id")
            )
        `)
        await queryRunner.query(`
            CREATE TABLE "resource_composition" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "parent_resource_id" uuid NOT NULL,
                "child_resource_id" uuid NOT NULL,
                "quantity" integer NOT NULL,
                "sort_order" integer NOT NULL,
                "is_required" boolean NOT NULL DEFAULT false,
                "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
                CONSTRAINT "PK_resource_composition" PRIMARY KEY ("id")
            )
        `)
        await queryRunner.query(`
            ALTER TABLE "resource_category"
            ADD CONSTRAINT "FK_resource_category_parent" FOREIGN KEY ("parent_category_id") REFERENCES "resource_category"("id") ON DELETE SET NULL
        `)
        await queryRunner.query(`
            ALTER TABLE "resource"
            ADD CONSTRAINT "FK_resource_category" FOREIGN KEY ("category_id") REFERENCES "resource_category"("id") ON DELETE RESTRICT
        `)
        await queryRunner.query(`
            ALTER TABLE "resource"
            ADD CONSTRAINT "FK_resource_state" FOREIGN KEY ("state_id") REFERENCES "resource_state"("id") ON DELETE RESTRICT
        `)
        await queryRunner.query(`
            ALTER TABLE "resource"
            ADD CONSTRAINT "FK_resource_storage_type" FOREIGN KEY ("storage_type_id") REFERENCES "storage_type"("id") ON DELETE RESTRICT
        `)
        await queryRunner.query(`
            ALTER TABLE "resource_revision"
            ADD CONSTRAINT "FK_resource_revision_resource" FOREIGN KEY ("resource_id") REFERENCES "resource"("id") ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE "resource_composition"
            ADD CONSTRAINT "FK_resource_composition_parent" FOREIGN KEY ("parent_resource_id") REFERENCES "resource"("id") ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE "resource_composition"
            ADD CONSTRAINT "FK_resource_composition_child" FOREIGN KEY ("child_resource_id") REFERENCES "resource"("id") ON DELETE CASCADE
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "resource_composition" DROP CONSTRAINT "FK_resource_composition_child"`)
        await queryRunner.query(`ALTER TABLE "resource_composition" DROP CONSTRAINT "FK_resource_composition_parent"`)
        await queryRunner.query(`ALTER TABLE "resource_revision" DROP CONSTRAINT "FK_resource_revision_resource"`)
        await queryRunner.query(`ALTER TABLE "resource" DROP CONSTRAINT "FK_resource_storage_type"`)
        await queryRunner.query(`ALTER TABLE "resource" DROP CONSTRAINT "FK_resource_state"`)
        await queryRunner.query(`ALTER TABLE "resource" DROP CONSTRAINT "FK_resource_category"`)
        await queryRunner.query(`ALTER TABLE "resource_category" DROP CONSTRAINT "FK_resource_category_parent"`)
        await queryRunner.query(`DROP TABLE "resource_composition"`)
        await queryRunner.query(`DROP TABLE "resource_revision"`)
        await queryRunner.query(`DROP TABLE "resource"`)
        await queryRunner.query(`DROP TABLE "storage_type"`)
        await queryRunner.query(`DROP TABLE "resource_state"`)
        await queryRunner.query(`DROP TABLE "resource_category"`)
    }
}
