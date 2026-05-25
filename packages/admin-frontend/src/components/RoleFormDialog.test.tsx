import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import RoleFormDialog from './RoleFormDialog'
import roleActions from '../pages/RoleActions'

const buildLocalizedValue = (content: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: {
            content,
            version: 1,
            isActive: true,
            createdAt: '2026-03-18T00:00:00.000Z',
            updatedAt: '2026-03-18T00:00:00.000Z'
        }
    }
})

const noop = () => undefined

const getCodenameInput = (): HTMLInputElement => {
    const formControl = screen.getByText('Code Name').closest('.MuiFormControl-root')
    const input = formControl?.querySelector('input')

    if (!(input instanceof HTMLInputElement)) {
        throw new Error('Code Name input not found')
    }

    return input
}

type MockLocalizedInlineFieldProps = {
    label: string
    value: { locales?: { en?: { content?: string } } } | null
    onChange: (value: ReturnType<typeof buildLocalizedValue>) => void
}

type MockColorPickerProps = {
    label: string
    value: string
    onChange: (value: string) => void
}

type MockCodenameFieldProps = {
    label: string
    value: { _primary?: string; locales?: Record<string, { content?: string }> } | null
    onChange: (value: ReturnType<typeof buildLocalizedValue>) => void
    onTouchedChange: (touched: boolean) => void
    disabled?: boolean
}

const expectVlcWithContent = (content: string) =>
    expect.objectContaining({
        _primary: 'en',
        locales: expect.objectContaining({
            en: expect.objectContaining({ content })
        })
    })

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-i18next')>()

    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, fallback?: string | Record<string, unknown>) => (typeof fallback === 'string' ? fallback : key),
            i18n: { language: 'en' }
        })
    }
})

vi.mock('@universo/template-mui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@universo/template-mui')>()

    return {
        ...actual,
        LocalizedInlineField: ({ label, value, onChange }: MockLocalizedInlineFieldProps) => (
            <input
                aria-label={label}
                value={value?.locales?.en?.content ?? ''}
                onChange={(event) =>
                    onChange({
                        _schema: '1',
                        _primary: 'en',
                        locales: {
                            en: {
                                content: event.target.value,
                                version: 1,
                                isActive: true,
                                createdAt: '2026-03-18T00:00:00.000Z',
                                updatedAt: '2026-03-18T00:00:00.000Z'
                            }
                        }
                    })
                }
            />
        ),
        CodenameField: ({ label, value, onChange, onTouchedChange, disabled }: MockCodenameFieldProps) => (
            <div className='MuiFormControl-root'>
                <span>{label}</span>
                <input
                    value={value?.locales?.[value?._primary || 'en']?.content ?? ''}
                    disabled={disabled}
                    onChange={(event) => {
                        onTouchedChange(true)
                        onChange({
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: {
                                    content: event.target.value,
                                    version: 1,
                                    isActive: true,
                                    createdAt: '2026-03-18T00:00:00.000Z',
                                    updatedAt: '2026-03-18T00:00:00.000Z'
                                }
                            }
                        })
                    }}
                />
            </div>
        )
    }
})

vi.mock('./ColorPicker', () => ({
    ColorPicker: ({ label, value, onChange }: MockColorPickerProps) => (
        <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
    )
}))

vi.mock('../hooks/usePlatformCodenameConfig', () => ({
    usePlatformCodenameConfig: () => ({
        style: 'pascal-case' as const,
        alphabet: 'en-ru' as const,
        allowMixed: false,
        autoConvertMixedAlphabets: true
    })
}))

