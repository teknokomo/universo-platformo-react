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
    IconChartBar
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
