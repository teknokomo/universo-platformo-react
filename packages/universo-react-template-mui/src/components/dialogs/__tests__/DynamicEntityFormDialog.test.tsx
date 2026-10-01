import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfirmContextProvider } from '../../../contexts'
import { ConfirmDialog } from '../ConfirmDialog'

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, optionsOrDefault?: unknown) => (typeof optionsOrDefault === 'string' ? optionsOrDefault : key)
    })
}))

jest.mock('@universo-react/i18n', () => ({
    useCommonTranslations: () => ({
        t: (key: string, options?: { defaultValue?: string; field?: string; locale?: string }) => {
            const messages: Record<string, string> = {
                'layouts.widgetBindings.missingLocale': 'Add {{field}} in {{locale}} before saving.',
                'layouts.widgetBindings.locales.en': 'English',
                'layouts.widgetBindings.locales.ru': 'Russian',
                'unsavedChanges.title': 'common.unsavedChanges.title',
                'unsavedChanges.description': 'common.unsavedChanges.description',
                'unsavedChanges.confirm': 'common.unsavedChanges.confirm',
                'unsavedChanges.cancel': 'common.unsavedChanges.cancel'
            }
            return (messages[key] ?? options?.defaultValue ?? key)
                .replace('{{field}}', options?.field ?? '')
                .replace('{{locale}}', options?.locale ?? '')
        }
    })
}))

import { DynamicEntityFormDialog } from '../DynamicEntityFormDialog'

