import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '@universo-react/i18n'
import { FormDialog, type FieldConfig } from '../FormDialog'
import '../../../i18n'

const groupKey = '019bbf00-0000-7000-8000-000000000001'

// TABLE cell rendering has its own integration suites; this suite exercises the parent Save boundary.
vi.mock('../../TabularPartEditor', () => ({
    TabularPartEditor: ({
        label,
        value,
        onChange
    }: {
        label: string
        value: Record<string, unknown>[]
        onChange: (rows: Record<string, unknown>[]) => void
    }) => (
        <section aria-label={label}>
            <output data-testid={`${label}-rows`} data-value={JSON.stringify(value)}>
                {value.length}
            </output>
            {label === 'Groups' ? (
                <>
                    <button onClick={() => onChange([{ key: '019bbf00-0000-7000-8000-000000000001', title: 'Opening' }])}>Add group</button>
                    <button onClick={() => onChange([...value, { key: '019bbf00-0000-7000-8000-000000000002', title: 'Unused group' }])}>
                        Add unused group
                    </button>
                    <button onClick={() => onChange([...value, { ...value[0] }])}>Duplicate group key</button>
                    <button onClick={() => onChange([])}>Remove groups</button>
                </>
            ) : null}
        </section>
    )
}))

vi.mock('../../RuntimeInlineTabularEditor', () => ({
    RuntimeInlineTabularEditor: ({
        componentId,
        disabled,
        onRowsLoaded
    }: {
        componentId: string
        disabled: boolean
        onRowsLoaded?: (rows: Record<string, unknown>[]) => void
    }) => (
        <section data-testid={`runtime-table-${componentId}`}>
            <button disabled={disabled}>Edit {componentId}</button>
            <button onClick={() => onRowsLoaded?.([])}>Load {componentId}</button>
        </section>
    )
}))

const fields: FieldConfig[] = [
    {
        id: 'groups',
        codename: 'Groups',
        label: 'Groups',
        type: 'TABLE',
        childFields: [
            { id: 'key', codename: 'Key', label: 'Key', type: 'STRING', hidden: true },
            { id: 'title', codename: 'Title', label: 'Title', type: 'STRING' }
        ]
    },
    {
        id: 'questions',
        codename: 'Questions',
        label: 'Questions',
        type: 'TABLE',
        childFields: [
            { id: 'text', label: 'Text', type: 'STRING' },
            {
                id: 'group',
                label: 'Group',
                type: 'STRING',
                uiConfig: {
                    siblingRowSelect: {
                        tableCodename: 'Groups',
                        valueFieldCodename: 'Key',
                        labelFieldCodename: 'Title',
                        requiredWithRows: true,
                        requireEachTargetReferenced: true
                    }
                }
            }
        ]
    }
]
const optionalFields = JSON.parse(JSON.stringify(fields)) as FieldConfig[]
const optionalSelectorConfig = optionalFields[1].childFields?.find((field) => field.id === 'group')?.uiConfig?.siblingRowSelect as
    | Record<string, unknown>
    | undefined
if (optionalSelectorConfig) {
    delete optionalSelectorConfig.requiredWithRows
    delete optionalSelectorConfig.requireEachTargetReferenced
}
const rows = (name: string) => JSON.parse(screen.getByTestId(`${name}-rows`).getAttribute('data-value')!)

