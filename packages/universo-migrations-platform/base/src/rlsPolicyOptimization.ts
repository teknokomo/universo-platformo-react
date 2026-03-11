import type { MigrationExecutionContext, PlatformMigrationFile } from '@universo/migrations-core'

/**
 * RLS policy performance optimization migration.
 *
 * Wraps all auth.uid() and admin.is_superuser() / admin.has_admin_permission()
 * calls in (SELECT ...) subqueries so PostgreSQL evaluates them once per
 * statement instead of once per row.
 *
 * Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
 */

interface PolicyRewrite {
    table: string
    name: string
    forClause: string
    using?: string
    withCheck?: string
}

const adminPolicies: PolicyRewrite[] = [
    {
        table: 'admin.roles',
        name: 'admin_access_manage_roles',
        forClause: 'FOR ALL',
        using: '(select admin.has_admin_permission((select auth.uid())))'
    },
    {
        table: 'admin.role_permissions',
        name: 'admin_access_manage_role_permissions',
        forClause: 'FOR ALL',
        using: '(select admin.has_admin_permission((select auth.uid())))'
    },
    {
        table: 'admin.user_roles',
        name: 'users_read_own_roles',
        forClause: 'FOR SELECT',
        using: 'user_id = (select auth.uid())'
    },
    {
        table: 'admin.user_roles',
        name: 'admin_access_manage_user_roles',
        forClause: 'FOR ALL',
        using: '(select admin.has_admin_permission((select auth.uid())))'
    },
    {
        table: 'admin.instances',
        name: 'instances_select_admin_access',
        forClause: 'FOR SELECT',
        using: '(select admin.has_admin_permission((select auth.uid())))'
    },
    {
        table: 'admin.instances',
        name: 'instances_manage_admin_access',
        forClause: 'FOR ALL',
        using: '(select admin.has_admin_permission((select auth.uid())))'
    },
    {
        table: 'admin.locales',
        name: 'admin_access_manage_locales',
        forClause: 'FOR ALL',
        using: '(select admin.has_admin_permission((select auth.uid())))'
    },
    {
        table: 'admin.settings',
        name: 'admin_access_manage_settings',
        forClause: 'FOR ALL',
        using: '(select admin.has_admin_permission((select auth.uid())))'
    }
]

const profilePolicies: PolicyRewrite[] = [
    {
        table: 'public.profiles',
        name: 'Allow users to view own profile',
        forClause: 'FOR SELECT',
        using: '(select auth.uid()) = user_id'
    },
    {
        table: 'public.profiles',
        name: 'Allow users to update own profile',
        forClause: 'FOR UPDATE',
        using: '(select auth.uid()) = user_id'
    },
    {
        table: 'public.profiles',
        name: 'Allow users to insert own profile',
        forClause: 'FOR INSERT',
        withCheck: '(select auth.uid()) = user_id'
    }
]

const metahubsPolicies: PolicyRewrite[] = [
    {
        table: 'metahubs.templates',
        name: 'templates_write_superuser',
        forClause: 'FOR ALL',
        using: '(select admin.is_superuser((select auth.uid())))',
        withCheck: '(select admin.is_superuser((select auth.uid())))'
    },
    {
        table: 'metahubs.templates_versions',
        name: 'template_versions_write_superuser',
        forClause: 'FOR ALL',
        using: '(select admin.is_superuser((select auth.uid())))',
        withCheck: '(select admin.is_superuser((select auth.uid())))'
    },
    {
        table: 'metahubs.metahubs_users',
        name: 'Allow users to manage their metahub memberships',
        forClause: 'FOR ALL',
        using: `user_id = (select auth.uid()) OR (select admin.is_superuser((select auth.uid())))`,
        withCheck: `user_id = (select auth.uid()) OR (select admin.is_superuser((select auth.uid())))`
    },
    {
        table: 'metahubs.metahubs',
        name: 'Allow users to manage their own metahubs',
        forClause: 'FOR ALL',
        using: `is_public = true
                    OR EXISTS (
                        SELECT 1 FROM metahubs.metahubs_users mu
                        WHERE mu.metahub_id = metahubs.metahubs.id AND mu.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))`,
        withCheck: `EXISTS (
                        SELECT 1 FROM metahubs.metahubs_users mu
                        WHERE mu.metahub_id = metahubs.metahubs.id AND mu.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))`
    },
    {
        table: 'metahubs.metahubs_branches',
        name: 'branches_access_via_metahub',
        forClause: 'FOR ALL',
        using: `EXISTS (
                        SELECT 1 FROM metahubs.metahubs_users mu
                        WHERE mu.metahub_id = metahubs.metahubs_branches.metahub_id AND mu.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))`,
        withCheck: `EXISTS (
                        SELECT 1 FROM metahubs.metahubs_users mu
                        WHERE mu.metahub_id = metahubs.metahubs_branches.metahub_id AND mu.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))`
    },
    {
        table: 'metahubs.publications',
        name: 'pub_access_via_metahub',
        forClause: 'FOR ALL',
        using: `EXISTS (
                        SELECT 1 FROM metahubs.metahubs_users mu
                        WHERE mu.metahub_id = metahubs.publications.metahub_id AND mu.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))`,
        withCheck: `EXISTS (
                        SELECT 1 FROM metahubs.metahubs_users mu
                        WHERE mu.metahub_id = metahubs.publications.metahub_id AND mu.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))`
    },
    {
        table: 'metahubs.publications_versions',
        name: 'publications_versions_policy',
        forClause: 'FOR ALL',
        using: `publication_id IN (
                        SELECT p.id FROM metahubs.publications p
                        JOIN metahubs.metahubs_users mu ON p.metahub_id = mu.metahub_id
                        WHERE mu.user_id = (select auth.uid())
                    )`,
        withCheck: `publication_id IN (
                        SELECT p.id FROM metahubs.publications p
                        JOIN metahubs.metahubs_users mu ON p.metahub_id = mu.metahub_id
                        WHERE mu.user_id = (select auth.uid())
                    )`
    }
]

