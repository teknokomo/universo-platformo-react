// Universo Platformo | Main entry point for the publish frontend app
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Создаем корневой элемент для React
const rootElement = document.getElementById('root')

if (!rootElement) {
    throw new Error('Failed to find the root element')
}

// Инициализируем React приложение
const root = ReactDOM.createRoot(rootElement)
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
