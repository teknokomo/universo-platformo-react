import { ScriptEngine } from '@universo/scripting-engine'
import {
    canCallScriptMethodOverPublicRpc,
    hasScriptCapability,
    isClientScriptMethodTarget,
    isScriptAttachmentKind,
    isServerScriptMethodTarget,
    normalizeScriptAttachmentKind,
    normalizeScriptCapabilities,
    normalizeScriptModuleRole,
    normalizeScriptSourceKind,
    resolveScriptSdkApiVersion,
    type ApplicationLifecycleContract,
    type ApplicationScriptDefinition,
    type RuntimeScriptCallRequest,
    type ScriptAttachmentKind,
    type ScriptCapability,
    type ScriptLifecyclePayload
} from '@universo/types'
import { createLocalizedContent, resolveApplicationLifecycleContractFromConfig, type DbExecutor } from '@universo/utils'
import type { RolePermission } from '../routes/guards'
import { RuntimeLedgersService } from './runtimeLedgersService'
import {
    allocateRuntimeRecordNumber,
    assertRuntimeRecordMutable,
    isRuntimeRecordBehaviorEnabled,
    normalizeRuntimeRecordBehavior
} from './runtimeRecordBehavior'
import {
    IDENTIFIER_REGEX,
    RUNTIME_WRITABLE_TYPES,
    buildRuntimeActiveRowCondition,
    buildRuntimeSoftDeleteSetClause,
    coerceRuntimeValue,
    ensureEnumerationValueBelongsToTarget,
    formatRuntimeFieldLabel,
    getDefaultEnumValueId,
    getEnumPresentationMode,
    getRuntimeInputValue,
    getSetConstantConfig,
    isSoftDeleteLifecycle,
    pgNumericToNumber,
    quoteIdentifier,
    resolveRefId,
    resolveRuntimeCodenameText,
    runtimeCodenameTextSql
} from '../shared/runtimeHelpers'

const LEDGER_CAPABILITY_CONDITION = `
(
  COALESCE((config->'components'->'ledgerSchema'->>'enabled')::boolean, false) = true
  AND COALESCE((config->'components'->'dataSchema'->>'enabled')::boolean, false) = true
  AND COALESCE((config->'components'->'physicalTable'->>'enabled')::boolean, false) = true
  AND jsonb_typeof(config->'ledger') = 'object'
)`

type RuntimeScriptRow = {
    id: string
    codename: string
    presentation?: unknown
    attached_to_kind: ScriptAttachmentKind
    attached_to_id?: string | null
    module_role: ApplicationScriptDefinition['moduleRole']
    source_kind: ApplicationScriptDefinition['sourceKind']
    sdk_api_version: string
    manifest?: unknown
    server_bundle?: string | null
    client_bundle?: string | null
    checksum: string
    is_active: boolean
    config?: unknown
}

type RuntimeScriptObjectRow = {
    id: string
    kind: string
    codename: unknown
    table_name: string
    config?: Record<string, unknown> | null
}

type RuntimeScriptAttributeRow = {
    id: string
    codename: unknown
    column_name: string
    data_type: string
    is_required: boolean
    validation_rules?: Record<string, unknown>
    target_object_id?: string | null
    target_object_kind?: string | null
    ui_config?: Record<string, unknown>
}

type RuntimeScriptRecordBinding = {
    object: RuntimeScriptObjectRow & {
        lifecycleContract: ApplicationLifecycleContract
        hasWorkspaceColumn: boolean
    }
    attrs: RuntimeScriptAttributeRow[]
    tableIdent: string
    activeRowCondition: string
}

type RuntimeLifecycleDispatchParams = {
    executor: DbExecutor
    applicationId: string
    schemaName: string
    attachmentKind?: ScriptAttachmentKind | null
    attachmentId?: string | null
    entityCodename: string
    currentWorkspaceId?: string | null
    currentUserId?: string | null
    permissions?: Record<RolePermission, boolean> | null
    attributeIds?: string[]
    payload: Omit<ScriptLifecyclePayload, 'entityCodename'>
}

const ACTIVE_SCRIPT_WHERE = '_upl_deleted = false AND _app_deleted = false AND is_active = true'

const createFallbackScriptPresentation = (): ApplicationScriptDefinition['presentation'] => ({
    name: createLocalizedContent('en', '')
})

const normalizeScript = (row: RuntimeScriptRow): ApplicationScriptDefinition => {
    const moduleRole = normalizeScriptModuleRole(row.module_role)
    const sourceKind = normalizeScriptSourceKind(row.source_kind)
    const rawManifest =
        row.manifest && typeof row.manifest === 'object' ? (row.manifest as Partial<ApplicationScriptDefinition['manifest']>) : {}
    const manifestModuleRole = normalizeScriptModuleRole(rawManifest.moduleRole ?? moduleRole)
    const sdkApiVersion = resolveScriptSdkApiVersion({
        sdkApiVersion: row.sdk_api_version,
        manifestSdkApiVersion: rawManifest.sdkApiVersion
    })

    return {
        id: row.id,
        codename: row.codename,
        presentation:
            row.presentation && typeof row.presentation === 'object'
                ? (row.presentation as ApplicationScriptDefinition['presentation'])
                : createFallbackScriptPresentation(),
        attachedToKind: row.attached_to_kind,
        attachedToId: row.attached_to_id ?? null,
        moduleRole: manifestModuleRole,
        sourceKind: normalizeScriptSourceKind(rawManifest.sourceKind ?? sourceKind),
        sdkApiVersion,
        manifest: {
            className: typeof rawManifest.className === 'string' ? rawManifest.className : 'ExtensionScriptModule',
            sdkApiVersion,
            moduleRole: manifestModuleRole,
            sourceKind: normalizeScriptSourceKind(rawManifest.sourceKind ?? sourceKind),
            capabilities: normalizeScriptCapabilities(manifestModuleRole, rawManifest.capabilities),
            methods: Array.isArray(rawManifest.methods) ? rawManifest.methods : [],
            checksum: typeof rawManifest.checksum === 'string' ? rawManifest.checksum : undefined
        },
        serverBundle: row.server_bundle ?? null,
        clientBundle: row.client_bundle ?? null,
        checksum: row.checksum,
        isActive: row.is_active,
        config: row.config && typeof row.config === 'object' ? (row.config as Record<string, unknown>) : {}
    }
}

const sanitizeClientScript = (script: ApplicationScriptDefinition): ApplicationScriptDefinition => ({
    ...script,
    serverBundle: null,
    clientBundle: null
})

const createCapabilityError = (capability: ScriptCapability): Error =>
    new Error(`Script capability "${capability}" is not enabled for this module`)

