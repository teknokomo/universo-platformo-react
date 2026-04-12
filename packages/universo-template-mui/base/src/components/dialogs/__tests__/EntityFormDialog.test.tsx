import React from 'react'
import { Dialog, DialogTitle } from '@mui/material'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { EntityFormDialog } from '../EntityFormDialog'
import { DialogPresentationProvider, mergeDialogPaperProps, useDialogPresentation } from '../dialogPresentation'

const DialogPresentationHarness = ({ onClose = () => undefined }: { onClose?: () => void }) => {
    const presentation = useDialogPresentation({ open: true, onClose })

    return (
        <>
            <button type='button' onClick={() => presentation.dialogProps.onClose?.(undefined, 'backdropClick')}>
                Trigger backdrop close
            </button>
            <Dialog
                open
                onClose={presentation.dialogProps.onClose}
                maxWidth={presentation.dialogProps.maxWidth ?? 'sm'}
                fullWidth={presentation.dialogProps.fullWidth ?? true}
                disableEscapeKeyDown={presentation.dialogProps.disableEscapeKeyDown}
                PaperProps={mergeDialogPaperProps(undefined, presentation.dialogProps.PaperProps)}
            >
                <DialogTitle>{presentation.titleActions ?? 'Dialog harness'}</DialogTitle>
                <div>Dialog harness content</div>
                {presentation.resizeHandle}
            </Dialog>
        </>
    )
}

const DialogPresentationCapture = ({
    onCapture,
    onClose = () => undefined
}: {
    onCapture: (presentation: ReturnType<typeof useDialogPresentation>) => void
    onClose?: () => void
}) => {
    const presentation = useDialogPresentation({ open: true, onClose })

    React.useEffect(() => {
        onCapture(presentation)
    }, [onCapture, presentation])

    return presentation.resizeHandle ? <>{presentation.resizeHandle}</> : null
}

