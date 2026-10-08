import { resolveApplicationLifecycleContractFromConfig } from '@universo-react/utils'
import type { DbExecutor } from '@universo-react/utils'
import { applyRuntimeProgressParentAggregations } from '../../services/runtimeRowSupport/progress'

const targetRecordId = '0190a9b5-3cde-7abc-8def-0123456789d1'
const siblingRecordId = '0190a9b5-3cde-7abc-8def-0123456789d2'
const parentRecordId = '0190a9b5-3cde-7abc-8def-0123456789d3'
const parentProgressId = '0190a9b5-3cde-7abc-8def-0123456789d4'
const userId = '0190a9b5-3cde-7abc-8def-0123456789d5'

describe('applyRuntimeProgressParentAggregations', () => {
    it('locks the learner progress scope before reading sibling progress for aggregation', async () => {
        const calls: Array<{ sql: string; params?: unknown[] }> = []
        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            calls.push({ sql, params })

            if (sql.includes('SELECT codename, column_name')) {
                return [{ codename: 'CourseId', column_name: 'course_id' }]
            }
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('AS "parent_id"') && sql.includes('WHERE id = $1')) {
                return [{ id: targetRecordId, parent_id: parentRecordId }]
            }
            if (sql.includes('AS "parent_id"') && sql.includes('IS NOT DISTINCT FROM $1')) {
                return [
                    { id: targetRecordId, parent_id: parentRecordId },
                    { id: siblingRecordId, parent_id: parentRecordId }
                ]
            }
            if (sql.includes('ANY($3::text[])')) {
                return [
                    { target_record_id: targetRecordId, status: 'completed', progress_percent: 100 },
                    { target_record_id: siblingRecordId, status: 'completed', progress_percent: 100 }
                ]
            }
            if (sql.includes('FROM app._app_objects')) {
                return [
                    { id: '0190a9b5-3cde-7abc-8def-0123456789d6', kind: 'object', codename: 'Courses', table_name: 'courses', config: {} }
                ]
            }
            if (sql.includes('FROM app."courses"')) return [{ id: parentRecordId }]
            if (sql.trimStart().startsWith('UPDATE app."content_progress"')) return [{ id: parentProgressId }]
            if (sql.includes('FROM app."content_progress"')) return [{ id: parentProgressId }]

            throw new Error(`Unexpected progress aggregation query: ${sql}`)
        })
        const manager = { query } as unknown as DbExecutor

        const failure = await applyRuntimeProgressParentAggregations({
            manager,
            schemaIdent: 'app',
            workspacesEnabled: false,
            userId,
            binding: {
                tableIdent: 'app."content_progress"',
                columns: {
                    targetObjectCodename: 'target_object_codename',
                    targetRecordId: 'target_record_id',
                    userId: 'user_id',
                    status: 'status',
                    progressPercent: 'progress_percent',
                    startedAt: 'started_at',
                    completedAt: 'completed_at',
                    lastViewedAt: 'last_viewed_at'
                }
            },
            targetObject: {
                id: '0190a9b5-3cde-7abc-8def-0123456789d7',
                table_name: 'course_items',
                config: {},
                lifecycleContract: resolveApplicationLifecycleContractFromConfig({})
            },
            targetObjectCodename: 'CourseItems',
            targetRecordId,
            aggregateParents: [{ parentObjectCodename: 'Courses', parentIdFieldCodename: 'CourseId', requiredOnly: false }]
        })

        expect(failure).toBeNull()

        const lockIndex = calls.findIndex(({ sql }) => sql.includes('pg_advisory_xact_lock'))
        const siblingReadIndex = calls.findIndex(({ sql }) => sql.includes('IS NOT DISTINCT FROM $1'))
        const progressReadIndex = calls.findIndex(({ sql }) => sql.includes('ANY($3::text[])'))
        expect(lockIndex).toBeGreaterThanOrEqual(0)
        expect(calls[lockIndex]?.params).toEqual([`app:app."content_progress":runtime-progress-user-scope:${userId}:`])
        expect(lockIndex).toBeLessThan(siblingReadIndex)
        expect(lockIndex).toBeLessThan(progressReadIndex)

        const aggregationUpdate = calls.find(({ sql }) => sql.trimStart().startsWith('UPDATE app."content_progress"'))
        expect(aggregationUpdate?.params).toEqual([parentProgressId, 'completed', 100, userId])
    })
})
