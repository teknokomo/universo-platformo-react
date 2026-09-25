import { marketingActionSchema, type MarketingActionKind, type MarketingLinkTarget } from '@universo-react/types'

export type MarketingActionDraft =
    | { kind: 'internal'; path: string; target: 'same-tab' }
    | { kind: 'external'; url: string; target: MarketingLinkTarget }
    | { kind: 'anchor'; href: string }
    | { kind: 'email'; address: string; subject?: string }
    | { kind: 'tel'; number: string }

export type MarketingActionSummaryLabels = {
    unavailable: string
    actionKinds: Readonly<Record<MarketingActionKind, string>>
    internalRoutes: Readonly<Record<string, string>>
    withTarget: (kind: string, target: string) => string
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

export const createDefaultMarketingAction = (kind: MarketingActionKind, internalPath = '/auth'): MarketingActionDraft => {
    switch (kind) {
        case 'internal':
            return { kind, path: internalPath, target: 'same-tab' }
        case 'external':
            return { kind, url: '', target: 'new-tab' }
        case 'anchor':
            return { kind, href: '' }
        case 'email':
            return { kind, address: '' }
        case 'tel':
            return { kind, number: '' }
    }
}

export const readMarketingActionDraft = (value: unknown, internalPath = '/auth'): MarketingActionDraft => {
    if (!isRecord(value)) return createDefaultMarketingAction('internal', internalPath)

    switch (value.kind) {
        case 'internal':
            return {
                kind: 'internal',
                path: typeof value.path === 'string' ? value.path : internalPath,
                target: 'same-tab'
            }
        case 'external':
            return {
                kind: 'external',
                url: typeof value.url === 'string' ? value.url : '',
                target: value.target === 'same-tab' ? 'same-tab' : 'new-tab'
            }
        case 'anchor':
            return { kind: 'anchor', href: typeof value.href === 'string' ? value.href : '' }
        case 'email':
            return {
                kind: 'email',
                address: typeof value.address === 'string' ? value.address : '',
                ...(typeof value.subject === 'string' ? { subject: value.subject } : {})
            }
        case 'tel':
            return { kind: 'tel', number: typeof value.number === 'string' ? value.number : '' }
        default:
            return createDefaultMarketingAction('internal', internalPath)
    }
}

export const formatMarketingActionSummary = (value: unknown, labels: MarketingActionSummaryLabels): string => {
    const parsed = marketingActionSchema.safeParse(value)
    if (!parsed.success) return labels.unavailable

    const action = parsed.data
    switch (action.kind) {
        case 'internal': {
            const target = labels.internalRoutes[action.path] ?? action.path
            return labels.withTarget(labels.actionKinds.internal, target)
        }
        case 'external':
            return labels.withTarget(labels.actionKinds.external, action.url)
        case 'anchor':
            return labels.withTarget(labels.actionKinds.anchor, action.href)
        case 'email':
            return labels.withTarget(labels.actionKinds.email, action.address)
        case 'tel':
            return labels.withTarget(labels.actionKinds.tel, action.number)
    }
}
