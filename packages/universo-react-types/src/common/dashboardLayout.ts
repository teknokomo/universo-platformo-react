import { z } from 'zod'
import { objectCollectionLayoutBehaviorConfigSchema } from './objectCollectionRuntimeConfig'

export { DASHBOARD_VIEW_MODES, type DashboardViewMode } from './dashboardLayoutPrimitives'

export const DASHBOARD_SIDE_MENU_MODES = ['wide', 'compact', 'overlay'] as const
export type DashboardSideMenuMode = (typeof DASHBOARD_SIDE_MENU_MODES)[number]

export interface DashboardSideMenuConfig {
    availableModes: DashboardSideMenuMode[]
    primaryMode: DashboardSideMenuMode
    rememberUserChoice?: boolean
}

export const defaultDashboardSideMenuConfig: DashboardSideMenuConfig = {
    availableModes: ['wide', 'compact', 'overlay'],
    primaryMode: 'wide',
    rememberUserChoice: true
}

export const dashboardSideMenuConfigSchema = z
    .object({
        availableModes: z.array(z.enum(DASHBOARD_SIDE_MENU_MODES)).min(1).optional(),
        primaryMode: z.enum(DASHBOARD_SIDE_MENU_MODES).optional(),
        rememberUserChoice: z.boolean().optional()
    })
    .strict()
    .superRefine((value, context) => {
        if (!value.primaryMode || !value.availableModes) return
        if (!value.availableModes.includes(value.primaryMode)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['primaryMode'],
                message: 'Primary side menu mode must be included in available modes'
            })
        }
    })
    .transform((value): DashboardSideMenuConfig => {
        const availableModes = [...new Set(value.availableModes ?? defaultDashboardSideMenuConfig.availableModes)]
        const requestedPrimaryMode = value.primaryMode ?? defaultDashboardSideMenuConfig.primaryMode
        return {
            availableModes,
            primaryMode: availableModes.includes(requestedPrimaryMode) ? requestedPrimaryMode : availableModes[0],
            rememberUserChoice: value.rememberUserChoice ?? defaultDashboardSideMenuConfig.rememberUserChoice
        }
    })

const dashboardLayoutConfigObjectSchema = z
    .object({
        /** Host-level side-menu presentation shared by the Dashboard shell. */
        sideMenu: dashboardSideMenuConfigSchema.optional(),
        /** Object record creation and form behavior; widget presentation remains placement-owned. */
        objectBehavior: objectCollectionLayoutBehaviorConfigSchema
    })
    .strict()

export const dashboardLayoutConfigSchema = dashboardLayoutConfigObjectSchema.optional()

export type DashboardLayoutConfig = z.infer<typeof dashboardLayoutConfigObjectSchema>

export interface ResolvedDashboardLayoutConfig {
    sideMenu: DashboardSideMenuConfig
}

export const defaultDashboardLayoutConfig: ResolvedDashboardLayoutConfig = {
    sideMenu: defaultDashboardSideMenuConfig
}
