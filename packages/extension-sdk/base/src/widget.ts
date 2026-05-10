import type { ScriptAttachmentKind } from '@universo/types'
import type { ExecutionTarget } from './types'

export interface WidgetExtensionConfig {
    attachedToKind?: ScriptAttachmentKind
    attachedToId?: string | null
    scriptCodename?: string
    mountMethodName?: string
    submitMethodName?: string
    executionTarget?: ExecutionTarget
}

export interface WidgetExtension<MountResult = unknown, SubmitPayload = unknown, SubmitResult = unknown> {
    mount?(locale?: string): Promise<MountResult> | MountResult
    submit?(payload: SubmitPayload): Promise<SubmitResult> | SubmitResult
}
