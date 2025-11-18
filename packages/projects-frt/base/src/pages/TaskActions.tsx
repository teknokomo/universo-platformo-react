import { createEntityActions } from '@universo/template-mui'
import type { Task } from '../types'

type TaskData = {
    name: string
    description?: string
}

export default createEntityActions<Task, TaskData>({
    i18nPrefix: 'projects',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
