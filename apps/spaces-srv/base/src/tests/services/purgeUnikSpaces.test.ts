import { EntityManager } from 'typeorm'
import { cleanupCanvasStorage, purgeSpacesForUnik } from '@/services/purgeUnikSpaces'

type FakeTableState = {
  spaces: Array<{ id: string; unik_id: string }>
  spaces_canvases: Array<{ id: string; space_id: string; canvas_id: string }>
  canvases: Array<{ id: string }>
  chat_message: Array<{ chatflowid: string }>
  chat_message_feedback: Array<{ chatflowid: string }>
  upsert_history: Array<{ chatflowid: string }>
  lead: Array<{ chatflowid: string }>
  document_store: Array<{ id: string; whereUsed: string }>
}

type BuilderContext = {
  mode: 'select' | 'delete' | 'update'
  table?: string
  operation?: string
  where?: { clause: string; params: Record<string, any> }
  andWhere?: { clause: string; params: Record<string, any> }
  values?: Record<string, any>
  selection?: any
}

const createFakeManager = (stateOverrides: Partial<FakeTableState> = {}) => {
  const state: FakeTableState = {
    spaces: [],
    spaces_canvases: [],
    canvases: [],
    chat_message: [],
    chat_message_feedback: [],
    upsert_history: [],
    lead: [],
    document_store: [],
    ...stateOverrides
  }

  const builderFactory = () => {
    const context: BuilderContext = {
      mode: 'select'
    }

    const builder: any = {
      select(selection: any, alias?: string) {
        context.selection = { selection, alias }
        return builder
      },
      from(table: string) {
        context.table = table
        if (context.mode === 'delete') {
          context.operation = `delete:${table}`
        }
        if (context.mode === 'update') {
          context.operation = `update:${table}`
        }
        return builder
      },
      where(clause: string, params: Record<string, any>) {
        context.where = { clause, params }
        return builder
      },
      andWhere(clause: string, params: Record<string, any>) {
        context.andWhere = { clause, params }
        return builder
      },
      delete() {
        context.mode = 'delete'
        return builder
      },
      update(table: string) {
        context.mode = 'update'
        context.table = table
        context.operation = `update:${table}`
        return builder
      },
      set(values: Record<string, any>) {
        context.values = values
        return builder
      },
      async getRawMany() {
        const { clause, params } = context.where ?? { clause: '', params: {} }
        switch (context.table) {
          case 'spaces': {
            const byUnik = params?.unikId
            const allowedSpaceIds = context.andWhere?.params?.spaceIds
            return state.spaces
              .filter((space) => space.unik_id === byUnik)
              .filter((space) => !allowedSpaceIds || allowedSpaceIds.includes(space.id))
              .map((space) => ({ spaceId: space.id }))
          }
          case 'spaces_canvases': {
            if (clause.includes('space_id')) {
              const ids: string[] = params?.ids ?? []
              return state.spaces_canvases
                .filter((row) => ids.includes(row.space_id))
                .map((row) => ({ canvasId: row.canvas_id }))
            }
            if (clause.includes('canvas_id')) {
              const ids: string[] = params?.ids ?? []
              return state.spaces_canvases
                .filter((row) => ids.includes(row.canvas_id))
                .map((row) => ({ canvasId: row.canvas_id }))
            }
            if (clause.includes('space.unik_id')) {
              const unikId = params?.unikId
              return state.spaces_canvases
                .filter((row) =>
                  state.spaces.some((space) => space.id === row.space_id && space.unik_id === unikId)
                )
                .map((row) => ({ canvasId: row.canvas_id }))
            }
            return []
          }
          case 'document_store':
            return state.document_store.map((row) => ({ id: row.id, whereUsed: row.whereUsed }))
          default:
            return []
        }
      },
      async execute() {
        const params = context.where?.params ?? {}
        const ids: string[] = params.ids ?? []
        switch (context.operation) {
          case 'delete:spaces_canvases':
            state.spaces_canvases = state.spaces_canvases.filter((row) => !ids.includes(row.space_id))
            return { affected: 1 }
          case 'delete:spaces':
            state.spaces = state.spaces.filter((row) => !ids.includes(row.id))
            return { affected: 1 }
          case 'delete:canvases':
            state.canvases = state.canvases.filter((row) => !ids.includes(row.id))
            return { affected: 1 }
          case 'delete:chat_message':
            state.chat_message = state.chat_message.filter((row) => !ids.includes(row.chatflowid))
            return { affected: 1 }
          case 'delete:chat_message_feedback':
            state.chat_message_feedback = state.chat_message_feedback.filter(
              (row) => !ids.includes(row.chatflowid)
            )
            return { affected: 1 }
          case 'delete:upsert_history':
            state.upsert_history = state.upsert_history.filter((row) => !ids.includes(row.chatflowid))
            return { affected: 1 }
          case 'delete:lead':
            state.lead = state.lead.filter((row) => !ids.includes(row.chatflowid))
            return { affected: 1 }
          case 'update:document_store': {
            const id = context.where?.params?.id
            const record = state.document_store.find((row) => row.id === id)
            if (record && context.values?.whereUsed) {
              record.whereUsed = context.values.whereUsed
            }
            return { affected: 1 }
          }
          default:
            return { affected: 0 }
        }
      }
    }

    return builder
  }

  const manager: Partial<EntityManager> & { state: FakeTableState } = {
    state,
    createQueryBuilder: jest.fn(() => builderFactory())
  }

  return manager as unknown as EntityManager & { state: FakeTableState }
}

