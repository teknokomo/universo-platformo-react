import { resolveObjectCollectionLayoutBehaviorConfig } from '@universo-react/utils'
import type { DbExecutor } from '@universo-react/utils'
import { EffectiveLayoutError } from '../../services/effectiveLayoutContract'
import { resolveEffectiveLayoutStructureForRequest, type EffectiveLayoutAuthContext } from '../../services/effectiveLayoutResolverCore'
import { UpdateFailure } from '../../shared/runtimeHelpers'
import { resolveRuntimeRowReorderAuthority } from './list'
import { createEmptyRuntimeZoneWidgets, mapRuntimeZoneWidgets } from './contracts'
import { attachRuntimeTableReorderAuthorityProjection } from './runtimeTableReorderAuthority'

export const resolveRuntimeObjectCollectionRuntimeConfig = async (params: {
    manager: DbExecutor
    applicationId: string
    userId: string
    role: EffectiveLayoutAuthContext['role']
    workspaceId: string | null
    locale: string
    objectCollectionId: string
    objectCollectionCodename: string
}) => {
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
                targetKind: 'object',
                entityTypeId: params.objectCollectionId,
                ...(params.workspaceId !== null ? { workspaceId: params.workspaceId } : {}),
                locale: params.locale
            }
        )
        const mappedZoneWidgets =
            result.layout.templateKey === 'dashboard'
                ? mapRuntimeZoneWidgets(
                      result.widgets
                          .filter((widget) => widget.isActive)
                          .map((widget) => ({
                              id: widget.id,
                              layout_id: result.layout.id,
                              widget_key: widget.widgetKey,
                              sort_order: widget.sortOrder,
                              config: widget.config,
                              runtime_data: widget.runtimeData,
                              zone: widget.zone
                          }))
                  )
                : createEmptyRuntimeZoneWidgets()
        const zoneWidgets =
            result.layout.templateKey === 'dashboard'
                ? attachRuntimeTableReorderAuthorityProjection(mappedZoneWidgets, result.widgets)
                : mappedZoneWidgets
        const objectBehaviorConfig = resolveObjectCollectionLayoutBehaviorConfig({ layoutConfig: result.layout.config ?? {} })
        const rowReorderAuthority = resolveRuntimeRowReorderAuthority(zoneWidgets, params.objectCollectionCodename)

        return {
            layoutId: result.layout.id,
            layoutConfig: result.layout.config ?? {},
            zoneWidgets,
            runtimeConfig: { ...objectBehaviorConfig, ...rowReorderAuthority }
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
