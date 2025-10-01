import { EntityManager } from 'typeorm'

const CANVAS_TABLES: Array<{ table: string; column: string }> = [
  { table: 'chat_message', column: 'canvas_id' },
  { table: 'chat_message_feedback', column: 'canvas_id' },
  { table: 'upsert_history', column: 'canvas_id' },
  { table: 'lead', column: 'canvas_id' }
]

const parseJsonArray = (
  value: string | null,
  logger: { warn: (msg: string, meta?: any) => void } = console
): string[] => {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    logger.warn('[Spaces] Failed to parse JSON value during purge', { error })
    return []
  }
}

const updateDocumentStoreUsage = async (manager: EntityManager, canvasIds: string[]) => {
  if (canvasIds.length === 0) return

  const canvasSet = new Set(canvasIds)
  const stores = await manager
    .createQueryBuilder()
    .select(['ds.id AS id', 'ds."whereUsed" AS "whereUsed"'])
    .from('document_store', 'ds')
    .where('ds."whereUsed" IS NOT NULL AND ds."whereUsed" <> :empty', { empty: '[]' })
    .getRawMany<{ id: string; whereUsed: string | null }>()

  await Promise.all(
    stores.map(async (store) => {
      const current = parseJsonArray(store.whereUsed)
      const filtered = current.filter((entry) => !canvasSet.has(entry))
      if (filtered.length === current.length) {
        return
      }

      await manager
        .createQueryBuilder()
        .update('document_store')
        .set({ whereUsed: JSON.stringify(filtered) })
        .where('id = :id', { id: store.id })
        .execute()
    })
  )
}

const deleteChatflowArtifacts = async (manager: EntityManager, canvasIds: string[]) => {
  if (canvasIds.length === 0) return

  await Promise.all(
    CANVAS_TABLES.map(({ table, column }) =>
      manager
        .createQueryBuilder()
        .delete()
        .from(table)
        .where(`${column} IN (:...ids)`, { ids: canvasIds })
        .execute()
    )
  )
}

const collectSpaceIds = async (
  manager: EntityManager,
  unikId: string,
  explicitSpaceIds?: string[]
): Promise<string[]> => {
  const query = manager
    .createQueryBuilder()
    .select('DISTINCT space.id', 'spaceId')
    .from('spaces', 'space')
    .where('space.unik_id = :unikId', { unikId })

  if (explicitSpaceIds?.length) {
    query.andWhere('space.id IN (:...spaceIds)', { spaceIds: explicitSpaceIds })
  }

  const rows = await query.getRawMany<{ spaceId?: string | null }>()
  return rows.map((row) => row.spaceId).filter((id): id is string => !!id)
}

const collectCanvasIds = async (manager: EntityManager, spaceIds: string[]): Promise<string[]> => {
  if (spaceIds.length === 0) return []

  const rows = await manager
    .createQueryBuilder()
    .select('DISTINCT sc.canvas_id', 'canvasId')
    .from('spaces_canvases', 'sc')
    .where('sc.space_id IN (:...ids)', { ids: spaceIds })
    .getRawMany<{ canvasId?: string | null }>()

  return rows.map((row) => row.canvasId).filter((id): id is string => !!id)
}

const filterDeletableCanvasIds = async (
  manager: EntityManager,
  candidateIds: string[]
): Promise<string[]> => {
  if (candidateIds.length === 0) return []

  const rows = await manager
    .createQueryBuilder()
    .select('sc.canvas_id', 'canvasId')
    .from('spaces_canvases', 'sc')
    .where('sc.canvas_id IN (:...ids)', { ids: candidateIds })
    .getRawMany<{ canvasId?: string | null }>()

  const stillLinked = new Set<string>()
  for (const row of rows) {
    if (row.canvasId) {
      stillLinked.add(row.canvasId)
    }
  }

  return candidateIds.filter((id) => !stillLinked.has(id))
}

export interface PurgeSpacesForUnikOptions {
  unikId: string
  spaceIds?: string[]
}

export interface PurgeSpacesForUnikResult {
  deletedSpaceIds: string[]
  deletedCanvasIds: string[]
}

export type CanvasStorageRemovalFn = (canvasId: string) => Promise<unknown> | unknown

export interface CanvasStorageCleanupOptions {
  logger?: {
    warn: (message: string, context?: Record<string, unknown>) => void
  }
  source?: string
}

export const purgeSpacesForUnik = async (
  manager: EntityManager,
  { unikId, spaceIds }: PurgeSpacesForUnikOptions
): Promise<PurgeSpacesForUnikResult> => {
  const targetSpaceIds = await collectSpaceIds(manager, unikId, spaceIds)
  if (targetSpaceIds.length === 0) {
    return { deletedSpaceIds: [], deletedCanvasIds: [] }
  }

  const targetCanvasIds = await collectCanvasIds(manager, targetSpaceIds)

  await manager
    .createQueryBuilder()
    .delete()
    .from('spaces_canvases')
    .where('space_id IN (:...ids)', { ids: targetSpaceIds })
    .execute()

  await manager
    .createQueryBuilder()
    .delete()
    .from('spaces')
    .where('id IN (:...ids)', { ids: targetSpaceIds })
    .execute()

  const deletableCanvasIds = await filterDeletableCanvasIds(manager, targetCanvasIds)
  if (deletableCanvasIds.length === 0) {
    return { deletedSpaceIds: targetSpaceIds, deletedCanvasIds: [] }
  }

  await deleteChatflowArtifacts(manager, deletableCanvasIds)
  await updateDocumentStoreUsage(manager, deletableCanvasIds)

  await manager
    .createQueryBuilder()
    .delete()
    .from('canvases')
    .where('id IN (:...ids)', { ids: deletableCanvasIds })
    .execute()

  return { deletedSpaceIds: targetSpaceIds, deletedCanvasIds: deletableCanvasIds }
}

export const cleanupCanvasStorage = async (
  canvasIds: string[],
  removeFolder: CanvasStorageRemovalFn,
  options: CanvasStorageCleanupOptions = {}
): Promise<void> => {
  if (canvasIds.length === 0) return

  const { logger = console, source = 'Spaces' } = options

  const removals = await Promise.allSettled(
    canvasIds.map((canvasId) => Promise.resolve().then(() => removeFolder(canvasId)))
  )

  removals.forEach((result, index) => {
    if (result.status === 'rejected') {
      logger.warn(`[${source}] Failed to remove storage folder for canvas`, {
        canvasId: canvasIds[index],
        error: result.reason
      })
    }
  })
}
