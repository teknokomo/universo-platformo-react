import type { EntityBehaviorService } from './EntityBehaviorService'

const behaviorServices = new Map<string, EntityBehaviorService>()

export const registerBehavior = (service: EntityBehaviorService): void => {
    behaviorServices.set(service.kindKey, service)
}

export const getBehaviorService = (kindKey: string): EntityBehaviorService | null => behaviorServices.get(kindKey) ?? null

export const clearBehaviorRegistry = (): void => {
    behaviorServices.clear()
}
