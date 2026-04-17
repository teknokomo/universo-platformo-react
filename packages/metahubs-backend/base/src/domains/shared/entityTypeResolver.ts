import type { EntityKind, ResolvedEntityType } from '@universo/types'
import type { EntityTypeService } from '../entities/services/EntityTypeService'

interface ResolveEntityTypeOptions {
    metahubId?: string
    userId?: string
}

export class EntityTypeResolver {
    private readonly resolveCache = new Map<string, Promise<ResolvedEntityType | null>>()

    constructor(private readonly entityTypeService?: Pick<EntityTypeService, 'resolveType'>) {}

    async resolve(kind: EntityKind | string, options?: ResolveEntityTypeOptions): Promise<ResolvedEntityType | null> {
        const normalizedKind = String(kind).trim()
        if (!options?.metahubId || !this.entityTypeService) {
            return null
        }

        const cacheKey = `${options.metahubId}::${options.userId ?? ''}::${normalizedKind}`
        const cached = this.resolveCache.get(cacheKey)
        if (cached) {
            return cached
        }

        const pending = this.entityTypeService
            .resolveType(options.metahubId, normalizedKind, options.userId)
            .then((resolved) => resolved ?? null)
            .catch((error) => {
                this.resolveCache.delete(cacheKey)
                throw error
            })

        this.resolveCache.set(cacheKey, pending)
        return pending
    }

    async resolveOrThrow(kind: EntityKind | string, options?: ResolveEntityTypeOptions): Promise<ResolvedEntityType> {
        const resolved = await this.resolve(kind, options)

        if (!resolved) {
            throw new Error(`Unknown entity kind: ${kind}`)
        }

        return resolved
    }

    async isComponentEnabled(
        kind: EntityKind | string,
        componentKey: keyof ResolvedEntityType['components'],
        options?: ResolveEntityTypeOptions
    ): Promise<boolean> {
        const resolved = await this.resolve(kind, options)
        const component = resolved?.components[componentKey]

        return Boolean(component && typeof component === 'object' && component.enabled)
    }
}
