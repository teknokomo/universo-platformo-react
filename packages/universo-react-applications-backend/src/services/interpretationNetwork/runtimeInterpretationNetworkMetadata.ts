import type { ComponentRow, ObjectContract } from '../../shared/interpretationNetworkRuntimeContracts'
import { IDENTIFIER_REGEX } from '../../shared/runtimeSqlIdentifiers'
import { InterpretationNetworkCommandError, interpretationNetworkCommandErrorCodes } from './runtimeInterpretationNetworkErrors'

/** Resolve a declared parent-object field by its semantic codename. */
export const getField = (contract: ObjectContract, codename: string): ComponentRow | undefined => contract.fields[codename]

/** Resolve a declared child-table field by its semantic codename. */
export const getChildField = (contract: ObjectContract, codename: string): ComponentRow | undefined => contract.childFields[codename]

/** Require a safe metadata column or preserve the established missing-metadata domain error. */
export const assertColumn = (field: ComponentRow | undefined, label: string): string => {
    if (!field?.column_name || !IDENTIFIER_REGEX.test(field.column_name)) {
        throw new InterpretationNetworkCommandError(
            501,
            interpretationNetworkCommandErrorCodes.missingMetadata,
            'Interpretation Network metadata is incomplete',
            { missing: [label] }
        )
    }
    return field.column_name
}
