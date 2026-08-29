jest.mock('../index', () => ({
    start: jest.fn(),
    getInstance: jest.fn()
}))

jest.mock('@universo-react/database', () => ({
    initKnex: jest.fn()
}))

import Start from '../commands/start'
import { BaseCommand } from '../commands/baseCommand'

describe('Start command', () => {
    it('does not define its own flags (inherits from BaseCommand)', () => {
        expect(Start.flags).toBe(BaseCommand.flags)
    })

    it('does not expose --reset-db flag', () => {
        const flagNames = Object.keys(Start.flags)
        expect(flagNames).not.toContain('reset-db')
    })
})
