import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { marketingWidgetLabel, renderMarketingWidget } from './MarketingWidgetRenderer'
import type { MarketingPageProps, MarketingPageWidget } from './types'

const zoneOrder: Record<MarketingPageWidget['zone'], number> = {
    'marketing-header': 0,
    'marketing-main': 1,
    'marketing-footer': 2
}

/**
 * Encode the semantic/UUID instance key without lossy character replacement.
 *
 * Replacing punctuation with `-` makes distinct persisted keys such as
 * `promo.one` and `promo-one` address the same DOM node. Keep the familiar
 * anchor for safe semantic keys, and encode every other code point between
 * delimiters so the result stays deterministic and injective.
 */
export const widgetAnchorId = (instanceKey: MarketingPageWidget['instanceKey']): string => {
    const value = String(instanceKey)
    const encoded = Array.from(value)
        .map((character) => {
            if (/^[A-Za-z0-9-]$/u.test(character)) return character
            return `_${(character.codePointAt(0) ?? 0).toString(16)}_`
        })
        .join('')
    return `marketing-widget-${encoded}`
}

const renderWidgetSlot = (
    widget: MarketingPageWidget,
    onAction: MarketingPageProps['onAction'],
    onLeadSubmit: MarketingPageProps['onLeadSubmit']
): ReactNode => (
    <Box
        id={widgetAnchorId(widget.instanceKey)}
        data-marketing-widget-instance={String(widget.instanceKey)}
        component='section'
        aria-label={marketingWidgetLabel(widget)}
        sx={{ minWidth: 0 }}
    >
        {renderMarketingWidget(widget, onAction, onLeadSubmit)}
    </Box>
)

/**
 * Render the validated marketing envelope by persisted widget placement and
 * order. The page does not own a section map: adding, repeating, moving, or
 * disabling a widget is represented only by the runtime payload.
 */
export default function MarketingPage({ data, onAction, onLeadSubmit }: MarketingPageProps) {
    const { t } = useTranslation('apps')
    const orderedWidgets = data.widgets
        .map((widget, index) => ({ widget, index }))
        .filter(({ widget }) => widget.isActive)
        .sort(
            (left, right) =>
                zoneOrder[left.widget.zone] - zoneOrder[right.widget.zone] ||
                left.widget.sortOrder - right.widget.sortOrder ||
                left.index - right.index
        )
        .map(({ widget }) => widget)

    const headerWidgets = orderedWidgets.filter((widget) => widget.zone === 'marketing-header')
    const contentWidgets = orderedWidgets.filter((widget) => widget.zone === 'marketing-main')
    const footerWidgets = orderedWidgets.filter((widget) => widget.zone === 'marketing-footer')

    return (
        <>
            <Box
                component='a'
                href='#marketing-page-main'
                sx={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    zIndex: (theme) => theme.zIndex.modal + 1,
                    px: 2,
                    py: 1,
                    color: 'text.primary',
                    bgcolor: 'background.paper',
                    boxShadow: 2,
                    transform: 'translateY(-150%)',
                    transition: 'transform 120ms ease-in-out',
                    '&:focus': { transform: 'translateY(0)' }
                }}
            >
                {t('marketingPage.navigation.skipToContent')}
            </Box>
            {headerWidgets.map((widget) => (
                <Box
                    key={String(widget.instanceKey)}
                    id={widgetAnchorId(widget.instanceKey)}
                    data-marketing-widget-instance={String(widget.instanceKey)}
                    component='header'
                    sx={{ minWidth: 0 }}
                >
                    {renderMarketingWidget(widget, onAction, onLeadSubmit)}
                </Box>
            ))}
            <main id='marketing-page-main'>
                {contentWidgets.map((widget, index) => (
                    <Fragment key={String(widget.instanceKey)}>
                        {index > 0 ? <Divider /> : null}
                        {renderWidgetSlot(widget, onAction, onLeadSubmit)}
                    </Fragment>
                ))}
            </main>
            {footerWidgets.map((widget) => (
                <Fragment key={String(widget.instanceKey)}>
                    <Divider />
                    {renderWidgetSlot(widget, onAction, onLeadSubmit)}
                </Fragment>
            ))}
        </>
    )
}

export type { MarketingPageProps } from './types'
