import { type DbExecutor } from '@universo-react/utils'
import { EffectiveLayoutError } from '../../services/effectiveLayoutContract'
import { resolveEffectiveLayoutStructureForRequest, type EffectiveLayoutAuthContext } from '../../services/effectiveLayoutResolverCore'
import { UpdateFailure } from '../../shared/runtimeHelpers'
import { createEmptyRuntimeZoneWidgets, mapRuntimeZoneWidgets, type RuntimeZoneWidgets } from '../../services/runtimeRowSupport/contracts'
import { attachRuntimeRelationAuthorityProjection } from '../../services/runtimeRowSupport/runtimeRelationAuthority'
import { attachRuntimeTableReorderAuthorityProjection } from '../../services/runtimeRowSupport/runtimeTableReorderAuthority'

export const resolveRuntimeEffectiveLayout = async (params: {
    manager: DbExecutor
    applicationId: string
    userId: string
    role: EffectiveLayoutAuthContext['role']
    targetKind: 'page' | 'object'
    entityTypeId: string
    workspaceId: string | null
    locale: string
}): Promise<{ layoutId: string; layoutConfig: Record<string, unknown>; zoneWidgets: RuntimeZoneWidgets }> => {
    try {
        const result = await resolveEffectiveLayoutStructureForRequest(
            params.manager,
            {
                applicationId: params.applicationId,
                userId: params.userId,
                role: params.role
            },
            {
                applicationId: params.applicationId,
                targetKind: params.targetKind,
                entityTypeId: params.entityTypeId,
                ...(params.workspaceId !== null ? { workspaceId: params.workspaceId } : {}),
                locale: params.locale
            }
        )
        const zoneWidgets =
            result.layout.templateKey === 'dashboard'
                ? attachRuntimeTableReorderAuthorityProjection(
                      attachRuntimeRelationAuthorityProjection(
                          mapRuntimeZoneWidgets(
                              result.widgets
                                  .filter((widget) => widget.isActive)
                                  .map((widget) => ({
                                      id: widget.id,
                                      layout_id: result.layout.id,
                                      widget_key: widget.widgetKey,
                                      sort_order: widget.sortOrder,
                                      config: widget.config,
                                      zone: widget.zone
                                  }))
                          ),
                          result.widgets
                      ),
                      result.widgets
                  )
                : createEmptyRuntimeZoneWidgets()
        return {
            layoutId: result.layout.id,
            layoutConfig: result.layout.config ?? {},
            zoneWidgets
        }
    } catch (error) {
        if (error instanceof EffectiveLayoutError) {
            throw new UpdateFailure(error.httpStatus, {
                error: 'Runtime layout could not be resolved',
                code: error.code
            })
        }
        throw error
    }
}
