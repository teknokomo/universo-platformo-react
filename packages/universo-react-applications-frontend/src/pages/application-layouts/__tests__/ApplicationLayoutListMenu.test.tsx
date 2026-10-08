import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TFunction } from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import type { ApplicationLayout } from '@universo-react/types'
import { applicationsTranslations } from '../../../i18n'
import { ApplicationLayoutListMenu } from '../ApplicationLayoutListMenu'

type Locale = 'en' | 'ru'

const getPath = (source: Record<string, unknown>, path: string): unknown =>
    path
        .split('.')
        .reduce<unknown>(
            (current, segment) =>
                current && typeof current === 'object' && !Array.isArray(current)
                    ? (current as Record<string, unknown>)[segment]
                    : undefined,
            source
        )

const applicationTranslate = (locale: Locale) =>
    ((key: string, fallback?: string) => {
        const value = getPath(applicationsTranslations[locale].applications, key)
        return typeof value === 'string' ? value : fallback ?? key
    }) as unknown as TFunction<'applications'>

const commonTranslate = ((key: string, fallback?: string) => fallback ?? key) as unknown as TFunction

const layout = (sourceKind: ApplicationLayout['sourceKind']): ApplicationLayout =>
    ({
        id: '018f8a78-7b8f-7c1d-a111-2222333344a1',
        scopeId: 'global',
        scopeKind: 'global',
        scopeEntityId: null,
        templateKey: 'dashboard',
        name: { en: 'Dashboard' },
        description: null,
        config: {},
        isActive: true,
        isDefault: false,
        sortOrder: 0,
        sourceKind,
        sourceLayoutId: null,
        sourceSnapshotHash: null,
        sourceContentHash: null,
        localContentHash: null,
        syncState: 'clean',
        isSourceExcluded: false,
        version: 1
    } as ApplicationLayout)

const renderMenu = (sourceKind: ApplicationLayout['sourceKind'], locale: Locale, onCopy = vi.fn()) => {
    const onClose = vi.fn()
    render(
        <ApplicationLayoutListMenu
            t={applicationTranslate(locale)}
            tc={commonTranslate}
            anchorEl={document.body}
            layout={layout(sourceKind)}
            onClose={onClose}
            onOpen={vi.fn()}
            onEdit={vi.fn()}
            onCopy={onCopy}
            onMakeDefault={vi.fn()}
            onToggleActive={vi.fn()}
            onDelete={vi.fn()}
        />
    )
    return { onClose, onCopy }
}

describe('ApplicationLayoutListMenu', () => {
    it.each(['en', 'ru'] as const)('explains in %s why source-managed layouts cannot be copied', (locale) => {
        const { onCopy } = renderMenu('metahub', locale)
        const copyItem = screen.getByRole('menuitem', { name: /copy|копировать/i })
        const reason = getPath(applicationsTranslations[locale].applications, 'layouts.copyUnavailable')

        expect(copyItem).toHaveAttribute('aria-disabled', 'true')
        expect(reason).toEqual(expect.any(String))
        expect(screen.getByText(String(reason))).toBeVisible()
        fireEvent.click(copyItem)
        expect(onCopy).not.toHaveBeenCalled()
    })

    it('keeps copying available for application-owned layouts', async () => {
        const user = userEvent.setup()
        const { onCopy } = renderMenu('application', 'en')
        const copyItem = await screen.findByRole('menuitem', { name: 'Copy' })

        expect(copyItem).toBeEnabled()
        await user.click(copyItem)
        expect(onCopy).toHaveBeenCalledTimes(1)
    })
})
