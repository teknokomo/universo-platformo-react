import type { ModuleAttachmentKind } from '@universo-react/types'
import type { ExecutionTarget } from './types'

export interface WidgetExtensionConfig {
    attachedToKind?: ModuleAttachmentKind
    attachedToId?: string | null
    moduleCodename?: string
    mountMethodName?: string
    submitMethodName?: string
    executionTarget?: ExecutionTarget
}

export interface WidgetExtension<MountResult = unknown, SubmitPayload = unknown, SubmitResult = unknown> {
    mount?(locale?: string): Promise<MountResult> | MountResult
    submit?(payload: SubmitPayload): Promise<SubmitResult> | SubmitResult
}
