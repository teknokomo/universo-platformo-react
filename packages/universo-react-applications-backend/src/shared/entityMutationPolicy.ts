import { resolveEntityRecordPolicy } from '@universo-react/types'
import type { Response } from 'express'
import { UpdateFailure } from './updateFailure'

export const RUNTIME_ENTITY_MUTATION_POLICY_CODES = {
    denied: 'RUNTIME_ENTITY_MUTATION_DENIED',
    invalid: 'RUNTIME_ENTITY_POLICY_INVALID'
} as const

type RuntimeEntityMutationPolicyFailure = {
    statusCode: 403 | 409
    code: (typeof RUNTIME_ENTITY_MUTATION_POLICY_CODES)[keyof typeof RUNTIME_ENTITY_MUTATION_POLICY_CODES]
    error: string
}

export class RuntimeEntityMutationPolicyError extends UpdateFailure {
    readonly code: RuntimeEntityMutationPolicyFailure['code']

    constructor(failure: RuntimeEntityMutationPolicyFailure) {
        super(failure.statusCode, { error: failure.error, code: failure.code })
        this.name = 'RuntimeEntityMutationPolicyError'
        this.code = failure.code
    }
}

/** Parse persisted policy metadata without granting the Entity runtime write permission. */
export const resolveValidatedRuntimeEntityRecordPolicy = (config: unknown) => {
    try {
        return resolveEntityRecordPolicy(config)
    } catch {
        throw new RuntimeEntityMutationPolicyError({
            statusCode: 409,
            code: RUNTIME_ENTITY_MUTATION_POLICY_CODES.invalid,
            error: 'Entity runtime mutation policy is invalid.'
        })
    }
}

const resolveRuntimeEntityMutationPolicyFailure = (config: unknown): RuntimeEntityMutationPolicyFailure | null => {
    try {
        const policy = resolveEntityRecordPolicy(config)
        if (policy?.runtimeMutation !== 'deny') return null

        return {
            statusCode: 403,
            code: RUNTIME_ENTITY_MUTATION_POLICY_CODES.denied,
            error: 'Runtime mutation is disabled for this Entity.'
        }
    } catch {
        return {
            statusCode: 409,
            code: RUNTIME_ENTITY_MUTATION_POLICY_CODES.invalid,
            error: 'Entity runtime mutation policy is invalid.'
        }
    }
}

/** Send a stable fail-closed response for a mutation of a policy-protected Entity. */
export const denyRuntimeEntityMutation = (res: Response, config: unknown): boolean => {
    const failure = resolveRuntimeEntityMutationPolicyFailure(config)
    if (!failure) return false
    res.status(failure.statusCode).json({ error: failure.error, code: failure.code })
    return true
}

/** Throw the same policy failure from service and transactional mutation boundaries. */
export const assertRuntimeEntityMutationAllowed = (config: unknown): void => {
    const failure = resolveRuntimeEntityMutationPolicyFailure(config)
    if (failure) throw new RuntimeEntityMutationPolicyError(failure)
}

export const sendRuntimeEntityMutationPolicyError = (res: Response, error: unknown): boolean => {
    if (!(error instanceof RuntimeEntityMutationPolicyError)) return false
    res.status(error.statusCode).json(error.body)
    return true
}
