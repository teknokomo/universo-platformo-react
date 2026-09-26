import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { getMarketingSectionAnchorEntries, getMarketingWidgetAnchorId, MARKETING_WIDGET_REGISTRY } from '@universo-react/types'

import { marketingWidgetLabel, renderMarketingWidget } from './MarketingWidgetRenderer'
import { MarketingHeaderShell } from './components/AppAppBar'
import { createMarketingSectionAnchors, type MarketingSectionAnchors } from './components/MarketingPrimitives'
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
export const widgetAnchorId = (instanceKey: MarketingPageWidget['instanceKey']): string => getMarketingWidgetAnchorId(String(instanceKey))

const MarketingWidgetSlot = ({
    widget,
    onAction,
    onLeadSubmit,
    options = {}
}: {
    widget: MarketingPageWidget
    onAction: MarketingPageProps['onAction']
    onLeadSubmit: MarketingPageProps['onLeadSubmit']
    options?: MarketingRenderOptions
}): ReactNode => {
    const { t } = useTranslation('apps')
    return (
        <Box
            id={widgetAnchorId(widget.instanceKey)}
            data-marketing-widget-instance={String(widget.instanceKey)}
            component='section'
            aria-label={marketingWidgetLabel(widget, t)}
            sx={{ minWidth: 0 }}
        >
            {renderMarketingWidget(widget, onAction, onLeadSubmit, options)}
        </Box>
    )
}

const renderWidgetSlot = (
    widget: MarketingPageWidget,
    onAction: MarketingPageProps['onAction'],
    onLeadSubmit: MarketingPageProps['onLeadSubmit'],
    options: MarketingRenderOptions = {}
): ReactNode => <MarketingWidgetSlot widget={widget} onAction={onAction} onLeadSubmit={onLeadSubmit} options={options} />

const shouldRenderDividerBefore = (widget: MarketingPageWidget, previousWidget: MarketingPageWidget | undefined): boolean => {
    if (!previousWidget) return false
    const seamlessAfter = MARKETING_WIDGET_REGISTRY[widget.widgetKey].seamlessAfter ?? []
    return !seamlessAfter.includes(previousWidget.widgetKey)
}

const buildSectionAnchors = (orderedWidgets: readonly MarketingPageWidget[]): MarketingSectionAnchors =>
    createMarketingSectionAnchors(getMarketingSectionAnchorEntries(orderedWidgets))

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
    const sectionAnchors = buildSectionAnchors(orderedWidgets)
    const headerProjections = readMarketingHeaderProjections(data.widgets, effectiveLayoutWidgets)
    const headerPosition = readMarketingHeaderPosition(effectiveLayoutConfig)
    const renderOptionsForWidget = (widget: MarketingPageWidget): MarketingRenderOptions => ({
        heroBackgroundOwner: widget.widgetKey === 'marketing.hero' ? 'widget' : undefined,
        sectionAnchors: widget.widgetKey === 'marketing.hero' ? sectionAnchors : undefined
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
                <MarketingHeaderShell
                    widgets={headerProjections}
                    position={headerPosition}
                    onAction={onAction}
                    sectionAnchors={sectionAnchors}
                />
            ) : null}
            <Box
                component='main'
                id='marketing-page-main'
                tabIndex={-1}
                sx={{ minWidth: 0, scrollMarginBlockStart: 'var(--marketing-header-occlusion, 0px)' }}
            >
                {contentWidgets.map((widget, index) => (
                    <Fragment key={String(widget.instanceKey)}>
                        {shouldRenderDividerBefore(widget, contentWidgets[index - 1]) ? <Divider /> : null}
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
