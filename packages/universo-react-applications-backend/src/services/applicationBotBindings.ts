import type { ApplicationBotBinding } from '@universo-react/types'
import { database, type DbExecutor } from '@universo-react/utils'
import {
    createApplicationBotBindingInTransaction,
    findApplicationBotBindingById,
    listApplicationBotBindings,
    releaseApplicationBotBindingInTransaction,
    resolveMessengerBindingAttribution,
    updateApplicationBotBindingInTransaction,
    type ApplicationBotBindingRecord,
    type CreateApplicationBotBindingInput,
    type UpdateApplicationBotBindingInput
} from '../persistence/applicationBotBindingsStore'
import type { MessengerBotPlatform } from '../shared/messengerBotBindingIdentity'
import { InvalidMessengerBotUsernameError, normalizeMessengerBotUsername } from './messengerBotBindingIdentity'
import { PublicApplicationUnavailableError, resolvePublicApplication } from './publicApplicationRuntime'

export { InvalidMessengerBotUsernameError }

export type ApplicationBotBindingDto = ApplicationBotBinding

export class ApplicationBotBindingIdentityConflictError extends Error {
    constructor() {
        super('A binding for this bot already exists in the application')
        this.name = 'ApplicationBotBindingIdentityConflictError'
    }
}

export class ApplicationBotBindingApplicationNotFoundError extends Error {
    constructor() {
        super('Application not found')
        this.name = 'ApplicationBotBindingApplicationNotFoundError'
    }
}

const toIsoString = (value: Date | string): string => {
    const date = value instanceof Date ? value : new Date(value)
    if (!Number.isFinite(date.getTime())) throw new Error('Invalid application bot binding timestamp')
    return date.toISOString()
}

const toApplicationBotBindingDto = (binding: ApplicationBotBindingRecord): ApplicationBotBindingDto => ({
    id: binding.id,
    applicationId: binding.applicationId,
    platform: binding.platform,
    botUsername: binding.botUsername,
    displayName: binding.displayName,
    status: binding.status,
    shortId: binding.shortId,
    releasedAt: binding.releasedAt ? toIsoString(binding.releasedAt) : null,
    version: binding.version,
    createdAt: toIsoString(binding.createdAt),
    updatedAt: toIsoString(binding.updatedAt)
})

const withPersistenceErrorMapping = async <T>(work: () => Promise<T>): Promise<T> => {
    try {
        return await work()
    } catch (error) {
        if (database.isUniqueViolation(error) && database.getDbErrorConstraint(error) === 'uq_application_bot_bindings_identity') {
            throw new ApplicationBotBindingIdentityConflictError()
        }
        if (error instanceof Error && error.message === 'Application was not found or is already deleted') {
            throw new ApplicationBotBindingApplicationNotFoundError()
        }
        throw error
    }
}

export function createApplicationBotBindingsService(executor: DbExecutor) {
    return {
        async list(applicationId: string): Promise<ApplicationBotBindingDto[]> {
            const bindings = await listApplicationBotBindings(executor, applicationId)
            return bindings.map(toApplicationBotBindingDto)
        },

        async create(input: CreateApplicationBotBindingInput): Promise<ApplicationBotBindingDto> {
            const botUsername = normalizeMessengerBotUsername(input.platform, input.botUsername)
            const binding = await withPersistenceErrorMapping(() =>
                createApplicationBotBindingInTransaction(executor, { ...input, botUsername })
            )
            return toApplicationBotBindingDto(binding)
        },

        async update(input: UpdateApplicationBotBindingInput): Promise<ApplicationBotBindingDto | null> {
            const existing = await findApplicationBotBindingById(executor, input.applicationId, input.bindingId)
            if (!existing) return null

            const botUsername =
                input.botUsername === undefined ? undefined : normalizeMessengerBotUsername(existing.platform, input.botUsername)
            const updated = await withPersistenceErrorMapping(() =>
                updateApplicationBotBindingInTransaction(executor, { ...input, botUsername })
            )
            return updated ? toApplicationBotBindingDto(updated) : null
        },

        async release(input: {
            applicationId: string
            bindingId: string
            expectedVersion: number
        }): Promise<ApplicationBotBindingDto | null> {
            const released = await withPersistenceErrorMapping(() => releaseApplicationBotBindingInTransaction(executor, input))
            return released ? toApplicationBotBindingDto(released) : null
        },

        async resolvePublicAttribution(applicationRef: string, shortId: string): Promise<MessengerBotPlatform | null> {
            try {
                const application = await resolvePublicApplication(executor, applicationRef)
                const attribution = await resolveMessengerBindingAttribution(executor, application.application.id, shortId)
                return attribution?.platform ?? null
            } catch (error) {
                if (error instanceof PublicApplicationUnavailableError) return null
                throw error
            }
        }
    }
}
