import { computeSnapshotHash } from '@universo-react/utils'
import type { SnapshotEnvelope } from './mmoommAppFixtureContract.shared.ts'
import { MMOOMM_APP_CANONICAL_METAHUB, MMOOMM_APP_PACKAGES, readCodenameText } from './mmoommAppFixtureContract.shared.ts'
import {
    assertDomainModel,
    assertGeneratedMenuEntitySource,
    assertPackage,
    assertRuntimeManifestWidgetBinding,
    assertRuntimeModules,
    hasWidget
} from './mmoommAppContentContract.ts'
import { assertPlayCanvasProjectSnapshot } from './mmoommPlaycanvasSceneContract.ts'
import { assertGeneratedArtifacts, assertRuntimeScripts, assertScriptAssets } from './mmoommPlaycanvasScriptContract.ts'

export { MMOOMM_APP_FIXTURE_FILENAME, MMOOMM_APP_CANONICAL_METAHUB, MMOOMM_APP_PACKAGES } from './mmoommAppFixtureContract.shared.ts'
export type { SnapshotEnvelope } from './mmoommAppFixtureContract.shared.ts'

export const assertMmoommAppFixtureEnvelopeContract = (envelope: SnapshotEnvelope): void => {
    const snapshot = envelope.snapshot
    if (!snapshot) {
        throw new Error('MMOOMM app fixture must contain a snapshot')
    }
    if (typeof envelope.snapshotHash !== 'string' || computeSnapshotHash(snapshot) !== envelope.snapshotHash) {
        throw new Error('MMOOMM app fixture snapshotHash does not match snapshot content')
    }
    for (const expected of MMOOMM_APP_PACKAGES) {
        assertPackage(snapshot, expected)
    }
    const playcanvasProjectSnapshot = assertPlayCanvasProjectSnapshot(snapshot)
    const scriptAssets = assertScriptAssets(playcanvasProjectSnapshot)
    const generatedArtifacts = assertGeneratedArtifacts(playcanvasProjectSnapshot, scriptAssets)
    assertDomainModel(snapshot)
    assertRuntimeModules(snapshot)
    assertRuntimeScripts(playcanvasProjectSnapshot, scriptAssets, generatedArtifacts)
    if (!hasWidget(snapshot.layouts, 'playcanvasCanvas') && !hasWidget(snapshot.layoutZoneWidgets, 'playcanvasCanvas')) {
        throw new Error('MMOOMM app fixture must include the playcanvasCanvas widget')
    }
    assertGeneratedMenuEntitySource(snapshot)
    const metahubCodename = readCodenameText((envelope as { metahub?: { codename?: unknown } }).metahub?.codename)
    if (metahubCodename !== MMOOMM_APP_CANONICAL_METAHUB.codename.en) {
        throw new Error(`MMOOMM app fixture metahub codename must be ${MMOOMM_APP_CANONICAL_METAHUB.codename.en}`)
    }
    assertRuntimeManifestWidgetBinding(snapshot, playcanvasProjectSnapshot)
}
