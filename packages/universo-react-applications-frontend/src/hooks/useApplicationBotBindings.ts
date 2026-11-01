import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { applicationsQueryKeys } from '../api/queryKeys'
import {
    createApplicationBotBinding,
    listApplicationBotBindings,
    releaseApplicationBotBinding,
    updateApplicationBotBinding,
    type CreateApplicationBotBindingInput,
    type UpdateApplicationBotBindingInput
} from '../api/applicationBotBindings'

export const useApplicationBotBindings = (applicationId: string, enabled = true) =>
    useQuery({
        queryKey: applicationsQueryKeys.botBindingsList(applicationId),
        queryFn: () => listApplicationBotBindings(applicationId),
        enabled: Boolean(applicationId) && enabled
    })

export const useCreateApplicationBotBinding = (applicationId: string) => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationKey: ['applications', applicationId, 'bot-bindings', 'create'],
        mutationFn: (input: CreateApplicationBotBindingInput) => createApplicationBotBinding(applicationId, input),
        onSuccess: async (binding) => {
            queryClient.setQueryData(applicationsQueryKeys.botBindingDetail(applicationId, binding.id), binding)
            await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.botBindings(applicationId) })
        }
    })
}

export const useUpdateApplicationBotBinding = (applicationId: string) => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationKey: ['applications', applicationId, 'bot-bindings', 'update'],
        mutationFn: ({ bindingId, data }: { bindingId: string; data: UpdateApplicationBotBindingInput }) =>
            updateApplicationBotBinding(applicationId, bindingId, data),
        onSuccess: async (binding) => {
            queryClient.setQueryData(applicationsQueryKeys.botBindingDetail(applicationId, binding.id), binding)
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.botBindingsList(applicationId) }),
                queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.botBindingDetail(applicationId, binding.id) })
            ])
        }
    })
}

export const useReleaseApplicationBotBinding = (applicationId: string) => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationKey: ['applications', applicationId, 'bot-bindings', 'release'],
        mutationFn: ({ bindingId, expectedVersion }: { bindingId: string; expectedVersion: number }) =>
            releaseApplicationBotBinding(applicationId, bindingId, expectedVersion),
        onSuccess: async (_result, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.botBindingsList(applicationId) }),
                queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.botBindingDetail(applicationId, variables.bindingId) })
            ])
        }
    })
}
