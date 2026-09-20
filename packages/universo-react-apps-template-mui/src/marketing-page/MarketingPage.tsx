import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { MARKETING_WIDGET_REGISTRY } from '@universo-react/types'

import { marketingWidgetLabel, renderMarketingWidget } from './MarketingWidgetRenderer'
import { MarketingHeaderShell } from './components/AppAppBar'
import { createMarketingSectionAnchors, marketingSectionId, type MarketingSectionAnchors } from './components/MarketingPrimitives'
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

const sectionAnchorForWidget = (widget: MarketingPageWidget): string | null => {
    switch (widget.widgetKey) {
        case 'marketing.hero':
            return marketingSectionId('hero', String(widget.instanceKey))
        case 'marketing.collection': {
            const anchor =
                widget.content.variant === 'logos'
                    ? 'logoCollection'
                    : widget.content.variant === 'features'
                    ? 'features'
                    : widget.content.variant === 'testimonials'
                    ? 'testimonials'
                    : widget.content.variant === 'highlights'
                    ? 'highlights'
                    : 'faq'
            return marketingSectionId(anchor, String(widget.instanceKey))
        }
        case 'marketing.pricing':
            return marketingSectionId('pricing', String(widget.instanceKey))
        case 'marketing.footer':
            return marketingSectionId('footer', String(widget.instanceKey))
        default:
            return null
    }
}

/**
 * Semantic section keys accepted for each widget kind. Persisted navigation
 * records address sections by these keys while the DOM ids are derived from
 * the widget instance key, so the mapping keeps every emitted anchor
 * resolvable for canonical and repeated widget instances.
 */
const sectionAnchorAliasesForWidget = (widget: MarketingPageWidget): string[] => {
    switch (widget.widgetKey) {
        case 'marketing.hero':
            return ['hero']
        case 'marketing.collection':
            switch (widget.content.variant) {
                case 'logos':
                    return ['logos', 'logoCollection']
                case 'features':
                    return ['features']
                case 'testimonials':
                    return ['testimonials']
                case 'highlights':
                    return ['highlights']
                case 'faq':
                    return ['faq']
                default:
                    return []
            }
        case 'marketing.pricing':
            return ['pricing']
        case 'marketing.footer':
            return ['footer']
        default:
            return []
    }
}

const buildSectionAnchors = (orderedWidgets: readonly MarketingPageWidget[]): MarketingSectionAnchors => {
    const entries: Array<readonly [string, string]> = []
    for (const widget of orderedWidgets) {
        const sectionId = sectionAnchorForWidget(widget)
        if (!sectionId) continue
        // The emitted section id stays addressable on its own so repeated
        // instances keep resolving (for example
        // `highlights-development-stage-seed` for a second highlights widget).
        entries.push([sectionId, sectionId])
        for (const alias of sectionAnchorAliasesForWidget(widget)) entries.push([alias, sectionId])
        entries.push([String(widget.instanceKey), widgetAnchorId(widget.instanceKey)])
    }

    return createMarketingSectionAnchors(entries)
}

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
