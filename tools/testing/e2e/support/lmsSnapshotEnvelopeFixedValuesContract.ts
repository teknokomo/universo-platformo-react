import { LMS_PRODUCT_ACCEPTANCE_MATRIX } from './lmsFixtureDataAcceptance.ts'
import { readLocalizedText } from './lmsFixtureValidationHelpers.ts'
import type { SnapshotEnvelope } from './lmsFixtureContractTypes.ts'

export function assertLmsSnapshotEnvelopeFixedValuesContract(envelope: SnapshotEnvelope, errors: string[]): void {
    const exportedFixedValues = Object.values(envelope.snapshot?.fixedValues ?? {}).flat()
    const exportedOptionValues = Object.values(envelope.snapshot?.optionValues ?? {}).flat()
    const fixedValueCodenames = new Set(exportedFixedValues.map((value) => readLocalizedText(value?.codename, 'en')).filter(Boolean))
    const optionValueCodenames = new Set(exportedOptionValues.map((value) => readLocalizedText(value?.codename, 'en')).filter(Boolean))
    const defaultLibraryColumns = exportedFixedValues.find((value) => readLocalizedText(value?.codename, 'en') === 'DefaultLibraryColumns')
    if (defaultLibraryColumns?.value !== 'type,title,status,ResourceType') {
        errors.push('LMS DefaultLibraryColumns must use safe generic union display columns without raw reference or identity fields')
    }
    for (const codename of [
        'AppName',
        'DefaultPassingScore',
        'CertificateValidityDays',
        'AutoEnrollEnabled',
        'SupportEmail',
        'GamificationEnabled',
        'DefaultPointAward'
    ]) {
        if (!fixedValueCodenames.has(codename)) {
            errors.push(`LMS fixture is missing Set/Constants fixed value ${codename}`)
        }
    }
    for (const acceptanceArea of LMS_PRODUCT_ACCEPTANCE_MATRIX) {
        for (const statusCodename of acceptanceArea.requiredStatuses) {
            if (!fixedValueCodenames.has(statusCodename) && !optionValueCodenames.has(statusCodename)) {
                errors.push(`LMS acceptance area ${acceptanceArea.area} is missing status value ${statusCodename}`)
            }
        }
    }
}
