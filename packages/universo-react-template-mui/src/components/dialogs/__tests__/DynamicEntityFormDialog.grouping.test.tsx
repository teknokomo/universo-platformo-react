import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ConfirmContextProvider } from '../../../contexts'
import { ConfirmDialog } from '../ConfirmDialog'
import { DynamicEntityFormDialog, type DynamicFieldConfig, type DynamicEntityFormDialogProps } from '../DynamicEntityFormDialog'

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key) })
}))

// Use checked-in common resources and real interpolation for the consumer contract.
jest.mock('@universo-react/i18n', () => {
    const i18n = require('i18next').createInstance()
    i18n.init({
        lng: 'en',
        fallbackLng: 'en',
        initImmediate: false,
        resources: {
            en: { common: require('../../../../../universo-react-i18n/src/locales/en/core/common.json') },
            ru: { common: require('../../../../../universo-react-i18n/src/locales/ru/core/common.json') }
        },
        defaultNS: 'common',
        interpolation: { escapeValue: false }
    })
    return { useCommonTranslations: () => ({ t: i18n.t.bind(i18n) }), groupingTestI18n: i18n }
})

const fields: DynamicFieldConfig[] = [
    {
        id: 'groups',
        codename: 'Groups',
        label: 'Sections',
        type: 'TABLE',
        childFields: [{ id: 'key', codename: 'Key', label: 'Key', type: 'STRING' }]
    },
    {
        id: 'items',
        label: 'Items',
        type: 'TABLE',
        childFields: [
            {
                id: 'group',
                label: 'Section',
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
    },
    { id: 'title', label: 'Title', type: 'STRING', localized: false }
]
const group = { key: 'stable-section', title: 'First section' }
const makeValues = (grouped: boolean) => ({
    groups: grouped ? [group] : [],
    items: [
        { id: 'first', group: grouped ? group.key : null, text: 'Keep first' },
        { id: 'second', group: grouped ? group.key : null, text: 'Keep second' }
    ],
    title: 'Original title'
})
const i18n = (
    jest.requireMock('@universo-react/i18n') as {
        groupingTestI18n: { changeLanguage: (locale: string) => Promise<unknown>; t: (key: string, options?: object) => string }
    }
).groupingTestI18n

const renderEditor = ({ field, value, values, onChange }: Parameters<NonNullable<DynamicEntityFormDialogProps['renderField']>>[0]) => {
    if (field.type !== 'TABLE') return undefined
    return (
        <div>
            <output aria-label={`${field.label} values`}>{JSON.stringify(values)}</output>
            {field.id === 'groups' && (
                <>
                    <button onClick={() => onChange(Array.isArray(value) && value.length ? [] : [group])}>Change grouping</button>
                    <button
                        onClick={() =>
                            onChange([...(Array.isArray(value) ? value : []), { key: 'unused-section', title: 'Unused section' }])
                        }
                    >
                        Add unused group
                    </button>
                    <button onClick={() => onChange([...(Array.isArray(value) ? value : []), group])}>Duplicate group key</button>
                </>
            )}
        </div>
    )
}

const form = (
    open: boolean,
    initialData: Record<string, unknown>,
    onSubmit = jest.fn().mockResolvedValue(undefined),
    renderField = renderEditor,
    formFields = fields
) => (
    <ConfirmContextProvider>
        <DynamicEntityFormDialog
            open={open}
            fields={formFields}
            initialData={initialData}
            locale='en'
            title='Edit record'
            onClose={() => undefined}
            onSubmit={onSubmit}
            renderField={renderField}
        />
        <ConfirmDialog />
    </ConfirmContextProvider>
)
const getValues = () => JSON.parse(screen.getByLabelText('Sections values').textContent ?? '{}')
const respond = async (accepted: boolean) => {
    const dialog = await screen.findByRole('dialog', { name: i18n.t('tableGrouping.title') })
    expect(dialog.querySelector('[class*="resize"]')).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t(`tableGrouping.${accepted ? 'confirm' : 'cancel'}`), exact: true }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: i18n.t('tableGrouping.title') })).not.toBeInTheDocument())
}

