import type { ElementType } from 'react'
import {
    IconBox,
    IconBolt,
    IconFiles,
    IconWorld,
    IconUser,
    IconFileText,
    IconUsers,
    IconUsersGroup,
    IconHierarchy,
    IconHierarchy3,
    IconBuildingStore,
    IconHistory,
    IconGitBranch,
    IconSettings,
    IconLayoutDashboard,
    IconShield,
    IconUserShield,
    IconLanguage,
    IconApps,
    IconDatabase
} from '@tabler/icons-react'

export type TemplateMenuItem = TemplateMenuEntry | TemplateMenuDivider

export interface TemplateMenuEntry {
    id: string
    titleKey?: string
    title?: string
    url: string
    icon: ElementType
    type?: 'item'
    external?: boolean
    target?: string
    requiredPermission?: 'manageMetahub' | 'manageMembers'
    chip?: {
        label: string
    }
}

export interface TemplateMenuDivider {
    id: string
    type: 'divider'
}

export const resolveTemplateMenuLabel = (
    item: TemplateMenuEntry,
    t: (key: string, options?: Record<string, unknown>) => string
): string => {
    if (typeof item.title === 'string' && item.title.trim().length > 0) {
        return item.title
    }

    return item.titleKey ? t(item.titleKey, { defaultValue: item.titleKey }) : ''
}

export interface PublishedMetahubMenuEntityType {
    kindKey: string
    title: string
    iconName?: string | null
    sidebarSection?: 'objects' | 'admin'
}

const menuIconRegistry: Record<string, ElementType> = {
    IconApps,
    IconBolt,
    IconBox,
    IconBuildingStore,
    IconDatabase,
    IconFiles,
    IconFileText,
    IconGitBranch,
    IconHierarchy,
    IconHierarchy3,
    IconHistory,
    IconLayoutDashboard,
    IconSettings,
    IconUsers,
    IconUsersGroup,
    IconUserShield,
    IconWorld
}

const resolveMenuIcon = (iconName?: string | null): ElementType => {
    if (!iconName) {
        return IconBox
    }

    return menuIconRegistry[iconName] ?? IconBox
}

const compactMenuDividers = (items: TemplateMenuItem[]): TemplateMenuItem[] => {
    const compacted: TemplateMenuItem[] = []

    for (const item of items) {
        if (item.type === 'divider') {
            const previous = compacted[compacted.length - 1]
            if (!previous || previous.type === 'divider') {
                continue
            }
        }

        compacted.push(item)
    }

    if (compacted[compacted.length - 1]?.type === 'divider') {
        compacted.pop()
    }

    return compacted
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
    },
    {
        id: 'application-settings',
        titleKey: 'settings',
        url: `/a/${applicationId}/admin/settings`,
        icon: IconSettings
    }
]

// Function to generate metahub menu items for a specific metahub
export const getMetahubMenuItems = (
    metahubId: string,
    options?: {
        canManageMetahub?: boolean
        canManageMembers?: boolean
        publishedEntityTypes?: PublishedMetahubMenuEntityType[]
    }
): TemplateMenuItem[] => {
    const publishedObjectItems = (options?.publishedEntityTypes ?? [])
        .filter((entityType) => (entityType.sidebarSection ?? 'objects') === 'objects')
        .map<TemplateMenuItem>((entityType) => ({
            id: `metahub-entity-${entityType.kindKey}`,
            title: entityType.title,
            url: `/metahub/${metahubId}/entities/${entityType.kindKey}/instances`,
            icon: resolveMenuIcon(entityType.iconName),
            type: 'item',
            requiredPermission: 'manageMetahub'
        }))

    const items: TemplateMenuItem[] = [
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
            type: 'item',
            requiredPermission: 'manageMetahub'
        },
        {
            id: 'metahub-divider',
            type: 'divider'
        },
        {
            id: 'metahub-common',
            titleKey: 'commonSection',
            url: `/metahub/${metahubId}/common`,
            icon: IconLayoutDashboard,
            type: 'item',
            requiredPermission: 'manageMetahub'
        },
        {
            id: 'metahub-entities',
            titleKey: 'entities',
            url: `/metahub/${metahubId}/entities`,
            icon: IconBox,
            type: 'item',
            requiredPermission: 'manageMetahub'
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
            id: 'metahub-sets',
            titleKey: 'sets',
            url: `/metahub/${metahubId}/sets`,
            icon: IconFileText,
            type: 'item'
        },
        {
            id: 'metahub-enumerations',
            titleKey: 'enumerations',
            url: `/metahub/${metahubId}/enumerations`,
            icon: IconFiles,
            type: 'item'
        },
        ...publishedObjectItems,
        {
            id: 'metahub-divider-secondary',
            type: 'divider'
        },
        {
            id: 'metahub-publications',
            titleKey: 'publications',
            url: `/metahub/${metahubId}/publications`,
            icon: IconApps,
            type: 'item',
            requiredPermission: 'manageMetahub'
        },
        {
            id: 'metahub-migrations',
            titleKey: 'migrations',
            url: `/metahub/${metahubId}/migrations`,
            icon: IconHistory,
            type: 'item',
            requiredPermission: 'manageMetahub'
        },
        {
            id: 'metahub-access',
            titleKey: 'access',
            url: `/metahub/${metahubId}/access`,
            icon: IconUsers,
            type: 'item',
            requiredPermission: 'manageMembers'
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
            type: 'item',
            requiredPermission: 'manageMetahub'
        }
    ]

    const filtered = items.filter((item) => {
        if (item.type === 'divider') {
            return true
        }

        if (item.requiredPermission === 'manageMetahub') {
            return options?.canManageMetahub === true
        }

        if (item.requiredPermission === 'manageMembers') {
            return options?.canManageMembers === true
        }

        return true
    })

    return compactMenuDividers(filtered)
}

export const rootMenuItems: TemplateMenuItem[] = [
    {
        id: 'metapanel',
        titleKey: 'metapanel',
        url: '/',
        icon: IconLayoutDashboard
    },
    {
        id: 'applications',
        titleKey: 'applications',
        url: '/applications',
        icon: IconApps
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
