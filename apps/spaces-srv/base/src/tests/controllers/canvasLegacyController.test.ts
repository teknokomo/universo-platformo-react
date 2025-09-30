import 'reflect-metadata'
import type { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { CanvasLegacyController } from '@/controllers/canvasLegacyController'

const createResponse = () => {
  const res: Partial<Response> = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res as Response & {
    status: jest.Mock
    json: jest.Mock
  }
}

const createNext = () => jest.fn() as NextFunction

const createService = () => ({
  getAllCanvases: jest.fn().mockResolvedValue([]),
  saveCanvas: jest.fn().mockResolvedValue({}),
  importCanvases: jest.fn().mockResolvedValue({}),
  checkIfCanvasIsValidForStreaming: jest.fn().mockResolvedValue({ isStreaming: true }),
  checkIfCanvasIsValidForUploads: jest.fn().mockResolvedValue({}),
  deleteCanvas: jest.fn().mockResolvedValue({ success: true }),
  getCanvasById: jest.fn().mockResolvedValue({ id: 'canvas-1' }),
  updateCanvas: jest.fn().mockResolvedValue({ id: 'canvas-1' })
})

describe('CanvasLegacyController', () => {
  it('передаёт spaceId и unikId при получении списка канвасов', async () => {
    const service = createService()
    const controller = new CanvasLegacyController(service as any)
    const req = {
      params: { unikId: 'unik-1', spaceId: 'space-1' },
      query: {}
    } as unknown as Request
    const res = createResponse()

    await controller.getAllCanvases(req, res, createNext())

    expect(service.getAllCanvases).toHaveBeenCalledWith({
      unikId: 'unik-1',
      spaceId: 'space-1',
      type: undefined
    })
    expect(res.json).toHaveBeenCalledWith([])
  })

  it('возвращает 412 если spaceId не указан для маршрута spaces', async () => {
    const service = createService()
    const controller = new CanvasLegacyController(service as any)
    const req = {
      params: { unikId: 'unik-1', spaceId: undefined, canvasId: 'canvas-1' }
    } as unknown as Request
    const res = createResponse()

    await controller.checkIfCanvasIsValidForUploads(req, res, createNext())

    expect(res.status).toHaveBeenCalledWith(StatusCodes.PRECONDITION_FAILED)
    expect(res.json).toHaveBeenCalledWith({ error: 'spaceId param is required' })
    expect(service.checkIfCanvasIsValidForUploads).not.toHaveBeenCalled()
  })

  it('удаляет канвас с передачей scope', async () => {
    const service = createService()
    const controller = new CanvasLegacyController(service as any)
    const req = {
      params: { unikId: 'unik-1', spaceId: 'space-1', canvasId: 'canvas-1' }
    } as unknown as Request
    const res = createResponse()

    await controller.deleteCanvas(req, res, createNext())

    expect(service.deleteCanvas).toHaveBeenCalledWith('canvas-1', {
      unikId: 'unik-1',
      spaceId: 'space-1'
    })
    expect(res.json).toHaveBeenCalledWith({ success: true })
  })

  it('возвращает канвас с ограничением по spaceId', async () => {
    const service = createService()
    const controller = new CanvasLegacyController(service as any)
    const req = {
      params: { unikId: 'unik-1', spaceId: 'space-1', canvasId: 'canvas-1' }
    } as unknown as Request
    const res = createResponse()

    await controller.getCanvasById(req, res, createNext())

    expect(service.getCanvasById).toHaveBeenCalledWith('canvas-1', {
      unikId: 'unik-1',
      spaceId: 'space-1'
    })
    expect(res.json).toHaveBeenCalledWith({ id: 'canvas-1' })
  })

  it('обновляет канвас с передачей scope, включая spaceId', async () => {
    const service = createService()
    const controller = new CanvasLegacyController(service as any)
    const req = {
      params: { unikId: 'unik-1', spaceId: 'space-1', canvasId: 'canvas-1' },
      body: { name: 'Updated Canvas' }
    } as unknown as Request
    const res = createResponse()

    await controller.updateCanvas(req, res, createNext())

    expect(service.updateCanvas).toHaveBeenCalledWith(
      'canvas-1',
      { name: 'Updated Canvas' },
      {
        unikId: 'unik-1',
        spaceId: 'space-1'
      }
    )
    expect(res.json).toHaveBeenCalledWith({ id: 'canvas-1' })
  })
})
