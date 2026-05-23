import type { ResourceSource, ResourceType } from '@universo/types'

export const buildDefaultResourceSourceForType = (resourceType: ResourceType): ResourceSource | Record<string, unknown> => {
    switch (resourceType) {
        case 'page':
            return { type: resourceType, pageCodename: '' }
        case 'scorm':
        case 'xapi':
            return { type: resourceType, packageDescriptor: { codename: '' } }
        case 'file':
            return { type: resourceType, storageKey: '' }
        default:
            return { type: resourceType, url: '' }
    }
}
