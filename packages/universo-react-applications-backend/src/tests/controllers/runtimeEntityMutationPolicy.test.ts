import {
    assertRuntimeEntityMutationAllowed,
    resolveValidatedRuntimeEntityRecordPolicy,
    validateRuntimeEntityRecordPolicy
} from '../../shared/entityMutationPolicy'

const allowedPolicy = {
    version: 1,
    denyDeleteWhenBound: false,
    immutableSemanticKeyWhenBound: false,
    runtimeMutation: 'allow'
}

const deniedPolicy = { ...allowedPolicy, runtimeMutation: 'deny' as const }
const captureFailure = (operation: () => void): unknown => {
    try {
        operation()
        return undefined
    } catch (error) {
        return error
    }
}

describe('runtime Entity mutation policy', () => {
    it.each([undefined, {}, { recordPolicy: allowedPolicy }])('allows absent or explicitly allowed policy: %j', (config) => {
        expect(() => assertRuntimeEntityMutationAllowed(config)).not.toThrow()
    })

    it('rejects denied policy with a stable forbidden code', () => {
        expect(captureFailure(() => assertRuntimeEntityMutationAllowed({ recordPolicy: deniedPolicy }))).toMatchObject({
            statusCode: 403,
            code: 'RUNTIME_ENTITY_MUTATION_DENIED'
        })
    })

    it('fails closed when persisted policy metadata is malformed', () => {
        expect(
            captureFailure(() => assertRuntimeEntityMutationAllowed({ recordPolicy: { version: 1, runtimeMutation: 'sometimes' } }))
        ).toMatchObject({
            statusCode: 409,
            code: 'RUNTIME_ENTITY_POLICY_INVALID'
        })
    })

    it('preserves a valid deny policy for trusted maintenance decisions without permitting runtime writes', () => {
        expect(resolveValidatedRuntimeEntityRecordPolicy({ recordPolicy: deniedPolicy })).toEqual(deniedPolicy)
        expect(() => assertRuntimeEntityMutationAllowed({ recordPolicy: deniedPolicy })).toThrow()
    })

    it('allows dedicated server-owned workflows to use valid protected Entities while rejecting malformed policy metadata', () => {
        const response = { status: jest.fn().mockReturnThis(), json: jest.fn() }

        expect(validateRuntimeEntityRecordPolicy(response as never, { recordPolicy: deniedPolicy })).toBe(false)
        expect(response.status).not.toHaveBeenCalled()

        expect(validateRuntimeEntityRecordPolicy(response as never, { recordPolicy: { version: 1, runtimeMutation: 'sometimes' } })).toBe(
            true
        )
        expect(response.status).toHaveBeenCalledWith(409)
        expect(response.json).toHaveBeenCalledWith({
            error: 'Entity runtime mutation policy is invalid.',
            code: 'RUNTIME_ENTITY_POLICY_INVALID'
        })
    })
})
