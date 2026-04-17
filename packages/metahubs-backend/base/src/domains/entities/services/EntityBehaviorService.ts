import type { ResolvedEntityType } from '@universo/types'
import type { DbExecutor } from '@universo/utils'

import type { EntityType } from '../../../utils/optimisticLock'
import type { MetahubFieldDefinitionsService } from '../../metahubs/services/MetahubFieldDefinitionsService'
import type { MetahubFixedValuesService } from '../../metahubs/services/MetahubFixedValuesService'
import type { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import type { MetahubSettingsService } from '../../settings/services/MetahubSettingsService'
import type { EntityTypeService } from './EntityTypeService'

export interface BehaviorPolicyOutcome {
    status: number
    body: Record<string, unknown>
}

export interface EntityBehaviorDeletePlan {
    policyOutcome: BehaviorPolicyOutcome | null
    beforeEntityDelete?: () => Promise<void>
}

export interface EntityBehaviorBlockingState {
    status: number
    body: Record<string, unknown>
}

export interface EntityBehaviorDeleteContext {
    metahubId: string
    entityId: string
    userId?: string
    exec: DbExecutor
    schemaService: MetahubSchemaService
    fieldDefinitionsService: MetahubFieldDefinitionsService
    fixedValuesService: MetahubFixedValuesService
    settingsService: MetahubSettingsService
    entityTypeService: EntityTypeService
    resolvedType: ResolvedEntityType
}

export interface EntityBehaviorService {
    kindKey: string
    entityLabel: string
    aclEntityType?: EntityType
    resolveGeneratedTableName?: (objectId: string) => string | null
    buildDeletePlan?: (context: EntityBehaviorDeleteContext) => Promise<EntityBehaviorDeletePlan>
    buildBlockingState?: (context: EntityBehaviorDeleteContext) => Promise<EntityBehaviorBlockingState>
}
