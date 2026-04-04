import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { EntityFormDialog } from '../EntityFormDialog'

describe('EntityFormDialog', () => {
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
})
