import { MigrationInterface, QueryRunner } from 'typeorm'

export class FixActiveVersions1743000000003 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('[FixActiveVersions] Starting fix for active versions...')

        // 1. Исправить дефолтное значение для новых записей
        console.log('[FixActiveVersions] Step 1: Setting default value for is_active to true...')
        await queryRunner.query(`
            ALTER TABLE "public"."canvases"
                ALTER COLUMN "is_active" SET DEFAULT true
        `)

        // 2. Сделать первую версию в каждой группе активной (если нет других активных)
        console.log('[FixActiveVersions] Step 2: Setting first version as active where no active version exists...')
        await queryRunner.query(`
            WITH groups_without_active AS (
                SELECT version_group_id
                FROM "public"."canvases"
                GROUP BY version_group_id
                HAVING NOT bool_or(is_active)
            ),
            first_versions AS (
                SELECT DISTINCT ON (c.version_group_id) c.id, c.version_group_id
                FROM "public"."canvases" c
                INNER JOIN groups_without_active gwa ON c.version_group_id = gwa.version_group_id
                ORDER BY c.version_group_id, c.version_index ASC, c.created_date ASC
            )
            UPDATE "public"."canvases"
            SET is_active = true
            FROM first_versions fv
            WHERE "public"."canvases".id = fv.id
        `)

        // 3. Убедиться что в каждой группе только одна активная версия (сделать последнюю созданную активной)
        console.log('[FixActiveVersions] Step 3: Ensuring only one active version per group...')
        await queryRunner.query(`
            WITH latest_versions AS (
                SELECT DISTINCT ON (version_group_id) 
                    id, version_group_id
                FROM "public"."canvases"
                ORDER BY version_group_id, version_index DESC, created_date DESC
            )
            UPDATE "public"."canvases" c
            SET is_active = CASE 
                WHEN EXISTS (SELECT 1 FROM latest_versions lv WHERE lv.id = c.id) THEN true
                ELSE false
            END
        `)

        console.log('[FixActiveVersions] Migration completed successfully!')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('[FixActiveVersions] Rolling back active versions fix...')
        
        // Возвращаем дефолтное значение обратно к false (если нужно откатить)
        await queryRunner.query(`
            ALTER TABLE "public"."canvases"
                ALTER COLUMN "is_active" SET DEFAULT false
        `)

        console.log('[FixActiveVersions] Rollback completed!')
    }
}