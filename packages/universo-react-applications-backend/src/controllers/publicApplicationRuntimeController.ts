import type { Request, Response } from 'express'
import {
    getLayoutWidgetDefinition,
    marketingSemanticKeySchema,
    PUBLIC_APPLICATION_RUNTIME_ERROR_CODE,
    validateWidgetBindings,
    type EffectiveWidget,
    type PublicMarketingApplicationRuntime
} from '@universo-react/types'
import { type DbExecutor } from '@universo-react/utils'
import { PublicEntryWorkspaceError, resolvePublicEntryWorkspace } from '../services/applicationWorkspaces'
import { EffectiveLayoutError } from '../services/effectiveLayoutContract'
import { resolveEffectiveLayoutForPublicTransaction } from '../services/effectiveLayoutResolver'
import {
    parsePublicApplicationRef,
    PublicApplicationUnavailableError,
    resolvePublicApplication,
    type ResolvedPublicApplication
} from '../services/publicApplicationRuntime'
import {
    loadAllowlistedPublishedMarketingRows,
    PublicMarketingMaterializationError,
    PUBLIC_MARKETING_ROW_LIMIT
} from '../persistence/publicApplicationRuntimeStore'
import { serializePublicMarketingRuntime } from '../services/publicMarketingRuntime'
import { getApplicationLayoutWidgetSourceBindingState } from '../persistence/applicationLayoutStoreSupport'

const PUBLIC_RUNTIME_QUERY_KEYS = new Set(['locale'])
const DAMAGED_PUBLIC_MATERIALIZATION_SQLSTATES = new Set(['42P01', '3F000', '42703'])

/**
 * A published application whose schema, table or column disappeared is an
 * unready/damaged materialization, not a transient infrastructure failure:
 * it must collapse into the same non-enumerating unavailable outcome.
 */
const isDamagedPublicMaterializationError = (error: unknown): boolean =>
    Boolean(
        error &&
            typeof error === 'object' &&
            'code' in error &&
            typeof (error as { code?: unknown }).code === 'string' &&
            DAMAGED_PUBLIC_MATERIALIZATION_SQLSTATES.has((error as { code: string }).code)
    )
const PUBLIC_RUNTIME_UI_PROBE_ACCEPT = 'application/vnd.universo.public-runtime-probe+json'

export type PublicHeroSelection = { entityCodename: string; semanticKeys: string[] }

/** Select only source-backed Hero records placed in the published layout. */
export const collectActivePublicHeroSelections = (widgets: readonly EffectiveWidget[]): PublicHeroSelection[] => {
    const activeHeroWidgets = widgets.filter((widget) => widget.widgetKey === 'marketing.hero' && widget.isActive)
    if (activeHeroWidgets.length === 0) return []

    const definition = getLayoutWidgetDefinition('marketing.hero')
    if (!definition?.bindingSlots?.some((slot) => slot.key === 'content')) {
        throw new PublicMarketingMaterializationError('Published Hero binding contract is unavailable')
    }

    const selections = new Map<string, Set<string>>()
    for (const widget of activeHeroWidgets) {
        const bindings = getApplicationLayoutWidgetSourceBindingState(widget)?.bindings
        if (!bindings) throw new PublicMarketingMaterializationError('Published Hero binding is missing')

        let validatedBindings
        try {
            validatedBindings = validateWidgetBindings(definition, bindings)
        } catch {
            throw new PublicMarketingMaterializationError('Published Hero binding is invalid')
        }

        const targets = validatedBindings.slots.find((slot) => slot.slot === 'content')?.targets
        if (!targets || targets.length !== 1) throw new PublicMarketingMaterializationError('Published Hero binding is invalid')
        const [target] = targets
        if (
            target.entityKind !== 'object' ||
            !/^[A-Za-z][A-Za-z0-9._-]*$/u.test(target.entityCodename) ||
            target.selector.kind !== 'semantic-key' ||
            target.selector.field !== 'key' ||
            !marketingSemanticKeySchema.safeParse(target.selector.value).success
        ) {
            throw new PublicMarketingMaterializationError('Published Hero binding target is invalid')
        }
        const keys = selections.get(target.entityCodename) ?? new Set<string>()
        keys.add(target.selector.value)
        selections.set(target.entityCodename, keys)
    }
    const totalKeys = [...selections.values()].reduce((total, keys) => total + keys.size, 0)
    if (totalKeys > PUBLIC_MARKETING_ROW_LIMIT) {
        throw new PublicMarketingMaterializationError('Published Hero selection exceeds the row limit')
    }
    return [...selections].map(([entityCodename, keys]) => ({ entityCodename, semanticKeys: [...keys] }))
}

