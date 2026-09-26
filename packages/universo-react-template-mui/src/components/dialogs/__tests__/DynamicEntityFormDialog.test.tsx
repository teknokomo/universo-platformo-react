import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, optionsOrDefault?: unknown) => (typeof optionsOrDefault === 'string' ? optionsOrDefault : key)
    })
}))

jest.mock('@universo-react/i18n', () => ({
    useCommonTranslations: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}))

import { DynamicEntityFormDialog } from '../DynamicEntityFormDialog'

describe('DynamicEntityFormDialog', () => {
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
})
