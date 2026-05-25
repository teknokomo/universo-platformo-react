import { describe, expect, it } from 'vitest'
import { buildSetLocalStatementTimeoutSql, formatStatementTimeoutLiteral } from '../statementTimeout'

describe('statementTimeout helpers', () => {
    it('formats a validated PostgreSQL timeout literal in milliseconds', () => {
        expect(formatStatementTimeoutLiteral(30000)).toBe('30000ms')
        expect(buildSetLocalStatementTimeoutSql(30000)).toBe("SET LOCAL statement_timeout TO '30000ms'")
    })

    it('rejects invalid timeout values', () => {
        expect(() => formatStatementTimeoutLiteral(0)).toThrow('Invalid statement_timeout value')
        expect(() => formatStatementTimeoutLiteral(-1)).toThrow('Invalid statement_timeout value')
        expect(() => formatStatementTimeoutLiteral(300001)).toThrow('Invalid statement_timeout value')
        expect(() => formatStatementTimeoutLiteral(12.5)).toThrow('Invalid statement_timeout value')
        expect(() => formatStatementTimeoutLiteral(Number.NaN)).toThrow('Invalid statement_timeout value')
    })
})