const prefersUiProbeResponse = (req: Request): boolean => req.get('accept')?.toLowerCase().includes(PUBLIC_RUNTIME_UI_PROBE_ACCEPT) === true

export const resolvePublicLocale = (req: Request): 'en' | 'ru' => {
    const queryKeys = Object.keys(req.query)
    if (queryKeys.some((key) => !PUBLIC_RUNTIME_QUERY_KEYS.has(key))) {
        throw new PublicApplicationUnavailableError('reference_invalid')
    }

    const rawLocale = req.query.locale
    if (rawLocale === undefined) return 'en'
    if (rawLocale !== 'en' && rawLocale !== 'ru') {
        throw new PublicApplicationUnavailableError('reference_invalid')
    }
    return rawLocale
}

export interface PublicMarketingRuntimeLoadInput {
    executor: DbExecutor
    locale: 'en' | 'ru'
    resolved: ResolvedPublicApplication
}

/** Resolve public workspace/layout and load the published allowlisted DTO in one transaction. */
export const loadPublicMarketingRuntime = async ({
    executor,
    locale,
    resolved
}: PublicMarketingRuntimeLoadInput): Promise<PublicMarketingApplicationRuntime> => {
    const application = resolved.application
    const publicWorkspace = application.workspacesEnabled ? await resolvePublicEntryWorkspace(executor, application.schemaName) : null

    if (application.workspacesEnabled && !publicWorkspace) {
        throw new PublicApplicationUnavailableError('materialization_invalid')
    }

    let effectiveLayout
    try {
        effectiveLayout = await resolveEffectiveLayoutForPublicTransaction(
            executor,
            { applicationId: application.id, targetKind: null, locale },
            publicWorkspace?.workspaceId ?? null
        )
    } catch (error) {
        if (error instanceof EffectiveLayoutError) {
            // Transient query failures (5xx) must stay retryable: turning them
            // into the generic unavailable outcome would tell every visitor the
            // application is not public and skip the frontend retry path.
            if (error.httpStatus >= 500) throw error
            throw new PublicMarketingMaterializationError('Public marketing effective layout is unavailable')
        }
        throw error
    }

    const rows = await loadAllowlistedPublishedMarketingRows(executor, {
        schemaName: application.schemaName,
        workspaceId: publicWorkspace?.workspaceId ?? null,
        heroTargets: collectActivePublicHeroSelections(effectiveLayout.widgets)
    })

    return serializePublicMarketingRuntime({ route: resolved.route, locale, effectiveLayout, rows })
}

export function createPublicApplicationRuntimeController(getDbExecutor: () => DbExecutor) {
    const getRuntime = async (req: Request, res: Response) => {
        res.set('Cache-Control', 'no-store')

        try {
            const applicationRef = req.params.applicationRef
            parsePublicApplicationRef(applicationRef)
            const locale = resolvePublicLocale(req)

            const payload = await getDbExecutor().transaction(async (tx) => {
                await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
                const resolved = await resolvePublicApplication(tx, applicationRef)
                return loadPublicMarketingRuntime({ executor: tx, locale, resolved })
            })

            return res.status(200).json(payload)
        } catch (error) {
            if (
                error instanceof PublicApplicationUnavailableError ||
                error instanceof PublicEntryWorkspaceError ||
                error instanceof PublicMarketingMaterializationError ||
                isDamagedPublicMaterializationError(error)
            ) {
                if (prefersUiProbeResponse(req)) return res.status(204).end()
                return res.status(404).json({ code: PUBLIC_APPLICATION_RUNTIME_ERROR_CODE })
            }
            return res.status(503).json({ code: 'PUBLIC_APPLICATION_RUNTIME_FAILED' })
        }
    }

    return { getRuntime }
}
