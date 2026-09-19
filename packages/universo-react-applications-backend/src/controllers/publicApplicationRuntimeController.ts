import type { Request, Response } from 'express'
import { PUBLIC_APPLICATION_RUNTIME_ERROR_CODE, type PublicMarketingApplicationRuntime } from '@universo-react/types'
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
import { loadAllowlistedPublishedMarketingRows, PublicMarketingMaterializationError } from '../persistence/publicApplicationRuntimeStore'
import { serializePublicMarketingRuntime } from '../services/publicMarketingRuntime'

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
            throw new PublicMarketingMaterializationError('Public marketing effective layout is unavailable')
        }
        throw error
    }

    const rows = await loadAllowlistedPublishedMarketingRows(executor, {
        schemaName: application.schemaName,
        workspaceId: publicWorkspace?.workspaceId ?? null
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
