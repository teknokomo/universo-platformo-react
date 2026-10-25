import type { Request, Response } from 'express'
import {
    PUBLIC_APPLICATION_RUNTIME_ERROR_CODE,
    MAX_PUBLIC_APPLICATION_RUNTIME_RESPONSE_BYTES,
    publicApplicationInstanceKeySchema,
    publicInterpretationNetworkHandleSchema,
    type PublicApplicationRuntime,
    type PublicMarketingApplicationRuntime,
    type RuntimeTarget
} from '@universo-react/types'
import { type DbExecutor } from '@universo-react/utils'
import { PublicEntryWorkspaceError, resolvePublicDashboardWorkspace, resolvePublicEntryWorkspace } from '../services/applicationWorkspaces'
import { EffectiveLayoutError, parseRuntimeTarget, type EffectiveLayoutSuccess } from '../services/effectiveLayoutContract'
import { resolveEffectiveLayoutForPublicTransactionWithRuntimeData } from '../services/effectiveLayoutResolverCore'
import { resolveInterpretationNetworkRuntimeSurface } from '../services/interpretationNetwork/runtimeInterpretationNetworkSurface'
import {
    parsePublicApplicationRef,
    PublicApplicationUnavailableError,
    resolvePublicApplication,
    toPublicApplicationRouteResolution,
    type ResolvedPublicApplication
} from '../services/publicApplicationRuntime'
import { createPublicMarketingBindingRecordLoader, PublicMarketingMaterializationError } from '../persistence/publicApplicationRuntimeStore'
import { findEffectiveLayoutPageBlockContent } from '../persistence/effectiveLayoutStore'
import { serializePublicMarketingRuntime } from '../services/publicMarketingRuntime'
import {
    classifyPublicDashboardPlacements,
    projectPublicDashboardRuntime,
    PublicDashboardMaterializationError,
    PublicRuntimeTransientError
} from '../services/publicDashboardRuntime'
import {
    PublicInterpretationNetworkUnavailableError,
    readPublicInterpretationNetwork,
    type PublicInterpretationNetworkView
} from '../services/publicInterpretationNetworkRuntime'

const PUBLIC_RUNTIME_QUERY_KEYS = new Set(['locale', 'targetKind', 'entityTypeId', 'entityTypeCodename'])
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

export const serializeBoundedPublicRuntimePayload = (payload: unknown): string => {
    try {
        const serialized = JSON.stringify(payload)
        if (typeof serialized !== 'string' || Buffer.byteLength(serialized, 'utf8') > MAX_PUBLIC_APPLICATION_RUNTIME_RESPONSE_BYTES) {
            throw new PublicRuntimeTransientError()
        }
        return serialized
    } catch (error) {
        if (error instanceof PublicRuntimeTransientError) throw error
        throw new PublicRuntimeTransientError()
    }
}

const prefersUiProbeResponse = (req: Request): boolean => req.get('accept')?.toLowerCase().includes(PUBLIC_RUNTIME_UI_PROBE_ACCEPT) === true

const readPublicQueryValue = (value: unknown): string | undefined => {
    if (value === undefined) return undefined
    if (typeof value !== 'string') throw new PublicApplicationUnavailableError('reference_invalid')
    return value
}

interface ParsedPublicRuntimeQuery {
    locale: 'en' | 'ru'
    targetKind?: string
    entityTypeId?: string
    entityTypeCodename?: string
}

export const parsePublicRuntimeQuery = (req: Request): ParsedPublicRuntimeQuery => {
    const queryKeys = Object.keys(req.query)
    if (queryKeys.some((key) => !PUBLIC_RUNTIME_QUERY_KEYS.has(key))) {
        throw new PublicApplicationUnavailableError('reference_invalid')
    }

    const rawLocale = readPublicQueryValue(req.query.locale) ?? 'en'
    if (rawLocale !== 'en' && rawLocale !== 'ru') {
        throw new PublicApplicationUnavailableError('reference_invalid')
    }

    const targetKind = readPublicQueryValue(req.query.targetKind)
    const entityTypeId = readPublicQueryValue(req.query.entityTypeId)
    const entityTypeCodename = readPublicQueryValue(req.query.entityTypeCodename)
    return {
        locale: rawLocale,
        ...(targetKind !== undefined ? { targetKind } : {}),
        ...(entityTypeId !== undefined ? { entityTypeId } : {}),
        ...(entityTypeCodename !== undefined ? { entityTypeCodename } : {})
    }
}

