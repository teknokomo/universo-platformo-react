import { computeSnapshotHash } from '@universo-react/utils'
import { CURRENT_METAHUB_SNAPSHOT_FORMAT_VERSION } from '@universo-react/types'
import { LMS_CANONICAL_METAHUB } from './lmsFixtureDataOverview.ts'
import { readLocalizedText } from './lmsFixtureValidationHelpers.ts'
import type { SnapshotEnvelope } from './lmsFixtureContractTypes.ts'

const LMS_EXPECTED_BUNDLE_VERSION = 1
const LMS_EXPECTED_SNAPSHOT_VERSION = 1
const LMS_EXPECTED_STRUCTURE_VERSION = '0.1.0'
const LMS_EXPECTED_SNAPSHOT_FORMAT_VERSION = CURRENT_METAHUB_SNAPSHOT_FORMAT_VERSION

export function assertLmsSnapshotEnvelopeIdentityContract(envelope: SnapshotEnvelope, errors: string[]): void {
    if (envelope.kind !== 'metahub_snapshot_bundle') {
        errors.push('LMS fixture must keep kind="metahub_snapshot_bundle"')
    }
    if (envelope.bundleVersion !== LMS_EXPECTED_BUNDLE_VERSION) {
        errors.push(`LMS fixture bundleVersion must remain ${LMS_EXPECTED_BUNDLE_VERSION}`)
    }

    if (!envelope?.snapshot || typeof envelope.snapshot !== 'object') {
        errors.push('LMS fixture is missing the snapshot payload')
    } else if (envelope.snapshotHash !== computeSnapshotHash(envelope.snapshot)) {
        errors.push('LMS fixture snapshotHash drifted from the canonical snapshot payload')
    }
    if (envelope.snapshot?.version !== LMS_EXPECTED_SNAPSHOT_VERSION) {
        errors.push(`LMS fixture snapshot version must remain ${LMS_EXPECTED_SNAPSHOT_VERSION}`)
    }
    if (envelope.snapshot?.versionEnvelope?.structureVersion !== LMS_EXPECTED_STRUCTURE_VERSION) {
        errors.push(`LMS fixture structureVersion must remain ${LMS_EXPECTED_STRUCTURE_VERSION}`)
    }
    if (envelope.snapshot?.versionEnvelope?.snapshotFormatVersion !== LMS_EXPECTED_SNAPSHOT_FORMAT_VERSION) {
        errors.push(`LMS fixture snapshotFormatVersion must remain ${LMS_EXPECTED_SNAPSHOT_FORMAT_VERSION}`)
    }
    if (envelope.snapshot?.versionEnvelope?.templateVersion != null) {
        errors.push('LMS fixture must not pin or bump templateVersion in exported snapshots')
    }

    if (envelope.snapshot?.runtimePolicy?.workspaceMode !== 'required') {
        errors.push('LMS fixture publication runtime policy must require application workspaces')
    }

    const metahubNameEn = readLocalizedText(envelope.metahub?.name, 'en')
    const metahubNameRu = readLocalizedText(envelope.metahub?.name, 'ru')
    const metahubDescriptionEn = readLocalizedText(envelope.metahub?.description, 'en')
    const metahubDescriptionRu = readLocalizedText(envelope.metahub?.description, 'ru')
    const metahubCodenameEn = readLocalizedText(envelope.metahub?.codename, 'en')
    const metahubCodenameRu = readLocalizedText(envelope.metahub?.codename, 'ru')

    if (metahubNameEn !== LMS_CANONICAL_METAHUB.name.en) {
        errors.push(`Unexpected LMS fixture metahub name: ${metahubNameEn ?? '<missing>'}`)
    }
    if (metahubNameRu !== LMS_CANONICAL_METAHUB.name.ru) {
        errors.push(`Unexpected LMS fixture Russian metahub name: ${metahubNameRu ?? '<missing>'}`)
    }
    if (metahubDescriptionEn !== LMS_CANONICAL_METAHUB.description.en) {
        errors.push('LMS fixture is missing the canonical English metahub description')
    }
    if (metahubDescriptionRu !== LMS_CANONICAL_METAHUB.description.ru) {
        errors.push('LMS fixture is missing the canonical Russian metahub description')
    }
    if (metahubCodenameEn !== LMS_CANONICAL_METAHUB.codename.en) {
        errors.push(`Unexpected LMS fixture codename: ${metahubCodenameEn ?? '<missing>'}`)
    }
    if (metahubCodenameRu !== LMS_CANONICAL_METAHUB.codename.ru) {
        errors.push(`Unexpected LMS fixture Russian codename: ${metahubCodenameRu ?? '<missing>'}`)
    }

    if (
        [metahubNameEn, metahubNameRu, metahubCodenameEn, metahubCodenameRu].some(
            (value) => typeof value === 'string' && /e2e|runid|imported-/i.test(value)
        )
    ) {
        errors.push('LMS fixture identity still contains run-specific markers')
    }
}
