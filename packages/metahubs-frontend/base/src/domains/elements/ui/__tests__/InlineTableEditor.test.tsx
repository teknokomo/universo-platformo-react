import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
    return {
        ...actual,
        useTranslation: () => ({
            t: (_key: string, fallback?: string) => fallback ?? _key
        })
    }
})

import InlineTableEditor from '../InlineTableEditor'

describe('InlineTableEditor', () => {
    it('stores localized child strings in the canonical VLC format', async () => {
        const user = userEvent.setup()
        const handleChange = vi.fn()

        const Wrapper = () => {
            const [rows, setRows] = useState<Record<string, unknown>[]>([])

            return (
                <InlineTableEditor
                    label='Resources'
                    value={rows}
                    onChange={(nextRows) => {
                        setRows(nextRows)
                        handleChange(nextRows)
                    }}
                    locale='ru'
                    childFields={[
                        {
                            id: 'resourceName',
                            label: 'Name',
                            type: 'STRING',
                            required: true,
                            validationRules: {
                                localized: true,
                                versioned: true,
                                maxLength: 100
                            }
                        }
                    ]}
                />
            )
        }

        render(<Wrapper />)

        await user.click(screen.getByRole('button', { name: 'Add Row' }))
        await user.type(screen.getByRole('textbox'), 'Сахар')

        const latestRows = handleChange.mock.calls.at(-1)?.[0] as Array<Record<string, unknown>>
        expect(Array.isArray(latestRows)).toBe(true)
        expect(latestRows).toHaveLength(1)
        expect(latestRows[0].resourceName).toMatchObject({
            _schema: '1',
            _primary: 'ru',
            locales: {
                ru: {
                    content: 'Сахар',
                    version: 1,
                    isActive: true
                }
            }
        })
    })
})
