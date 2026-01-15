import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

const notifyError = vi.fn()

vi.mock('@universo/template-mui', () => ({
    LocalizedInlineField: ({ label }: any) => <div data-testid='localized-inline-field'>{label}</div>,
    CodenameField: ({ label }: any) => <div data-testid='codename-field'>{label}</div>,
    useCodenameAutoFill: () => undefined,
    useViewPreference: (key: string) => ['card', vi.fn()],
    DEFAULT_VIEW_STYLE: 'card',
    notifyError
}))

type TFn = (key: string, arg2?: unknown) => string

const makeT = (): TFn => {
    return (key: string, arg2?: unknown) => {
        if (typeof arg2 === 'string') return arg2
        if (arg2 && typeof arg2 === 'object' && typeof (arg2 as any).defaultValue === 'string') return (arg2 as any).defaultValue
        return key
    }
}

const makeVlc = (content: string) => ({
    _schema: 'v1',
    _primary: 'en',
    locales: { en: { content } }
})

describe('Action descriptors (coverage)', () => {
    beforeEach(() => {
        notifyError.mockClear()
        vi.clearAllMocks()
    })

    it('ConnectorActions edit/delete buildProps covers validation, save, delete, refresh and error branches', async () => {
        const mod = await import('../ConnectorActions')
        const descriptors = mod.default as any[]

        const edit = descriptors.find((d) => d.id === 'edit')
        const del = descriptors.find((d) => d.id === 'delete')
        expect(edit?.dialog?.buildProps).toBeTypeOf('function')
        expect(del?.onSelect).toBeTypeOf('function')

        const updateEntity = vi.fn(async () => undefined)
        const refreshList = vi.fn(async () => undefined)
        const openDeleteDialog = vi.fn()
        const enqueueSnackbar = vi.fn()

        const ctx: any = {
            entity: { id: 'conn-1', name: 'Connector One', codename: 'connector-one', description: 'Desc' },
            uiLocale: 'en',
            t: makeT(),
            api: { updateEntity },
            helpers: { refreshList, openDeleteDialog, enqueueSnackbar },
            connectorMap: new Map([
                [
                    'conn-1',
                    {
                        id: 'conn-1',
                        applicationId: 'app-1',
                        codename: 'connector-one',
                        name: makeVlc('Connector One'),
                        description: makeVlc('Desc'),
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                ]
            ])
        }

        const props = edit.dialog.buildProps(ctx)

        // Extra fields render path (covers ConnectorEditFields component + hooks)
        const extraEl = props.extraFields({
            values: props.initialExtraValues,
            setValue: vi.fn(),
            isLoading: false,
            errors: props.validate?.(props.initialExtraValues) ?? {}
        })
        render(extraEl)

        // Validation branches
        expect(props.validate({ nameVlc: null, codename: '' })).toMatchObject({
            nameVlc: 'Name is required',
            codename: 'Codename is required'
        })
        expect(props.validate({ nameVlc: makeVlc('X'), codename: 'Bad Code' })).toBeNull()

        // canSave branches
        expect(props.canSave({ nameVlc: null, codename: 'ok' })).toBe(false)
        expect(props.canSave({ nameVlc: makeVlc('X'), codename: '' })).toBe(false)
        expect(props.canSave({ nameVlc: makeVlc('X'), codename: 'Bad Code' })).toBe(true)
        expect(props.canSave({ nameVlc: makeVlc('X'), codename: 'good-code' })).toBe(true)

        // Save success path
        await props.onSave({
            nameVlc: makeVlc('Connector One'),
            descriptionVlc: makeVlc('Desc'),
            codename: '  good-code  '
        })
        expect(updateEntity).toHaveBeenCalledWith(
            'conn-1',
            expect.objectContaining({
                codename: 'good-code',
                namePrimaryLocale: 'en'
            })
        )
        expect(refreshList).toHaveBeenCalled()

        // Delete wiring
        props.onDelete?.()
        expect(openDeleteDialog).toHaveBeenCalledWith(ctx.entity)
        await del.onSelect(ctx)
        expect(openDeleteDialog).toHaveBeenCalledWith(ctx.entity)

        // Success refresh branch
        await props.onSuccess?.()
        expect(refreshList).toHaveBeenCalled()

        // Save error branch
        updateEntity.mockRejectedValueOnce(new Error('boom'))
        await expect(
            props.onSave({
                nameVlc: makeVlc('Connector One'),
                descriptionVlc: makeVlc('Desc'),
                codename: 'good-code'
            })
        ).rejects.toThrow('boom')
        expect(notifyError).toHaveBeenCalled()
    }, 15000)

    it('ApplicationActions edit/delete buildProps covers validate/canSave/save/delete branches', async () => {
        const mod = await import('../ApplicationActions')
        const descriptors = mod.default as any[]

        const edit = descriptors.find((d) => d.id === 'edit')
        const del = descriptors.find((d) => d.id === 'delete')
        expect(edit?.dialog?.buildProps).toBeTypeOf('function')
        expect(del?.dialog?.buildProps).toBeTypeOf('function')

        const updateEntity = vi.fn(async () => undefined)
        const deleteEntity = vi.fn(async () => undefined)
        const refreshList = vi.fn(async () => undefined)
        const openDeleteDialog = vi.fn()
        const enqueueSnackbar = vi.fn()

        const ctx: any = {
            entity: { id: 'app-1', name: 'My App', description: 'Desc' },
            uiLocale: 'en',
            t: makeT(),
            api: { updateEntity, deleteEntity },
            helpers: { refreshList, openDeleteDialog, enqueueSnackbar },
            applicationMap: new Map([
                [
                    'app-1',
                    {
                        id: 'app-1',
                        codename: 'my-app',
                        name: makeVlc('My App'),
                        description: makeVlc('Desc'),
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                ]
            ])
        }

        const editProps = edit.dialog.buildProps(ctx)
        expect(editProps.validate({ nameVlc: null })).toMatchObject({ nameVlc: 'Name is required' })
        expect(editProps.validate({ nameVlc: makeVlc('X') })).toBeNull()
        expect(editProps.canSave({ nameVlc: null })).toBe(false)
        expect(editProps.canSave({ nameVlc: makeVlc('X') })).toBe(true)

        await editProps.onSave({ nameVlc: makeVlc('My App'), descriptionVlc: makeVlc('Desc') })
        expect(updateEntity).toHaveBeenCalledWith('app-1', expect.objectContaining({ namePrimaryLocale: 'en' }))
        expect(refreshList).toHaveBeenCalled()

        editProps.onDelete?.()
        expect(openDeleteDialog).toHaveBeenCalledWith(ctx.entity)

        const delProps = del.dialog.buildProps(ctx)
        await delProps.onConfirm()
        expect(deleteEntity).toHaveBeenCalledWith('app-1')
        expect(refreshList).toHaveBeenCalled()

        // Delete error branch
        deleteEntity.mockRejectedValueOnce(new Error('delete-fail'))
        await expect(delProps.onConfirm()).rejects.toThrow('delete-fail')
        expect(notifyError).toHaveBeenCalled()
    }, 15000)
})