const createLifecycleRpcError = (): Error => new Error('Runtime script lifecycle handlers are not callable through public RPC')

const createPublicRpcError = (): Error => new Error('Runtime script method is not callable through public RPC')

const buildAttachmentKey = (kind: ScriptAttachmentKind, id: string | null | undefined): string => `${kind}:${id ?? ''}`

const resolveRecordFieldKey = (attr: RuntimeScriptAttributeRow): string => {
    const codenameKey = resolveRuntimeCodenameText(attr.codename)
    return codenameKey.trim().length > 0 ? codenameKey : attr.column_name
}

const resolveLifecycleAttachmentKind = (kind: string): ScriptAttachmentKind | null =>
    isScriptAttachmentKind(kind) ? normalizeScriptAttachmentKind(kind) : null

const collectTouchedRecordAttributeIds = (attrs: RuntimeScriptAttributeRow[], payload: Record<string, unknown>): string[] => {
    const touched = new Set<string>()

    for (const attr of attrs) {
        const { hasUserValue } = getRuntimeInputValue(payload, attr.column_name, resolveRecordFieldKey(attr))

        if (hasUserValue) {
            touched.add(attr.id)
        }
    }

    return [...touched]
}

const isLocalizedStringAttribute = (attr: RuntimeScriptAttributeRow): boolean =>
    attr.data_type === 'STRING' && Boolean(attr.validation_rules?.versioned || attr.validation_rules?.localized)

const buildScriptRecordPayload = (row: Record<string, unknown>, attrs: RuntimeScriptAttributeRow[]): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
        id: String(row.id)
    }

    for (const attr of attrs) {
        const fieldKey = resolveRecordFieldKey(attr)
        if (fieldKey === 'id') {
            continue
        }

        const rawValue = row[attr.column_name] ?? null
        payload[fieldKey] = attr.data_type === 'NUMBER' && rawValue !== null ? pgNumericToNumber(rawValue) : rawValue
    }

    return payload
}

const assertCurrentUserId = (currentUserId: string | null): string => {
    if (!currentUserId) {
        throw new Error('Runtime script write context is missing current user id')
    }

    return currentUserId
}

const assertMutationPermission = (permissions: Record<RolePermission, boolean> | null, permission: RolePermission) => {
    if (permissions?.[permission]) {
        return
    }

    throw new Error('Insufficient permissions for this action')
}

const ensureNoUnsupportedTableFields = (attrs: RuntimeScriptAttributeRow[], payload: Record<string, unknown>) => {
    const tableAttrs = attrs.filter((attr) => attr.data_type === 'TABLE')

    for (const attr of tableAttrs) {
        const { hasUserValue } = getRuntimeInputValue(payload, attr.column_name, attr.codename)
        if (hasUserValue) {
            throw new Error(`TABLE field is not supported by the runtime Record API: ${formatRuntimeFieldLabel(attr.codename)}`)
        }
    }
}

const assertNoUnknownRecordFields = (
    attrs: RuntimeScriptAttributeRow[],
    payload: Record<string, unknown>,
    allowedExtraKeys: string[] = []
) => {
    const allowedKeys = new Set<string>(allowedExtraKeys)

    for (const attr of attrs) {
        allowedKeys.add(attr.column_name)
        allowedKeys.add(resolveRecordFieldKey(attr))
    }

    for (const key of Object.keys(payload)) {
        if (!allowedKeys.has(key)) {
            throw new Error(`Unknown record field: ${key}`)
        }
    }
}

const normalizeFilterPagination = (filters?: Record<string, unknown>): { limit: number; offset: number } => {
    const rawLimit = filters?.limit
    const rawOffset = filters?.offset

    const limit =
        typeof rawLimit === 'number' ? rawLimit : typeof rawLimit === 'string' && rawLimit.trim().length > 0 ? Number(rawLimit) : 100
    const offset =
        typeof rawOffset === 'number' ? rawOffset : typeof rawOffset === 'string' && rawOffset.trim().length > 0 ? Number(rawOffset) : 0

    if (!Number.isInteger(limit) || limit <= 0 || limit > 1000) {
        throw new Error('Record API list() limit must be an integer between 1 and 1000')
    }

    if (!Number.isInteger(offset) || offset < 0) {
        throw new Error('Record API list() offset must be a non-negative integer')
    }

    return { limit, offset }
}

const resolveFilterAttribute = (attrs: RuntimeScriptAttributeRow[], key: string): RuntimeScriptAttributeRow | null => {
    const normalizedKey = key.trim().toLowerCase()
    if (!normalizedKey) {
        return null
    }

    return (
        attrs.find((attr) => {
            const codenameKey = resolveRecordFieldKey(attr).trim().toLowerCase()
            return codenameKey === normalizedKey || attr.column_name.trim().toLowerCase() === normalizedKey
        }) ?? null
    )
}

const resolveFilterColumnSql = (attr: RuntimeScriptAttributeRow): string => {
    const columnRef = quoteIdentifier(attr.column_name)
    return isLocalizedStringAttribute(attr) ? runtimeCodenameTextSql(columnRef) : columnRef
}

const normalizeRecordFilterValue = (attr: RuntimeScriptAttributeRow, rawValue: unknown): unknown => {
    if (attr.data_type === 'REF') {
        const refId = resolveRefId(rawValue)
        return coerceRuntimeValue(refId ?? rawValue, attr.data_type, attr.validation_rules)
    }

    return coerceRuntimeValue(rawValue, attr.data_type, attr.validation_rules)
}

const buildRecordListFilters = (
    attrs: RuntimeScriptAttributeRow[],
    filters?: Record<string, unknown>
): { clauses: string[]; values: unknown[]; limit: number; offset: number } => {
    if (!filters) {
        return { clauses: [], values: [], limit: 100, offset: 0 }
    }

    const { limit, offset } = normalizeFilterPagination(filters)
    const clauses: string[] = []
    const values: unknown[] = []

    for (const [key, rawValue] of Object.entries(filters)) {
        if (key === 'limit' || key === 'offset') {
            continue
        }

        if (key === 'id') {
            if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
                throw new Error('Record API id filter must be a non-empty string')
            }

            values.push(rawValue)
            clauses.push(`id = $${values.length}`)
            continue
        }

        const attr = resolveFilterAttribute(attrs, key)
        if (!attr) {
            throw new Error(`Unknown record filter field: ${key}`)
        }
        if (attr.data_type === 'TABLE') {
            throw new Error(`TABLE field cannot be used as a record filter: ${formatRuntimeFieldLabel(attr.codename)}`)
        }

        const normalizedValue = normalizeRecordFilterValue(attr, rawValue)
        if (normalizedValue === null) {
            clauses.push(`${resolveFilterColumnSql(attr)} IS NULL`)
            continue
        }

        values.push(normalizedValue)
        clauses.push(`${resolveFilterColumnSql(attr)} = $${values.length}`)
    }

    return { clauses, values, limit, offset }
}

