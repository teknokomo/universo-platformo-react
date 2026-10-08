import { jest } from '@jest/globals'
import * as layoutSupport from '../../persistence/applicationLayoutStoreSupport'
import * as structureModeGuard from '../../shared/interpretationNetworkStructureModeGuard'
import { createMockDbExecutor } from '../utils/dbMocks'

export const createApplicationLayoutWidgetsStoreBindingsHarness = (createDefaultLayoutDetail: () => unknown) => {
    const { executor, txExecutor } = createMockDbExecutor()
    const lockLayout = jest.spyOn(layoutSupport, 'lockApplicationLayoutMutation')
    const getLayoutDetail = jest.spyOn(layoutSupport, 'getApplicationLayoutDetail')
    const lockStructureMode = jest.spyOn(structureModeGuard, 'lockInterpretationNetworkStructureMode')

    const reset = () => {
        jest.clearAllMocks()
        txExecutor.query.mockReset().mockResolvedValue([])
        lockLayout.mockResolvedValue(createDefaultLayoutDetail() as never)
        getLayoutDetail.mockResolvedValue(null)
        lockStructureMode.mockResolvedValue(undefined)
    }

    return { executor, txExecutor, lockLayout, getLayoutDetail, lockStructureMode, reset }
}
