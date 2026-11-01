import {
    applicationBotBindingApiResponseSchema,
    applicationBotBindingListResponseSchema,
    type ApplicationBotBinding,
    type CreateApplicationBotBindingInput,
    type UpdateApplicationBotBindingInput
} from '@universo-react/types'
import apiClient from './apiClient'

export type {
    ApplicationBotBinding,
    ApplicationBotBindingStatus,
    ApplicationBotPlatform,
    CreateApplicationBotBindingInput,
    UpdateApplicationBotBindingInput
} from '@universo-react/types'

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const parseBinding = (value: unknown): ApplicationBotBinding => {
    const result = applicationBotBindingApiResponseSchema.safeParse(value)
    if (!result.success) throw new Error('APPLICATION_BOT_BINDING_RESPONSE_INVALID')
    return result.data
}

export const listApplicationBotBindings = async (applicationId: string): Promise<ApplicationBotBinding[]> => {
    const response = await apiClient.get<unknown>(`/applications/${encodeURIComponent(applicationId)}/bot-bindings`)
    const result = applicationBotBindingListResponseSchema.safeParse(response.data)
    if (!result.success) throw new Error('APPLICATION_BOT_BINDING_RESPONSE_INVALID')
    return result.data.items
}

export const createApplicationBotBinding = async (
    applicationId: string,
    input: CreateApplicationBotBindingInput
): Promise<ApplicationBotBinding> => {
    const response = await apiClient.post<unknown>(`/applications/${encodeURIComponent(applicationId)}/bot-bindings`, input)
    return parseBinding(response.data)
}

export const updateApplicationBotBinding = async (
    applicationId: string,
    bindingId: string,
    input: UpdateApplicationBotBindingInput
): Promise<ApplicationBotBinding> => {
    const response = await apiClient.patch<unknown>(
        `/applications/${encodeURIComponent(applicationId)}/bot-bindings/${encodeURIComponent(bindingId)}`,
        input
    )
    return parseBinding(response.data)
}

export const releaseApplicationBotBinding = async (applicationId: string, bindingId: string, expectedVersion: number): Promise<void> => {
    await apiClient.delete(`/applications/${encodeURIComponent(applicationId)}/bot-bindings/${encodeURIComponent(bindingId)}`, {
        data: { expectedVersion }
    })
}

export const getApplicationBotBindingErrorCode = (error: unknown): string | null => {
    if (!isRecord(error) || !isRecord(error.response) || !isRecord(error.response.data)) return null
    const code = error.response.data.code
    return typeof code === 'string' && code.trim() ? code.trim() : null
}
