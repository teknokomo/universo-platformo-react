import type { QueryClient } from '@tanstack/react-query'
import type {
    ListGlobalShortLinksInput,
    ListGlobalShortLinkQuizAccessOptionsInput,
    ListGlobalShortLinkResourceOptionsInput
} from './globalShortLinksApi'

export const globalShortLinksQueryKeys = {
    all: ['global-short-links'] as const,
    lists: () => [...globalShortLinksQueryKeys.all, 'list'] as const,
    listsForApplication: (applicationId: string) => [...globalShortLinksQueryKeys.lists(), { applicationId }] as const,
    list: (input: ListGlobalShortLinksInput) => [...globalShortLinksQueryKeys.lists(), input] as const,
    quizAccessOptions: (input: ListGlobalShortLinkQuizAccessOptionsInput) =>
        [...globalShortLinksQueryKeys.all, 'quiz-access-options', input] as const,
    resourceOptions: (input: ListGlobalShortLinkResourceOptionsInput) =>
        [...globalShortLinksQueryKeys.all, 'application-resource-options', input] as const
}

export const invalidateGlobalShortLinks = async (queryClient: QueryClient, applicationId: string) =>
    queryClient.invalidateQueries({
        queryKey: globalShortLinksQueryKeys.listsForApplication(applicationId)
    })
