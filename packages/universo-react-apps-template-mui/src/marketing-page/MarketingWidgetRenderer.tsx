import type { ReactNode } from 'react'

import FAQ from './components/FAQ'
import Features from './components/Features'
import Footer from './components/Footer'
import Hero from './components/Hero'
import Highlights from './components/Highlights'
import LogoCollection from './components/LogoCollection'
import Pricing from './components/Pricing'
import Testimonials from './components/Testimonials'
import type { MarketingPageProps, MarketingPageWidget, MarketingRenderOptions } from './types'

type WidgetKey = MarketingPageWidget['widgetKey']
type WidgetOf<K extends WidgetKey> = Extract<MarketingPageWidget, { widgetKey: K }>
type RendererProps<K extends WidgetKey> = {
    widget: WidgetOf<K>
    onAction: MarketingPageProps['onAction']
    onLeadSubmit: MarketingPageProps['onLeadSubmit']
    heroBackgroundOwner?: MarketingRenderOptions['heroBackgroundOwner']
}
type WidgetRenderer<K extends WidgetKey> = (props: RendererProps<K>) => ReactNode

type MarketingWidgetRendererRegistry = {
    [K in WidgetKey]: WidgetRenderer<K>
}

const renderCollection = ({ widget, onAction }: RendererProps<'marketing.collection'>): ReactNode => {
    switch (widget.content.variant) {
        case 'logos':
            return (
                <LogoCollection
                    instanceKey={widget.instanceKey}
                    section={widget.content.section}
                    items={widget.content.items}
                    onAction={onAction}
                />
            )
        case 'features':
            return <Features instanceKey={widget.instanceKey} section={widget.content.section} items={widget.content.items} />
        case 'testimonials':
            return <Testimonials instanceKey={widget.instanceKey} section={widget.content.section} items={widget.content.items} />
        case 'highlights':
            return <Highlights instanceKey={widget.instanceKey} section={widget.content.section} items={widget.content.items} />
        case 'faq':
            return <FAQ instanceKey={widget.instanceKey} section={widget.content.section} items={widget.content.items} />
    }
}

const marketingWidgetRenderers = {
    'marketing.brand': (): ReactNode => null,
    'marketing.navigation': (): ReactNode => null,
    'marketing.auth': (): ReactNode => null,
    'marketing.hero': ({ widget, onAction, onLeadSubmit, heroBackgroundOwner }: RendererProps<'marketing.hero'>) => (
        <Hero
            instanceKey={widget.instanceKey}
            data={widget.content}
            onAction={onAction}
            onLeadSubmit={onLeadSubmit}
            backgroundOwner={heroBackgroundOwner}
        />
    ),
    'marketing.collection': renderCollection,
    'marketing.pricing': ({ widget, onAction }: RendererProps<'marketing.pricing'>) => (
        <Pricing instanceKey={widget.instanceKey} section={widget.content.section} tiers={widget.content.tiers} onAction={onAction} />
    ),
    'marketing.footer': ({ widget, onAction, onLeadSubmit }: RendererProps<'marketing.footer'>) => (
        <Footer instanceKey={widget.instanceKey} data={widget.content} onAction={onAction} onLeadSubmit={onLeadSubmit} />
    )
} satisfies MarketingWidgetRendererRegistry

export const marketingWidgetLabel = (widget: MarketingPageWidget): string => {
    switch (widget.widgetKey) {
        case 'marketing.brand':
            return widget.content.name
        case 'marketing.navigation':
            return widget.content.navigation[0]?.label || 'Navigation'
        case 'marketing.auth':
            return widget.content.signIn?.label || widget.content.signUp?.label || 'Authentication'
        case 'marketing.hero':
            return widget.content.title
        case 'marketing.collection':
            return widget.content.section.title
        case 'marketing.pricing':
            return widget.content.section.title
        case 'marketing.footer':
            return widget.content.brandName
    }
}

export function renderMarketingWidget(
    widget: MarketingPageWidget,
    onAction: MarketingPageProps['onAction'],
    onLeadSubmit: MarketingPageProps['onLeadSubmit'],
    options: MarketingRenderOptions = {}
): ReactNode {
    const renderer = marketingWidgetRenderers[widget.widgetKey] as WidgetRenderer<WidgetKey>
    return renderer({ widget: widget as never, onAction, onLeadSubmit, ...options })
}

export { marketingWidgetRenderers }
