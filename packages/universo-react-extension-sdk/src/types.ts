import type { ModuleAttachmentKind, ModuleCapability, ModuleEventName, ModuleRole, ModuleSourceKind } from '@universo-react/types'
import type { HttpAPI } from './apis/http'
import type { I18nAPI } from './apis/i18n'
import type { ExtensionLedgerApi } from './apis/ledgers'
import type { LogAPI } from './apis/log'
import type { ExtensionMetadataApi } from './apis/metadata'
import type { ExtensionRecordApi } from './apis/records'
import type { StateAPI } from './apis/state'

export const EXECUTION_TARGETS = ['server', 'client', 'server_and_client'] as const
export type ExecutionTarget = (typeof EXECUTION_TARGETS)[number]

export type LifecycleEvent = ModuleEventName

export interface EventContext<TPayload = unknown> {
    eventName: LifecycleEvent
    payload?: TPayload
    applicationId?: string
    metahubId?: string
    moduleId?: string
    moduleCodename?: string
}

export interface ModuleContext {
    applicationId?: string
    metahubId?: string
    moduleId?: string
    moduleCodename?: string
    records: ExtensionRecordApi
    ledger: ExtensionLedgerApi
    metadata: ExtensionMetadataApi
    callServerMethod(methodName: string, args: unknown[]): Promise<unknown>
    emit?(eventName: ModuleEventName, payload?: unknown): Promise<unknown>
    http?: HttpAPI
    state?: StateAPI
    log?: LogAPI
    i18n?: I18nAPI
}

export type ExtensionModuleContext = ModuleContext

export interface ExtensionModuleMetadata {
    sdkApiVersion?: string
    moduleRole?: ModuleRole
    sourceKind?: ModuleSourceKind
    capabilities?: ModuleCapability[]
    attachedToKind?: ModuleAttachmentKind | null
}
