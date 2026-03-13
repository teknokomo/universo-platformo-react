import {
    assertCanonicalPlatformScopeKey,
    assertCanonicalSchemaName,
    assertManagedCustomSchemaName,
    buildManagedDynamicSchemaName,
    quoteIdentifier,
    quoteQualifiedIdentifier,
    resolveSchemaTargetSchemaName
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

    it('builds managed dynamic schema names deterministically', () => {
        expect(buildManagedDynamicSchemaName({ prefix: 'app', ownerId: '019ccfad-de2d-7108-b32e-1de9e32359a4' })).toBe(
            'app_019ccfadde2d7108b32e1de9e32359a4'
        )
        expect(buildManagedDynamicSchemaName({ prefix: 'mhb', ownerId: '019ccefc2f7b7b3682f485cdb1312268', branchNumber: 1 })).toBe(
            'mhb_019ccefc2f7b7b3682f485cdb1312268_b1'
        )
    })

    it('rejects malformed managed owner ids instead of silently normalizing them', () => {
        expect(() => buildManagedDynamicSchemaName({ prefix: 'app', ownerId: 'owner-019ccfadde2d7108b32e1de9e32359a4' })).toThrow(
            'Managed schema ownerId must be a canonical UUID or a 32-character hexadecimal identifier'
        )
        expect(() => buildManagedDynamicSchemaName({ prefix: 'app', ownerId: 'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz' })).toThrow(
            'Managed schema ownerId must be a canonical UUID or a 32-character hexadecimal identifier'
        )
    })

    it('validates managed custom schema names separately from canonical names', () => {
        expect(() => assertManagedCustomSchemaName('custom_runtime')).not.toThrow()
        expect(() => assertManagedCustomSchemaName('metahubs')).toThrow('Invalid managed custom schema name')
        expect(() => assertManagedCustomSchemaName('bad-schema-name')).toThrow('Invalid managed custom schema name')
    })

    it('resolves schema target names for fixed, dynamic, and custom targets', () => {
        expect(resolveSchemaTargetSchemaName({ kind: 'fixed', schemaName: 'admin' })).toBe('admin')
        expect(resolveSchemaTargetSchemaName({ kind: 'managed_dynamic', prefix: 'app', ownerId: '019ccfadde2d7108b32e1de9e32359a4' })).toBe(
            'app_019ccfadde2d7108b32e1de9e32359a4'
        )
        expect(resolveSchemaTargetSchemaName({ kind: 'managed_custom', schemaName: 'custom_runtime' })).toBe('custom_runtime')
    })
})
