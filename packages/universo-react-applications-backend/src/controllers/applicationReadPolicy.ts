import { z } from 'zod'
import type { DbExecutor } from '@universo-react/utils'
import type { ApplicationRole } from '../routes/guards'

export const APPLICATION_ADMIN_ROLES: ApplicationRole[] = ['owner', 'admin']
export const APPLICATION_LAYOUT_READ_ROLES = ['owner', 'admin', 'editor', 'member'] as const

const applicationLayoutReadPolicySchema = z
    .object({
        applicationLayouts: z
            .object({
                readRoles: z.array(z.enum(APPLICATION_LAYOUT_READ_ROLES)).min(1).optional()
            })
            .strict()
            .optional()
    })
    .passthrough()

/**
 * Normalizes the configurable layouts read policy from application settings.
 * Owner/admin always keep read access; configured roles widen it within the
 * known role set. Shared by the layouts controller and the theme-presets
 * routes ("see the layout — see its theme" rule).
 */
export const normalizeApplicationLayoutReadRoles = (settings: unknown): ApplicationRole[] => {
    const parsed = applicationLayoutReadPolicySchema.safeParse(settings)
    const configuredRoles = parsed.success ? parsed.data.applicationLayouts?.readRoles : undefined
    if (!configuredRoles || configuredRoles.length === 0) {
        return [...APPLICATION_ADMIN_ROLES]
    }

    const roles = new Set<ApplicationRole>(['owner', 'admin'])
    for (const role of configuredRoles) {
        roles.add(role)
    }
    return APPLICATION_LAYOUT_READ_ROLES.filter((role) => roles.has(role))
}

/** Resolves the effective layouts read roles for an application (its settings-driven policy). */
export async function resolveApplicationLayoutReadRoles(executor: DbExecutor, applicationId: string): Promise<ApplicationRole[]> {
    const rows = await executor.query<{ settings: unknown }>(
        `
        SELECT settings
        FROM applications.obj_applications
        WHERE id = $1
          AND _upl_deleted = false
          AND _app_deleted = false
        LIMIT 1
        `,
        [applicationId]
    )

    return normalizeApplicationLayoutReadRoles(rows[0]?.settings)
}
