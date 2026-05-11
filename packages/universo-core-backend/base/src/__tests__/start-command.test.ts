import Start from '../commands/start'
import { BaseCommand } from '../commands/base'

describe('Start command', () => {
    it('does not define its own flags (inherits from BaseCommand)', () => {
        expect(Start.flags).toBe(BaseCommand.flags)
    })

    it('does not expose --reset-db flag', () => {
        const flagNames = Object.keys(Start.flags)
        expect(flagNames).not.toContain('reset-db')
    })
})
