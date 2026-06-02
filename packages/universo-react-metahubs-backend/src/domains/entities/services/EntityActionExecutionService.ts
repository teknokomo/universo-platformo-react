import { qSchemaTable } from '@universo-react/database'
import { ModuleEngine } from '@universo-react/modules-engine'
import { hasModuleCapability, isServerModuleMethodTarget, type MetahubModuleRecord, type ModuleAttachmentKind } from '@universo-react/types'
import { queryOne, type DbExecutor } from '@universo-react/utils/database'
import { codenamePrimaryTextSql, getCodenameText } from '../../shared/codename'
import { createLogger } from '../../../utils/logger'
import { MetahubModulesService } from '../../modules/services/MetahubModulesService'
import type { EntityActionExecutionRequest, EntityActionExecutor } from './EntityEventRouter'

const log = createLogger('EntityActionExecutionService')

type JsonRecord = Record<string, unknown>

type StoredLifecycleObjectRow = {
    id: string
    kind: string
    codename: unknown
    presentation?: unknown
    config?: unknown
    _upl_version?: number
    _upl_created_at?: string | Date | null
    _upl_updated_at?: string | Date | null
    _mhb_deleted?: boolean
    _mhb_deleted_at?: string | Date | null
}

type StoredMetadataObjectRow = {
    id: string
    kind: string
    codename: unknown
    table_name?: string | null
    presentation?: unknown
    config?: unknown
}

type StoredMetadataComponentRow = {
    id: string
    object_id: string
    codename: unknown
    column_name: string
    data_type: string
}

const ensureJsonRecord = (value: unknown): JsonRecord => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {}
    }

    return value as JsonRecord
}

const toIsoTimestamp = (value: unknown): string | null => {
    if (value instanceof Date) {
        return value.toISOString()
    }

    return typeof value === 'string' ? value : null
}

const normalizeLifecycleRow = (row: StoredLifecycleObjectRow): Record<string, unknown> => {
    const presentation = ensureJsonRecord(row.presentation)

    return {
        id: row.id,
        kind: row.kind,
        codename: getCodenameText(row.codename),
        name: presentation.name ?? null,
        description: presentation.description ?? null,
        config: ensureJsonRecord(row.config),
        version: typeof row._upl_version === 'number' ? row._upl_version : null,
        createdAt: toIsoTimestamp(row._upl_created_at),
        updatedAt: toIsoTimestamp(row._upl_updated_at),
        deletedAt: toIsoTimestamp(row._mhb_deleted_at),
        isDeleted: row._mhb_deleted === true || row._mhb_deleted_at != null
    }
}

export class EntityActionExecutionService {
    constructor(private readonly modulesService: MetahubModulesService, private readonly engine: ModuleEngine = new ModuleEngine()) {}

    readonly execute: EntityActionExecutor = async (request) => {
        if (request.action.actionType !== 'module') {
            log.warn(`Skipping unsupported entity action type ${request.action.actionType} for action ${request.action.id}`)
            return
        }

        if (!request.action.moduleId) {
            log.warn(`Skipping module entity action ${request.action.id} without a moduleId`)
            return
        }

        const module = await this.modulesService.getModuleByIdInSchema(
            request.schemaName,
            request.action.moduleId,
            request.executor,
            request.metahubId
        )
        if (!module) {
            log.warn(`Skipping entity action ${request.action.id} because module ${request.action.moduleId} was not found`)
            return
        }

        if (!module.serverBundle) {
            log.warn(`Skipping entity action ${request.action.id} because module ${module.id} has no server bundle`)
            return
        }

        const hasMatchingHandler = module.manifest.methods.some(
            (method) => isServerModuleMethodTarget(method.target) && method.eventName === request.eventName
        )
        if (!hasMatchingHandler) {
            return
        }

        const currentRow = await this.findObjectRow(request.schemaName, request.objectId, request.executor)

        await this.engine.dispatchEvent({
            bundle: module.serverBundle,
            manifest: module.manifest,
            eventName: request.eventName,
            payload: {
                eventName: request.eventName as never,
                entityCodename: currentRow ? String(currentRow.codename ?? request.objectId) : request.objectId,
                row: currentRow,
                previousRow: this.readLifecyclePayloadField(request.payload, 'previousRow'),
                patch: this.readLifecyclePayloadField(request.payload, 'patch'),
                metadata: {
                    ...this.readLifecyclePayloadField(request.payload, 'metadata'),
                    metahubId: request.metahubId,
                    objectId: request.objectId,
                    bindingId: request.binding.id,
                    bindingPriority: request.binding.priority,
                    bindingConfig: ensureJsonRecord(request.binding.config),
                    actionId: request.action.id,
                    actionCodename: getCodenameText(request.action.codename),
                    actionType: request.action.actionType,
                    actionConfig: ensureJsonRecord(request.action.config),
                    moduleId: module.id,
                    moduleCodename: getCodenameText(module.codename)
                }
            },
            context: this.createExecutionContext(request, module)
        })
    }

