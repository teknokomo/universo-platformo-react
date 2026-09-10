import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import LanguageSwitcher from '../components/LanguageSwitcher'
import { marketingWidgetLabel, renderMarketingWidget } from './MarketingWidgetRenderer'
import {
    MARKETING_NAVIGATION_BAR_HEIGHT_PX,
    MARKETING_NAVIGATION_STACK_GAP_PX,
    type MarketingPageProps,
    type MarketingPageWidget,
    type MarketingRenderOptions
} from './types'

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
 * order. The page does not own a section map: adding, repeating, moving, or
 * disabling a widget is represented only by the runtime payload.
 */
export default function MarketingPage({ data, sharedLayoutWidgets, onAction, onLeadSubmit }: MarketingPageProps) {
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
    const languageSwitcherEnabled =
        sharedLayoutWidgets === undefined
            ? true
            : sharedLayoutWidgets.some(
                  (widget) => widget.widgetKey === 'languageSwitcher' && widget.zone === 'marketing-header' && widget.isActive
              )
    const navigationWidgets = headerWidgets.filter((widget) => widget.widgetKey === 'marketing.navigation')
    const navigationShellOwner = navigationWidgets[0]?.instanceKey ?? null
    const repeatedNavigation = navigationWidgets.length > 1
    const navigationAriaLabels = new Map(
        navigationWidgets.map((widget, index) => [
            widget,
            t('marketingPage.navigation.landmark', {
                brand: widget.content.brand.name,
                index: String(index + 1),
                defaultValue: `${widget.content.brand.name} navigation ${index + 1}`
            })
        ])
    )
    const navigationStackIndices = new Map(navigationWidgets.map((widget, index) => [widget, index]))
    const renderOptionsForWidget = (widget: MarketingPageWidget): MarketingRenderOptions => ({
        showLanguageSwitcher:
            languageSwitcherEnabled &&
            widget.widgetKey === 'marketing.navigation' &&
            String(widget.instanceKey) === String(navigationShellOwner),
        navigationInstanceKey: widget.widgetKey === 'marketing.navigation' ? String(widget.instanceKey) : undefined,
        navigationAriaLabel: widget.widgetKey === 'marketing.navigation' ? navigationAriaLabels.get(widget) : undefined,
        navigationPosition: widget.widgetKey === 'marketing.navigation' ? 'fixed' : undefined,
        navigationStackIndex: widget.widgetKey === 'marketing.navigation' ? navigationStackIndices.get(widget) ?? 0 : undefined,
        heroBackgroundOwner: widget.widgetKey === 'marketing.hero' && repeatedNavigation ? 'page' : 'widget'
    })
    const renderStandaloneLanguageSwitcher = languageSwitcherEnabled && navigationShellOwner === null

    return (
        <Box
            data-testid='marketing-page-root'
            sx={(theme) => ({
                minWidth: 0,
                width: '100%',
                minHeight: '100vh',
                backgroundRepeat: 'no-repeat',
                backgroundImage: repeatedNavigation
                    ? 'radial-gradient(ellipse 80% 50% at 50% -20%, hsl(210, 100%, 90%), transparent)'
                    : 'none',
                ...theme.applyStyles('dark', {
                    backgroundImage: repeatedNavigation
                        ? 'radial-gradient(ellipse 80% 50% at 50% -20%, hsl(210, 100%, 16%), transparent)'
                        : 'none'
                })
            })}
        >
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
            {renderStandaloneLanguageSwitcher ? (
                <Box
                    component='header'
                    data-testid='marketing-shared-language-header'
                    sx={{ display: 'flex', justifyContent: 'flex-end', maxWidth: 'lg', mx: 'auto', px: 2, pt: 2 }}
                >
                    <LanguageSwitcher />
                </Box>
            ) : null}
            {headerWidgets.length > 0 ? (
                <Stack
                    component='header'
                    spacing={2}
                    sx={{
                        minWidth: 0,
                        pt: repeatedNavigation
                            ? `calc(var(--template-frame-height, 0px) + 28px + ${
                                  navigationWidgets.length * MARKETING_NAVIGATION_BAR_HEIGHT_PX +
                                  (navigationWidgets.length - 1) * MARKETING_NAVIGATION_STACK_GAP_PX
                              }px)`
                            : 0
                    }}
                >
                    {headerWidgets.map((widget) => (
                        <Box
                            key={String(widget.instanceKey)}
                            id={widgetAnchorId(widget.instanceKey)}
                            data-marketing-widget-instance={String(widget.instanceKey)}
                            component='div'
                            sx={{ minWidth: 0 }}
                        >
                            {renderMarketingWidget(widget, onAction, onLeadSubmit, renderOptionsForWidget(widget))}
                        </Box>
                    ))}
                </Stack>
            ) : null}
            <main id='marketing-page-main'>
                {contentWidgets.map((widget, index) => (
                    <Fragment key={String(widget.instanceKey)}>
                        {index > 0 ? <Divider /> : null}
                        {renderWidgetSlot(widget, onAction, onLeadSubmit, renderOptionsForWidget(widget))}
                    </Fragment>
                ))}
            </main>
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