describe('EntityFormDialog', () => {
    afterEach(() => {
        window.localStorage.clear()
    })

    it('hydrates async extra values while the form is still pristine', async () => {
        const AsyncDialogHost = () => {
            const [initialExtraValues, setInitialExtraValues] = React.useState<Record<string, unknown>>({ nameVlc: null })

            React.useEffect(() => {
                setInitialExtraValues({
                    nameVlc: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: {
                            en: { content: 'Loaded publication name' }
                        }
                    }
                })
            }, [])

            return (
                <EntityFormDialog
                    open
                    title='Edit Publication'
                    hideDefaultFields
                    nameLabel='Name'
                    descriptionLabel='Description'
                    initialExtraValues={initialExtraValues}
                    tabs={({ values, setValue }) => [
                        {
                            id: 'general',
                            label: 'General',
                            content: (
                                <>
                                    <div data-testid='name-value'>{String(values.nameVlc?.locales?.en?.content ?? 'empty')}</div>
                                    <button type='button' onClick={() => setValue('nameVlc', { locales: { en: { content: 'Edited' } } })}>
                                        Edit
                                    </button>
                                </>
                            )
                        }
                    ]}
                    onClose={() => undefined}
                    onSave={() => undefined}
                />
            )
        }

        render(<AsyncDialogHost />)

        await waitFor(() => {
            expect(screen.getByTestId('name-value')).toHaveTextContent('Loaded publication name')
        })
    })

    it('keeps async hydration active when a child auto-initializes an empty localized scaffold first', async () => {
        const AutoInitializingField = ({
            value,
            setValue
        }: {
            value: { locales?: { en?: { content?: string } } } | null | undefined
            setValue: (name: string, nextValue: unknown) => void
        }) => {
            React.useEffect(() => {
                if (value) return
                setValue('nameVlc', {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: {
                        en: { content: '' }
                    }
                })
            }, [setValue, value])

            return <div data-testid='name-value'>{String(value?.locales?.en?.content ?? 'empty')}</div>
        }

        const AsyncDialogHost = () => {
            const [initialExtraValues, setInitialExtraValues] = React.useState<Record<string, unknown>>({ nameVlc: null })

            React.useEffect(() => {
                const timer = window.setTimeout(() => {
                    setInitialExtraValues({
                        nameVlc: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Loaded publication name' }
                            }
                        }
                    })
                }, 0)

                return () => window.clearTimeout(timer)
            }, [])

            return (
                <EntityFormDialog
                    open
                    title='Edit Publication'
                    hideDefaultFields
                    nameLabel='Name'
                    descriptionLabel='Description'
                    initialExtraValues={initialExtraValues}
                    tabs={({ values, setValue }) => [
                        {
                            id: 'general',
                            label: 'General',
                            content: <AutoInitializingField value={values.nameVlc as never} setValue={setValue} />
                        }
                    ]}
                    onClose={() => undefined}
                    onSave={() => undefined}
                />
            )
        }

        render(<AsyncDialogHost />)

        await waitFor(() => {
            expect(screen.getByTestId('name-value')).toHaveTextContent('Loaded publication name')
        })
    })

    it('does not overwrite extra values after the user starts editing', async () => {
        const AsyncDialogHost = () => {
            const [initialExtraValues, setInitialExtraValues] = React.useState<Record<string, unknown>>({
                nameVlc: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Initial value' }
                    }
                }
            })

            return (
                <>
                    <button
                        type='button'
                        onClick={() =>
                            setInitialExtraValues({
                                nameVlc: {
                                    _schema: 'v1',
                                    _primary: 'en',
                                    locales: {
                                        en: { content: 'Server refresh value' }
                                    }
                                }
                            })
                        }
                    >
                        Refresh
                    </button>
                    <EntityFormDialog
                        open
                        title='Edit Publication'
                        hideDefaultFields
                        nameLabel='Name'
                        descriptionLabel='Description'
                        initialExtraValues={initialExtraValues}
                        tabs={({ values, setValue }) => [
                            {
                                id: 'general',
                                label: 'General',
                                content: (
                                    <>
                                        <div data-testid='name-value'>{String(values.nameVlc?.locales?.en?.content ?? 'empty')}</div>
                                        <button
                                            type='button'
                                            onClick={() =>
                                                setValue('nameVlc', {
                                                    _schema: 'v1',
                                                    _primary: 'en',
                                                    locales: {
                                                        en: { content: 'Edited locally' }
                                                    }
                                                })
                                            }
                                        >
                                            Edit
                                        </button>
                                    </>
                                )
                            }
                        ]}
                        onClose={() => undefined}
                        onSave={() => undefined}
                    />
                </>
            )
        }

        const user = userEvent.setup()
        render(<AsyncDialogHost />)

        await user.click(screen.getByRole('button', { name: 'Edit' }))
        expect(screen.getByTestId('name-value')).toHaveTextContent('Edited locally')

        await user.click(screen.getByText('Refresh'))

        await waitFor(() => {
            expect(screen.getByTestId('name-value')).toHaveTextContent('Edited locally')
        })
    })

    it('keeps async hydration enabled for internal underscore-prefixed fields', async () => {
        const AsyncDialogHost = () => {
            const [initialExtraValues, setInitialExtraValues] = React.useState<Record<string, unknown>>({ nameVlc: null })

            React.useEffect(() => {
                setInitialExtraValues({
                    nameVlc: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: {
                            en: { content: 'Server hydrated value' }
                        }
                    }
                })
            }, [])

            return (
                <EntityFormDialog
                    open
                    title='Edit Publication'
                    hideDefaultFields
                    nameLabel='Name'
                    descriptionLabel='Description'
                    initialExtraValues={initialExtraValues}
                    tabs={({ values, setValue }) => [
                        {
                            id: 'general',
                            label: 'General',
                            content: (
                                <>
                                    <div data-testid='name-value'>{String(values.nameVlc?.locales?.en?.content ?? 'empty')}</div>
                                    <button type='button' onClick={() => setValue('_codenameConfig', { style: 'pascal-case' })}>
                                        Sync internal config
                                    </button>
                                </>
                            )
                        }
                    ]}
                    onClose={() => undefined}
                    onSave={() => undefined}
                />
            )
        }

        const user = userEvent.setup()
        render(<AsyncDialogHost />)

        await user.click(screen.getByRole('button', { name: 'Sync internal config' }))

        await waitFor(() => {
            expect(screen.getByTestId('name-value')).toHaveTextContent('Server hydrated value')
        })
    })

    it('renders initial extra values on the very first open before child auto-initializers can blank them', async () => {
        const AutoInitializingField = ({
            value,
            setValue
        }: {
            value: { locales?: { en?: { content?: string } } } | null | undefined
            setValue: (name: string, nextValue: unknown) => void
        }) => {
            React.useEffect(() => {
                if (value) return
                setValue('nameVlc', {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: {
                        en: { content: '' }
                    }
                })
            }, [setValue, value])

            return <div data-testid='name-value'>{String(value?.locales?.en?.content ?? 'empty')}</div>
        }

        const OpenOnDemandHost = () => {
            const [open, setOpen] = React.useState(false)

            return (
                <>
                    <button type='button' onClick={() => setOpen(true)}>
                        Open
                    </button>
                    <EntityFormDialog
                        open={open}
                        title='Edit Publication'
                        hideDefaultFields
                        nameLabel='Name'
                        descriptionLabel='Description'
                        initialExtraValues={{
                            nameVlc: {
                                _schema: 'v1',
                                _primary: 'en',
                                locales: {
                                    en: { content: 'Loaded on first open' }
                                }
                            }
                        }}
                        tabs={({ values, setValue }) => [
                            {
                                id: 'general',
                                label: 'General',
                                content: <AutoInitializingField value={values.nameVlc as never} setValue={setValue} />
                            }
                        ]}
                        onClose={() => undefined}
                        onSave={() => undefined}
                    />
                </>
            )
        }

        const user = userEvent.setup()
        render(<OpenOnDemandHost />)

        await user.click(screen.getByRole('button', { name: 'Open' }))

        await waitFor(() => {
            expect(screen.getByTestId('name-value')).toHaveTextContent('Loaded on first open')
        })
    })

    it('shows fullscreen and reset controls when dialog presentation is enabled with a stored custom size', async () => {
        window.localStorage.setItem('universo:dialog-presentation:metahub-1:size', JSON.stringify({ width: 720, height: 540 }))

        const user = userEvent.setup()

        render(
            <DialogPresentationProvider
                value={{
                    enabled: true,
                    sizePreset: 'medium',
                    allowFullscreen: true,
                    allowResize: true,
                    closeBehavior: 'strict-modal',
                    storageScopeKey: 'metahub-1'
                }}
            >
                <EntityFormDialog
                    open
                    title='Edit Publication'
                    nameLabel='Name'
                    descriptionLabel='Description'
                    initialName='Existing name'
                    onClose={() => undefined}
                    onSave={() => undefined}
                />
            </DialogPresentationProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('dialog-toggle-fullscreen')).toBeInTheDocument()
        })

        expect(screen.getByTestId('dialog-reset-size')).toBeInTheDocument()
        expect(screen.getByTestId('dialog-resize-handle')).toBeInTheDocument()

        await user.click(screen.getByTestId('dialog-reset-size'))

        await waitFor(() => {
            expect(window.localStorage.getItem('universo:dialog-presentation:metahub-1:size')).toBeNull()
        })
    })

    it('uses provided localized labels for dialog action tooltips and the resize handle aria-label', async () => {
        window.localStorage.setItem('universo:dialog-presentation:labels:size', JSON.stringify({ width: 720, height: 540 }))

        let capturedPresentation: ReturnType<typeof useDialogPresentation> | null = null

        render(
            <DialogPresentationProvider
                value={{
                    enabled: true,
                    sizePreset: 'medium',
                    allowFullscreen: true,
                    allowResize: true,
                    closeBehavior: 'strict-modal',
                    storageScopeKey: 'labels',
                    titleActionLabels: {
                        resetSize: 'Сбросить размер окна',
                        expand: 'Раскрыть окно',
                        restoreSize: 'Вернуть размер окна',
                        resizeHandle: 'Изменить размер окна'
                    }
                }}
            >
                <DialogPresentationCapture onCapture={(presentation) => (capturedPresentation = presentation)} />
            </DialogPresentationProvider>
        )

        await waitFor(() => {
            expect(capturedPresentation?.titleActions).not.toBeNull()
        })

        expect(screen.getByTestId('dialog-resize-handle')).toHaveAttribute('aria-label', 'Изменить размер окна')

        const titleActions = capturedPresentation!.titleActions as React.ReactElement
        const children = React.Children.toArray(titleActions.props.children) as React.ReactElement[]
        const resetTooltip = children[0]
        const fullscreenTooltip = children[1]

        expect(resetTooltip.props.title).toBe('Сбросить размер окна')
        expect(fullscreenTooltip.props.title).toBe('Раскрыть окно')
    })

    it('shows attention feedback when strict modal blocks a backdrop close', async () => {
        let closeCalls = 0
        const user = userEvent.setup()

        render(
            <DialogPresentationProvider
                value={{
                    enabled: true,
                    allowFullscreen: true,
                    allowResize: false,
                    closeBehavior: 'strict-modal',
                    storageScopeKey: 'strict-modal-attention'
                }}
            >
                <DialogPresentationHarness onClose={() => (closeCalls += 1)} />
            </DialogPresentationProvider>
        )

        const dialog = await screen.findByRole('dialog')
        expect(dialog).toHaveAttribute('data-dialog-attention', 'idle')

        await user.click(screen.getByText('Trigger backdrop close'))

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveAttribute('data-dialog-attention', 'active')
        })

        expect(closeCalls).toBe(0)
    })

    it('persists resized dimensions and clears resize cursor state after mouseup', async () => {
        render(
            <DialogPresentationProvider
                value={{
                    enabled: true,
                    allowFullscreen: false,
                    allowResize: true,
                    closeBehavior: 'backdrop-close',
                    storageScopeKey: 'resize-harness'
                }}
            >
                <DialogPresentationHarness />
            </DialogPresentationProvider>
        )

        const dialog = await screen.findByRole('dialog')
        Object.defineProperty(dialog, 'getBoundingClientRect', {
            configurable: true,
            value: () => ({
                x: 0,
                y: 0,
                top: 0,
                left: 0,
                right: 640,
                bottom: 480,
                width: 640,
                height: 480,
                toJSON: () => undefined
            })
        })

        fireEvent.mouseDown(screen.getByTestId('dialog-resize-handle'), { clientX: 640, clientY: 480 })

        await waitFor(() => {
            expect(document.body.style.cursor).toBe('nwse-resize')
        })

        fireEvent.mouseMove(window, { clientX: 720, clientY: 560 })
        fireEvent.mouseUp(window)

        await waitFor(() => {
            expect(window.localStorage.getItem('universo:dialog-presentation:resize-harness:size')).toBe(
                JSON.stringify({ width: 720, height: 560 })
            )
        })

        expect(document.body.style.cursor).toBe('')
        expect(document.body.style.userSelect).toBe('')
    })
})
