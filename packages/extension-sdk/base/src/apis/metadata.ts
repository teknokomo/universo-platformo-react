import type { ScriptAttachmentKind } from '@universo/types'

export interface AttachedEntityRef {
    kind: ScriptAttachmentKind
    id: string | null
}

export interface ExtensionMetadataApi {
    getAttachedEntity(): Promise<AttachedEntityRef>
    getByCodename(kind: ScriptAttachmentKind, codename: string): Promise<unknown | null>
}