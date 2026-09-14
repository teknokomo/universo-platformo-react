import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import { Fragment, type ReactNode } from 'react'

import { marketingWidgetLabel, renderMarketingWidget } from './MarketingWidgetRenderer'
import { MarketingHeaderShell } from './components/AppAppBar'
import { readMarketingHeaderPosition, readMarketingHeaderProjections } from './marketingHeaderRuntime'
import type { MarketingPageProps, MarketingPageWidget, MarketingRenderOptions } from './types'

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
    onLeadSubmit: MarketingPageProps['onLeadSubmit'],
    options: MarketingRenderOptions = {}
): ReactNode => (
    <Box
        id={widgetAnchorId(widget.instanceKey)}
        data-marketing-widget-instance={String(widget.instanceKey)}
        component='section'
        aria-label={marketingWidgetLabel(widget)}
        sx={{ minWidth: 0 }}
    >
        {renderMarketingWidget(widget, onAction, onLeadSubmit, options)}
    </Box>
)

/**
 * Render the validated marketing envelope by persisted widget placement and
 * order. The header shell receives the host's effective layout rows, while
 * content widgets remain owned by the marketing runtime payload.
 */
export default function MarketingPage({ data, effectiveLayoutWidgets, effectiveLayoutConfig, onAction, onLeadSubmit }: MarketingPageProps) {
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

    const contentWidgets = orderedWidgets.filter((widget) => widget.zone === 'marketing-main')
    const footerWidgets = orderedWidgets.filter((widget) => widget.zone === 'marketing-footer')
    const headerProjections = readMarketingHeaderProjections(data.widgets, effectiveLayoutWidgets)
    const headerPosition = readMarketingHeaderPosition(effectiveLayoutConfig)
    const renderOptionsForWidget = (widget: MarketingPageWidget): MarketingRenderOptions => ({
        heroBackgroundOwner: widget.widgetKey === 'marketing.hero' ? 'widget' : undefined
    })

    return (
        <Box
            data-testid='marketing-page-root'
            sx={{
                minWidth: 0,
                width: '100%',
                minHeight: '100vh',
                backgroundImage: 'none'
            }}
        >
            {headerProjections.length > 0 ? (
                <MarketingHeaderShell widgets={headerProjections} position={headerPosition} onAction={onAction} />
            ) : null}
            <Box
                component='main'
                id='marketing-page-main'
                tabIndex={-1}
                sx={{ minWidth: 0, scrollMarginBlockStart: 'var(--marketing-header-occlusion, 0px)' }}
            >
                {contentWidgets.map((widget, index) => (
                    <Fragment key={String(widget.instanceKey)}>
                        {index > 0 ? <Divider /> : null}
                        {renderWidgetSlot(widget, onAction, onLeadSubmit, renderOptionsForWidget(widget))}
                    </Fragment>
                ))}
            </Box>
            {footerWidgets.map((widget) => (
                <Fragment key={String(widget.instanceKey)}>
                    <Divider />
                    {renderWidgetSlot(widget, onAction, onLeadSubmit, renderOptionsForWidget(widget))}
                </Fragment>
            ))}
        </Box>
    )
}

export type { MarketingPageProps } from './types'
