import { IDENTIFIER_REGEX, quoteIdentifier } from '../../shared/runtimeSqlIdentifiers'

describe('runtime SQL identifier validation', () => {
    it('quotes valid metadata identifiers as PostgreSQL identifiers', () => {
        expect(quoteIdentifier('content_records')).toBe('"content_records"')
        expect(IDENTIFIER_REGEX.test('content_records')).toBe(true)
    })

    it.each(['Users', 'users.records', 'users"; DROP TABLE records; --', 'user-name', '1records'])(
        'rejects unsafe identifier %s before SQL interpolation',
        (identifier) => {
            expect(() => quoteIdentifier(identifier)).toThrow('Unsafe identifier')
            expect(IDENTIFIER_REGEX.test(identifier)).toBe(false)
        }
    )
})
