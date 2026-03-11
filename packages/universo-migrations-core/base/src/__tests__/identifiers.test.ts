import {
    assertCanonicalPlatformScopeKey,
    assertCanonicalSchemaName,
    quoteIdentifier,
    quoteQualifiedIdentifier
} from '../identifiers'

describe('migrations-core identifiers', () => {
    it('accepts fixed and dynamic schema names', () => {
        expect(() => assertCanonicalSchemaName('metahubs')).not.toThrow()
        expect(() => assertCanonicalSchemaName('mhb_019ccefc2f7b7b3682f485cdb1312268_b1')).not.toThrow()
        expect(() => assertCanonicalSchemaName('app_019ccfadde2d7108b32e1de9e32359a4')).not.toThrow()
    })

    it('rejects invalid schema names', () => {
        expect(() => assertCanonicalSchemaName('bad-schema-name')).toThrow('Invalid schema name')
        expect(() => assertCanonicalSchemaName('customschema')).toThrow('Invalid schema name')
        expect(() => assertCanonicalSchemaName('')).toThrow('Invalid schema name')
    })

    it('accepts synthetic platform scope keys that are not physical schemas', () => {
        expect(() => assertCanonicalPlatformScopeKey('cross_schema')).not.toThrow()
        expect(() => assertCanonicalSchemaName('cross_schema')).toThrow('Invalid schema name')
    })

    it('quotes identifiers and qualified names safely', () => {
        expect(quoteIdentifier('metahubs')).toBe('"metahubs"')
        expect(quoteQualifiedIdentifier('metahubs', 'publications_versions')).toBe('"metahubs"."publications_versions"')
    })
})
