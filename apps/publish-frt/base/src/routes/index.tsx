// Universo Platformo | Publish Frontend Routes
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ARView from '../pages/public/ARView'
import ARViewPage from '../pages/public/ARViewPage'

/**
 * Основной компонент маршрутизации для приложения публикации
 */
const AppRoutes: React.FC = () => {
    return (
        <BrowserRouter>
            <Routes>
                {/* Публичные маршруты */}
                <Route path='/ar/:uuid' element={<ARView />} />

                {/* Новый маршрут для потоковой генерации AR.js */}
                <Route path='/ar/:flowId' element={<ARViewPage />} />

                {/* Редирект с корневого пути на страницу с ошибкой */}
                <Route path='/' element={<Navigate to='/error/not-found' replace />} />

                {/* Обработка несуществующих маршрутов */}
                <Route path='*' element={<div>Страница не найдена</div>} />
            </Routes>
        </BrowserRouter>
    )
}

export default AppRoutes
