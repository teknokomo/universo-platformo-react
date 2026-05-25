import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CompletionStep } from '../../components/CompletionStep'

const translations: Record<string, string> = {
    'completion.imageAlt': 'Completion image',
    'completion.title': 'All set',
    'completion.message1': 'Message 1',
    'completion.message2': 'Message 2',
    'completion.noticeTitle': 'Notice',
    'completion.noticeAlpha': 'Alpha notice',
    'completion.noticeUpdates': 'Updates on',
    'completion.noticeUpdatesGitHub': 'GitHub',
    'completion.noticeUpdatesAnd': 'and',
    'completion.noticeUpdatesGitVerse': 'GitVerse',
    'completion.noticeTelegram': 'Telegram',
    'completion.noticeTelegramPlatformo': 'Platformo',
    'completion.noticeTelegramAnd': 'and',
    'completion.noticeTelegramDiverslaboristo': 'Diverslaboristo',
    'completion.noticeHelp': 'Help via',
    'completion.noticeHelpBoosty': 'Boosty',
    'completion.slogan': 'Start acting',
    'buttons.startOver': 'Start over',
    'buttons.startActing': 'Start acting'
}

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => translations[key] ?? key
    })
}))

describe('CompletionStep', () => {
    it('renders the restart action before the primary CTA and invokes both callbacks', () => {
        const onStartOver = vi.fn()
        const onPrimaryAction = vi.fn()

        render(<CompletionStep onStartOver={onStartOver} onPrimaryAction={onPrimaryAction} primaryActionLabel='Enter workspace' />)

        const buttons = screen.getAllByRole('button')

        expect(buttons).toHaveLength(2)
        expect(buttons[0]).toHaveTextContent('Start over')
        expect(buttons[1]).toHaveTextContent('Enter workspace')

        fireEvent.click(buttons[0])
        fireEvent.click(buttons[1])

        expect(onStartOver).toHaveBeenCalledTimes(1)
        expect(onPrimaryAction).toHaveBeenCalledTimes(1)
    })

    it('only renders the primary CTA when restart is unavailable and surfaces loading plus error state', () => {
        render(<CompletionStep onPrimaryAction={() => undefined} primaryActionLoading error='Sync failed' />)

        const buttons = screen.getAllByRole('button')

        expect(buttons).toHaveLength(1)
        expect(buttons[0]).toHaveTextContent('Start acting')
        expect(buttons[0]).toBeDisabled()
        expect(screen.getByText('Sync failed')).toBeInTheDocument()
        expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
})