describe('DynamicEntityFormDialog', () => {
    it('keeps dirty content when discard is canceled and closes after discard is confirmed', async () => {
        const user = userEvent.setup()
        const onClose = jest.fn()

        render(
            <ConfirmContextProvider>
                <DynamicEntityFormDialog
                    open
                    title='Edit content record'
                    locale='en'
                    fields={[{ id: 'Title', label: 'Title', type: 'STRING' }]}
                    initialData={{ Title: 'Original title' }}
                    onClose={onClose}
                    onSubmit={async () => undefined}
                />
                <ConfirmDialog />
            </ConfirmContextProvider>
        )

        const contentDialog = screen.getByRole('dialog', { name: 'Edit content record', exact: true })
        const titleInput = within(contentDialog).getByRole('textbox', { name: 'Title', exact: true })
        await user.clear(titleInput)
        await user.type(titleInput, 'Unsaved title')
        await user.click(within(contentDialog).getByRole('button', { name: 'Cancel', exact: true }))

        const discardDialog = screen.getByRole('dialog', { name: 'common.unsavedChanges.title' })
        expect(discardDialog).toHaveAccessibleDescription('common.unsavedChanges.description')
        await user.click(within(discardDialog).getByRole('button', { name: 'common.unsavedChanges.cancel' }))

        expect(onClose).not.toHaveBeenCalled()
        expect(titleInput).toHaveValue('Unsaved title')
        expect(contentDialog).toBeVisible()

        await user.click(within(contentDialog).getByRole('button', { name: 'Cancel', exact: true }))
        await user.click(
            within(screen.getByRole('dialog', { name: 'common.unsavedChanges.title' })).getByRole('button', {
                name: 'common.unsavedChanges.confirm'
            })
        )

        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    })

    it('closes a pristine content form without asking for confirmation', async () => {
        const user = userEvent.setup()
        const onClose = jest.fn()

        render(
            <ConfirmContextProvider>
                <DynamicEntityFormDialog
                    open
                    title='Edit content record'
                    locale='en'
                    fields={[{ id: 'Title', label: 'Title', type: 'STRING' }]}
                    initialData={{ Title: 'Original title' }}
                    onClose={onClose}
                    onSubmit={async () => undefined}
                />
                <ConfirmDialog />
            </ConfirmContextProvider>
        )

        await user.click(screen.getByRole('button', { name: 'Cancel', exact: true }))

        expect(onClose).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('dialog', { name: 'common.unsavedChanges.title' })).not.toBeInTheDocument()
    })

    it('focuses the first invalid field after the dialog opens', async () => {
        render(
            <DynamicEntityFormDialog
                open
                title='Create content record'
                locale='en'
                fields={[{ id: 'Title', label: 'Title', type: 'STRING', required: true }]}
                fieldValidationError={{ fieldId: 'Title', message: 'Title is required.' }}
                onClose={() => undefined}
                onSubmit={async () => undefined}
            />
        )

        const dialog = await screen.findByRole('dialog', { name: 'Create content record', exact: true })
        const titleInput = within(dialog).getByRole('textbox', { name: 'Title', exact: true })
        await waitFor(() => expect(titleInput).toHaveFocus())
    })

    it('hides technical semantic keys, generates a UUID v7 key, and exposes an accessible standard dialog name', async () => {
        const onSubmit = jest.fn().mockResolvedValue(undefined)
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(
            <QueryClientProvider client={queryClient}>
                <DynamicEntityFormDialog
                    open
                    title='Create content record'
                    locale='en'
                    fields={[
                        {
                            id: 'HeroKey',
                            label: 'Hero key',
                            type: 'STRING',
                            required: true,
                            validationRules: { unique: true },
                            uiConfig: { hidden: true, autoGenerateSemanticKey: true }
                        },
                        { id: 'Title', label: 'Title', type: 'STRING', required: true }
                    ]}
                    onClose={() => undefined}
                    onSubmit={onSubmit}
                />
            </QueryClientProvider>
        )

        const dialog = await screen.findByRole('dialog', { name: 'Create content record', exact: true })
        const saveButton = within(dialog).getByRole('button', { name: 'Save', exact: true })
        const actions = dialog.querySelector('.MuiDialogActions-root')
        expect(actions).toBeInTheDocument()
        expect(actions).toContainElement(saveButton)
        expect(dialog.querySelector('.MuiDialogContent-root')).not.toContainElement(saveButton)
        expect(within(dialog).queryByRole('textbox', { name: 'Hero key' })).not.toBeInTheDocument()
        fireEvent.change(within(dialog).getByRole('textbox', { name: 'Title' }), { target: { value: 'Homepage' } })
        fireEvent.click(saveButton)

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
        expect(onSubmit).toHaveBeenCalledWith({
            HeroKey: expect.stringMatching(/^record-[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu),
            Title: 'Homepage'
        })
    })

    it('generates a fresh semantic key for a copied record after its technical key was cleared', async () => {
        const onSubmit = jest.fn().mockResolvedValue(undefined)
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(
            <QueryClientProvider client={queryClient}>
                <DynamicEntityFormDialog
                    open
                    title='Copy content record'
                    locale='en'
                    fields={[
                        {
                            id: 'HeroKey',
                            label: 'Hero key',
                            type: 'STRING',
                            required: true,
                            uiConfig: { hidden: true, autoGenerateSemanticKey: true }
                        },
                        { id: 'Title', label: 'Title', type: 'STRING', required: true }
                    ]}
                    initialData={{ Title: 'Homepage' }}
                    onClose={() => undefined}
                    onSubmit={onSubmit}
                />
            </QueryClientProvider>
        )

        const dialog = await screen.findByRole('dialog', { name: 'Copy content record', exact: true })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save', exact: true }))
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
        const submittedKey = onSubmit.mock.calls[0]?.[0].HeroKey
        expect(submittedKey).toMatch(/^record-[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
    })

    it('hides formHidden fields while preserving their existing values on save', async () => {
        const onSubmit = jest.fn().mockResolvedValue(undefined)
        render(
            <DynamicEntityFormDialog
                open
                title='Edit content record'
                locale='en'
                fields={[
                    { id: 'Title', label: 'Title', type: 'STRING' },
                    { id: 'ArchivedAt', label: 'Archived at', type: 'DATE', uiConfig: { formHidden: true } }
                ]}
                initialData={{ Title: 'Current title', ArchivedAt: '2026-09-01' }}
                onClose={() => undefined}
                onSubmit={onSubmit}
            />
        )

        expect(screen.queryByLabelText('Archived at')).not.toBeInTheDocument()
        fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Updated title' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ Title: 'Updated title', ArchivedAt: '2026-09-01' }))
    })

    it('associates server validation with the requested locale and focuses that localized field', async () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const clearFieldError = jest.fn()
        render(
            <QueryClientProvider client={queryClient}>
                <DynamicEntityFormDialog
                    open
                    title='Create Hero content'
                    locale='ru'
                    fields={[{ id: 'Title', label: 'Title', type: 'STRING', validationRules: { localized: true } }]}
                    initialData={{
                        Title: {
                            _schema: 'v1',
                            _primary: 'ru',
                            locales: { ru: { content: 'Заголовок', isActive: true } }
                        }
                    }}
                    fieldValidationError={{ fieldId: 'Title', locale: 'en', message: 'Add Title in English before saving.' }}
                    onFieldErrorClear={clearFieldError}
                    onClose={() => undefined}
                    onSubmit={async () => undefined}
                />
            </QueryClientProvider>
        )

        const englishRow = await screen.findByTestId('localized-inline-row-en')
        const titleInput = within(englishRow).getByRole('textbox', { name: 'Title', exact: true })
        expect(clearFieldError).not.toHaveBeenCalled()
        await waitFor(() => expect(titleInput).toHaveFocus())
        expect(titleInput).toHaveAttribute('aria-invalid', 'true')
        const describedBy = titleInput.getAttribute('aria-describedby')
        expect(describedBy).toBeTruthy()
        expect(document.getElementById(describedBy as string)).toHaveTextContent('Add Title in English before saving.')
        expect(englishRow).toContainElement(titleInput)

        fireEvent.change(titleInput, { target: { value: 'English title' } })
        expect(clearFieldError).toHaveBeenCalledWith('Title')
    })

    it('shows required locale validation and blocks saving an incomplete localized record', async () => {
        const onSubmit = jest.fn().mockResolvedValue(undefined)
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(
            <QueryClientProvider client={queryClient}>
                <DynamicEntityFormDialog
                    open
                    title='Edit content record'
                    locale='en'
                    fields={[
                        {
                            id: 'Title',
                            label: 'Title',
                            type: 'STRING',
                            required: true,
                            validationRules: { localized: true, requiredLocales: ['en', 'ru'] }
                        }
                    ]}
                    initialData={{
                        Title: {
                            _schema: 'v1',
                            _primary: 'ru',
                            locales: {
                                en: { content: '', isActive: true },
                                ru: { content: 'Заголовок', isActive: true }
                            }
                        }
                    }}
                    onClose={() => undefined}
                    onSubmit={onSubmit}
                />
            </QueryClientProvider>
        )

        const englishRow = await screen.findByTestId('localized-inline-row-en')
        const englishTitle = within(englishRow).getByRole('textbox', { name: 'Title', exact: true })
        expect(englishTitle).toHaveAttribute('aria-invalid', 'true')
        expect(englishRow).toHaveTextContent('Add Title in English before saving.')
        expect(screen.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
        expect(onSubmit).not.toHaveBeenCalled()

        fireEvent.change(englishTitle, { target: { value: 'English title' } })
        await waitFor(() => expect(englishTitle).toHaveAttribute('aria-invalid', 'false'))
        expect(screen.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
        fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }))
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ Title: expect.objectContaining({ locales: expect.any(Object) }) }))
    })

    it('applies a conditional required rule as its controlling field changes', async () => {
        const user = userEvent.setup()
        const onSubmit = jest.fn().mockResolvedValue(undefined)
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(
            <QueryClientProvider client={queryClient}>
                <DynamicEntityFormDialog
                    open
                    title='Create image record'
                    locale='en'
                    fields={[
                        { id: 'Decorative', label: 'Decorative image', type: 'BOOLEAN', required: true },
                        {
                            id: 'AltText',
                            label: 'Alternative text',
                            type: 'STRING',
                            validationRules: {
                                localized: true,
                                requiredLocales: ['en', 'ru'],
                                requiredWhen: { field: 'Decorative', equals: false }
                            }
                        }
                    ]}
                    initialData={{
                        Decorative: false,
                        AltText: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Dashboard preview', isActive: true },
                                ru: { content: 'Предпросмотр панели', isActive: true }
                            }
                        }
                    }}
                    onClose={() => undefined}
                    onSubmit={onSubmit}
                />
            </QueryClientProvider>
        )

        const dialog = await screen.findByRole('dialog', { name: 'Create image record', exact: true })
        const save = within(dialog).getByRole('button', { name: 'Save', exact: true })
        const englishRow = within(dialog).getByTestId('localized-inline-row-en')
        const russianRow = within(dialog).getByTestId('localized-inline-row-ru')
        await user.clear(within(englishRow).getByRole('textbox', { name: 'Alternative text', exact: true }))
        await user.clear(within(russianRow).getByRole('textbox', { name: 'Alternative text', exact: true }))

        expect(save).toBeDisabled()
        const decorative = within(dialog).getByRole('checkbox', { name: 'Decorative image', exact: true })
        await user.click(decorative)
        expect(decorative).toBeChecked()
        expect(save).toBeEnabled()
        await user.click(decorative)
        expect(decorative).not.toBeChecked()
        expect(save).toBeDisabled()

        await user.type(within(englishRow).getByRole('textbox', { name: 'Alternative text', exact: true }), 'Dashboard preview')
        await user.type(within(russianRow).getByRole('textbox', { name: 'Alternative text', exact: true }), 'Предпросмотр панели')
        expect(save).toBeEnabled()
        await user.click(save)
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    })

    it('explains the required locale when a localized required field has no content', async () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(
            <QueryClientProvider client={queryClient}>
                <DynamicEntityFormDialog
                    open
                    title='Create content record'
                    locale='en'
                    fields={[
                        {
                            id: 'Title',
                            label: 'Title',
                            type: 'STRING',
                            required: true,
                            validationRules: { localized: true, requiredLocales: ['en', 'ru'] }
                        }
                    ]}
                    initialData={{
                        Title: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: {
                                en: { content: '', isActive: true },
                                ru: { content: '', isActive: true }
                            }
                        }
                    }}
                    onClose={() => undefined}
                    onSubmit={async () => undefined}
                />
            </QueryClientProvider>
        )

        const englishRow = await screen.findByTestId('localized-inline-row-en')
        const englishTitle = within(englishRow).getByRole('textbox', { name: 'Title', exact: true })
        expect(englishTitle).toHaveAttribute('aria-invalid', 'true')
        expect(englishRow).toHaveTextContent('Add Title in English before saving.')
        expect(screen.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
    })

    it('renders semantic long-text string fields as multiline controls', () => {
        render(
            <DynamicEntityFormDialog
                open
                title='Edit Record'
                locale='en'
                fields={[
                    {
                        id: 'Description',
                        label: 'Description',
                        type: 'STRING',
                        validationRules: { maxLength: 2000 }
                    }
                ]}
                initialData={{ Description: 'Long-form copy' }}
                onClose={() => undefined}
                onSubmit={async () => undefined}
            />
        )

        const textbox = screen.getByRole('textbox', { name: 'Description' })
        expect(textbox.tagName).toBe('TEXTAREA')
        expect(textbox).toHaveAttribute('maxlength', '2000')
    })

    it('edits canonical resource sources without exposing raw JSON and preserves storage locators', async () => {
        const onSubmit = jest.fn().mockResolvedValue(undefined)

        render(
            <DynamicEntityFormDialog
                open
                title='Edit media'
                locale='en'
                fields={[{ id: 'HeroImage', label: 'Hero image', type: 'JSON', uiConfig: { widget: 'resourceSource' } }]}
                initialData={{ HeroImage: { type: 'file', storageKey: 'marketing/hero.webp' } }}
                onClose={() => undefined}
                onSubmit={onSubmit}
            />
        )

        expect(screen.getByRole('combobox', { name: 'Resource type' })).toBeInTheDocument()
        expect(screen.getByRole('textbox', { name: 'Storage key' })).toHaveValue('marketing/hero.webp')
        expect(screen.queryByText(/storageKey|marketing\/hero\.webp/)).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledWith({ HeroImage: { type: 'file', storageKey: 'marketing/hero.webp' } })
        })
    })

    it('keeps a URL-backed file source visible and unchanged while editing', async () => {
        const onSubmit = jest.fn().mockResolvedValue(undefined)

        render(
            <DynamicEntityFormDialog
                open
                title='Edit media'
                locale='en'
                fields={[{ id: 'HeroImage', label: 'Hero image', type: 'JSON', uiConfig: { widget: 'resourceSource' } }]}
                initialData={{ HeroImage: { type: 'file', url: 'https://cdn.example.test/hero.webp' } }}
                onClose={() => undefined}
                onSubmit={onSubmit}
            />
        )

        expect(screen.getByRole('textbox', { name: 'Source URL' })).toHaveValue('https://cdn.example.test/hero.webp')

        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledWith({
                HeroImage: { type: 'file', url: 'https://cdn.example.test/hero.webp' }
            })
        })
    })

    it('omits an optional empty resource source instead of persisting an invalid placeholder', async () => {
        const onSubmit = jest.fn().mockResolvedValue(undefined)

        render(
            <DynamicEntityFormDialog
                open
                title='Edit media'
                locale='en'
                fields={[{ id: 'HeroImage', label: 'Hero image', type: 'JSON', uiConfig: { widget: 'resourceSource' } }]}
                initialData={{ HeroImage: { type: 'url', url: '' } }}
                onClose={() => undefined}
                onSubmit={onSubmit}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledWith({})
        })
    })

    it('sends an explicit null when clearing an existing optional resource source', async () => {
        const onSubmit = jest.fn().mockResolvedValue(undefined)

        render(
            <DynamicEntityFormDialog
                open
                title='Edit media'
                locale='en'
                fields={[{ id: 'HeroImage', label: 'Hero image', type: 'JSON', uiConfig: { widget: 'resourceSource' } }]}
                initialData={{ HeroImage: { type: 'url', url: 'https://cdn.example.test/hero.webp' } }}
                onClose={() => undefined}
                onSubmit={onSubmit}
            />
        )

        fireEvent.change(screen.getByRole('textbox', { name: 'Source URL' }), { target: { value: '' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledWith({ HeroImage: null })
        })
    })
})
