import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddEntities1741281000000 implements MigrationInterface {
    name = 'AddEntities1741281000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      CREATE TABLE "entity_status" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" character varying NOT NULL,
        "label" character varying NOT NULL,
        CONSTRAINT "PK_entity_status" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_entity_status_code" UNIQUE ("code")
      )
    `)
        await queryRunner.query(`
      CREATE TABLE "entity_template" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" character varying NOT NULL,
        "title_en" character varying NOT NULL,
        "title_ru" character varying NOT NULL,
        "description_en" text,
        "description_ru" text,
        "root_resource_category_id" uuid,
        "parent_template_id" uuid,
        "resource_schema" jsonb NOT NULL DEFAULT '{}'::jsonb,
        CONSTRAINT "PK_entity_template" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_entity_template_code" UNIQUE ("code")
      )
    `)
        await queryRunner.query(`
      CREATE TABLE "entity" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "template_id" uuid NOT NULL,
        "status_id" uuid NOT NULL,
        "slug" character varying NOT NULL,
        "title_en" character varying NOT NULL,
        "title_ru" character varying NOT NULL,
        "description_en" text,
        "description_ru" text,
        "root_resource_id" uuid,
        "parent_entity_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_entity" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_entity_slug" UNIQUE ("slug")
      )
    `)
        await queryRunner.query(`
      CREATE TABLE "entity_owner" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "entity_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" character varying NOT NULL,
        "is_primary" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_entity_owner" PRIMARY KEY ("id")
      )
    `)
        await queryRunner.query(`
      CREATE TABLE "entity_resource" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "entity_id" uuid NOT NULL,
        "resource_id" uuid NOT NULL,
        "slot_code" character varying,
        "quantity" integer NOT NULL DEFAULT 1,
        "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
        CONSTRAINT "PK_entity_resource" PRIMARY KEY ("id")
      )
    `)
        await queryRunner.query(`
      CREATE TABLE "entity_relation" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "source_entity_id" uuid NOT NULL,
        "target_entity_id" uuid NOT NULL,
        "relation_type" character varying NOT NULL,
        CONSTRAINT "PK_entity_relation" PRIMARY KEY ("id")
      )
    `)
        await queryRunner.query(`
      ALTER TABLE "entity_template"
        ADD CONSTRAINT "FK_template_root_category" FOREIGN KEY ("root_resource_category_id") REFERENCES "resource_category"("id") ON DELETE SET NULL
    `)
        await queryRunner.query(`
      ALTER TABLE "entity_template"
        ADD CONSTRAINT "FK_template_parent" FOREIGN KEY ("parent_template_id") REFERENCES "entity_template"("id") ON DELETE SET NULL
    `)
        await queryRunner.query(`
      ALTER TABLE "entity"
        ADD CONSTRAINT "FK_entity_template" FOREIGN KEY ("template_id") REFERENCES "entity_template"("id") ON DELETE RESTRICT
    `)
        await queryRunner.query(`
      ALTER TABLE "entity"
        ADD CONSTRAINT "FK_entity_status" FOREIGN KEY ("status_id") REFERENCES "entity_status"("id") ON DELETE RESTRICT
    `)
        await queryRunner.query(`
      ALTER TABLE "entity"
        ADD CONSTRAINT "FK_entity_root_resource" FOREIGN KEY ("root_resource_id") REFERENCES "resource"("id") ON DELETE SET NULL
    `)
        await queryRunner.query(`
      ALTER TABLE "entity"
        ADD CONSTRAINT "FK_entity_parent" FOREIGN KEY ("parent_entity_id") REFERENCES "entity"("id") ON DELETE SET NULL
    `)
        await queryRunner.query(`
      ALTER TABLE "entity_owner"
        ADD CONSTRAINT "FK_entity_owner_entity" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE CASCADE
    `)
        await queryRunner.query(`
      ALTER TABLE "entity_resource"
        ADD CONSTRAINT "FK_entity_resource_entity" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE CASCADE
    `)
        await queryRunner.query(`
      ALTER TABLE "entity_resource"
        ADD CONSTRAINT "FK_entity_resource_resource" FOREIGN KEY ("resource_id") REFERENCES "resource"("id") ON DELETE CASCADE
    `)
        await queryRunner.query(`
      ALTER TABLE "entity_relation"
        ADD CONSTRAINT "FK_entity_relation_source" FOREIGN KEY ("source_entity_id") REFERENCES "entity"("id") ON DELETE CASCADE
    `)
        await queryRunner.query(`
      ALTER TABLE "entity_relation"
        ADD CONSTRAINT "FK_entity_relation_target" FOREIGN KEY ("target_entity_id") REFERENCES "entity"("id") ON DELETE CASCADE
    `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "entity_relation" DROP CONSTRAINT "FK_entity_relation_target"`)
        await queryRunner.query(`ALTER TABLE "entity_relation" DROP CONSTRAINT "FK_entity_relation_source"`)
        await queryRunner.query(`ALTER TABLE "entity_resource" DROP CONSTRAINT "FK_entity_resource_resource"`)
        await queryRunner.query(`ALTER TABLE "entity_resource" DROP CONSTRAINT "FK_entity_resource_entity"`)
        await queryRunner.query(`ALTER TABLE "entity_owner" DROP CONSTRAINT "FK_entity_owner_entity"`)
        await queryRunner.query(`ALTER TABLE "entity" DROP CONSTRAINT "FK_entity_parent"`)
        await queryRunner.query(`ALTER TABLE "entity" DROP CONSTRAINT "FK_entity_root_resource"`)
        await queryRunner.query(`ALTER TABLE "entity" DROP CONSTRAINT "FK_entity_status"`)
        await queryRunner.query(`ALTER TABLE "entity" DROP CONSTRAINT "FK_entity_template"`)
        await queryRunner.query(`ALTER TABLE "entity_template" DROP CONSTRAINT "FK_template_parent"`)
        await queryRunner.query(`ALTER TABLE "entity_template" DROP CONSTRAINT "FK_template_root_category"`)
        await queryRunner.query(`DROP TABLE "entity_relation"`)
        await queryRunner.query(`DROP TABLE "entity_resource"`)
        await queryRunner.query(`DROP TABLE "entity_owner"`)
        await queryRunner.query(`DROP TABLE "entity"`)
        await queryRunner.query(`DROP TABLE "entity_template"`)
        await queryRunner.query(`DROP TABLE "entity_status"`)
    }
}
