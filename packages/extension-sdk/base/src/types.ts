import type { ScriptAttachmentKind, ScriptCapability, ScriptEventName, ScriptModuleRole, ScriptSourceKind } from '@universo/types'
import type { HttpAPI } from './apis/http'
import type { I18nAPI } from './apis/i18n'
import type { ExtensionLedgerApi } from './apis/ledgers'
import type { LogAPI } from './apis/log'
import type { ExtensionMetadataApi } from './apis/metadata'
import type { ExtensionRecordApi } from './apis/records'
import type { StateAPI } from './apis/state'

export const EXECUTION_TARGETS = ['server', 'client', 'server_and_client'] as const
export type ExecutionTarget = (typeof EXECUTION_TARGETS)[number]

export type LifecycleEvent = ScriptEventName

export interface EventContext<TPayload = unknown> {
    eventName: LifecycleEvent
    payload?: TPayload
    applicationId?: string
    metahubId?: string
    scriptId?: string
    scriptCodename?: string
}

export interface ScriptContext {
    applicationId?: string
    metahubId?: string
    scriptId?: string
    scriptCodename?: string
    records: ExtensionRecordApi
    ledger: ExtensionLedgerApi
    metadata: ExtensionMetadataApi
    callServerMethod(methodName: string, args: unknown[]): Promise<unknown>
    emit?(eventName: ScriptEventName, payload?: unknown): Promise<unknown>
    http?: HttpAPI
    state?: StateAPI
    log?: LogAPI
    i18n?: I18nAPI
}

export type ExtensionScriptContext = ScriptContext

export interface ExtensionScriptMetadata {
    sdkApiVersion?: string
    moduleRole?: ScriptModuleRole
    sourceKind?: ScriptSourceKind
    capabilities?: ScriptCapability[]
    attachedToKind?: ScriptAttachmentKind | null
}