const buildWritableAttrs = (attrs: RuntimeScriptAttributeRow[]): RuntimeScriptAttributeRow[] =>
    attrs.filter(
        (attr) => IDENTIFIER_REGEX.test(attr.column_name) && RUNTIME_WRITABLE_TYPES.has(attr.data_type) && attr.data_type !== 'TABLE'
    )

export class RuntimeScriptsService {
    constructor(
        private readonly engine: ScriptEngine = new ScriptEngine(),
        private readonly ledgers: RuntimeLedgersService = new RuntimeLedgersService()
    ) {}

    async listClientScripts(params: {
        executor: DbExecutor
        schemaName: string
        attachedToKind?: ScriptAttachmentKind
        attachedToId?: string | null
    }): Promise<ApplicationScriptDefinition[]> {
        const scripts = await this.listActiveScripts(params.executor, params.schemaName)

        return scripts
            .filter((script) => {
                if (!script.clientBundle) return false
                if (!script.manifest.methods.some((method) => isClientScriptMethodTarget(method.target))) return false
                if (params.attachedToKind && script.attachedToKind !== params.attachedToKind) return false
                if (params.attachedToId !== undefined && script.attachedToId !== (params.attachedToId ?? null)) return false
                return true
            })
            .map(sanitizeClientScript)
    }

    async getClientScriptBundle(params: {
        executor: DbExecutor
        schemaName: string
        scriptId: string
    }): Promise<{ bundle: string; checksum: string }> {
        const script = await this.getActiveScriptById(params.executor, params.schemaName, params.scriptId)
        if (!script) {
            throw new Error('Runtime script not found')
        }

        if (!script.clientBundle) {
            throw new Error('Runtime script does not expose a client bundle')
        }

        return {
            bundle: script.clientBundle,
            checksum: script.checksum
        }
    }

    async callServerMethod(params: {
        executor: DbExecutor
        applicationId: string
        schemaName: string
        scriptId: string
        currentWorkspaceId?: string | null
        currentUserId?: string | null
        permissions?: Record<RolePermission, boolean> | null
        request: RuntimeScriptCallRequest
    }): Promise<unknown> {
        const script = await this.getActiveScriptById(params.executor, params.schemaName, params.scriptId)
        if (!script) {
            throw new Error('Runtime script not found')
        }

        if (!script.serverBundle) {
            throw new Error('Runtime script does not expose a server bundle')
        }

        const method = script.manifest.methods.find((item) => item.name === params.request.methodName)
        if (!method) {
            throw new Error('Runtime script method was not found')
        }

        if (method.eventName) {
            throw createLifecycleRpcError()
        }

        if (!hasScriptCapability(script.manifest, 'rpc.client')) {
            throw createCapabilityError('rpc.client')
        }

        if (!canCallScriptMethodOverPublicRpc(script.manifest, method)) {
            throw createPublicRpcError()
        }

        const context = this.createExecutionContext({
            executor: params.executor,
            applicationId: params.applicationId,
            schemaName: params.schemaName,
            script,
            currentWorkspaceId: params.currentWorkspaceId ?? null,
            currentUserId: params.currentUserId ?? null,
            permissions: params.permissions ?? null,
            executionOrigin: 'manual'
        })

        return this.engine.callMethod({
            bundle: script.serverBundle,
            methodName: params.request.methodName,
            args: params.request.args,
            context
        })
    }

    async dispatchLifecycleEvent(params: RuntimeLifecycleDispatchParams): Promise<unknown[]> {
        const scripts = await this.listActiveScripts(params.executor, params.schemaName)
        const attachmentKeys = new Set<string>([
            buildAttachmentKey('metahub', null),
            ...(params.attachmentKind && params.attachmentId ? [buildAttachmentKey(params.attachmentKind, params.attachmentId)] : []),
            ...(params.attributeIds ?? []).map((attributeId) => buildAttachmentKey('attribute', attributeId))
        ])
        const results: unknown[] = []

        for (const script of scripts) {
            if (!script.serverBundle) continue
            if (!hasScriptCapability(script.manifest, 'lifecycle')) continue
            if (!attachmentKeys.has(buildAttachmentKey(script.attachedToKind, script.attachedToId))) continue

            const handlers = script.manifest.methods.filter(
                (method) => isServerScriptMethodTarget(method.target) && method.eventName === params.payload.eventName
            )
            if (handlers.length === 0) continue

            const context = this.createExecutionContext({
                executor: params.executor,
                applicationId: params.applicationId,
                schemaName: params.schemaName,
                script,
                currentWorkspaceId: params.currentWorkspaceId ?? null,
                currentUserId: params.currentUserId ?? null,
                permissions: params.permissions ?? null,
                executionOrigin: 'registrar',
                registrarKind: params.attachmentKind ?? null
            })

            results.push(
                ...(await this.engine.dispatchEvent({
                    bundle: script.serverBundle,
                    manifest: script.manifest,
                    eventName: params.payload.eventName,
                    payload: {
                        ...params.payload,
                        entityCodename: params.entityCodename
                    },
                    context
                }))
            )
        }

        return results
    }

    private dispatchLifecycleEventAfterCommit(params: RuntimeLifecycleDispatchParams | null): void {
        if (!params) {
            return
        }

        void this.dispatchLifecycleEvent(params).catch((error) => {
            console.error(`[RuntimeScriptsService] ${params.payload.eventName} lifecycle hook failed`, error)
        })
    }

    private buildLifecycleDispatchParams(params: {
        executor: DbExecutor
        applicationId: string
        schemaName: string
        binding: RuntimeScriptRecordBinding
        currentWorkspaceId: string | null
        currentUserId: string | null
        permissions: Record<RolePermission, boolean> | null
        attributeIds?: string[]
        payload: Omit<ScriptLifecyclePayload, 'entityCodename'>
    }): RuntimeLifecycleDispatchParams {
        return {
            executor: params.executor,
            applicationId: params.applicationId,
            schemaName: params.schemaName,
            attachmentKind: resolveLifecycleAttachmentKind(params.binding.object.kind),
            attachmentId: params.binding.object.id,
            entityCodename: resolveRuntimeCodenameText(params.binding.object.codename),
            currentWorkspaceId: params.currentWorkspaceId,
            currentUserId: params.currentUserId,
            permissions: params.permissions,
            attributeIds: params.attributeIds,
            payload: params.payload
        }
    }