const resolvePublicRuntimeTarget = (query: ParsedPublicRuntimeQuery, applicationId: string): RuntimeTarget => {
    try {
        return parseRuntimeTarget(applicationId, query)
    } catch (error) {
        if (error instanceof EffectiveLayoutError && error.code === 'LAYOUT_REQUEST_INVALID') {
            throw new PublicApplicationUnavailableError('reference_invalid')
        }
        throw error
    }
}

export const resolvePublicRuntimeRequest = (req: Request, applicationId: string): { locale: 'en' | 'ru'; target: RuntimeTarget } => {
    const query = parsePublicRuntimeQuery(req)
    return { locale: query.locale, target: resolvePublicRuntimeTarget(query, applicationId) }
}

export interface PublicMarketingRuntimeLoadInput {
    executor: DbExecutor
    locale: 'en' | 'ru'
    resolved: ResolvedPublicApplication
    workspaceId: string | null
    effectiveLayout: EffectiveLayoutSuccess
}

/** Resolve public workspace/layout and bounded Entity bindings in one transaction. */
export const loadPublicMarketingRuntime = async ({
    executor,
    locale,
    resolved,
    workspaceId,
    effectiveLayout
}: PublicMarketingRuntimeLoadInput): Promise<PublicMarketingApplicationRuntime> => {
    const application = resolved.application
    const loadRecords = createPublicMarketingBindingRecordLoader(executor, {
        schemaName: application.schemaName,
        workspaceId
    })

    return serializePublicMarketingRuntime({ route: resolved.route, locale, effectiveLayout, loadRecords })
}

const resolvePublicRuntimeLayoutStructure = (
    executor: DbExecutor,
    target: RuntimeTarget,
    workspaceId: string | null,
    allowMissingWorkspace = false
) => {
    const runtimeDataResolver = async () => new Map()
    return allowMissingWorkspace
        ? resolveEffectiveLayoutForPublicTransactionWithRuntimeData(executor, target, workspaceId, runtimeDataResolver, {
              allowMissingWorkspace: true
          })
        : resolveEffectiveLayoutForPublicTransactionWithRuntimeData(executor, target, workspaceId, runtimeDataResolver)
}

interface ParsedPublicInterpretationNetworkQuery {
    locale: 'en' | 'ru'
    targetKind?: string
    entityTypeId?: string
    entityTypeCodename?: string
    view: PublicInterpretationNetworkView
    parentHandle?: string
    offset: number
}

const PUBLIC_INTERPRETATION_NETWORK_QUERY_KEYS = new Set([...PUBLIC_RUNTIME_QUERY_KEYS, 'view', 'parentHandle', 'offset'])

export const parsePublicInterpretationNetworkQuery = (req: Request): ParsedPublicInterpretationNetworkQuery => {
    if (Object.keys(req.query).some((key) => !PUBLIC_INTERPRETATION_NETWORK_QUERY_KEYS.has(key))) {
        throw new PublicApplicationUnavailableError('reference_invalid')
    }
    const rawLocale = readPublicQueryValue(req.query.locale) ?? 'en'
    if (rawLocale !== 'en' && rawLocale !== 'ru') throw new PublicApplicationUnavailableError('reference_invalid')
    const rawView = readPublicQueryValue(req.query.view) ?? 'structures'
    if (rawView !== 'structures' && rawView !== 'interpretations' && rawView !== 'matrix' && rawView !== 'materials') {
        throw new PublicApplicationUnavailableError('reference_invalid')
    }
    const rawParentHandle = readPublicQueryValue(req.query.parentHandle)
    if ((rawView === 'structures') !== (rawParentHandle === undefined)) {
        throw new PublicApplicationUnavailableError('reference_invalid')
    }
    let parentHandle: string | undefined
    if (rawParentHandle !== undefined) {
        const parsedParentHandle = publicInterpretationNetworkHandleSchema.safeParse(rawParentHandle)
        if (!parsedParentHandle.success) throw new PublicApplicationUnavailableError('reference_invalid')
        parentHandle = parsedParentHandle.data
    }

    const rawOffset = readPublicQueryValue(req.query.offset) ?? '0'
    if (!/^(0|[1-9][0-9]{0,4})$/u.test(rawOffset)) throw new PublicApplicationUnavailableError('reference_invalid')
    const offset = Number(rawOffset)
    if (offset > 10_000) throw new PublicApplicationUnavailableError('reference_invalid')

    return {
        locale: rawLocale,
        ...(req.query.targetKind !== undefined ? { targetKind: readPublicQueryValue(req.query.targetKind) } : {}),
        ...(req.query.entityTypeId !== undefined ? { entityTypeId: readPublicQueryValue(req.query.entityTypeId) } : {}),
        ...(req.query.entityTypeCodename !== undefined ? { entityTypeCodename: readPublicQueryValue(req.query.entityTypeCodename) } : {}),
        view: rawView,
        ...(parentHandle !== undefined ? { parentHandle } : {}),
        offset
    }
}

