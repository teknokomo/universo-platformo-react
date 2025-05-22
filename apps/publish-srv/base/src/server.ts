// Universo Platformo | Publish Module | Express Server
// Маршруты для потоковой генерации AR.js на основе UPDL-узлов

import express from 'express'
import cors from 'cors'
import publishRoutes from './routes/publishRoutes'
import { errorHandler } from './middlewares/errorHandler'

/**
 * Инициализирует маршруты публикации AR.js
 * Интегрируется с основным сервером Flowise на порту 3000
 * @param app Express приложение, в которое будут добавлены маршруты
 * @returns Сконфигурированное Express приложение
 */
export function initializePublishServer(app?: express.Application): express.Application {
    // Создаем приложение, если не предоставлено
    const expressApp = app || express()

    // Настройка middleware
    expressApp.use(cors())
    expressApp.use(express.json({ limit: '50mb' }))

    // Настройка маршрутов API
    expressApp.use('/api/v1/publish', publishRoutes)

    // Добавляем обработчик ошибок (должен быть последним middleware)
    expressApp.use(errorHandler)

    console.log('Publish server routes initialized')

    return expressApp
}
