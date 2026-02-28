import type { ElementType } from 'react'
import {
    IconFiles,
    IconWorld,
    IconUser,
    IconFileText,
    IconUsers,
    IconBoxMultiple,
    IconHierarchy3,
    IconBuildingStore,
    IconMap,
    IconTool,
    IconKey,
    IconVariable,
    IconApi,
    IconDatabase,
    IconRobot,
    IconChartBar,
    IconFlag,
    IconLayoutDashboard,
    IconShield,
    IconUsersGroup,
    IconUserShield,
    IconLanguage,
    IconApps,
    IconHistory,
    IconGitBranch
} from '@tabler/icons-react'

export type TemplateMenuItem = TemplateMenuEntry | TemplateMenuDivider

export interface TemplateMenuEntry {
    id: string
    titleKey: string
    url: string
    icon: ElementType
    type?: 'item'
    external?: boolean
    target?: string
    chip?: {
        label: string
    }
}

export interface TemplateMenuDivider {
    id: string
    type: 'divider'
}

// Function to generate unik menu items for a specific unik
export const getUnikMenuItems = (unikId: string): TemplateMenuItem[] => [
    {
        id: 'unik-board',
        titleKey: 'unikboard',
        url: `/unik/${unikId}`,
        icon: IconBuildingStore
    },
    {
        id: 'unik-spaces',
        titleKey: 'spaces',
        url: `/unik/${unikId}/spaces`,
        icon: IconMap
    },
    {
        id: 'unik-tools',
        titleKey: 'tools',
        url: `/unik/${unikId}/tools`,
        icon: IconTool
    },
    {
        id: 'unik-credentials',
        titleKey: 'credentials',
        url: `/unik/${unikId}/credentials`,
        icon: IconKey
    },
    {
        id: 'unik-variables',
        titleKey: 'variables',
        url: `/unik/${unikId}/variables`,
        icon: IconVariable
    },
    {
        id: 'unik-apikey',
        titleKey: 'apiKeys',
        url: `/unik/${unikId}/apikey`,
        icon: IconApi
    },
    {
        id: 'unik-document-stores',
        titleKey: 'documentStores',
        url: `/unik/${unikId}/document-stores`,
        icon: IconDatabase
    },
    {
        id: 'unik-assistants',
        titleKey: 'assistants',
        url: `/unik/${unikId}/assistants`,
        icon: IconRobot
    },
    {
        id: 'unik-executions',
        titleKey: 'executions',
        url: `/unik/${unikId}/executions`,
        icon: IconFlag
    },
    {
        id: 'unik-analytics',
        titleKey: 'analytics',
        url: `/unik/${unikId}/analytics`,
        icon: IconChartBar
    },
    {
        id: 'unik-templates',
        titleKey: 'templates',
        url: `/unik/${unikId}/templates`,
        icon: IconLayoutDashboard
    },
    {
        id: 'unik-access',
        titleKey: 'access',
        url: `/unik/${unikId}/access`,
        icon: IconUsers
    }
]

// Function to generate metahub menu items for a specific metahub
export const getMetahubMenuItems = (metahubId: string): TemplateMenuItem[] => [
    {
        id: 'metahub-board',
        titleKey: 'metahubboard',
        url: `/metahub/${metahubId}`,
        icon: IconBuildingStore,
        type: 'item'
    },
    {
        id: 'metahub-branches',
        titleKey: 'branches',
        url: `/metahub/${metahubId}/branches`,
        icon: IconGitBranch,
        type: 'item'
    },
    {
        id: 'metahub-divider',
        type: 'divider'
    },
    {
        id: 'metahub-hubs',
        titleKey: 'hubs',
        url: `/metahub/${metahubId}/hubs`,
        icon: IconHierarchy3,
        type: 'item'
    },
    {
        id: 'metahub-catalogs',
        titleKey: 'catalogs',
        url: `/metahub/${metahubId}/catalogs`,
        icon: IconDatabase,
        type: 'item'
    },
    {
        id: 'metahub-enumerations',
        titleKey: 'enumerations',
        url: `/metahub/${metahubId}/enumerations`,
        icon: IconFiles,
        type: 'item'
    },
    {
        id: 'metahub-divider-secondary',
        type: 'divider'
    },
    {
        id: 'metahub-layouts',
        titleKey: 'layouts',
        url: `/metahub/${metahubId}/layouts`,
        icon: IconLayoutDashboard,
        type: 'item'
    },
    {
        id: 'metahub-publications',
        titleKey: 'publications',
        url: `/metahub/${metahubId}/publications`,
        icon: IconApps,
        type: 'item'
    },
    {
        id: 'metahub-migrations',
        titleKey: 'migrations',
        url: `/metahub/${metahubId}/migrations`,
        icon: IconHistory,
        type: 'item'
    },
    {
        id: 'metahub-access',
        titleKey: 'access',
        url: `/metahub/${metahubId}/access`,
        icon: IconUsers,
        type: 'item'
    }
]