describe('purgeSpacesForUnik', () => {
  it('удаляет пространства и связанные холсты выбранного уника', async () => {
    const manager = createFakeManager({
      spaces: [
        { id: 'space-1', unik_id: 'unik-1' },
        { id: 'space-2', unik_id: 'unik-1' },
        { id: 'space-3', unik_id: 'unik-2' }
      ],
      spaces_canvases: [
        { id: 'sc-1', space_id: 'space-1', canvas_id: 'canvas-1' },
        { id: 'sc-2', space_id: 'space-2', canvas_id: 'canvas-2' },
        { id: 'sc-3', space_id: 'space-3', canvas_id: 'canvas-3' }
      ],
      canvases: [{ id: 'canvas-1' }, { id: 'canvas-2' }, { id: 'canvas-3' }],
      chat_message: [{ chatflowid: 'canvas-1' }, { chatflowid: 'canvas-2' }],
      chat_message_feedback: [{ chatflowid: 'canvas-1' }],
      upsert_history: [{ chatflowid: 'canvas-2' }],
      lead: [{ chatflowid: 'canvas-1' }],
      document_store: [
        { id: 'doc-1', whereUsed: JSON.stringify(['canvas-1', 'canvas-3']) },
        { id: 'doc-2', whereUsed: JSON.stringify(['canvas-2']) }
      ]
    })

    const result = await purgeSpacesForUnik(manager, { unikId: 'unik-1' })

    expect(result).toEqual({
      deletedSpaceIds: ['space-1', 'space-2'],
      deletedCanvasIds: ['canvas-1', 'canvas-2']
    })
    expect(manager.state.spaces).toEqual([{ id: 'space-3', unik_id: 'unik-2' }])
    expect(manager.state.spaces_canvases).toEqual([{ id: 'sc-3', space_id: 'space-3', canvas_id: 'canvas-3' }])
    expect(manager.state.canvases).toEqual([{ id: 'canvas-3' }])
    expect(manager.state.chat_message).toEqual([])
    expect(JSON.parse(manager.state.document_store[0].whereUsed)).toEqual(['canvas-3'])
  })

  it('ограничивает удаление указанными spaceIds', async () => {
    const manager = createFakeManager({
      spaces: [
        { id: 'space-1', unik_id: 'unik-1' },
        { id: 'space-2', unik_id: 'unik-1' }
      ],
      spaces_canvases: [
        { id: 'sc-1', space_id: 'space-1', canvas_id: 'canvas-1' },
        { id: 'sc-2', space_id: 'space-2', canvas_id: 'canvas-2' }
      ],
      canvases: [{ id: 'canvas-1' }, { id: 'canvas-2' }]
    })

    const result = await purgeSpacesForUnik(manager, { unikId: 'unik-1', spaceIds: ['space-2'] })

    expect(result).toEqual({
      deletedSpaceIds: ['space-2'],
      deletedCanvasIds: ['canvas-2']
    })
    expect(manager.state.spaces).toEqual([{ id: 'space-1', unik_id: 'unik-1' }])
    expect(manager.state.canvases).toEqual([{ id: 'canvas-1' }])
  })
})

describe('cleanupCanvasStorage', () => {
  it('не вызывает удаление когда список пустой', async () => {
    const remove = jest.fn()

    await cleanupCanvasStorage([], remove)

    expect(remove).not.toHaveBeenCalled()
  })

  it('запускает удаление для каждого холста и логирует ошибки', async () => {
    const remove = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('failed'))
    const warn = jest.fn()

    await cleanupCanvasStorage(['canvas-1', 'canvas-2'], remove, {
      logger: { warn },
      source: 'Test'
    })

    expect(remove).toHaveBeenNthCalledWith(1, 'canvas-1')
    expect(remove).toHaveBeenNthCalledWith(2, 'canvas-2')
    expect(warn).toHaveBeenCalledWith('[Test] Failed to remove storage folder for canvas', {
      canvasId: 'canvas-2',
      error: expect.any(Error)
    })
  })
})
