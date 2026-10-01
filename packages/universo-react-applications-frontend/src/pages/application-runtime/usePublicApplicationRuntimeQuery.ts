import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { getPublicApplicationRuntime, PublicApplicationRuntimeError } from '../../api/publicApplicationRuntime'
import { publicApplicationRuntimeQueryKeys } from '../../api/publicApplicationRuntimeQueryKeys'
import { normalizePublicRuntimeLocale } from './runtimeLayout'
import type { ApplicationRuntimeLayoutTarget } from '../../types'

const readPublicRuntimeTarget = (searchParams: URLSearchParams) => {
    const readSingleValue = (key: string) => {
        const values = searchParams.getAll(key)
        if (values.length > 1) return ''
        return values[0]
    }
    const targetKind = readSingleValue('targetKind')
    const entityTypeId = readSingleValue('entityTypeId')
    const entityTypeCodename = readSingleValue('entityTypeCodename')
    if (targetKind === undefined && entityTypeId === undefined && entityTypeCodename === undefined) return undefined

    // The anonymous server boundary validates kind, UUID v7, selector
    // exclusivity, and unknown parameters. Preserve malformed target values so
    // they fail closed there instead of silently falling back to the global
    // application layout.
    return {
        ...(targetKind !== undefined ? { targetKind: targetKind as ApplicationRuntimeLayoutTarget['targetKind'] } : {}),
        ...(entityTypeId !== undefined ? { entityTypeId } : {}),
        ...(entityTypeCodename !== undefined ? { entityTypeCodename } : {})
    }
}

const shouldRetryPublicRuntime = (failureCount: number, error: unknown): boolean =>
    error instanceof PublicApplicationRuntimeError && error.status >= 500 && error.status <= 599 && failureCount < 2

/**
 * Shared anonymous published-read bootstrap used by both the route entry
 * resolver and the public runtime page. Both consumers intentionally share one
 * TanStack Query key: the entry performs the first fetch and the page reuses
 * that result instead of re-requesting the same bootstrap payload.
 */
export const usePublicApplicationRuntimeQuery = (applicationRef: string, options: { refetchOnMount?: boolean } = {}) => {
    const [runtimeSearchParams] = useSearchParams()
    const { i18n } = useTranslation('applications')
    const requestedLocale = normalizePublicRuntimeLocale(runtimeSearchParams.get('locale') || i18n.resolvedLanguage || i18n.language)
    const requestedTarget = readPublicRuntimeTarget(runtimeSearchParams)
    const publicRuntimeQuery = useQuery({
        queryKey: publicApplicationRuntimeQueryKeys.runtime(applicationRef, requestedLocale, requestedTarget),
        queryFn: () => getPublicApplicationRuntime(applicationRef, requestedLocale, requestedTarget),
        enabled: Boolean(applicationRef),
        staleTime: 0,
        refetchOnMount: options.refetchOnMount ?? true,
        retry: shouldRetryPublicRuntime
    })

    useEffect(() => {
        const activeLocale = normalizePublicRuntimeLocale(i18n.resolvedLanguage || i18n.language)
        if (activeLocale !== requestedLocale && typeof i18n.changeLanguage === 'function') {
            void i18n.changeLanguage(requestedLocale)
        }
    }, [i18n, requestedLocale])

    return { requestedLocale, publicRuntimeQuery }
}