// Function to generate application menu items for a specific application
export const getApplicationMenuItems = (applicationId: string): TemplateMenuItem[] => [
    {
        id: 'application-board',
        titleKey: 'applicationboard',
        url: `/a/${applicationId}/admin`,
        icon: IconBuildingStore
    },
    {
        id: 'application-connectors',
        titleKey: 'connectors',
        url: `/a/${applicationId}/admin/connectors`,
        icon: IconHierarchy3
    },
    {
        id: 'application-migrations',
        titleKey: 'migrations',
        url: `/a/${applicationId}/admin/migrations`,
        icon: IconHistory
    },
    {
        id: 'application-access',
        titleKey: 'access',
        url: `/a/${applicationId}/admin/access`,
        icon: IconUsers
    }
]

// Function to generate metaverse menu items for a specific metaverse
export const getMetaverseMenuItems = (metaverseId: string): TemplateMenuItem[] => [
    {
        id: 'metaverse-board',
        // Keys are used within the 'menu' namespace context
        titleKey: 'metaverseboard',
        url: `/metaverse/${metaverseId}`,
        icon: IconWorld
    },
    {
        id: 'metaverse-entities',
        titleKey: 'entities',
        url: `/metaverses/${metaverseId}/entities`,
        icon: IconBoxMultiple
    },
    {
        id: 'metaverse-sections',
        titleKey: 'sections',
        url: `/metaverses/${metaverseId}/sections`,
        icon: IconHierarchy3
    },
    {
        id: 'metaverse-access',
        titleKey: 'access',
        url: `/metaverse/${metaverseId}/access`,
        icon: IconUsers
    }
]

export const rootMenuItems: TemplateMenuItem[] = [
    {
        id: 'uniks',
        titleKey: 'uniks',
        url: '/uniks',
        icon: IconFiles
    },
    {
        id: 'metaverses',
        titleKey: 'metaverses',
        url: '/metaverses',
        icon: IconWorld
    },
    {
        id: 'profile',
        titleKey: 'profile',
        url: '/profile',
        icon: IconUser
    },
    {
        id: 'docs',
        titleKey: 'docs',
        url: 'https://teknokomo.gitbook.io/up',
        icon: IconFileText,
        external: true,
        target: '_blank',
        chip: {
            label: '⧉'
        }
    }
]

/**
 * Applications menu items (shown in a separate section before Metahubs)
 * Returns single menu item pointing to applications list
 */
export const getApplicationsMenuItem = (): TemplateMenuItem[] => [
    {
        id: 'applications',
        titleKey: 'applications',
        url: '/applications',
        icon: IconApps
    }
]

/**
 * Metahubs menu items (shown in a separate section before Admin)
 * Returns single menu item pointing to metahubs list
 */
export const getMetahubsMenuItem = (): TemplateMenuItem[] => [
    {
        id: 'metahubs',
        titleKey: 'metahubs',
        url: '/metahubs',
        icon: IconWorld
    }
]

/**
 * Admin menu items (shown only for super users)
 * Returns single menu item pointing to instances list
 */
export const getAdminMenuItems = (): TemplateMenuItem[] => [
    {
        id: 'admin',
        titleKey: 'administration',
        url: '/admin',
        icon: IconShield
    }
]

/**
 * Instance context menu items (shown when inside /admin/instance/:id)
 * Returns array of menu items for the instance context
 */
export const getInstanceMenuItems = (instanceId: string): TemplateMenuItem[] => [
    {
        id: 'instance-board',
        titleKey: 'instanceboard',
        url: `/admin/instance/${instanceId}/board`,
        icon: IconLayoutDashboard
    },
    {
        id: 'instance-roles',
        titleKey: 'roles',
        url: `/admin/instance/${instanceId}/roles`,
        icon: IconUserShield
    },
    {
        id: 'instance-users',
        titleKey: 'users',
        url: `/admin/instance/${instanceId}/users`,
        icon: IconUsersGroup
    },
    {
        id: 'instance-locales',
        titleKey: 'locales',
        url: `/admin/instance/${instanceId}/locales`,
        icon: IconLanguage
    }
]

/**
 * @deprecated Use getAdminMenuItems() instead
 * Legacy admin menu item - kept for backward compatibility
 */
export const adminMenuItem: TemplateMenuItem = {
    id: 'admin',
    titleKey: 'administration',
    url: '/admin',
    icon: IconShield
}
