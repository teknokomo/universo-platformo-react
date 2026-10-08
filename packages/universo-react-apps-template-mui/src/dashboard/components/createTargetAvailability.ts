import { readLocalizedTextValue, type DashboardLibraryTableWidgetConfig } from '@universo-react/types'
import type { DashboardDetailsSlot } from '../contracts'
import { getDefaultResourceTypeLabel } from '../../utils/resourceSourceLabels'

type CreateTarget = NonNullable<DashboardLibraryTableWidgetConfig['createTargets']>[number]
type Translate = (key: string, fallback: string, options?: Record<string, unknown>) => string

export type CreateActionAvailability = {
    disabled: boolean
    disabledReason?: string
}

export function resolveCreateActionAvailability(details: DashboardDetailsSlot | undefined, translate: Translate): CreateActionAvailability {
    if (!details) {
        return {
            disabled: true,
            disabledReason: translate(
                'app.createContextUnavailable',
                'Content access is unavailable. Reload the application and try again.'
            )
        }
    }
    if (details.runtimeAccessMode === 'public') {
        return {
            disabled: true,
            disabledReason: translate('app.createMemberRequired', 'Content creation is available to application members.')
        }
    }
    if (details.permissions?.createContent !== true) {
        return {
            disabled: true,
            disabledReason: translate('app.createPermissionRequired', 'You do not have permission to create content.')
        }
    }
    if (!details.onOpenCreateTarget) {
        return {
            disabled: true,
            disabledReason: translate('app.createWorkflowUnavailable', 'This application does not provide a content creation workflow.')
        }
    }

    return { disabled: false }
}

export function resolveCreateTargetAvailability(
    target: CreateTarget,
    details: DashboardDetailsSlot,
    translate: Translate
): CreateActionAvailability {
    const access = resolveCreateActionAvailability(details, translate)
    if (access.disabled) return access

    if (target.disabled) {
        const reason = readLocalizedTextValue(target.disabledReason, details.locale ?? 'en')?.trim()
        return {
            disabled: true,
            disabledReason: reason || translate('app.createTargetDisabled', 'This action is disabled by its content settings.')
        }
    }

    const sources = target.sectionCodename ? details.sections : details.objectCollections
    const source = sources?.find((item) => item.codename === (target.sectionCodename ?? target.objectCollectionCodename))
    if (!source) {
        return {
            disabled: true,
            disabledReason: translate('dashboard.widget.staleSource', 'This content source is no longer available.')
        }
    }

    const runtimeConfig = 'runtimeConfig' in source ? source.runtimeConfig : undefined
    if (
        runtimeConfig &&
        typeof runtimeConfig === 'object' &&
        'showCreateButton' in runtimeConfig &&
        runtimeConfig.showCreateButton === false
    ) {
        return {
            disabled: true,
            disabledReason: translate(
                'app.createTargetSourceCreationDisabled',
                'Creation is disabled for this content type in application settings.'
            )
        }
    }

    for (const item of target.createDefaults ?? []) {
        const resourceType = item.resourceSourceType
        if (!resourceType) continue
        const configuredType = details.resourceSourceTypes?.find((option) => option.resourceType === resourceType)
        const typeLabel =
            readLocalizedTextValue(configuredType?.label, details.locale ?? 'en') ??
            translate(`resourceSource.types.${resourceType}`, getDefaultResourceTypeLabel(resourceType))
        if (!configuredType || configuredType.enabled === false) {
            return {
                disabled: true,
                disabledReason: translate('app.createTargetResourceTypeDisabled', '{{type}} is disabled in application settings.', {
                    type: typeLabel
                })
            }
        }
        if (configuredType.deferred === true) {
            return {
                disabled: true,
                disabledReason: translate('app.createTargetResourceTypeDeferred', '{{type}} is planned for a later phase.', {
                    type: typeLabel
                })
            }
        }
    }

    return { disabled: false }
}
