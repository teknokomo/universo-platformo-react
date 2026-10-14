import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@universo-react/i18n'
import { isUuidV7 } from '@universo-react/utils'
import '../../../../../../i18n'
import { AssessmentOptionsEditorDialog } from '../AssessmentOptionsEditorDialog'

const validOptionId = '0190a9b5-3cde-7abc-8def-0123456789ab'
const uuidV4 = '550e8400-e29b-41d4-a716-446655440000'

describe('metahub assessment option editor', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('en')
    })

    it('normalizes legacy, non-v7, and duplicate option IDs while preserving a valid unique UUID v7', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()

        render(
            <AssessmentOptionsEditorDialog
                open
                value={[
                    { id: validOptionId, label: 'First', isCorrect: true },
                    { id: uuidV4, label: 'Second', isCorrect: false },
                    { id: 'legacy-option-id', label: 'Third', isCorrect: false },
                    { id: validOptionId, label: 'Fourth', isCorrect: false }
                ]}
                locale='en'
                minOptions={4}
                maxOptions={4}
                onClose={vi.fn()}
                onSave={onSave}
            />
        )

        const dialog = screen.getByRole('dialog', { name: 'Answer options' })
        await user.click(within(dialog).getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
        const saved = onSave.mock.calls[0]?.[0] as Array<{ id: string }>
        const savedIds = saved.map(({ id }) => id)

        expect(savedIds[0]).toBe(validOptionId)
        expect(savedIds[1]).not.toBe(uuidV4)
        expect(savedIds[2]).not.toBe('legacy-option-id')
        expect(savedIds[3]).not.toBe(validOptionId)
        expect(savedIds.every(isUuidV7)).toBe(true)
        expect(new Set(savedIds.map((id) => id.toLowerCase())).size).toBe(savedIds.length)
    })
})
