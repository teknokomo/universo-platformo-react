import { MigrationInterface, QueryRunner } from 'typeorm'

export class FixOrganizationsRLS1741500000001 implements MigrationInterface {
    name = 'FixOrganizationsRLS1741500000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the restrictive policy
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage their organization memberships" ON organizations.organizations_users;`
        )

        // Create a new, more permissive policy that allows:
        // 1. Users to manage their own membership (e.g. leave) - though usually they can't change their own role
        // 2. Organization owners/admins to manage all memberships for that organization
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their organization memberships" ON organizations.organizations_users
            FOR ALL
            USING (
                -- User is operating on their own record (e.g. viewing self)
                user_id = auth.uid()
                OR
                -- User is an owner or admin of the organization
                EXISTS (
                    SELECT 1 FROM organizations.organizations_users admin_ou
                    WHERE admin_ou.organization_id = organizations.organizations_users.organization_id
                    AND admin_ou.user_id = auth.uid()
                    AND admin_ou.role IN ('owner', 'admin')
                )
            )
            WITH CHECK (
                -- User is operating on their own record (e.g. viewing self)
                user_id = auth.uid()
                OR
                -- User is an owner or admin of the organization
                EXISTS (
                    SELECT 1 FROM organizations.organizations_users admin_ou
                    WHERE admin_ou.organization_id = organizations.organizations_users.organization_id
                    AND admin_ou.user_id = auth.uid()
                    AND admin_ou.role IN ('owner', 'admin')
                )
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert to the restrictive policy
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage their organization memberships" ON organizations.organizations_users;`
        )

        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their organization memberships" ON organizations.organizations_users
            FOR ALL
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid())
        `)
    }
}
