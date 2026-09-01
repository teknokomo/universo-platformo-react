import { fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, optionsOrDefault?: unknown) => (typeof optionsOrDefault === 'string' ? optionsOrDefault : key)
    })
}))

import { DynamicEntityFormDialog } from '../DynamicEntityFormDialog'

describe('DynamicEntityFormDialog', () => {
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
