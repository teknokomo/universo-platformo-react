import type { ResourceType } from '@universo-react/types'

const DEFAULT_RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
    page: 'Page',
    url: 'Link',
    video: 'Video',
    audio: 'Audio',
    document: 'Document',
    scorm: 'SCORM',
    xapi: 'xAPI',
    embed: 'Embed',
    file: 'File'
}

export const getDefaultResourceTypeLabel = (resourceType: ResourceType): string => DEFAULT_RESOURCE_TYPE_LABELS[resourceType]
