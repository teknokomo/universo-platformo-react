type SnapshotEntity = {
    id?: unknown
    kind?: unknown
    config?: unknown
    hubs?: unknown
    codename?: {
        locales?: Record<string, { content?: unknown } | undefined>
    }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const readEntityLabel = (entity: SnapshotEntity, uuid: string): string => {
    const englishCodename = entity.codename?.locales?.en?.content
    if (typeof entity.kind !== 'string' || typeof englishCodename !== 'string' || englishCodename.length === 0) {
        throw new Error(`MMOOMM app fixture entity ${uuid} is missing its kind or English codename`)
    }

    if (typeof entity.id !== 'string' || entity.id.toLowerCase() !== uuid.toLowerCase()) {
        throw new Error(`MMOOMM app fixture entity key ${uuid} does not match its id`)
    }

    return englishCodename
}

// Regenerated IDs must not define order; type, codename, and scope identify each entity.
export const seedSnapshotEntityUuidTokens = (
    entities: Record<string, unknown>,
    uuidMap: Map<string, string>,
    assignToken: (uuid: string) => void
): void => {
    const entityEntries = Object.entries(entities).map(([uuid, value]) => {
        if (!UUID_PATTERN.test(uuid) || !value || typeof value !== 'object' || Array.isArray(value)) {
            throw new Error(`MMOOMM app fixture contains an invalid snapshot entity entry: ${uuid}`)
        }

        return {
            uuid: uuid.toLowerCase(),
            entity: value as SnapshotEntity
        }
    })

    const entitiesById = new Map(entityEntries.map(({ uuid, entity }) => [uuid, entity]))
    const identityCache = new Map<string, string>()
    const getIdentity = (uuid: string, ancestry = new Set<string>()): string => {
        const normalizedUuid = uuid.toLowerCase()
        if (ancestry.has(normalizedUuid)) {
            throw new Error(`MMOOMM app fixture entity scopes contain a cycle at ${uuid}`)
        }
        const cachedIdentity = identityCache.get(normalizedUuid)
        if (cachedIdentity) return cachedIdentity

        const entity = entitiesById.get(normalizedUuid)
        if (!entity) {
            throw new Error(`MMOOMM app fixture entity scope references an unknown entity: ${uuid}`)
        }

        const nextAncestry = new Set(ancestry)
        nextAncestry.add(normalizedUuid)
        const englishCodename = readEntityLabel(entity, uuid)
        if (entity.config !== undefined && entity.config !== null && (typeof entity.config !== 'object' || Array.isArray(entity.config))) {
            throw new Error(`MMOOMM app fixture entity ${uuid} has an invalid config`)
        }
        const config = (entity.config ?? {}) as Record<string, unknown>
        const parentTreeEntityId = config.parentTreeEntityId
        if (parentTreeEntityId !== undefined && parentTreeEntityId !== null && typeof parentTreeEntityId !== 'string') {
            throw new Error(`MMOOMM app fixture entity ${uuid} has an invalid parentTreeEntityId`)
        }

        const parentIdentity = typeof parentTreeEntityId === 'string' ? getIdentity(parentTreeEntityId, nextAncestry) : null
        if (entity.hubs !== undefined && !Array.isArray(entity.hubs)) {
            throw new Error(`MMOOMM app fixture entity ${uuid} has an invalid hubs scope`)
        }
        const hubIds = (entity.hubs ?? []) as unknown[]
        const hubIdentities = hubIds.map((hubId) => {
            if (typeof hubId !== 'string') {
                throw new Error(`MMOOMM app fixture entity ${uuid} has an invalid hub reference`)
            }
            return getIdentity(hubId, nextAncestry)
        })
        hubIdentities.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))

        const identity = JSON.stringify([entity.kind, englishCodename, parentIdentity, hubIdentities])
        identityCache.set(normalizedUuid, identity)
        return identity
    }

    const identifiedEntities = entityEntries.map(({ uuid }) => ({ uuid, identity: getIdentity(uuid) }))
    identifiedEntities.sort((left, right) => (left.identity < right.identity ? -1 : left.identity > right.identity ? 1 : 0))

    for (let index = 0; index < identifiedEntities.length; index += 1) {
        const { uuid, identity } = identifiedEntities[index]
        if (index > 0 && identifiedEntities[index - 1].identity === identity) {
            throw new Error(`MMOOMM app fixture entities have duplicate semantic identity: ${identity}`)
        }

        if (!uuidMap.has(uuid)) {
            assignToken(uuid)
        }
    }
}
