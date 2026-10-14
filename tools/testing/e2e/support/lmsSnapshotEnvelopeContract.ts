import { assertLmsSeededRowsContract } from './lmsSeededRowsContract.ts'
import { assertLmsSnapshotEnvelopeAcceptanceContract } from './lmsSnapshotEnvelopeAcceptanceContract.ts'
import { assertLmsSnapshotEnvelopeEntityContract } from './lmsSnapshotEnvelopeEntityContract.ts'
import { assertLmsSnapshotEnvelopeFixedValuesContract } from './lmsSnapshotEnvelopeFixedValuesContract.ts'
import { assertLmsSnapshotEnvelopeIdentityContract } from './lmsSnapshotEnvelopeIdentityContract.ts'
import { assertLmsSnapshotEnvelopePagesContract } from './lmsSnapshotEnvelopePagesContract.ts'
import { assertLmsSnapshotEnvelopeRuntimeProgressContract } from './lmsSnapshotEnvelopeRuntimeProgressContract.ts'
import { assertLmsSnapshotEnvelopeWorkflowModulesContract } from './lmsSnapshotEnvelopeWorkflowModulesContract.ts'
import type { SnapshotEnvelope } from './lmsFixtureContractTypes.ts'

export function assertLmsFixtureEnvelopeContract(envelope: SnapshotEnvelope) {
    const errors: string[] = []

    assertLmsSnapshotEnvelopeIdentityContract(envelope, errors)
    const entityContext = assertLmsSnapshotEnvelopeEntityContract(envelope, errors)
    assertLmsSnapshotEnvelopeAcceptanceContract(entityContext, errors)

    const modules = Array.isArray(envelope.snapshot?.modules) ? envelope.snapshot.modules : []
    assertLmsSnapshotEnvelopeRuntimeProgressContract(envelope, entityContext, modules, errors)
    assertLmsSnapshotEnvelopePagesContract(entityContext, errors)
    assertLmsSnapshotEnvelopeWorkflowModulesContract(entityContext, modules, errors)
    assertLmsSnapshotEnvelopeFixedValuesContract(envelope, errors)
    assertLmsSeededRowsContract({ envelope, entityByCodename: entityContext.entityByCodename, errors })

    if (errors.length > 0) {
        throw new Error(errors.join('\n'))
    }
}
