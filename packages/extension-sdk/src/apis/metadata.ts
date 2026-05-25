import type { ModuleAttachmentKind } from '@universo/types'

export interface AttachedEntityRef {
    kind: ModuleAttachmentKind
    id: string | null
}

export interface ExtensionMetadataApi {
    getAttachedEntity(): Promise<AttachedEntityRef>
    getByCodename(kind: ModuleAttachmentKind, codename: string): Promise<unknown | null>
}