    private async listActiveScripts(executor: DbExecutor, schemaName: string): Promise<ApplicationScriptDefinition[]> {
        if (!(await this.hasScriptsTable(executor, schemaName))) {
            return []
        }

        const rows = (await executor.query(
            `
        SELECT id, codename, presentation, attached_to_kind, attached_to_id, module_role, source_kind,
               sdk_api_version, manifest, server_bundle, client_bundle, checksum, is_active, config
        FROM "${schemaName}"._app_scripts
        WHERE ${ACTIVE_SCRIPT_WHERE}
        ORDER BY attached_to_kind ASC, attached_to_id ASC NULLS FIRST, codename ASC, id ASC
      `
        )) as RuntimeScriptRow[]

        return rows.map(normalizeScript)
    }

    private async getActiveScriptById(
        executor: DbExecutor,
        schemaName: string,
        scriptId: string
    ): Promise<ApplicationScriptDefinition | null> {
        if (!(await this.hasScriptsTable(executor, schemaName))) {
            return null
        }

        const rows = (await executor.query(
            `
        SELECT id, codename, presentation, attached_to_kind, attached_to_id, module_role, source_kind,
               sdk_api_version, manifest, server_bundle, client_bundle, checksum, is_active, config
        FROM "${schemaName}"._app_scripts
        WHERE id = $1 AND ${ACTIVE_SCRIPT_WHERE}
        LIMIT 1
      `,
            [scriptId]
        )) as RuntimeScriptRow[]

        return rows[0] ? normalizeScript(rows[0]) : null
    }

    private async hasScriptsTable(executor: DbExecutor, schemaName: string): Promise<boolean> {
        const rows = (await executor.query('SELECT to_regclass($1) AS table_name', [`${schemaName}._app_scripts`])) as Array<{
            table_name?: string | null
        }>

        return typeof rows[0]?.table_name === 'string' && rows[0].table_name.length > 0
    }

    private createExecutionContext(params: {
        executor: DbExecutor
        applicationId: string
        schemaName: string
        script: ApplicationScriptDefinition
        currentWorkspaceId: string | null
        currentUserId: string | null
        permissions: Record<RolePermission, boolean> | null
        executionOrigin?: 'manual' | 'registrar'
        registrarKind?: ScriptAttachmentKind | null
    }) {
        const canReadRecords = hasScriptCapability(params.script.manifest, 'records.read')
        const canWriteRecords = hasScriptCapability(params.script.manifest, 'records.write')
        const canReadMetadata = hasScriptCapability(params.script.manifest, 'metadata.read')
        const canReadLedger = hasScriptCapability(params.script.manifest, 'ledger.read')
        const canWriteLedger = hasScriptCapability(params.script.manifest, 'ledger.write')
        const canCallServerMethod = hasScriptCapability(params.script.manifest, 'rpc.client')
        const ledgerWriteOrigin = params.executionOrigin ?? 'manual'
        const ledgerRegistrarKind = params.executionOrigin === 'registrar' ? params.registrarKind ?? null : null

        const callServerMethod = async (methodName: string, args: unknown[]) => {
            if (!canCallServerMethod) {
                throw createCapabilityError('rpc.client')
            }

            return this.callServerMethod({
                executor: params.executor,
                applicationId: params.applicationId,
                schemaName: params.schemaName,
                scriptId: params.script.id,
                currentWorkspaceId: params.currentWorkspaceId,
                currentUserId: params.currentUserId,
                permissions: params.permissions,
                request: {
                    methodName,
                    args
                }
            })
        }

        const denyCapability = async (capability: ScriptCapability): Promise<never> => {
            throw createCapabilityError(capability)
        }

        const baseContext: Record<string, unknown> = {
            applicationId: params.applicationId,
            scriptId: params.script.id,
            scriptCodename: params.script.codename,
            records: {
                list: canReadRecords
                    ? async (entityCodename: string, filters?: Record<string, unknown>) => {
                          return this.listRecords({
                              executor: params.executor,
                              schemaName: params.schemaName,
                              currentWorkspaceId: params.currentWorkspaceId,
                              entityCodename,
                              filters
                          })
                      }
                    : async () => denyCapability('records.read'),
                get: canReadRecords
                    ? async (entityCodename: string, recordId: string) => {
                          return this.getRecord({
                              executor: params.executor,
                              schemaName: params.schemaName,
                              currentWorkspaceId: params.currentWorkspaceId,
                              entityCodename,
                              recordId
                          })
                      }
                    : async () => denyCapability('records.read'),
                findByCodename: canReadRecords
                    ? async (entityCodename: string, codename: string) => {
                          return this.findRecordByCodename({
                              executor: params.executor,
                              schemaName: params.schemaName,
                              currentWorkspaceId: params.currentWorkspaceId,
                              entityCodename,
                              codename
                          })
                      }
                    : async () => denyCapability('records.read'),
                create: canWriteRecords
                    ? async (entityCodename: string, data: Record<string, unknown>) => {
                          return this.createRecord({
                              executor: params.executor,
                              applicationId: params.applicationId,
                              schemaName: params.schemaName,
                              currentWorkspaceId: params.currentWorkspaceId,
                              currentUserId: params.currentUserId,
                              permissions: params.permissions,
                              entityCodename,
                              data
                          })
                      }
                    : async () => denyCapability('records.write'),
                update: canWriteRecords
                    ? async (entityCodename: string, recordId: string, patch: Record<string, unknown>) => {
                          return this.updateRecord({
                              executor: params.executor,
                              applicationId: params.applicationId,
                              schemaName: params.schemaName,
                              currentWorkspaceId: params.currentWorkspaceId,
                              currentUserId: params.currentUserId,
                              permissions: params.permissions,
                              entityCodename,
                              recordId,
                              patch
                          })
                      }
                    : async () => denyCapability('records.write'),
                delete: canWriteRecords
                    ? async (entityCodename: string, recordId: string) => {
                          await this.deleteRecord({
                              executor: params.executor,
                              applicationId: params.applicationId,
                              schemaName: params.schemaName,
                              currentWorkspaceId: params.currentWorkspaceId,
                              currentUserId: params.currentUserId,
                              permissions: params.permissions,
                              entityCodename,
                              recordId
                          })
                      }
                    : async () => denyCapability('records.write')
            },
            metadata: {
                getAttachedEntity: canReadMetadata
                    ? async () => ({
                          kind: params.script.attachedToKind,
                          id: params.script.attachedToId ?? null
                      })
                    : async () => denyCapability('metadata.read'),
                getByCodename: canReadMetadata
                    ? async (kind: ScriptAttachmentKind, codename: string) => {
                          if (kind === 'metahub') {
                              return null
                          }

                          if (kind === 'attribute') {
                              const rows = (await params.executor.query(
                                  `
                    SELECT id, object_id, codename, column_name, data_type
                    FROM "${params.schemaName}"._app_attributes
                    WHERE ${runtimeCodenameTextSql('codename')} = $1
                      AND _upl_deleted = false
                      AND _app_deleted = false
                    LIMIT 1
                  `,
                                  [codename]
                              )) as Array<Record<string, unknown>>

                              return rows[0] ?? null
                          }

                          const rows = (await params.executor.query(
                              `
                  SELECT id, kind, codename, table_name, presentation, config
                  FROM "${params.schemaName}"._app_objects
                  WHERE kind = $1
                    AND ${runtimeCodenameTextSql('codename')} = $2
                    AND _upl_deleted = false
                    AND _app_deleted = false
                  LIMIT 1
                `,
                              [kind, codename]
                          )) as Array<Record<string, unknown>>

                          return rows[0] ?? null
                      }
                    : async () => denyCapability('metadata.read')
            },
            ledger: {
                list: canReadLedger
                    ? async () =>
                          this.ledgers.listLedgers({
                              executor: params.executor,
                              schemaName: params.schemaName
                          })
                    : async () => denyCapability('ledger.read'),
                facts: canReadLedger
                    ? async (ledgerCodename: string, options?: { limit?: number; offset?: number }) => {
                          const ledger = await this.resolveLedgerMetadataByCodename(params.executor, params.schemaName, ledgerCodename)
                          return this.ledgers.listFacts({
                              executor: params.executor,
                              schemaName: params.schemaName,
                              ledgerId: ledger.id,
                              currentWorkspaceId: params.currentWorkspaceId,
                              limit: options?.limit,
                              offset: options?.offset
                          })
                      }
                    : async () => denyCapability('ledger.read'),
                query: canReadLedger
                    ? async (
                          ledgerCodename: string,
                          projectionCodename: string,
                          options?: { filters?: Record<string, unknown>; limit?: number; offset?: number }
                      ) => {
                          const ledger = await this.resolveLedgerMetadataByCodename(params.executor, params.schemaName, ledgerCodename)
                          return this.ledgers.queryProjection({
                              executor: params.executor,
                              schemaName: params.schemaName,
                              ledgerId: ledger.id,
                              currentWorkspaceId: params.currentWorkspaceId,
                              projectionCodename,
                              filters: options?.filters,
                              limit: options?.limit,
                              offset: options?.offset
                          })
                      }
                    : async () => denyCapability('ledger.read'),
                append: canWriteLedger
                    ? async (ledgerCodename: string, facts: Array<{ data: Record<string, unknown> }>) =>
                          this.ledgers.appendFacts({
                              executor: params.executor,
                              schemaName: params.schemaName,
                              ledgerCodename,
                              currentWorkspaceId: params.currentWorkspaceId,
                              currentUserId: params.currentUserId,
                              facts,
                              writeOrigin: ledgerWriteOrigin,
                              registrarKind: ledgerRegistrarKind
                          })
                    : async () => denyCapability('ledger.write'),
                reverse: canWriteLedger
                    ? async (ledgerCodename: string, factIds: string[]) =>
                          this.ledgers.reverseFacts({
                              executor: params.executor,
                              schemaName: params.schemaName,
                              ledgerCodename,
                              currentWorkspaceId: params.currentWorkspaceId,
                              currentUserId: params.currentUserId,
                              factIds,
                              writeOrigin: ledgerWriteOrigin,
                              registrarKind: ledgerRegistrarKind
                          })
                    : async () => denyCapability('ledger.write')
            },
            callServerMethod
        }

        return baseContext
    }

