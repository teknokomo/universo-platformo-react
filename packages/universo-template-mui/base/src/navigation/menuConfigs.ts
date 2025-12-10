import type { ElementType } from 'react'
import {
    IconFiles,
    IconWorld,
    IconFolder,
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
    IconUserShield
} from '@tabler/icons-react'

export interface TemplateMenuItem {
    id: string
    titleKey: string
    url: string
    icon: ElementType
    external?: boolean
    target?: string
    chip?: {
        label: string
    }
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

// Function to generate cluster menu items for a specific cluster
export const getClusterMenuItems = (clusterId: string): TemplateMenuItem[] => [
    {
        id: 'cluster-board',
        titleKey: 'clusterboard',
        url: `/cluster/${clusterId}`,
        icon: IconBuildingStore
    },
    {
        id: 'cluster-resources',
        titleKey: 'resources',
        url: `/clusters/${clusterId}/resources`,
        icon: IconBoxMultiple
    },
    {
        id: 'cluster-domains',
        titleKey: 'domains',
        url: `/clusters/${clusterId}/domains`,
        icon: IconHierarchy3
    },
    {
        id: 'cluster-access',
        titleKey: 'access',
        url: `/cluster/${clusterId}/access`,
        icon: IconUsers
    }
]

// Function to generate project menu items for a specific project
export const getProjectMenuItems = (projectId: string): TemplateMenuItem[] => [
    {
        id: 'project-board',
        titleKey: 'projectboard',
        url: `/project/${projectId}`,
        icon: IconBuildingStore
    },
    {
        id: 'project-tasks',
        titleKey: 'tasks',
        url: `/projects/${projectId}/tasks`,
        icon: IconBoxMultiple
    },
    {
        id: 'project-milestones',
        titleKey: 'milestones',
        url: `/projects/${projectId}/milestones`,
        icon: IconHierarchy3
    },
    {
        id: 'project-access',
        titleKey: 'access',
        url: `/project/${projectId}/access`,
        icon: IconUsers
    }
]

// Function to generate organization menu items for a specific organization
export const getOrganizationMenuItems = (organizationId: string): TemplateMenuItem[] => [
    {
        id: 'organization-board',
        titleKey: 'organizationboard',
        url: `/organization/${organizationId}`,
        icon: IconBuildingStore
    },
    {
        id: 'organization-departments',
        titleKey: 'departments',
        url: `/organizations/${organizationId}/departments`,
        icon: IconHierarchy3
    },
    {
        id: 'organization-positions',
        titleKey: 'positions',
        url: `/organizations/${organizationId}/positions`,
        icon: IconBoxMultiple
    },
    {
        id: 'organization-access',
        titleKey: 'access',
        url: `/organization/${organizationId}/access`,
        icon: IconUsers
    }
]

// Function to generate storage menu items for a specific storage
export const getStorageMenuItems = (storageId: string): TemplateMenuItem[] => [
    {
        id: 'storage-board',
        titleKey: 'storageboard',
        url: `/storage/${storageId}/board`,
        icon: IconDatabase
    },
    {
        id: 'storage-containers',
        titleKey: 'containers',
        url: `/storages/${storageId}/containers`,
        icon: IconBoxMultiple
    },
    {
        id: 'storage-slots',
        titleKey: 'slots',
        url: `/storages/${storageId}/slots`,
        icon: IconFolder
    },
    {
        id: 'storage-members',
        titleKey: 'members',
        url: `/storage/${storageId}/members`,
        icon: IconUsers
    }
]

// Function to generate campaign menu items for a specific campaign
export const getCampaignMenuItems = (campaignId: string): TemplateMenuItem[] => [
    {
        id: 'campaign-board',
        titleKey: 'campaignboard',
        url: `/campaign/${campaignId}`,
        icon: IconFlag
    },
    {
        id: 'campaign-events',
        titleKey: 'events',
        url: `/campaigns/${campaignId}/events`,
        icon: IconHierarchy3
    },
    {
        id: 'campaign-activities',
        titleKey: 'activities',
        url: `/campaigns/${campaignId}/activities`,
        icon: IconBoxMultiple
    },
    {
        id: 'campaign-access',
        titleKey: 'access',
        url: `/campaign/${campaignId}/access`,
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
        id: 'clusters',
        titleKey: 'clusters',
        url: '/clusters',
        icon: IconFolder
    },
    {
        id: 'projects',
        titleKey: 'projects',
        url: '/projects',
        icon: IconFolder
    },
    {
        id: 'organizations',
        titleKey: 'organizations',
        url: '/organizations',
        icon: IconBuildingStore
    },
    {
        id: 'storages',
        titleKey: 'storages',
        url: '/storages',
        icon: IconDatabase
    },
    {
        id: 'campaigns',
        titleKey: 'campaigns',
        url: '/campaigns',
        icon: IconFlag
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
