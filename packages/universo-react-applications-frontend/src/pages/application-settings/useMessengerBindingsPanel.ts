import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { applicationAliasesQueryKeys } from '../../api/applicationAliasesQueryKeys'
import { listAliasesByApplication } from '../../api/applicationAliasesApi'
import { useApplicationBotBindings } from '../../hooks/useApplicationBotBindings'
import { buildPublicApplicationAddress } from '../../utils/publicApplicationAddress'

export const useMessengerBindingsPanel = (applicationId: string) => {
    const { i18n } = useTranslation('applications')
    const bindingsQuery = useApplicationBotBindings(applicationId)
    const aliasesQuery = useQuery({
        queryKey: applicationAliasesQueryKeys.byApplication(applicationId),
        queryFn: () => listAliasesByApplication(applicationId),
        enabled: Boolean(applicationId),
        staleTime: 60_000
    })
    const primaryAlias = aliasesQuery.data?.find((alias) => alias.isPrimary && alias.status !== 'released')?.alias
    const publicUrl = useMemo(
        () => (aliasesQuery.isSuccess && primaryAlias ? buildPublicApplicationAddress(primaryAlias) : null),
        [aliasesQuery.isSuccess, primaryAlias]
    )
    const bindingDateFormatter = useMemo(
        () =>
            new Intl.DateTimeFormat(i18n.resolvedLanguage || i18n.language || 'en', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
        [i18n.language, i18n.resolvedLanguage]
    )

    const formatBindingDate = (value: string): string => {
        const date = new Date(value)
        return Number.isNaN(date.getTime()) ? '—' : bindingDateFormatter.format(date)
    }

    return { bindingsQuery, aliasesQuery, primaryAlias, publicUrl, formatBindingDate }
}