    private async resolveLedgerMetadataByCodename(
        executor: DbExecutor,
        schemaName: string,
        ledgerCodename: string
    ): Promise<{ id: string }> {
        const normalized = ledgerCodename.trim()
        if (!normalized) {
            throw new Error('Ledger codename is required')
        }

        const rows = (await executor.query(
            `
        SELECT id
        FROM ${quoteIdentifier(schemaName)}._app_objects
        WHERE ${LEDGER_CAPABILITY_CONDITION}
          AND ${runtimeCodenameTextSql('codename')} = $1
          AND _upl_deleted = false
          AND _app_deleted = false
        LIMIT 1
      `,
            [normalized]
        )) as Array<{ id: string }>

        const id = rows[0]?.id
        if (!id) {
            throw new Error(`Ledger was not found: ${normalized}`)
        }
        return { id }
    }

    private async resolveRecordBinding(params: {
        executor: DbExecutor
        schemaName: string
        entityCodename: string
        currentWorkspaceId: string | null
    }): Promise<RuntimeScriptRecordBinding> {
        const normalizedCodename = params.entityCodename.trim()
        if (!normalizedCodename) {
            throw new Error('Record API entity codename is required')
        }

        const schemaIdent = quoteIdentifier(params.schemaName)
        const objects = (await params.executor.query(
            `
        SELECT id, kind, codename, table_name, config
        FROM ${schemaIdent}._app_objects
        WHERE ${runtimeCodenameTextSql('codename')} = $1
          AND _upl_deleted = false
          AND _app_deleted = false
        LIMIT 1
      `,
            [normalizedCodename]
        )) as RuntimeScriptObjectRow[]

        const object = objects[0]
        if (!object) {
            throw new Error(`Runtime entity was not found: ${normalizedCodename}`)
        }
        if (!IDENTIFIER_REGEX.test(object.table_name)) {
            throw new Error(`Runtime entity table name is invalid: ${object.table_name}`)
        }

        const hasWorkspaceColumnRows = (await params.executor.query(
            `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
          AND column_name = 'workspace_id'
        LIMIT 1
      `,
            [params.schemaName, object.table_name]
        )) as Array<Record<string, unknown>>

        const attrs = (await params.executor.query(
            `
        SELECT id, codename, column_name, data_type, is_required, validation_rules,
               target_object_id, target_object_kind, ui_config
        FROM ${schemaIdent}._app_attributes
        WHERE object_id = $1
          AND parent_attribute_id IS NULL
          AND _upl_deleted = false
          AND _app_deleted = false
      `,
            [object.id]
        )) as RuntimeScriptAttributeRow[]

        const lifecycleContract = resolveApplicationLifecycleContractFromConfig(object.config)
        const hasWorkspaceColumn = hasWorkspaceColumnRows.length > 0

        return {
            object: {
                ...object,
                lifecycleContract,
                hasWorkspaceColumn
            },
            attrs,
            tableIdent: `${schemaIdent}.${quoteIdentifier(object.table_name)}`,
            activeRowCondition: buildRuntimeActiveRowCondition(
                lifecycleContract,
                object.config,
                undefined,
                hasWorkspaceColumn ? params.currentWorkspaceId : undefined
            )
        }
    }