const resolvePublicInterpretationNetworkTarget = (query: ParsedPublicInterpretationNetworkQuery, applicationId: string): RuntimeTarget => {
    try {
        return parseRuntimeTarget(applicationId, {
            locale: query.locale,
            ...(query.targetKind !== undefined ? { targetKind: query.targetKind } : {}),
            ...(query.entityTypeId !== undefined ? { entityTypeId: query.entityTypeId } : {}),
            ...(query.entityTypeCodename !== undefined ? { entityTypeCodename: query.entityTypeCodename } : {})
        })
    } catch (error) {
        if (error instanceof EffectiveLayoutError && error.code === 'LAYOUT_REQUEST_INVALID') {
            throw new PublicApplicationUnavailableError('reference_invalid')
        }
        throw error
    }
}

export function createPublicApplicationRuntimeController(getDbExecutor: () => DbExecutor) {
    const getRuntime = async (req: Request, res: Response) => {
        res.set('Cache-Control', 'no-store')

        try {
            const applicationRef = req.params.applicationRef
            parsePublicApplicationRef(applicationRef)
            const query = parsePublicRuntimeQuery(req)
            const payload = await getDbExecutor().transaction(async (tx) => {
                await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
                const resolved = await resolvePublicApplication(tx, applicationRef)
                const target = resolvePublicRuntimeTarget(query, resolved.application.id)
                const publicWorkspace = resolved.application.workspacesEnabled
                    ? await resolvePublicEntryWorkspace(tx, resolved.application.schemaName)
                    : null
                let effectiveLayout = await resolvePublicRuntimeLayoutStructure(
                    tx,
                    target,
                    publicWorkspace?.workspaceId ?? null,
                    resolved.application.workspacesEnabled && !publicWorkspace
                )
                if (effectiveLayout.layout.templateKey === 'marketing-page') {
                    if (resolved.application.workspacesEnabled && !publicWorkspace) {
                        throw new PublicApplicationUnavailableError('materialization_invalid')
                    }
                    return loadPublicMarketingRuntime({
                        executor: tx,
                        locale: query.locale,
                        resolved,
                        workspaceId: publicWorkspace?.workspaceId ?? null,
                        effectiveLayout
                    })
                }
                if (effectiveLayout.layout.templateKey === 'dashboard') {
                    let dashboardWorkspace = publicWorkspace
                    if (resolved.application.workspacesEnabled && !dashboardWorkspace) {
                        dashboardWorkspace = await resolvePublicDashboardWorkspace(tx, resolved.application.schemaName)
                        if (dashboardWorkspace) {
                            effectiveLayout = await resolvePublicRuntimeLayoutStructure(tx, target, dashboardWorkspace.workspaceId)
                            if (effectiveLayout.layout.templateKey !== 'dashboard') {
                                throw new PublicApplicationUnavailableError('materialization_invalid')
                            }
                        }
                    }
                    const pageBlockContent =
                        effectiveLayout.resolvedEntityTypeId &&
                        (effectiveLayout.target.targetKind === null || effectiveLayout.target.targetKind === 'page')
                            ? await findEffectiveLayoutPageBlockContent(
                                  tx,
                                  resolved.application.schemaName,
                                  effectiveLayout.resolvedEntityTypeId,
                                  'public'
                              )
                            : undefined
                    return {
                        route: toPublicApplicationRouteResolution(resolved.route),
                        templateKey: 'dashboard' as const,
                        dashboard: await projectPublicDashboardRuntime({
                            executor: tx,
                            resolved,
                            workspaceId: dashboardWorkspace?.workspaceId ?? null,
                            workspaceAvailable: !resolved.application.workspacesEnabled || dashboardWorkspace !== null,
                            locale: query.locale,
                            effectiveLayout,
                            pageBlockContent
                        })
                    } satisfies PublicApplicationRuntime
                }
                throw new PublicApplicationUnavailableError('materialization_invalid')
            })

            return res.status(200).type('application/json').send(serializeBoundedPublicRuntimePayload(payload))
        } catch (error) {
            if (
                error instanceof PublicApplicationUnavailableError ||
                error instanceof PublicEntryWorkspaceError ||
                error instanceof PublicMarketingMaterializationError ||
                error instanceof PublicDashboardMaterializationError ||
                isDamagedPublicMaterializationError(error)
            ) {
                if (prefersUiProbeResponse(req)) return res.status(204).end()
                return res.status(404).json({ code: PUBLIC_APPLICATION_RUNTIME_ERROR_CODE })
            }
            if (error instanceof EffectiveLayoutError && error.httpStatus < 500) {
                if (prefersUiProbeResponse(req)) return res.status(204).end()
                return res.status(404).json({ code: PUBLIC_APPLICATION_RUNTIME_ERROR_CODE })
            }
            if (error instanceof PublicRuntimeTransientError || (error instanceof EffectiveLayoutError && error.httpStatus >= 500)) {
                return res.status(503).json({ code: 'PUBLIC_APPLICATION_RUNTIME_FAILED' })
            }
            return res.status(503).json({ code: 'PUBLIC_APPLICATION_RUNTIME_FAILED' })
        }
    }

    const getInterpretationNetwork = async (req: Request, res: Response) => {
        res.set('Cache-Control', 'no-store')
        try {
            const applicationRef = req.params.applicationRef
            parsePublicApplicationRef(applicationRef)
            const instanceResult = publicApplicationInstanceKeySchema.safeParse(req.params.instanceKey)
            if (!instanceResult.success) throw new PublicApplicationUnavailableError('reference_invalid')
            const query = parsePublicInterpretationNetworkQuery(req)
            const payload = await getDbExecutor().transaction(async (tx) => {
                await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
                const resolved = await resolvePublicApplication(tx, applicationRef)
                const target = resolvePublicInterpretationNetworkTarget(query, resolved.application.id)
                const dashboardWorkspace = resolved.application.workspacesEnabled
                    ? await resolvePublicDashboardWorkspace(tx, resolved.application.schemaName)
                    : null
                if (resolved.application.workspacesEnabled && !dashboardWorkspace) {
                    throw new PublicApplicationUnavailableError('materialization_invalid')
                }
                const effectiveLayout = await resolvePublicRuntimeLayoutStructure(tx, target, dashboardWorkspace?.workspaceId ?? null)
                if (effectiveLayout.layout.templateKey !== 'dashboard')
                    throw new PublicApplicationUnavailableError('materialization_invalid')
                const classified = classifyPublicDashboardPlacements(effectiveLayout)
                const placement = classified.interpretationNetworkWidget
                if (!placement || placement.instanceKey !== instanceResult.data) throw new PublicInterpretationNetworkUnavailableError()

                const surface = await resolveInterpretationNetworkRuntimeSurface(tx, {
                    applicationId: resolved.application.id,
                    schemaName: resolved.application.schemaName,
                    workspaceId: dashboardWorkspace?.workspaceId ?? null,
                    scopeEntityId: effectiveLayout.layout.scopeEntityId ?? null,
                    layoutId: effectiveLayout.layout.id,
                    widgetId: placement.id
                })
                if (
                    surface.featureState !== 'ready' ||
                    surface.applicationId !== resolved.application.id ||
                    surface.schemaName !== resolved.application.schemaName ||
                    surface.workspaceId !== (dashboardWorkspace?.workspaceId ?? null) ||
                    surface.layoutId !== effectiveLayout.layout.id ||
                    surface.widgetId !== placement.id ||
                    surface.widgetKey !== 'interpretationNetworkWorkspace'
                ) {
                    throw new PublicInterpretationNetworkUnavailableError()
                }

                return readPublicInterpretationNetwork({
                    executor: tx,
                    surface,
                    applicationId: resolved.application.id,
                    layoutId: effectiveLayout.layout.id,
                    widgetId: placement.id,
                    instanceKey: instanceResult.data,
                    target,
                    locale: query.locale,
                    view: query.view,
                    ...(query.parentHandle !== undefined ? { parentHandle: query.parentHandle } : {}),
                    offset: query.offset
                })
            })
            return res.status(200).type('application/json').send(serializeBoundedPublicRuntimePayload(payload))
        } catch (error) {
            if (
                error instanceof PublicApplicationUnavailableError ||
                error instanceof PublicEntryWorkspaceError ||
                error instanceof PublicDashboardMaterializationError ||
                error instanceof PublicInterpretationNetworkUnavailableError ||
                isDamagedPublicMaterializationError(error)
            ) {
                if (prefersUiProbeResponse(req)) return res.status(204).end()
                return res.status(404).json({ code: PUBLIC_APPLICATION_RUNTIME_ERROR_CODE })
            }
            if (error instanceof EffectiveLayoutError && error.httpStatus < 500) {
                if (prefersUiProbeResponse(req)) return res.status(204).end()
                return res.status(404).json({ code: PUBLIC_APPLICATION_RUNTIME_ERROR_CODE })
            }
            return res.status(503).json({ code: 'PUBLIC_APPLICATION_RUNTIME_FAILED' })
        }
    }

    return { getRuntime, getInterpretationNetwork }
}
