import { LMS_ACCEPTANCE_AREAS } from '@universo-react/types'
import { LMS_PRODUCT_ACCEPTANCE_MATRIX } from './lmsFixtureDataAcceptance.ts'
import { REQUIRED_BASIC_BASELINE_ENTITIES } from './lmsSnapshotEnvelopeDefinitions.ts'
import type { LmsSnapshotEnvelopeEntityContext } from './lmsSnapshotEnvelopeEntityContract.ts'

export function assertLmsSnapshotEnvelopeAcceptanceContract(entityContext: LmsSnapshotEnvelopeEntityContext, errors: string[]): void {
    const { entityByCodename, findEntityByKindAndName } = entityContext
    const acceptanceAreas = new Set(LMS_PRODUCT_ACCEPTANCE_MATRIX.map((area) => area.area))
    for (const expectedArea of LMS_ACCEPTANCE_AREAS) {
        if (!acceptanceAreas.has(expectedArea)) {
            errors.push(`LMS acceptance matrix is missing declared area ${expectedArea}`)
        }
    }
    for (const acceptanceArea of LMS_PRODUCT_ACCEPTANCE_MATRIX) {
        const gatesComplete = Object.values(acceptanceArea.gates).every((value) => value === true)
        if (!gatesComplete && acceptanceArea.gaps.length === 0) {
            errors.push(`LMS acceptance area ${acceptanceArea.area} has incomplete phase gates without explicit gaps`)
        }
        if (acceptanceArea.gaps.some((gap) => !gap.startsWith('Deferred beyond current Learning Content release scope:'))) {
            errors.push(
                `LMS acceptance area ${acceptanceArea.area} has a gap that is not explicitly scoped out of the current Learning Content release`
            )
        }
        if (!acceptanceArea.gates['covered-by-e2e'] && acceptanceArea.gaps.length === 0) {
            errors.push(`LMS acceptance area ${acceptanceArea.area} is not browser-covered and must declare an explicit deferred gap`)
        }
        if (acceptanceArea.gates['covered-by-e2e'] && acceptanceArea.browserEvidence.length === 0) {
            errors.push(`LMS acceptance area ${acceptanceArea.area} is marked browser-covered without typed browserEvidence`)
        }
        if (!acceptanceArea.gates['covered-by-e2e'] && acceptanceArea.browserEvidence.length > 0) {
            errors.push(`LMS acceptance area ${acceptanceArea.area} declares browserEvidence while covered-by-e2e is false`)
        }
        if (
            !acceptanceArea.gates['covered-by-e2e'] &&
            acceptanceArea.apiEvidence.length === 0 &&
            acceptanceArea.fixtureEvidence.length === 0
        ) {
            errors.push(`LMS acceptance area ${acceptanceArea.area} is deferred from browser coverage without API or fixture evidence`)
        }
        if (acceptanceArea.gates.seeded && acceptanceArea.requiredEntities.length === 0) {
            errors.push(`LMS acceptance area ${acceptanceArea.area} is marked seeded without required entities`)
        }
    }
    for (const acceptanceArea of LMS_PRODUCT_ACCEPTANCE_MATRIX) {
        for (const entityCodename of acceptanceArea.requiredEntities) {
            if (!entityByCodename.has(entityCodename)) {
                errors.push(`LMS acceptance area ${acceptanceArea.area} is missing required entity ${entityCodename}`)
            }
        }
    }

    for (const requiredEntity of REQUIRED_BASIC_BASELINE_ENTITIES) {
        if (!findEntityByKindAndName(requiredEntity.kind, requiredEntity.name)) {
            errors.push(`LMS fixture is missing Basic baseline ${requiredEntity.kind} entity "${requiredEntity.name}"`)
        }
    }
}