    private async getRecordById(params: {
        executor: DbExecutor
        binding: RuntimeScriptRecordBinding
        recordId: string
    }): Promise<Record<string, unknown> | null> {
        const attrs = params.binding.attrs.filter((attr) => IDENTIFIER_REGEX.test(attr.column_name) && attr.data_type !== 'TABLE')
        const selectColumns = ['id', ...attrs.map((attr) => quoteIdentifier(attr.column_name))]

        const rows = (await params.executor.query(
            `
        SELECT ${selectColumns.join(', ')}
        FROM ${params.binding.tableIdent}
        WHERE id = $1
          AND ${params.binding.activeRowCondition}
        LIMIT 1
      `,
            [params.recordId]
        )) as Array<Record<string, unknown>>

        return rows[0] ? buildScriptRecordPayload(rows[0], attrs) : null
    }

    private async listRecords(params: {
        executor: DbExecutor
        schemaName: string
        currentWorkspaceId: string | null
        entityCodename: string
        filters?: Record<string, unknown>
    }): Promise<Record<string, unknown>[]> {
        const binding = await this.resolveRecordBinding(params)
        const attrs = binding.attrs.filter((attr) => IDENTIFIER_REGEX.test(attr.column_name) && attr.data_type !== 'TABLE')
        const { clauses, values, limit, offset } = buildRecordListFilters(attrs, params.filters)
        const selectColumns = ['id', ...attrs.map((attr) => quoteIdentifier(attr.column_name))]
        const whereClause = [binding.activeRowCondition, ...clauses].join(' AND ')
        const queryValues = [...values, limit, offset]

        const rows = (await params.executor.query(
            `
        SELECT ${selectColumns.join(', ')}
        FROM ${binding.tableIdent}
        WHERE ${whereClause}
        ORDER BY _upl_created_at ASC NULLS LAST, id ASC
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
      `,
            queryValues
        )) as Array<Record<string, unknown>>

        return rows.map((row) => buildScriptRecordPayload(row, attrs))
    }

    private async getRecord(params: {
        executor: DbExecutor
        schemaName: string
        currentWorkspaceId: string | null
        entityCodename: string
        recordId: string
    }): Promise<Record<string, unknown> | null> {
        const binding = await this.resolveRecordBinding(params)
        return this.getRecordById({
            executor: params.executor,
            binding,
            recordId: params.recordId
        })
    }

    private async findRecordByCodename(params: {
        executor: DbExecutor
        schemaName: string
        currentWorkspaceId: string | null
        entityCodename: string
        codename: string
    }): Promise<Record<string, unknown> | null> {
        const binding = await this.resolveRecordBinding(params)
        const attrs = binding.attrs.filter((attr) => IDENTIFIER_REGEX.test(attr.column_name) && attr.data_type !== 'TABLE')
        const codenameAttr = attrs.find((attr) => {
            const key = resolveRecordFieldKey(attr).trim().toLowerCase()
            return key === 'codename' || attr.column_name.trim().toLowerCase() === 'codename'
        })

        if (!codenameAttr) {
            throw new Error(`Runtime entity does not expose a codename field: ${params.entityCodename}`)
        }

        const selectColumns = ['id', ...attrs.map((attr) => quoteIdentifier(attr.column_name))]
        const codenameColumnSql = resolveFilterColumnSql(codenameAttr)

        const rows = (await params.executor.query(
            `
        SELECT ${selectColumns.join(', ')}
        FROM ${binding.tableIdent}
        WHERE ${codenameColumnSql} = $1
          AND ${binding.activeRowCondition}
        LIMIT 1
      `,
            [params.codename]
        )) as Array<Record<string, unknown>>

        return rows[0] ? buildScriptRecordPayload(rows[0], attrs) : null
    }

    private async buildWritableColumnValues(params: {
        executor: DbExecutor
        schemaName: string
        attrs: RuntimeScriptAttributeRow[]
        payload: Record<string, unknown>
        mode: 'create' | 'update'
    }): Promise<Array<{ column: string; value: unknown }>> {
        assertNoUnknownRecordFields(params.attrs, params.payload)
        ensureNoUnsupportedTableFields(params.attrs, params.payload)

        const writableAttrs = buildWritableAttrs(params.attrs)
        const values: Array<{ column: string; value: unknown }> = []

        for (const attr of writableAttrs) {
            const attrLabel = formatRuntimeFieldLabel(attr.codename)
            const { hasUserValue, value: inputValue } = getRuntimeInputValue(params.payload, attr.column_name, attr.codename)
            let raw = inputValue

            const isEnumRef = attr.data_type === 'REF' && attr.target_object_kind === 'enumeration'
            const enumMode = getEnumPresentationMode(attr.ui_config)

            if (isEnumRef && enumMode === 'label' && hasUserValue) {
                throw new Error(`Field is read-only: ${attrLabel}`)
            }

            if (params.mode === 'create' && raw === undefined && isEnumRef && typeof attr.target_object_id === 'string') {
                const defaultEnumValueId = getDefaultEnumValueId(attr.ui_config)
                if (defaultEnumValueId) {
                    try {
                        await ensureEnumerationValueBelongsToTarget(
                            params.executor,
                            quoteIdentifier(params.schemaName),
                            defaultEnumValueId,
                            attr.target_object_id
                        )
                        raw = defaultEnumValueId
                    } catch (error) {
                        if (!(error instanceof Error) || error.message !== 'Enumeration value does not belong to target enumeration') {
                            throw error
                        }
                    }
                }
            }

            const setConstantConfig =
                attr.data_type === 'REF' && attr.target_object_kind === 'set' ? getSetConstantConfig(attr.ui_config) : null

            if (setConstantConfig) {
                const providedRefId = resolveRefId(raw)
                if (!providedRefId) {
                    raw = setConstantConfig.id
                } else if (providedRefId !== setConstantConfig.id) {
                    throw new Error(`Field is read-only: ${attrLabel}`)
                } else {
                    raw = setConstantConfig.id
                }
            }

            if (raw === undefined) {
                if (params.mode === 'create' && attr.is_required && attr.data_type !== 'BOOLEAN') {
                    throw new Error(`Required field missing: ${attrLabel}`)
                }
                continue
            }

            const normalizedRaw = attr.data_type === 'REF' ? resolveRefId(raw) ?? raw : raw
            const coerced = coerceRuntimeValue(normalizedRaw, attr.data_type, attr.validation_rules)

            if (attr.is_required && attr.data_type !== 'BOOLEAN' && coerced === null) {
                throw new Error(`Required field cannot be set to null: ${attrLabel}`)
            }

            if (isEnumRef && typeof attr.target_object_id === 'string' && coerced) {
                await ensureEnumerationValueBelongsToTarget(
                    params.executor,
                    quoteIdentifier(params.schemaName),
                    String(coerced),
                    attr.target_object_id
                )
            }

            values.push({
                column: attr.column_name,
                value: coerced
            })
        }

        return values
    }

