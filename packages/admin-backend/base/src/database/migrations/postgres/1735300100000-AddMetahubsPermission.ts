import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration: Add metahubs:read permission for global users
 *
 * This migration adds explicit metahubs permissions to the admin schema.
 * The superuser role already has wildcard (*:*) permissions, but this makes
 * the metahubs module explicitly available and allows future fine-grained control.
 *
 * Permissions added:
 * - metahubs:* (all actions) for superuser role
 *
 * Note: The metahubs module is only visible to users with:
 * - superuser role (via *:* wildcard)
 * - explicit metahubs:read permission
 */
export class AddMetahubsPermission1735300100000 implements MigrationInterface {
    name = 'AddMetahubsPermission1735300100000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add explicit metahubs:* permission for superuser
        // This is technically redundant (superuser has *:*) but makes it explicit
        // and allows for future role configurations
        await queryRunner.query(`
            INSERT INTO admin.role_permissions (role_id, subject, action)
            SELECT id, 'metahubs', '*' FROM admin.roles WHERE codename = 'superuser'
            ON CONFLICT (role_id, subject, action) DO NOTHING
        `)

        // Log what was done
        // eslint-disable-next-line no-console
        console.log('[Migration] Added metahubs:* permission for superuser role')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove metahubs:* permission from superuser
        await queryRunner.query(`
            DELETE FROM admin.role_permissions
            WHERE role_id = (SELECT id FROM admin.roles WHERE codename = 'superuser')
            AND subject = 'metahubs'
            AND action = '*'
        `)
    }
}
