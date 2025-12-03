import client from './client'

const createAttachment = (canvasId, chatId, formData) =>
    client.post(`/attachments/${canvasId}/${chatId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })

export default {
    createAttachment
}
