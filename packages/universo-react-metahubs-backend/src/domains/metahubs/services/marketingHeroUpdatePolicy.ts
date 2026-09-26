import type { EntityRecordPolicy } from '@universo-react/types'
import type { SqlQueryable } from '@universo-react/utils/database'
import { MetahubValidationError } from '../../shared/domainErrors'
import { assertMarketingHeroRecordActionsRemainValid } from '../../layouts/marketingHeroActionIntegrityStore'
import { projectMarketingHeroContentData } from '../../layouts/marketingHeroBindingsStore'

type AssertMarketingHeroUpdateActionsInput = {
    db: SqlQueryable
    schemaName: string
    objectCodename?: string
    semanticKey: EntityRecordPolicy['semanticKey']
    recordData: Record<string, unknown>
    normalizedRecordData: Record<string, unknown>
}

/** Preserve action targets when a bound Hero Entity record is edited. */
export const assertMarketingHeroUpdateActionsRemainValid = async ({
    db,
    schemaName,
    objectCodename,
    semanticKey: semanticKeyDefinition,
    recordData,
    normalizedRecordData
}: AssertMarketingHeroUpdateActionsInput): Promise<void> => {
    if (
        typeof objectCodename !== 'string' ||
        !semanticKeyDefinition ||
        semanticKeyDefinition.componentCodename !== 'HeroKey' ||
        semanticKeyDefinition.creationPrefix !== 'hero' ||
        semanticKeyDefinition.protectedValues.length !== 1 ||
        semanticKeyDefinition.protectedValues[0] !== 'default'
    )
        return

    const semanticKeyField = semanticKeyDefinition.componentCodename
    const semanticKey = recordData[semanticKeyField]
    if (typeof semanticKey !== 'string' || semanticKey.length === 0) {
        throw new MetahubValidationError('Hero content record has an invalid semantic key')
    }

    await assertMarketingHeroRecordActionsRemainValid(
        db,
        schemaName,
        semanticKeyField,
        semanticKey,
        projectMarketingHeroContentData(normalizedRecordData)
    )
}
