import { SHARED_OBJECT_KINDS, type SharedObjectKind } from '@universo-react/types'

export type SharedContainerDescriptor = {
    codename: string
    title: string
    description: string
}

export const SHARED_CONTAINER_DESCRIPTORS: Record<SharedObjectKind, SharedContainerDescriptor> = {
    [SHARED_OBJECT_KINDS.SHARED_OBJECT_POOL]: {
        codename: 'shared_components',
        title: 'Shared Components',
        description: 'Virtual container for metahub-wide shared components'
    },
    [SHARED_OBJECT_KINDS.SHARED_SET_POOL]: {
        codename: 'shared_constants',
        title: 'Shared Constants',
        description: 'Virtual container for metahub-wide shared constants'
    },
    [SHARED_OBJECT_KINDS.SHARED_ENUM_POOL]: {
        codename: 'shared_values',
        title: 'Shared Values',
        description: 'Virtual container for metahub-wide shared enumeration values'
    }
}
