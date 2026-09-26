import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DynamicFieldConfig } from '@universo-react/template-mui/components/dialogs'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string } | string) =>
            typeof options === 'string' ? options : options?.defaultValue ?? key,
        i18n: { language: 'en' }
    })
}))

vi.mock('@universo-react/i18n', () => ({
    useCommonTranslations: () => ({
        t: (key: string, options?: { defaultValue?: string } | string) =>
            typeof options === 'string' ? options : options?.defaultValue ?? key
    })
}))

const sharedDialogMocks = vi.hoisted(() => ({ dynamicEntityFormDialog: vi.fn() }))

vi.mock('@universo-react/template-mui/components/dialogs', async () => {
    const actual = await vi.importActual<typeof import('@universo-react/template-mui/components/dialogs')>(
        '@universo-react/template-mui/components/dialogs'
    )

    return {
        ...actual,
        DynamicEntityFormDialog: (props: Parameters<typeof actual.DynamicEntityFormDialog>[0]) => {
            sharedDialogMocks.dynamicEntityFormDialog(props)
            return actual.DynamicEntityFormDialog(props)
        }
    }
})

import MarketingHeroRecordFormDialog from '../MarketingHeroRecordFormDialog'

const actionField: DynamicFieldConfig = {
    id: 'PrimaryAction',
    codename: 'PrimaryAction',
    label: 'Primary action',
    type: 'JSON',
    required: true,
    localized: false,
    validationRules: { format: 'marketingAction' },
    uiConfig: {}
}

describe('MarketingHeroRecordFormDialog', () => {
    it('edits the Hero action through the shared typed action field and submits its object value', async () => {
        const user = userEvent.setup()
        const onSubmit = vi.fn().mockResolvedValue(undefined)

        render(
            <MarketingHeroRecordFormDialog
                open
                mode='edit'
                onClose={vi.fn()}
                onSubmit={onSubmit}
                initialData={{ PrimaryAction: { kind: 'external', url: 'https://example.test/old', target: 'new-tab' } }}
                fields={[actionField]}
                actionFieldIds={new Set(['PrimaryAction'])}
                locale='en'
                sectionTargets={[]}
                sectionTargetsState='ready'
                isSubmitting={false}
                error={null}
                fieldError={null}
                onFieldErrorClear={vi.fn()}
            />
        )

        expect(sharedDialogMocks.dynamicEntityFormDialog).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Edit Hero content', i18nNamespace: 'metahubs' })
        )
        const destination = screen.getByRole('textbox', { name: 'Web address' })
        expect(destination).toHaveValue('https://example.test/old')
        await user.clear(destination)
        await user.type(destination, 'https://example.test/new')
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSubmit).toHaveBeenCalledWith({
            PrimaryAction: { kind: 'external', url: 'https://example.test/new', target: 'new-tab' }
        })
    })

    it('offers an explicit, accessible route back to record selection when requested', async () => {
        const user = userEvent.setup()
        const onChooseRecord = vi.fn()

        render(
            <MarketingHeroRecordFormDialog
                open
                mode='edit'
                onClose={vi.fn()}
                onChooseRecord={onChooseRecord}
                onSubmit={vi.fn().mockResolvedValue(undefined)}
                initialData={{ PrimaryAction: { kind: 'internal', path: '/auth' } }}
                fields={[actionField]}
                actionFieldIds={new Set(['PrimaryAction'])}
                locale='en'
                sectionTargets={[]}
                sectionTargetsState='ready'
                isSubmitting={false}
                error={null}
                fieldError={null}
                onFieldErrorClear={vi.fn()}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Choose another record and discard unsaved changes' }))
        expect(onChooseRecord).toHaveBeenCalledTimes(1)
    })

    it('disables the record-selection action while the content update is being saved', async () => {
        const onChooseRecord = vi.fn()

        render(
            <MarketingHeroRecordFormDialog
                open
                mode='edit'
                onClose={vi.fn()}
                onChooseRecord={onChooseRecord}
                onSubmit={vi.fn().mockResolvedValue(undefined)}
                initialData={{ PrimaryAction: { kind: 'internal', path: '/auth' } }}
                fields={[actionField]}
                actionFieldIds={new Set(['PrimaryAction'])}
                locale='en'
                sectionTargets={[]}
                sectionTargetsState='ready'
                isSubmitting
                error={null}
                fieldError={null}
                onFieldErrorClear={vi.fn()}
            />
        )

        expect(screen.getByRole('button', { name: 'Choose another record and discard unsaved changes' })).toBeDisabled()
    })
})
