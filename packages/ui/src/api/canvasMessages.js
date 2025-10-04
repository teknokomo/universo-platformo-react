import client from './client'

const getInternalCanvasMessages = (canvasId, params = {}) =>
    client.get(`/internal-canvas-messages/${canvasId}`, { params: { feedback: true, ...params } })

const getCanvasMessages = (canvasId, params = {}) =>
    client.get(`/canvas-messages/${canvasId}`, { params: { order: 'DESC', feedback: true, ...params } })

const getCanvasMessagesAscending = (canvasId, params = {}) =>
    client.get(`/canvas-messages/${canvasId}`, { params: { order: 'ASC', feedback: true, ...params } })

const deleteCanvasMessages = (canvasId, params = {}) =>
    client.delete(`/canvas-messages/${canvasId}`, { params: { ...params } })

const getStoragePath = () => client.get(`/get-upload-path`)

const abortCanvasMessage = (canvasId, threadId) => client.put(`/canvas-messages/abort/${canvasId}/${threadId}`)

export default {
    getInternalCanvasMessages,
    getCanvasMessages,
    getCanvasMessagesAscending,
    deleteCanvasMessages,
    getStoragePath,
    abortCanvasMessage
}