const applicationsPolicies: PolicyRewrite[] = [
    {
        table: 'applications.applications_users',
        name: 'Allow users to manage their application memberships',
        forClause: 'FOR ALL',
        using: `user_id = (select auth.uid()) OR (select admin.is_superuser((select auth.uid())))`,
        withCheck: `user_id = (select auth.uid()) OR (select admin.is_superuser((select auth.uid())))`
    },
    {
        table: 'applications.applications',
        name: 'Allow users to manage their own applications',
        forClause: 'FOR ALL',
        using: `is_public = true
                    OR EXISTS (
                        SELECT 1 FROM applications.applications_users au
                        WHERE au.application_id = applications.applications.id AND au.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))`,
        withCheck: `EXISTS (
                        SELECT 1 FROM applications.applications_users au
                        WHERE au.application_id = applications.applications.id AND au.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))`
    },
    {
        table: 'applications.connectors',
        name: 'Allow users to manage connectors in their applications',
        forClause: 'FOR ALL',
        using: `EXISTS (
                        SELECT 1 FROM applications.applications a
                        LEFT JOIN applications.applications_users au ON a.id = au.application_id
                        WHERE a.id = applications.connectors.application_id
                        AND (a.is_public = true OR au.user_id = (select auth.uid()))
                    )
                    OR (select admin.is_superuser((select auth.uid())))`,
        withCheck: `EXISTS (
                        SELECT 1 FROM applications.applications_users au
                        WHERE au.application_id = applications.connectors.application_id AND au.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))`
    },
    {
        table: 'applications.connectors_publications',
        name: 'Allow users to manage connector-publication links',
        forClause: 'FOR ALL',
        using: `EXISTS (
                        SELECT 1 FROM applications.connectors c
                        JOIN applications.applications_users au ON c.application_id = au.application_id
                        WHERE c.id = applications.connectors_publications.connector_id AND au.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))`,
        withCheck: `EXISTS (
                        SELECT 1 FROM applications.connectors c
                        JOIN applications.applications_users au ON c.application_id = au.application_id
                        WHERE c.id = applications.connectors_publications.connector_id AND au.user_id = (select auth.uid())
                    )
                    OR (select admin.is_superuser((select auth.uid())))`
    }
]

const allPolicies: PolicyRewrite[] = [
    ...adminPolicies,
    ...profilePolicies,
    ...metahubsPolicies,
    ...applicationsPolicies
]

const buildCreatePolicy = (policy: PolicyRewrite): string => {
    const parts = [`CREATE POLICY "${policy.name}" ON ${policy.table}`, policy.forClause]
    if (policy.using) {
        parts.push(`USING (${policy.using})`)
    }
    if (policy.withCheck) {
        parts.push(`WITH CHECK (${policy.withCheck})`)
    }
    return parts.join('\n    ')
}

export const optimizeRlsPoliciesMigration: PlatformMigrationFile = {
    id: 'OptimizeRlsPolicies1800000000200',
    version: '1800000000200',
    scope: {
        kind: 'platform_schema',
        key: 'cross_schema'
    },
    sourceKind: 'file',
    transactionMode: 'single',
    lockMode: 'transaction_advisory',
    summary: 'Wrap auth.uid() and admin function calls in (SELECT ...) subqueries for RLS policy evaluation performance',
    async up(ctx: MigrationExecutionContext) {
        for (const policy of allPolicies) {
            await ctx.raw(`DROP POLICY IF EXISTS "${policy.name}" ON ${policy.table}`)
            await ctx.raw(buildCreatePolicy(policy))
        }
    },
    async down(ctx: MigrationExecutionContext) {
        // Rollback: recreation of original policies is handled by the original
        // CREATE POLICY migrations running from scratch. For partial rollback,
        // re-run the original schema migrations for admin/profile/metahubs/applications.
        ctx.logger.warn(
            '[OptimizeRlsPolicies] Down migration drops optimized policies. ' +
            'Original policies must be restored by re-running their source migrations.',
            { migrationId: 'OptimizeRlsPolicies1800000000200' }
        )
        for (const policy of allPolicies) {
            await ctx.raw(`DROP POLICY IF EXISTS "${policy.name}" ON ${policy.table}`)
        }
    }
}
