import { assertLmsDashboardFixtureContract } from './lmsDashboardFixtureContract.ts'
import { assertLocalizedFixtureValue, readLocalizedText, readRecord, readWidgetConfig } from './lmsFixtureValidationHelpers.ts'
import type { SnapshotEnvelope, SnapshotModule } from './lmsFixtureContractTypes.ts'
import type { LmsSnapshotEnvelopeEntityContext } from './lmsSnapshotEnvelopeEntityContract.ts'

export function assertLmsSnapshotEnvelopeRuntimeProgressContract(
    envelope: SnapshotEnvelope,
    entityContext: LmsSnapshotEnvelopeEntityContext,
    modules: SnapshotModule[],
    errors: string[]
): void {
    const { entityByCodename } = entityContext
    assertLmsDashboardFixtureContract({
        envelope,
        entityByCodename,
        modules,
        errors,
        readRecord,
        readWidgetConfig,
        readLocalizedText,
        assertLocalizedFixtureValue
    })

    const assertRuntimeProgressSequencePolicy = (
        entityCodename: 'CourseItems' | 'TrackSteps',
        expectedScopeFieldCodename: 'CourseId' | 'TrackId'
    ) => {
        const entity = entityByCodename.get(entityCodename)
        const config = readRecord(entity?.config)
        const runtimeProgress = readRecord(config?.runtimeProgress)
        const sequencePolicy = readRecord(runtimeProgress?.sequencePolicy)
        if (
            sequencePolicy?.mode !== 'sequential' ||
            sequencePolicy.scopeFieldCodename !== expectedScopeFieldCodename ||
            sequencePolicy.orderFieldCodename !== 'SortOrder'
        ) {
            errors.push(
                `LMS ${entityCodename} must declare a runtimeProgress sequencePolicy so direct progress writes cannot bypass ordering`
            )
        }
    }

    assertRuntimeProgressSequencePolicy('CourseItems', 'CourseId')
    assertRuntimeProgressSequencePolicy('TrackSteps', 'TrackId')

    const assertRuntimeProgressAggregation = (
        entityCodename: 'CourseItems' | 'TrackSteps',
        expectedParentObjectCodename: 'Courses' | 'LearningTracks',
        expectedParentFieldCodename: 'CourseId' | 'TrackId'
    ) => {
        const entity = entityByCodename.get(entityCodename)
        const config = readRecord(entity?.config)
        const runtimeProgress = readRecord(config?.runtimeProgress)
        const aggregateParents = Array.isArray(runtimeProgress?.aggregateParents) ? runtimeProgress.aggregateParents.map(readRecord) : []
        const aggregateParent = aggregateParents.find(
            (candidate) =>
                candidate?.parentObjectCodename === expectedParentObjectCodename &&
                candidate.parentIdFieldCodename === expectedParentFieldCodename &&
                candidate.requiredOnly === true
        )

        if (!aggregateParent) {
            errors.push(
                `LMS ${entityCodename} must aggregate learner progress into ${expectedParentObjectCodename} through runtimeProgress.aggregateParents`
            )
        }
    }

    assertRuntimeProgressAggregation('CourseItems', 'Courses', 'CourseId')
    assertRuntimeProgressAggregation('TrackSteps', 'LearningTracks', 'TrackId')

    const assertRuntimeParentRecordAccess = (
        entityCodename: 'CourseSections' | 'CourseItems' | 'TrackStages' | 'TrackSteps',
        expectedParentObjectCodename: 'Courses' | 'LearningTracks',
        expectedParentFieldCodename: 'CourseId' | 'TrackId'
    ) => {
        const entity = entityByCodename.get(entityCodename)
        const config = readRecord(entity?.config)
        const parentAccess = readRecord(config?.runtimeRecordParentAccess)

        if (
            parentAccess?.mode !== 'parentRecord' ||
            parentAccess.parentObjectCodename !== expectedParentObjectCodename ||
            parentAccess.parentFieldCodename !== expectedParentFieldCodename
        ) {
            errors.push(
                `LMS ${entityCodename} must inherit runtime record access from ${expectedParentObjectCodename} through ${expectedParentFieldCodename}`
            )
        }
    }

    assertRuntimeParentRecordAccess('CourseSections', 'Courses', 'CourseId')
    assertRuntimeParentRecordAccess('CourseItems', 'Courses', 'CourseId')
    assertRuntimeParentRecordAccess('TrackStages', 'LearningTracks', 'TrackId')
    assertRuntimeParentRecordAccess('TrackSteps', 'LearningTracks', 'TrackId')

    const assertRuntimeCopyRelations = (
        entityCodename: 'Courses' | 'LearningTracks',
        expectedRelations: Array<{
            objectCodename: string
            parentFieldCodename: string
            refRemap?: { fieldCodename: string; sourceObjectCodename: string }
        }>
    ) => {
        const entity = entityByCodename.get(entityCodename)
        const config = readRecord(entity?.config)
        const runtimeCopy = readRecord(config?.runtimeCopy)
        const relations = Array.isArray(runtimeCopy?.relations) ? runtimeCopy.relations.map(readRecord) : []

        for (const expectedRelation of expectedRelations) {
            const expectedRefRemap = expectedRelation.refRemap
            const relation = relations.find(
                (candidate) =>
                    candidate?.objectCodename === expectedRelation.objectCodename &&
                    candidate.parentFieldCodename === expectedRelation.parentFieldCodename &&
                    candidate.orderFieldCodename === 'SortOrder'
            )
            const refRemaps = Array.isArray(relation?.refRemaps) ? relation.refRemaps.map(readRecord) : []
            const hasExpectedRefRemap =
                !expectedRefRemap ||
                refRemaps.some(
                    (candidate) =>
                        candidate?.fieldCodename === expectedRefRemap.fieldCodename &&
                        candidate.sourceObjectCodename === expectedRefRemap.sourceObjectCodename
                )

            if (!relation || !hasExpectedRefRemap) {
                errors.push(
                    `LMS ${entityCodename} must declare runtimeCopy relation ${expectedRelation.objectCodename} with safe outline remapping`
                )
            }
        }
    }

    assertRuntimeCopyRelations('Courses', [
        { objectCodename: 'CourseSections', parentFieldCodename: 'CourseId' },
        {
            objectCodename: 'CourseItems',
            parentFieldCodename: 'CourseId',
            refRemap: { fieldCodename: 'SectionId', sourceObjectCodename: 'CourseSections' }
        }
    ])
    assertRuntimeCopyRelations('LearningTracks', [
        { objectCodename: 'TrackStages', parentFieldCodename: 'TrackId' },
        {
            objectCodename: 'TrackSteps',
            parentFieldCodename: 'TrackId',
            refRemap: { fieldCodename: 'StageId', sourceObjectCodename: 'TrackStages' }
        }
    ])
}