describe('RoleFormDialog', () => {
    it('submits copyPermissions as false by default for copy dialogs', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined)

        render(<RoleFormDialog open title='Copy role' submitLabel='Copy role' showCopyPermissions onClose={noop} onSubmit={onSubmit} />)

        const codenameInput = getCodenameInput()
        const nameInput = screen.getByLabelText('Name')

        fireEvent.change(codenameInput, { target: { value: 'EditorCopy' } })
        fireEvent.change(nameInput, { target: { value: 'Editor Copy' } })
        fireEvent.click(screen.getByRole('button', { name: 'Copy role' }))

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledWith(
                expect.objectContaining({
                    codename: expectVlcWithContent('EditorCopy'),
                    copyPermissions: false
                })
            )
        })
    })

    it('allows enabling permission copy explicitly', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined)

        render(<RoleFormDialog open title='Copy role' submitLabel='Copy role' showCopyPermissions onClose={noop} onSubmit={onSubmit} />)

        const codenameInput = getCodenameInput()
        const nameInput = screen.getByLabelText('Name')

        fireEvent.change(codenameInput, { target: { value: 'EditorCopy' } })
        fireEvent.change(nameInput, { target: { value: 'Editor Copy' } })
        fireEvent.click(screen.getByLabelText('Copy permissions from source role'))
        fireEvent.click(screen.getByRole('button', { name: 'Copy role' }))

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledWith(
                expect.objectContaining({
                    codename: expectVlcWithContent('EditorCopy'),
                    copyPermissions: true
                })
            )
        })
    })

    it('auto-fills codename from the role name in create dialogs until the codename is touched', async () => {
        render(<RoleFormDialog open title='Create role' submitLabel='Create role' onClose={noop} onSubmit={vi.fn()} />)

        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Content Editor' } })

        await waitFor(() => {
            expect(getCodenameInput().value).toBe('ContentEditor')
        })
    })

    it('blocks submit when the codename is shorter than the backend contract', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined)

        render(<RoleFormDialog open title='Create role' submitLabel='Create role' onClose={noop} onSubmit={onSubmit} />)

        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'A' } })
        fireEvent.change(getCodenameInput(), { target: { value: 'a' } })
        fireEvent.click(screen.getByRole('button', { name: 'Create role' }))

        await waitFor(() => {
            expect(onSubmit).not.toHaveBeenCalled()
        })

        expect(screen.getByText('Code name must be between 2 and 50 characters')).toBeInTheDocument()
    })

    it('opens copy dialogs with a blank codename and visible permission toggle', () => {
        const copyAction = roleActions.find((descriptor) => descriptor.id === 'copy')
        const props = copyAction?.dialog?.buildProps({
            entity: {
                id: 'role-1',
                codename: buildLocalizedValue('editor'),
                name: buildLocalizedValue('Editor'),
                description: buildLocalizedValue('Editor role'),
                color: '#111111',
                isSuperuser: false,
                isSystem: false,
                permissions: []
            },
            t: (key: string, fallback?: string | Record<string, unknown>) => (typeof fallback === 'string' ? fallback : key),
            meta: { copyRole: vi.fn() }
        } as Parameters<NonNullable<(typeof copyAction)['dialog']>['buildProps']>[0])

        expect(props).toEqual(
            expect.objectContaining({
                initialCodename: expectVlcWithContent('editor_copy'),
                initialCopyPermissions: false,
                showCopyPermissions: true
            })
        )
    })

    it('uses a dialog-based edit action instead of legacy navigation', () => {
        const editAction = roleActions.find((descriptor) => descriptor.id === 'edit')
        const props = editAction?.dialog?.buildProps({
            entity: {
                id: 'role-1',
                codename: buildLocalizedValue('editor'),
                name: buildLocalizedValue('Editor'),
                description: buildLocalizedValue('Editor role'),
                color: '#111111',
                isSuperuser: false,
                isSystem: false,
                permissions: []
            },
            t: (key: string, fallback?: string | Record<string, unknown>) => (typeof fallback === 'string' ? fallback : key),
            api: { updateEntity: vi.fn() }
        } as Parameters<NonNullable<(typeof editAction)['dialog']>['buildProps']>[0])

        expect(editAction?.dialog).toBeTruthy()
        expect(props).toEqual(
            expect.objectContaining({
                initialCodename: buildLocalizedValue('editor'),
                codenameDisabled: false,
                showCopyPermissions: false
            })
        )
    })
})
