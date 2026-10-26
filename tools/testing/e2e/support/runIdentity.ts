import { createHash } from 'node:crypto'
import type { TestInfo } from '@playwright/test'

/** Build a stable resource suffix that stays unique across tests, workers, and retries. */
export const buildExecutionRunId = (runId: string, testInfo: TestInfo): string => {
    const projectName = testInfo.project.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    const project = projectName.slice(0, 8) || 'project'
    const testKey = createHash('sha256').update(`${projectName}:${testInfo.testId}`).digest('hex').slice(0, 8)
    return `${runId}-${project}-${testKey}-r${testInfo.retry}-p${testInfo.repeatEachIndex}-w${testInfo.workerIndex}`
}
