import { useTranslation } from 'react-i18next'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import { getDashboardWidgetDefinition, readLocalizedTextValue } from '@universo-react/types'
import type { RuntimeWidgetData } from '../runtime/widgetPlacementGraph'

export function RuntimeWidgetStatus({ state, invalid = false }: { state?: RuntimeWidgetData; invalid?: boolean }) {
    const { t } = useTranslation('apps')
    const status = invalid ? 'malformed-config' : state?.status ?? 'optional-unbound'
    if (status === 'optional-unbound') return null
    if (status === 'loading') {
        return <Skeleton role='status' aria-label={t('dashboard.widget.loading', 'Loading widget content')} variant='rounded' height={72} />
    }
    if (status === 'empty') {
        const message = t('dashboard.widget.empty', 'No matching content was found.')
        return (
            <Alert severity='info' role='status'>
                {message}
            </Alert>
        )
    }
    const messages = {
        'required-missing': t('dashboard.widget.requiredMissing', 'A required content source is unavailable.'),
        'stale-source': t('dashboard.widget.staleSource', 'This content source is no longer available.'),
        'permission-denied': t('dashboard.widget.permissionDenied', 'You do not have access to this content.'),
        'malformed-config': t('dashboard.widget.malformedConfig', 'This widget is configured incorrectly.'),
        'network-error': t('dashboard.widget.networkError', 'Could not reach the content service.'),
        'server-error': t('dashboard.widget.serverError', 'The content service could not complete the request.')
    }
    return (
        <Alert severity='error' role='status'>
            {messages[status as keyof typeof messages] ??
                t('dashboard.widget.serverError', 'The content service could not complete the request.')}
        </Alert>
    )
}

export const getMissingRuntimeDataState = (widgetKey: string): RuntimeWidgetData => {
    const sourcePolicy = getDashboardWidgetDefinition(widgetKey)?.sourcePolicy
    if (sourcePolicy?.authority === 'metahub-source' && sourcePolicy.sourceMode === 'required') {
        return { status: 'required-missing' }
    }
    if (sourcePolicy?.authority === 'metahub-source' && sourcePolicy.sourceMode === 'optional') {
        return { status: 'optional-unbound' }
    }
    return { status: 'server-error' }
}

export const readLocalizedWidgetText = (value: unknown, locale: string | undefined): string | undefined =>
    readLocalizedTextValue(value, locale ?? 'en')