describe('FormDialog coupled TABLE grouping', () => {
    afterEach(async () => {
        await i18n.changeLanguage('en')
    })

    it('cancels without edits, then confirms assignment and saves/reopens both tables together', async () => {
        await i18n.changeLanguage('en')
        const user = userEvent.setup()
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        const initialData = {
            groups: [],
            questions: [
                { text: 'First', group: null },
                { text: 'Second', group: null }
            ]
        }
        const props = { title: 'Edit quiz', fields, locale: 'en', onClose: vi.fn(), onSubmit }
        const { rerender } = render(<FormDialog {...props} open initialData={initialData} />)

        await user.click(await screen.findByRole('button', { name: 'Add group' }))
        let confirmation = screen.getByRole('dialog', { name: 'Update related table rows?' })
        expect(confirmation).toHaveAccessibleDescription(/Assign all existing related rows/)
        expect(within(confirmation).queryByRole('button', { name: /fullscreen|resize/i })).not.toBeInTheDocument()
        await waitFor(() => expect(within(confirmation).getByRole('button', { name: 'Cancel' })).toHaveFocus())
        await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }))
        expect(rows('Groups')).toEqual([])
        expect(rows('Questions')).toEqual(initialData.questions)
        expect(onSubmit).not.toHaveBeenCalled()

        await user.click(await screen.findByRole('button', { name: 'Add group' }))
        confirmation = screen.getByRole('dialog', { name: 'Update related table rows?' })
        await user.click(within(confirmation).getByRole('button', { name: 'Apply change' }))
        expect(rows('Questions')).toEqual(initialData.questions.map((row) => ({ ...row, group: groupKey })))
        await user.click(screen.getByTestId('entity-form-submit'))
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
        const saved = onSubmit.mock.calls[0][0]
        expect(saved.groups).toEqual([{ key: groupKey, title: 'Opening' }])
        expect(saved.questions.map((row: Record<string, unknown>) => row.group)).toEqual([groupKey, groupKey])

        rerender(<FormDialog {...props} open={false} initialData={saved} />)
        rerender(<FormDialog {...props} open initialData={saved} />)
        expect(rows('Questions')).toEqual(saved.questions)
        expect(screen.queryByRole('dialog', { name: 'Update related table rows?' })).not.toBeInTheDocument()
    })

    it('requires localized confirmation before clearing grouping and preserves content/order', async () => {
        await i18n.changeLanguage('ru')
        const user = userEvent.setup()
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        const initialData = { groups: [{ key: groupKey, title: 'Opening' }], questions: [{ text: 'First', group: groupKey }] }
        render(
            <FormDialog
                open
                title='Edit quiz'
                fields={fields}
                locale='ru'
                onClose={vi.fn()}
                onSubmit={onSubmit}
                initialData={initialData}
            />
        )
        await user.click(await screen.findByRole('button', { name: 'Remove groups' }))
        let confirmation = screen.getByRole('dialog', { name: 'Обновить связанные строки?' })
        await user.click(within(confirmation).getByRole('button', { name: 'Отмена' }))
        expect(rows('Groups')).toEqual(initialData.groups)
        expect(rows('Questions')).toEqual(initialData.questions)
        await user.click(await screen.findByRole('button', { name: 'Remove groups' }))
        confirmation = screen.getByRole('dialog', { name: 'Обновить связанные строки?' })
        await user.click(within(confirmation).getByRole('button', { name: 'Применить изменение' }))
        await user.click(screen.getByTestId('entity-form-submit'))
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ groups: [], questions: [{ text: 'First', group: null }] }))
    })

    it('clears optional sibling references without asking for grouping confirmation', async () => {
        const user = userEvent.setup()
        const initialData = { groups: [{ key: groupKey, title: 'Opening' }], questions: [{ text: 'First', group: groupKey }] }
        render(
            <FormDialog
                open
                title='Edit quiz'
                fields={optionalFields}
                locale='en'
                onClose={vi.fn()}
                onSubmit={vi.fn().mockResolvedValue(undefined)}
                initialData={initialData}
            />
        )

        await user.click(await screen.findByRole('button', { name: 'Remove groups' }))

        expect(screen.queryByRole('dialog', { name: 'Update related table rows?' })).not.toBeInTheDocument()
        expect(rows('Groups')).toEqual([])
        expect(rows('Questions')).toEqual([{ text: 'First', group: null }])
    })

    it('confirms removing the final empty group before saving the flat quiz', async () => {
        const user = userEvent.setup()
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        const initialData = { groups: [{ key: groupKey, title: 'Opening' }], questions: [] }
        render(
            <FormDialog
                open
                title='Edit quiz'
                fields={fields}
                locale='en'
                onClose={vi.fn()}
                onSubmit={onSubmit}
                initialData={initialData}
            />
        )

        await user.click(await screen.findByRole('button', { name: 'Remove groups' }))
        let confirmation = screen.getByRole('dialog', { name: 'Update related table rows?' })
        expect(confirmation).toBeVisible()
        await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }))
        expect(rows('Groups')).toEqual(initialData.groups)
        expect(rows('Questions')).toEqual([])
        expect(onSubmit).not.toHaveBeenCalled()

        await user.click(await screen.findByRole('button', { name: 'Remove groups' }))
        confirmation = screen.getByRole('dialog', { name: 'Update related table rows?' })
        await user.click(within(confirmation).getByRole('button', { name: 'Apply change' }))
        expect(rows('Groups')).toEqual([])
        await user.click(screen.getByTestId('entity-form-submit'))
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ groups: [], questions: [] }))
    })

    it('waits for every related table to load before enabling grouping edits or Save', async () => {
        const user = userEvent.setup()
        render(
            <FormDialog
                open
                title='Edit quiz'
                fields={fields}
                locale='en'
                apiBaseUrl='/api/v1'
                applicationId='application'
                objectCollectionId='object'
                editRowId='record'
                onClose={vi.fn()}
                onSubmit={vi.fn().mockResolvedValue(undefined)}
                initialData={{ groups: [], questions: [] }}
            />
        )

        const save = screen.getByTestId('entity-form-submit')
        expect(save).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Edit groups' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Edit questions' })).toBeDisabled()

        await user.click(screen.getByRole('button', { name: 'Load groups' }))
        expect(save).toBeDisabled()

        await user.click(screen.getByRole('button', { name: 'Load questions' }))
        await waitFor(() => expect(save).toBeEnabled())
        expect(screen.getByRole('button', { name: 'Edit groups' })).toBeEnabled()
        expect(screen.getByRole('button', { name: 'Edit questions' })).toBeEnabled()
    })

    it('explains why Save is blocked when a required grouping table is hidden', async () => {
        await i18n.changeLanguage('en')
        render(
            <FormDialog
                open
                title='Edit quiz'
                fields={fields}
                locale='en'
                apiBaseUrl='/api/v1'
                applicationId='application'
                objectCollectionId='object'
                editRowId='record'
                hiddenFieldIds={['groups']}
                onClose={vi.fn()}
                onSubmit={vi.fn().mockResolvedValue(undefined)}
                initialData={{ groups: [], questions: [] }}
            />
        )

        expect(
            await screen.findByText('Related tables required for grouping are hidden. Contact an application administrator.')
        ).toBeInTheDocument()
        expect(screen.getByTestId('entity-form-submit')).toBeDisabled()
    })

    it('blocks Save with a localized inline explanation when a group has no questions', async () => {
        await i18n.changeLanguage('ru')
        const user = userEvent.setup()
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        render(
            <FormDialog
                open
                title='Edit quiz'
                fields={fields}
                locale='ru'
                onClose={vi.fn()}
                onSubmit={onSubmit}
                initialData={{
                    groups: [{ key: groupKey, title: 'Opening' }],
                    questions: [{ text: 'First', group: groupKey }]
                }}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Add unused group' }))
        expect(screen.getByText('Перед сохранением добавьте хотя бы одну связанную строку в каждую группу.')).toBeInTheDocument()
        expect(screen.getByTestId('entity-form-submit')).toBeDisabled()
        expect(onSubmit).not.toHaveBeenCalled()
    })

    it('blocks Save with a localized explanation when groups have duplicate keys', async () => {
        await i18n.changeLanguage('ru')
        const user = userEvent.setup()
        const onSubmit = vi.fn().mockResolvedValue(undefined)
        render(
            <FormDialog
                open
                title='Редактирование теста'
                fields={fields}
                locale='ru'
                onClose={vi.fn()}
                onSubmit={onSubmit}
                initialData={{
                    groups: [{ key: groupKey, title: 'Opening' }],
                    questions: [{ text: 'First', group: groupKey }]
                }}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Duplicate group key' }))

        expect(
            screen.getByText('У каждой группы должен быть уникальный ключ. Удалите или создайте повторную группу заново перед сохранением.')
        ).toBeInTheDocument()
        expect(screen.getByTestId('entity-form-submit')).toBeDisabled()
        expect(onSubmit).not.toHaveBeenCalled()
    })

    it('keeps a pending dialog open and prevents dismissal while saving', async () => {
        await i18n.changeLanguage('en')
        const user = userEvent.setup()
        const onClose = vi.fn()
        const onSubmit = vi.fn().mockResolvedValue(undefined)

        render(<FormDialog open title='Edit quiz' fields={fields} locale='en' isSubmitting onClose={onClose} onSubmit={onSubmit} />)

        const dialog = await screen.findByRole('dialog', { name: 'Edit quiz' })
        expect(screen.getByTestId('entity-form-submit')).toBeDisabled()
        expect(screen.getByTestId('entity-form-cancel')).toBeDisabled()

        await user.keyboard('{Escape}')

        expect(dialog).toBeInTheDocument()
        expect(onClose).not.toHaveBeenCalled()
        expect(onSubmit).not.toHaveBeenCalled()
    })
})
