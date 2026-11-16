import { resolveEntityRecordPolicy } from '@universo-react/types'
import type { Response } from 'express'
import { UpdateFailure } from './updateFailure'

export const RUNTIME_ENTITY_MUTATION_POLICY_CODES = {
    denied: 'RUNTIME_ENTITY_MUTATION_DENIED',
    invalid: 'RUNTIME_ENTITY_POLICY_INVALID'
} as const

export const RUNTIME_LEDGER_REGISTER_POLICY_CODES = {
    forbidden: 'LEDGER_ROWS_API_FORBIDDEN'
} as const

type RuntimeEntityMutationPolicyFailure = {
    statusCode: 403 | 409
    code:
        | (typeof RUNTIME_ENTITY_MUTATION_POLICY_CODES)[keyof typeof RUNTIME_ENTITY_MUTATION_POLICY_CODES]
        | (typeof RUNTIME_LEDGER_REGISTER_POLICY_CODES)[keyof typeof RUNTIME_LEDGER_REGISTER_POLICY_CODES]
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

/** Apply an Entity's persisted mutation policy to the runtime's effective UI capabilities. */
export const restrictRuntimeEntityMutationPermissions = <
    T extends {
        createContent: boolean
        editContent: boolean
        deleteContent: boolean
    }
>(
    permissions: T,
    config: unknown
): T => {
    try {
        const policy = resolveEntityRecordPolicy(config)
        if (policy?.runtimeMutation !== 'deny') return permissions
    } catch {
        // Invalid policy metadata must never leave mutation controls enabled.
    }

    return {
        ...permissions,
        createContent: false,
        editContent: false,
        deleteContent: false
    }
}

const resolveRuntimeEntityMutationPolicyFailure = (config: unknown): RuntimeEntityMutationPolicyFailure | null => {
    // Ledger-register entities are checked first (Phase H): their fact rows are
    // registrar-managed and must only be written through the ledger API, which
    // enforces source policy, fact validation and idempotency.
    if (isLedgerRegisterEntityConfig(config)) return LEDGER_REGISTER_MUTATION_FAILURE
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

/** Validate policy metadata without blocking an explicitly authorized server-owned workflow. */
export const validateRuntimeEntityRecordPolicy = (res: Response, config: unknown): boolean => {
    try {
        resolveEntityRecordPolicy(config)
        return false
    } catch {
        res.status(409).json({
            error: 'Entity runtime mutation policy is invalid.',
            code: RUNTIME_ENTITY_MUTATION_POLICY_CODES.invalid
        })
        return true
    }
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

// ---------------------------------------------------------------------------
// Ledger-register row-surface policy (Phase H): ledger-register entities are
// registrar-managed surfaces — their fact rows are only addressable through
// the dedicated ledger API, which enforces source policy, fact validation and
// idempotency. The generic runtime rows API must never become a side door:
// reads require the application report privilege, writes are always rejected.
// ---------------------------------------------------------------------------

/**
 * Mirrors the ledger service's own register condition
 * (`LEDGER_CAPABILITY_CONDITION`): ledgerSchema + dataSchema + physicalTable
 * all enabled AND a `config.ledger` object. Merely toggling the ledger
 * capability on an entity (the metahub UI default block) does not make it a
 * register — the posting document entities carry the toggle too.
 */
export const isLedgerRegisterEntityConfig = (config: unknown): boolean => {
    if (!config || typeof config !== 'object' || Array.isArray(config)) return false
    const capabilities = (config as { capabilities?: unknown }).capabilities
    if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) return false
    const caps = capabilities as {
        ledgerSchema?: { enabled?: unknown }
        dataSchema?: { enabled?: unknown }
        physicalTable?: { enabled?: unknown }
    }
    if (caps.ledgerSchema?.enabled !== true || caps.dataSchema?.enabled !== true || caps.physicalTable?.enabled !== true) {
        return false
    }
    const ledger = (config as { ledger?: unknown }).ledger
    return typeof ledger === 'object' && ledger !== null && !Array.isArray(ledger)
}

const LEDGER_REGISTER_READ_FAILURE = {
    statusCode: 403 as const,
    error: 'Ledger register rows are readable only through the ledger API by report-privileged members.',
    code: RUNTIME_LEDGER_REGISTER_POLICY_CODES.forbidden
}

const LEDGER_REGISTER_MUTATION_FAILURE = {
    statusCode: 403 as const,
    error: 'Ledger register facts must be written through the ledger API.',
    code: RUNTIME_LEDGER_REGISTER_POLICY_CODES.forbidden
}

/** Generic rows API reads of ledger registers require the application report privilege. */
export const denyRuntimeLedgerRegisterRead = (
    res: Response,
    config: unknown,
    permissions: { readReports?: boolean } | undefined
): boolean => {
    if (!isLedgerRegisterEntityConfig(config) || permissions?.readReports === true) return false
    res.status(LEDGER_REGISTER_READ_FAILURE.statusCode).json({
        error: LEDGER_REGISTER_READ_FAILURE.error,
        code: LEDGER_REGISTER_READ_FAILURE.code
    })
    return true
}

/** Generic rows API mutations of ledger registers are always forbidden (even for admins). */
export const denyRuntimeLedgerRegisterMutation = (res: Response, config: unknown): boolean => {
    if (!isLedgerRegisterEntityConfig(config)) return false
    res.status(LEDGER_REGISTER_MUTATION_FAILURE.statusCode).json({
        error: LEDGER_REGISTER_MUTATION_FAILURE.error,
        code: LEDGER_REGISTER_MUTATION_FAILURE.code
    })
    return true
}

/** Service-level variant of {@link denyRuntimeLedgerRegisterRead}. */
export const assertRuntimeLedgerRegisterReadAllowed = (config: unknown, permissions: { readReports?: boolean } | undefined): void => {
    if (!isLedgerRegisterEntityConfig(config) || permissions?.readReports === true) return
    throw new UpdateFailure(LEDGER_REGISTER_READ_FAILURE.statusCode, {
        error: LEDGER_REGISTER_READ_FAILURE.error,
        code: LEDGER_REGISTER_READ_FAILURE.code
    })
}

/** Service-level variant of {@link denyRuntimeLedgerRegisterMutation}. */
export const assertRuntimeLedgerRegisterMutationAllowed = (config: unknown): void => {
    if (!isLedgerRegisterEntityConfig(config)) return
    throw new UpdateFailure(LEDGER_REGISTER_MUTATION_FAILURE.statusCode, {
        error: LEDGER_REGISTER_MUTATION_FAILURE.error,
        code: LEDGER_REGISTER_MUTATION_FAILURE.code
    })
}
