import {
    UpdateFailure,
    quoteIdentifier,
    resolveRuntimeCodenameText,
    type RuntimeSchemaContext,
    type resolveTabularContext
} from '../shared/runtimeHelpers'
import { SYSTEM_STRUCTURE_KEY } from '../services/interpretationNetwork/runtimeInterpretationNetworkCore'
import { resolveInterpretationNetworkRuntimeSurface } from '../services/interpretationNetwork/runtimeInterpretationNetworkSurface'

export type RuntimeTableTemplateGenericMutation = 'parent-delete' | 'child-delete' | 'child-replacement'

export const getRuntimeTableTemplateGenericMutationFailure = (
    objectCodename: unknown,
    mutation: RuntimeTableTemplateGenericMutation
): { statusCode: number; body: Record<string, string> } | null => {
    if (resolveRuntimeCodenameText(objectCodename).toLowerCase() !== 'tabletemplate') return null

    const messages: Record<RuntimeTableTemplateGenericMutation, string> = {
        'parent-delete': 'TableTemplate records must be deleted through the dedicated aggregate command',
        'child-delete': 'TableTemplate child rows must be deleted through the dedicated aggregate command',
        'child-replacement':
            'TableTemplate child rows cannot be replaced through generic runtime updates when rows already exist; use a dedicated aggregate command so associated Materials are cleaned up transactionally'
    }
    return {
        statusCode: 409,
        body: {
            error: messages[mutation],
            code: 'INTERPRETATION_NETWORK_TEMPLATE_AGGREGATE_COMMAND_REQUIRED'
        }
    }
}

export const assertCanonicalMatrixChildMutation = async (
    ctx: RuntimeSchemaContext,
    applicationId: string,
    tc: Exclude<Awaited<ReturnType<typeof resolveTabularContext>>, { error: string }>,
    recordId: string,
    action: 'copy' | 'delete'
): Promise<void> => {
    const surface = await resolveInterpretationNetworkRuntimeSurface(ctx.manager, {
        applicationId,
        schemaName: ctx.schemaName,
        workspaceId: ctx.currentWorkspaceId,
        scopeEntityId: tc.object.id
    })
    if (surface.featureState === 'ambiguous-widget') {
        throw new UpdateFailure(409, {
            error: 'Interpretation Network runtime widget context is ambiguous',
            code: 'INTERPRETATION_NETWORK_AMBIGUOUS_WIDGET_CONTEXT'
        })
    }
    if (surface.featureState !== 'ready' || surface.structureMode !== 'singleSystem') return
    if (surface.resolvedObjects.Interpretation !== tc.object.id) return

    const parentStructureAttr = surface.contracts.Interpretation.fields.ParentStructure
    const structureKeyAttr = surface.contracts.Structure.fields.SystemKey
    if (!parentStructureAttr || !structureKeyAttr) return

    const parentValues: unknown[] = [recordId]
    const parentWorkspaceClause = ctx.currentWorkspaceId ? ` AND workspace_id = $2` : ''
    if (ctx.currentWorkspaceId) parentValues.push(ctx.currentWorkspaceId)
    const parentRows = await ctx.manager.query<Record<string, unknown>>(
        `SELECT ${quoteIdentifier(parentStructureAttr.column_name)} FROM ${tc.parentTableIdent} WHERE id = $1
          AND _upl_deleted = false
          AND _app_deleted = false${parentWorkspaceClause}
          LIMIT 1`,
        parentValues
    )
    const structureId = String(parentRows[0]?.[parentStructureAttr.column_name] ?? '').trim()
    if (!structureId) return

    const systemValues: unknown[] = [structureId]
    const systemWorkspaceClause = ctx.currentWorkspaceId ? ` AND workspace_id = $2` : ''
    if (ctx.currentWorkspaceId) systemValues.push(ctx.currentWorkspaceId)
    const systemRows = await ctx.manager.query<Record<string, unknown>>(
        `SELECT ${quoteIdentifier(structureKeyAttr.column_name)} FROM ${ctx.schemaIdent}.${quoteIdentifier(
            surface.contracts.Structure.object.table_name
        )} WHERE id = $1
          AND _upl_deleted = false
          AND _app_deleted = false${systemWorkspaceClause}
          LIMIT 1`,
        systemValues
    )
    if (String(systemRows[0]?.[structureKeyAttr.column_name] ?? '').trim() !== SYSTEM_STRUCTURE_KEY) return

    throw new UpdateFailure(409, {
        error: `Canonical Matrix cells cannot be ${action === 'copy' ? 'copied' : 'deleted'} in single-system mode`,
        code: 'INTERPRETATION_NETWORK_CANONICAL_MATRIX_IMMUTABLE'
    })
}