describe('DynamicEntityFormDialog TABLE grouping', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('en')
    })

    it.each([false, true])('cancels the boundary change without changing either table (grouped=%s)', async (grouped) => {
        const initial = makeValues(grouped)
        const submit = jest.fn().mockResolvedValue(undefined)
        render(form(true, initial, submit))
        fireEvent.click(screen.getByRole('button', { name: 'Change grouping' }))
        const confirmation = screen.getByRole('dialog', { name: i18n.t('tableGrouping.title') })
        expect(confirmation).toHaveAccessibleDescription(
            i18n.t(`tableGrouping.${grouped ? 'ungroupDescription' : 'groupDescription'}`, { table: 'Sections' })
        )
        await respond(false)
        expect(getValues()).toEqual(initial)
        fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }))
        await waitFor(() => expect(submit).toHaveBeenCalledWith(initial))
    })

    it.each(['en', 'ru'])('confirms both directions atomically with real %s common labels', async (locale) => {
        await i18n.changeLanguage(locale)
        const initial = makeValues(false)
        const submit = jest.fn().mockResolvedValue(undefined)
        const observed: Record<string, unknown>[] = []
        render(
            form(true, initial, submit, (params) => {
                observed.push(params.values)
                return renderEditor(params)
            })
        )
        for (const grouped of [true, false]) {
            fireEvent.click(screen.getByRole('button', { name: 'Change grouping' }))
            await respond(true)
            const expected = makeValues(grouped)
            await waitFor(() => expect(getValues()).toEqual(expected))
            fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }))
            await waitFor(() => expect(submit).toHaveBeenLastCalledWith(expected))
        }
        for (const values of observed) {
            expect(values).toEqual(makeValues((values.groups as unknown[]).length > 0))
        }
    })

    it.each([false, true])('ignores a late confirmation after closing and reopening (grouped=%s)', async (grouped) => {
        const initial = makeValues(grouped)
        const reopened = { ...makeValues(grouped), title: 'Reopened title' }
        const view = render(form(true, initial))
        fireEvent.click(screen.getByRole('button', { name: 'Change grouping' }))
        view.rerender(form(false, initial))
        view.rerender(form(true, reopened))
        await respond(true)
        expect(getValues()).toEqual(reopened)
        expect(screen.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Reopened title')
    })

    it('keeps ordinary edits immediate and preserves them when grouping is canceled', async () => {
        render(form(true, makeValues(false)))
        fireEvent.change(screen.getByRole('textbox', { name: 'Title', exact: true }), { target: { value: 'Edited title' } })
        expect(screen.queryByRole('dialog', { name: i18n.t('tableGrouping.title') })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Change grouping' }))
        await respond(false)
        expect(getValues()).toEqual({ ...makeValues(false), title: 'Edited title' })
    })

    it('confirms removal of the final empty group before saving the flat form', async () => {
        const initial = { ...makeValues(true), items: [] }
        const submit = jest.fn().mockResolvedValue(undefined)
        const expected = { ...initial, groups: [] }
        render(form(true, initial, submit))

        fireEvent.click(screen.getByRole('button', { name: 'Change grouping' }))
        expect(screen.getByRole('dialog', { name: i18n.t('tableGrouping.title') })).toHaveAccessibleDescription(
            i18n.t('tableGrouping.ungroupDescription', { table: 'Sections' })
        )
        await respond(false)
        expect(getValues()).toEqual(initial)
        expect(submit).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Change grouping' }))
        await respond(true)
        expect(getValues()).toEqual(expected)
        fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }))
        await waitFor(() => expect(submit).toHaveBeenCalledWith(expected))
    })

    it('clears optional sibling references without asking for grouping confirmation', async () => {
        const optionalFields = JSON.parse(JSON.stringify(fields)) as DynamicFieldConfig[]
        const optionalSelectorConfig = optionalFields[1].childFields?.[0].uiConfig?.siblingRowSelect as Record<string, unknown>
        delete optionalSelectorConfig.requiredWithRows
        delete optionalSelectorConfig.requireEachTargetReferenced
        const initial = makeValues(true)
        const expected = {
            ...initial,
            groups: [],
            items: initial.items.map((row) => ({ ...row, group: null }))
        }
        const submit = jest.fn().mockResolvedValue(undefined)
        render(form(true, initial, submit, renderEditor, optionalFields))

        fireEvent.click(screen.getByRole('button', { name: 'Change grouping' }))

        expect(screen.queryByRole('dialog', { name: i18n.t('tableGrouping.title') })).not.toBeInTheDocument()
        await waitFor(() => expect(getValues()).toEqual(expected))
        fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }))
        await waitFor(() => expect(submit).toHaveBeenCalledWith(expected))
    })

    it('blocks saving when a group has no related rows', async () => {
        const submit = jest.fn().mockResolvedValue(undefined)
        render(form(true, makeValues(true), submit))

        fireEvent.click(screen.getByRole('button', { name: 'Add unused group' }))

        expect(await screen.findByText('Each group must contain at least one related row before saving.')).toBeInTheDocument()
        const saveButton = screen.getByRole('button', { name: 'Save', exact: true })
        expect(saveButton).toBeDisabled()
        fireEvent.click(saveButton)
        expect(submit).not.toHaveBeenCalled()
    })

    it('blocks saving when two groups share a semantic key', async () => {
        const submit = jest.fn().mockResolvedValue(undefined)
        render(form(true, makeValues(true), submit))

        fireEvent.click(screen.getByRole('button', { name: 'Duplicate group key' }))

        expect(
            await screen.findByText('Each group must have a unique key. Remove or recreate the duplicate group before saving.')
        ).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
        expect(submit).not.toHaveBeenCalled()
    })
})
