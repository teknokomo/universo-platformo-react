import type { ElementType } from 'react'
import { IconFiles, IconWorld, IconFolder, IconUser, IconFileText, IconUsers, IconBoxMultiple, IconHierarchy3 } from '@tabler/icons-react'

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

// Function to generate metaverse menu items for a specific metaverse
export const getMetaverseMenuItems = (metaverseId: string): TemplateMenuItem[] => [
    {
        id: 'metaverse-board',
        titleKey: 'menu.metaverseboard',
        url: `/metaverses/${metaverseId}`,
        icon: IconWorld
    },
    {
        id: 'metaverse-entities',
        titleKey: 'menu.entities',
        url: `/metaverses/${metaverseId}/entities`,
        icon: IconBoxMultiple
    },
    {
        id: 'metaverse-sections',
        titleKey: 'menu.sections',
        url: `/metaverses/${metaverseId}/sections`,
        icon: IconHierarchy3
    },
    {
        id: 'metaverse-access',
        titleKey: 'menu.access',
        url: `/metaverses/${metaverseId}/access`,
        icon: IconUsers
    }
]

export const rootMenuItems: TemplateMenuItem[] = [
    {
        id: 'uniks',
        titleKey: 'menu.uniks',
        url: '/uniks',
        icon: IconFiles
    },
    {
        id: 'metaverses',
        titleKey: 'menu.metaverses',
        url: '/metaverses',
        icon: IconWorld
    },
    {
        id: 'clusters',
        titleKey: 'menu.clusters',
        url: '/clusters',
        icon: IconFolder
    },
    {
        id: 'profile',
        titleKey: 'menu.profile',
        url: '/profile',
        icon: IconUser
    },
    {
        id: 'docs',
        titleKey: 'menu.docs',
        url: 'https://teknokomo.gitbook.io/up',
        icon: IconFileText,
        external: true,
        target: '_blank',
        chip: {
            label: '⧉'
        }
    }
]
