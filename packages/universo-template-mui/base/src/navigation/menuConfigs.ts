import type { ElementType } from 'react'
import {
    IconFiles,
    IconWorld,
    IconUser,
    IconFileText,
    IconUsers,
    IconHierarchy3,
    IconBuildingStore,
    IconHistory,
    IconGitBranch,
    IconSettings,
    IconLayoutDashboard,
    IconShield,
    IconUsersGroup,
    IconUserShield,
    IconLanguage,
    IconApps,
    IconDatabase
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
    },
    {
        id: 'metahub-divider-footer',
        type: 'divider'
    },
    {
        id: 'metahub-settings',
        titleKey: 'settings',
        url: `/metahub/${metahubId}/settings`,
        icon: IconSettings,
        type: 'item'
    }
]

export const rootMenuItems: TemplateMenuItem[] = [
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
    },
    {
        id: 'instance-settings',
        titleKey: 'settings',
        url: `/admin/instance/${instanceId}/settings`,
        icon: IconSettings
    }
]