    private readLifecyclePayloadField(payload: Record<string, unknown> | undefined, field: string): Record<string, unknown> | null {
        if (!payload || !Object.prototype.hasOwnProperty.call(payload, field)) {
            return null
        }

        const value = payload[field]
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return null
        }

        return value as Record<string, unknown>
    }

    private async findObjectRow(
        schemaName: string,
        objectId: string,
        executor: Pick<DbExecutor, 'query'>
    ): Promise<Record<string, unknown> | null> {
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const row = await queryOne<StoredLifecycleObjectRow>(
            executor,
            `SELECT id, kind, codename, presentation, config, _upl_version, _upl_created_at, _upl_updated_at, _mhb_deleted, _mhb_deleted_at
             FROM ${qt}
             WHERE id = $1
             LIMIT 1`,
            [objectId]
        )

        return row ? normalizeLifecycleRow(row) : null
    }

    private createExecutionContext(request: EntityActionExecutionRequest, module: MetahubModuleRecord): Record<string, unknown> {
        const canReadMetadata = hasModuleCapability(module.manifest, 'metadata.read')
        const canReadRecords = hasModuleCapability(module.manifest, 'records.read')
        const canWriteRecords = hasModuleCapability(module.manifest, 'records.write')
        const canCallServerMethod = hasModuleCapability(module.manifest, 'rpc.client')

        const denyCapability = async (capability: string): Promise<never> => {
            throw new Error(`Module capability "${capability}" is not enabled for this module`)
        }

        const denyUnsupported = async (feature: string): Promise<never> => {
            throw new Error(`${feature} is not available in metahub entity lifecycle modules yet`)
        }

        return {
            metahubId: request.metahubId,
            moduleId: module.id,
            moduleCodename: getCodenameText(module.codename),
            records: {
                list: canReadRecords ? async () => denyUnsupported('records.list()') : async () => denyCapability('records.read'),
                get: canReadRecords ? async () => denyUnsupported('records.get()') : async () => denyCapability('records.read'),
                findByCodename: canReadRecords
                    ? async () => denyUnsupported('records.findByCodename()')
                    : async () => denyCapability('records.read'),
                create: canWriteRecords ? async () => denyUnsupported('records.create()') : async () => denyCapability('records.write'),
                update: canWriteRecords ? async () => denyUnsupported('records.update()') : async () => denyCapability('records.write'),
                delete: canWriteRecords ? async () => denyUnsupported('records.delete()') : async () => denyCapability('records.write')
            },
            ledger: {
                list: async () => denyCapability('ledger.read'),
                facts: async () => denyCapability('ledger.read'),
                query: async () => denyCapability('ledger.read'),
                append: async () => denyCapability('ledger.write'),
                reverse: async () => denyCapability('ledger.write')
            },
            metadata: {
                getAttachedEntity: canReadMetadata
                    ? async () => ({
                          kind: module.attachedToKind,
                          id: module.attachedToId ?? null
                      })
                    : async () => denyCapability('metadata.read'),
                getByCodename: canReadMetadata
                    ? async (kind: ModuleAttachmentKind, codename: string) => {
                          return this.findMetadataByCodename(request, kind, codename)
                      }
                    : async () => denyCapability('metadata.read')
            },
            callServerMethod: canCallServerMethod
                ? async () => denyUnsupported('callServerMethod()')
                : async () => denyCapability('rpc.client')
        }
    }

    private async findMetadataByCodename(
        request: EntityActionExecutionRequest,
        kind: ModuleAttachmentKind,
        codename: string
    ): Promise<Record<string, unknown> | null> {
        const normalizedCodename = String(codename).trim()
        if (!normalizedCodename) {
            return null
        }

        if (kind === 'metahub') {
            return { id: request.metahubId }
        }

        if (kind === 'component') {
            const qt = qSchemaTable(request.schemaName, '_mhb_components')
            const row = await queryOne<StoredMetadataComponentRow>(
                request.executor,
                `SELECT id, object_id, codename, column_name, data_type
                 FROM ${qt}
                 WHERE ${codenamePrimaryTextSql('codename')} = $1
                   AND _upl_deleted = false
                   AND _mhb_deleted = false
                 LIMIT 1`,
                [normalizedCodename]
            )

            return row
                ? {
                      id: row.id,
                      objectId: row.object_id,
                      codename: getCodenameText(row.codename),
                      columnName: row.column_name,
                      dataType: row.data_type
                  }
                : null
        }

        const qt = qSchemaTable(request.schemaName, '_mhb_objects')
        const row = await queryOne<StoredMetadataObjectRow>(
            request.executor,
            `SELECT id, kind, codename, table_name, presentation, config
             FROM ${qt}
             WHERE kind = $1
               AND ${codenamePrimaryTextSql('codename')} = $2
               AND _upl_deleted = false
               AND _mhb_deleted = false
             LIMIT 1`,
            [kind, normalizedCodename]
        )

        return row
            ? {
                  id: row.id,
                  kind: row.kind,
                  codename: getCodenameText(row.codename),
                  tableName: row.table_name ?? null,
                  presentation: ensureJsonRecord(row.presentation),
                  config: ensureJsonRecord(row.config)
              }
            : null
    }
}
