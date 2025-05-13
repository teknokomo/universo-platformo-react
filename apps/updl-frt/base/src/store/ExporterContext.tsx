// Universo Platformo | Exporter state management
import React, { createContext, useContext, useState, ReactNode } from 'react'

interface ExporterInfo {
    id: string
    name: string
    description: string
    icon?: string
}

interface ExporterContextType {
    exporters: ExporterInfo[]
    selectedExporter: string | null
    setSelectedExporter: (id: string) => void
    loadExporters: () => Promise<void>
}

const ExporterContext = createContext<ExporterContextType | undefined>(undefined)

interface ExporterProviderProps {
    children: ReactNode
}

const ExporterProvider = (props: ExporterProviderProps) => {
    const [exporters, setExporters] = useState<ExporterInfo[]>([])
    const [selectedExporter, setSelectedExporter] = useState<string | null>(null)

    const loadExporters = async (): Promise<void> => {
        try {
            // В будущем, здесь будет загрузка экспортеров через API
            const mockExporters: ExporterInfo[] = [
                { id: 'arjs', name: 'AR.js', description: 'Augmented Reality with AR.js' },
                { id: 'aframe', name: 'A-Frame', description: 'Virtual Reality with A-Frame' }
            ]

            setExporters(mockExporters)

            // Устанавливаем первый экспортер по умолчанию, если еще не выбран
            if (!selectedExporter && mockExporters.length > 0) {
                setSelectedExporter(mockExporters[0].id)
            }
        } catch (error) {
            console.error('Failed to load exporters:', error)
        }
    }

    // Создаем объект значения контекста
    const value = {
        exporters,
        selectedExporter,
        setSelectedExporter,
        loadExporters
    }

    // Используем React.createElement вместо JSX
    return React.createElement(ExporterContext.Provider, { value }, props.children)
}

const useExporter = (): ExporterContextType => {
    const context = useContext(ExporterContext)
    if (!context) {
        throw new Error('useExporter must be used within an ExporterProvider')
    }
    return context
}

export { ExporterProvider, useExporter, ExporterContext }