    private async createRecord(params: {
        executor: DbExecutor
        applicationId: string
        schemaName: string
        currentWorkspaceId: string | null
        currentUserId: string | null
        permissions: Record<RolePermission, boolean> | null
        entityCodename: string
        data: Record<string, unknown>
    }): Promise<Record<string, unknown>> {
        assertMutationPermission(params.permissions, 'createContent')
        const currentUserId = assertCurrentUserId(params.currentUserId)
        let created: Record<string, unknown> | null = null
        let afterCreateLifecycleRequest: RuntimeLifecycleDispatchParams | null = null

        await params.executor.transaction(async (txExecutor) => {
            const binding = await this.resolveRecordBinding({
                ...params,
                executor: txExecutor
            })
            const touchedAttributeIds = collectTouchedRecordAttributeIds(binding.attrs, params.data)
            const columnValues = await this.buildWritableColumnValues({
                executor: txExecutor,
                schemaName: params.schemaName,
                attrs: binding.attrs,
                payload: params.data,
                mode: 'create'
            })

            await this.dispatchLifecycleEvent(
                this.buildLifecycleDispatchParams({
                    executor: txExecutor,
                    applicationId: params.applicationId,
                    schemaName: params.schemaName,
                    binding,
                    currentWorkspaceId: params.currentWorkspaceId,
                    currentUserId: params.currentUserId,
                    permissions: params.permissions,
                    attributeIds: touchedAttributeIds,
                    payload: {
                        eventName: 'beforeCreate',
                        patch: params.data
                    }
                })
            )

            const insertColumns = columnValues.map((entry) => quoteIdentifier(entry.column))
            const insertValues = columnValues.map((entry) => entry.value)
            const placeholders = insertValues.map((_, index) => `$${index + 1}`)
            const recordBehavior = normalizeRuntimeRecordBehavior(binding.object.config)
            if (isRuntimeRecordBehaviorEnabled(recordBehavior)) {
                const recordDate = new Date()
                if (recordBehavior.numbering.enabled) {
                    insertColumns.push(quoteIdentifier('_app_record_number'))
                    insertValues.push(
                        await allocateRuntimeRecordNumber({
                            manager: txExecutor,
                            schemaIdent: quoteIdentifier(params.schemaName),
                            objectId: binding.object.id,
                            behavior: recordBehavior,
                            currentWorkspaceId: params.currentWorkspaceId,
                            currentUserId: currentUserId,
                            date: recordDate
                        })
                    )
                    placeholders.push(`$${insertValues.length}`)
                }
                if (recordBehavior.effectiveDate.enabled && recordBehavior.effectiveDate.defaultToNow) {
                    insertColumns.push(quoteIdentifier('_app_record_date'))
                    insertValues.push(recordDate)
                    placeholders.push(`$${insertValues.length}`)
                }
                if (recordBehavior.lifecycle.enabled || recordBehavior.posting.mode !== 'disabled') {
                    insertColumns.push(quoteIdentifier('_app_record_state'))
                    insertValues.push('draft')
                    placeholders.push(`$${insertValues.length}`)
                }
            }

            if (binding.object.hasWorkspaceColumn && params.currentWorkspaceId) {
                insertColumns.push(quoteIdentifier('workspace_id'))
                insertValues.push(params.currentWorkspaceId)
                placeholders.push(`$${insertValues.length}`)
            }

            insertColumns.push('_upl_created_by')
            insertValues.push(currentUserId)
            placeholders.push(`$${insertValues.length}`)

            const rows = (await txExecutor.query(
                `
          INSERT INTO ${binding.tableIdent} (${insertColumns.join(', ')})
          VALUES (${placeholders.join(', ')})
          RETURNING id
        `,
                insertValues
            )) as Array<{ id: string }>

            created = await this.getRecordById({
                executor: txExecutor,
                binding,
                recordId: rows[0]?.id ?? ''
            })

            if (!created) {
                throw new Error('Runtime record was created but could not be reloaded')
            }

            afterCreateLifecycleRequest = this.buildLifecycleDispatchParams({
                executor: params.executor,
                applicationId: params.applicationId,
                schemaName: params.schemaName,
                binding,
                currentWorkspaceId: params.currentWorkspaceId,
                currentUserId: params.currentUserId,
                permissions: params.permissions,
                attributeIds: touchedAttributeIds,
                payload: {
                    eventName: 'afterCreate',
                    row: created,
                    patch: params.data
                }
            })
        })

        this.dispatchLifecycleEventAfterCommit(afterCreateLifecycleRequest)

        if (!created) {
            throw new Error('Runtime record was created but could not be reloaded')
        }

        return created
    }

