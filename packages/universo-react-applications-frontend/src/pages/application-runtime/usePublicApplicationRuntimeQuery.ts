import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { getPublicApplicationRuntime, PublicApplicationRuntimeError } from '../../api/publicApplicationRuntime'
import { publicApplicationRuntimeQueryKeys } from '../../api/publicApplicationRuntimeQueryKeys'
import { normalizePublicRuntimeLocale } from './runtimeLayout'

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
    const publicRuntimeQuery = useQuery({
        queryKey: publicApplicationRuntimeQueryKeys.runtime(applicationRef, requestedLocale),
        queryFn: () => getPublicApplicationRuntime(applicationRef, requestedLocale),
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
