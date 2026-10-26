import { z } from 'zod'
import { uuidV7Schema } from '@universo-react/types'
import { buildRuntimeApiUrl, fetchWithCsrf, parseRuntimeResponse } from '../../../../api/client'

const favoriteTargetSchema = z
    .object({
        interpretationId: uuidV7Schema,
        cellId: uuidV7Schema
    })
    .strict()

const favoriteCellPathItemSchema = z
    .object({
        label: z.string(),
        rowLabel: z.string().nullable(),
        columnLabel: z.string().nullable(),
        cellValue: z.string().nullable()
    })
    .strict()

const favoriteListCommonSchema = z.object({
    favoriteId: uuidV7Schema,
    structureName: z.string().nullable(),
    interpretationTitle: z.string().nullable(),
    cellPath: z.array(favoriteCellPathItemSchema),
    addedAt: z.string().nullable()
})

export const interpretationNetworkFavoriteListItemSchema = z.discriminatedUnion('availability', [
    favoriteListCommonSchema.extend({
        target: favoriteTargetSchema,
        structureId: uuidV7Schema,
        availability: z.literal('available')
    }),
    favoriteListCommonSchema.extend({
        target: z.null(),
        structureId: z.null(),
        availability: z.literal('unavailable')
    })
])

export const interpretationNetworkFavoritesPageSchema = z
    .object({
        items: z.array(interpretationNetworkFavoriteListItemSchema),
        hasMore: z.boolean()
    })
    .strict()

export const interpretationNetworkFavoriteAddResponseSchema = z
    .object({
        target: favoriteTargetSchema,
        created: z.boolean(),
        status: z.enum(['created', 'alreadyPresent'])
    })
    .strict()

export const interpretationNetworkFavoriteRemoveResponseSchema = z
    .object({
        favoriteId: uuidV7Schema,
        removed: z.boolean(),
        status: z.enum(['removed', 'alreadyAbsent'])
    })
    .strict()

export type InterpretationNetworkFavoriteListItem = z.infer<typeof interpretationNetworkFavoriteListItemSchema>
export type AvailableInterpretationNetworkFavorite = Extract<InterpretationNetworkFavoriteListItem, { availability: 'available' }>
export type InterpretationNetworkFavoriteTarget = z.infer<typeof favoriteTargetSchema>
export type InterpretationNetworkFavoritesPage = z.infer<typeof interpretationNetworkFavoritesPageSchema>

export type InterpretationNetworkFavoritesRequestOptions = {
    apiBaseUrl: string
    applicationId: string
    workspaceId?: string | null
    locale: string
    limit: number
    offset: number
}

type FavoriteMutationOptions = Pick<InterpretationNetworkFavoritesRequestOptions, 'apiBaseUrl' | 'applicationId' | 'workspaceId'>

const buildFavoritesUrl = ({ apiBaseUrl, applicationId, workspaceId }: FavoriteMutationOptions, locale?: string): string => {
    const url = new URL(buildRuntimeApiUrl(apiBaseUrl, applicationId, '/interpretation-network/favorites'))
    if (workspaceId) url.searchParams.set('workspaceId', workspaceId)
    if (locale) url.searchParams.set('locale', locale)
    return url.toString()
}

export async function fetchInterpretationNetworkFavorites(
    options: InterpretationNetworkFavoritesRequestOptions
): Promise<InterpretationNetworkFavoritesPage> {
    const response = await fetchWithCsrf(options.apiBaseUrl, buildFavoritesUrl(options, options.locale), {
        method: 'GET',
        credentials: 'include'
    })
    return parseRuntimeResponse(response, interpretationNetworkFavoritesPageSchema, 'Favorites request failed')
}

export async function addInterpretationNetworkFavorite(
    options: FavoriteMutationOptions,
    target: InterpretationNetworkFavoriteTarget
): Promise<z.infer<typeof interpretationNetworkFavoriteAddResponseSchema>> {
    const response = await fetchWithCsrf(options.apiBaseUrl, buildFavoritesUrl(options), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(target)
    })
    return parseRuntimeResponse(response, interpretationNetworkFavoriteAddResponseSchema, 'Favorite update failed')
}

export async function removeInterpretationNetworkFavorite(
    options: FavoriteMutationOptions,
    favoriteId: string
): Promise<z.infer<typeof interpretationNetworkFavoriteRemoveResponseSchema>> {
    const response = await fetchWithCsrf(options.apiBaseUrl, buildFavoritesUrl(options), {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favoriteId })
    })
    return parseRuntimeResponse(response, interpretationNetworkFavoriteRemoveResponseSchema, 'Favorite update failed')
}
