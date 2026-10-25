import type { PublicInterpretationNetworkReadResponse } from '@universo-react/types'
import {
    MAX_OFFSET,
    PublicInterpretationNetworkUnavailableError,
    type PublicInterpretationNetworkReadInput
} from './publicInterpretationNetwork/contracts'
import { readInterpretations } from './publicInterpretationNetwork/interpretationsReader'
import { readMaterials } from './publicInterpretationNetwork/materialsReader'
import { readMatrix } from './publicInterpretationNetwork/matrixReader'
import { readStructures } from './publicInterpretationNetwork/structuresReader'

export { PublicInterpretationNetworkUnavailableError } from './publicInterpretationNetwork/contracts'
export type { PublicInterpretationNetworkReadInput, PublicInterpretationNetworkView } from './publicInterpretationNetwork/contracts'

const pageResult = async (input: PublicInterpretationNetworkReadInput): Promise<PublicInterpretationNetworkReadResponse> => {
    if (!Number.isInteger(input.offset) || input.offset < 0 || input.offset > MAX_OFFSET) {
        throw new PublicInterpretationNetworkUnavailableError()
    }

    switch (input.view) {
        case 'structures':
            return readStructures(input)
        case 'interpretations':
            return readInterpretations(input)
        case 'matrix':
            return readMatrix(input)
        case 'materials':
            return readMaterials(input)
    }
}

/** Read a bounded public IN view after the caller re-resolves application, target, Workspace, layout and active placement. */
export const readPublicInterpretationNetwork = pageResult