    private async updateRecord(params: {
        executor: DbExecutor
        applicationId: string
        schemaName: string
        currentWorkspaceId: string | null
        currentUserId: string | null
        permissions: Record<RolePermission, boolean> | null
        entityCodename: string
        recordId: string
        patch: Record<string, unknown>
    }): Promise<Record<string, unknown>> {
        assertMutationPermission(params.permissions, 'editContent')
        const currentUserId = assertCurrentUserId(params.currentUserId)
        let updated: Record<string, unknown> | null = null
        let afterUpdateLifecycleRequest: RuntimeLifecycleDispatchParams | null = null

        await params.executor.transaction(async (txExecutor) => {
            const binding = await this.resolveRecordBinding({
                ...params,
                executor: txExecutor
            })

            const currentRow = (await txExecutor.query(
                `
          SELECT *
          FROM ${binding.tableIdent}
          WHERE id = $1
            AND ${binding.activeRowCondition}
          LIMIT 1
        `,
                [params.recordId]
            )) as Array<Record<string, unknown>>

            if (!currentRow[0]) {
                throw new Error('Runtime record was not found')
            }
            if (currentRow[0]._upl_locked) {
                throw new Error('Runtime record is locked')
            }
            assertRuntimeRecordMutable(binding.object.config, currentRow[0])

            const previousRow = await this.getRecordById({
                executor: txExecutor,
                binding,
                recordId: params.recordId
            })

            if (!previousRow) {
                throw new Error('Runtime record was not found')
            }

            const touchedAttributeIds = collectTouchedRecordAttributeIds(binding.attrs, params.patch)
            const columnValues = await this.buildWritableColumnValues({
                executor: txExecutor,
                schemaName: params.schemaName,
                attrs: binding.attrs,
                payload: params.patch,
                mode: 'update'
            })

            if (columnValues.length === 0) {
                updated = previousRow
                return
            }

            await this.dispatchLifecycleEvent(
                this.buildLifecycleDispatchParams({
                    executor: txExecutor,
                    applicationId: params.applicationId,
                    schemaName: params.schemaName,
                    binding,
                    currentWorkspaceId: params.currentWorkspaceId,
                    currentUserId: params.currentUserId,
                    permissions: params.permissions,
                    attributeIds: touchedAttributeIds,
                    payload: {
                        eventName: 'beforeUpdate',
                        previousRow,
                        patch: params.patch
                    }
                })
            )

            const setClauses = columnValues.map((entry, index) => `${quoteIdentifier(entry.column)} = $${index + 1}`)
            const values = columnValues.map((entry) => entry.value)
            values.push(currentUserId)
            const updatedByIndex = values.length
            values.push(params.recordId)
            const recordIdIndex = values.length

            const rows = (await txExecutor.query(
                `
          UPDATE ${binding.tableIdent}
          SET ${setClauses.join(', ')},
              _upl_updated_at = now(),
              _upl_updated_by = $${updatedByIndex},
              _upl_version = COALESCE(_upl_version, 1) + 1
          WHERE id = $${recordIdIndex}
            AND ${binding.activeRowCondition}
            AND COALESCE(_upl_locked, false) = false
          RETURNING id
        `,
                values
            )) as Array<{ id: string }>

            if (rows.length === 0) {
                throw new Error('Runtime record was not found')
            }

            updated = await this.getRecordById({
                executor: txExecutor,
                binding,
                recordId: params.recordId
            })

            if (!updated) {
                throw new Error('Runtime record was updated but could not be reloaded')
            }

            afterUpdateLifecycleRequest = this.buildLifecycleDispatchParams({
                executor: params.executor,
                applicationId: params.applicationId,
                schemaName: params.schemaName,
                binding,
                currentWorkspaceId: params.currentWorkspaceId,
                currentUserId: params.currentUserId,
                permissions: params.permissions,
                attributeIds: touchedAttributeIds,
                payload: {
                    eventName: 'afterUpdate',
                    row: updated,
                    previousRow,
                    patch: params.patch
                }
            })
        })

        this.dispatchLifecycleEventAfterCommit(afterUpdateLifecycleRequest)

        if (!updated) {
            throw new Error('Runtime record was updated but could not be reloaded')
        }

        return updated
    }

    private async deleteRecord(params: {
        executor: DbExecutor
        applicationId: string
        schemaName: string
        currentWorkspaceId: string | null
        currentUserId: string | null
        permissions: Record<RolePermission, boolean> | null
        entityCodename: string
        recordId: string
    }): Promise<void> {
        assertMutationPermission(params.permissions, 'deleteContent')
        const currentUserId = assertCurrentUserId(params.currentUserId)
        let afterDeleteLifecycleRequest: RuntimeLifecycleDispatchParams | null = null

        await params.executor.transaction(async (txExecutor) => {
            const binding = await this.resolveRecordBinding({
                ...params,
                executor: txExecutor
            })

            const currentRow = (await txExecutor.query(
                `
          SELECT *
          FROM ${binding.tableIdent}
          WHERE id = $1
            AND ${binding.activeRowCondition}
          LIMIT 1
        `,
                [params.recordId]
            )) as Array<Record<string, unknown>>

            if (!currentRow[0]) {
                throw new Error('Runtime record was not found')
            }
            if (currentRow[0]._upl_locked) {
                throw new Error('Runtime record is locked')
            }
            assertRuntimeRecordMutable(binding.object.config, currentRow[0])

            const previousRow = await this.getRecordById({
                executor: txExecutor,
                binding,
                recordId: params.recordId
            })

            if (!previousRow) {
                throw new Error('Runtime record was not found')
            }

            await this.dispatchLifecycleEvent(
                this.buildLifecycleDispatchParams({
                    executor: txExecutor,
                    applicationId: params.applicationId,
                    schemaName: params.schemaName,
                    binding,
                    currentWorkspaceId: params.currentWorkspaceId,
                    currentUserId: params.currentUserId,
                    permissions: params.permissions,
                    payload: {
                        eventName: 'beforeDelete',
                        previousRow
                    }
                })
            )

            if (isSoftDeleteLifecycle(binding.object.lifecycleContract)) {
                const softDeleteSetClause = buildRuntimeSoftDeleteSetClause('$1', binding.object.lifecycleContract, binding.object.config)

                const rows = (await txExecutor.query(
                    `
            UPDATE ${binding.tableIdent}
            SET ${softDeleteSetClause},
                _upl_version = COALESCE(_upl_version, 1) + 1
            WHERE id = $2
              AND ${binding.activeRowCondition}
              AND COALESCE(_upl_locked, false) = false
            RETURNING id
          `,
                    [currentUserId, params.recordId]
                )) as Array<{ id: string }>

                if (rows.length === 0) {
                    throw new Error('Runtime record was not found')
                }
            } else {
                const rows = (await txExecutor.query(
                    `
            DELETE FROM ${binding.tableIdent}
            WHERE id = $1
              AND ${binding.activeRowCondition}
              AND COALESCE(_upl_locked, false) = false
            RETURNING id
          `,
                    [params.recordId]
                )) as Array<{ id: string }>

                if (rows.length === 0) {
                    throw new Error('Runtime record was not found')
                }
            }

            afterDeleteLifecycleRequest = this.buildLifecycleDispatchParams({
                executor: params.executor,
                applicationId: params.applicationId,
                schemaName: params.schemaName,
                binding,
                currentWorkspaceId: params.currentWorkspaceId,
                currentUserId: params.currentUserId,
                permissions: params.permissions,
                payload: {
                    eventName: 'afterDelete',
                    row: null,
                    previousRow
                }
            })
        })

        this.dispatchLifecycleEventAfterCommit(afterDeleteLifecycleRequest)
    }
}
