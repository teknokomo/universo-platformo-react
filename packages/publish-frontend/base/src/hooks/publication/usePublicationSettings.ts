import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PublicationApi } from '../../api'
import { publishQueryKeys, invalidatePublishQueries } from '../../api'
import { useAutoSave } from '../useAutoSave'
import { useState, useCallback, useEffect } from 'react'

/**
 * Hook for loading publication settings for a specific technology
 *
 * @param canvasId - Canvas/Space ID
 * @param technology - Technology identifier (e.g., 'arjs', 'playcanvas', 'chatbot')
 * @param options - Additional query options
 * @returns Query result with settings data
 *
 * @example
 * ```tsx
 * const { data: settings, isLoading } = useLoadPublicationSettings(
 *   'canvas-123',
 *   'arjs'
 * )
 * ```
 */
export function useLoadPublicationSettings(canvasId: string | undefined, technology: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: [...publishQueryKeys.canvasById(canvasId || ''), 'settings', technology],
        queryFn: async () => {
            if (!canvasId) {
                throw new Error('Canvas ID is required')
            }
            return await PublicationApi.loadPublicationSettings(canvasId, technology)
        },
        enabled: (options?.enabled ?? true) && !!canvasId,
        staleTime: 1 * 60 * 1000 // 1 minute
    })
}

/**
 * Hook for saving publication settings with mutation
 *
 * @returns Mutation object with saveSettings function
 *
 * @example
 * ```tsx
 * const { mutateAsync: saveSettings, isPending } = useSavePublicationSettings()
 *
 * await saveSettings({
 *   canvasId: 'canvas-123',
 *   technology: 'arjs',
 *   settings: { isPublic: true, ... }
 * })
 * ```
 */
export function useSavePublicationSettings() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ canvasId, technology, settings }: { canvasId: string; technology: string; settings: any }) => {
            await PublicationApi.savePublicationSettings(canvasId, technology, settings)
        },
        onSuccess: (_, variables) => {
            // Invalidate canvas queries to refetch updated data
            invalidatePublishQueries.canvas(queryClient, variables.canvasId)
            // Also invalidate settings query for this specific technology
            queryClient.invalidateQueries({
                queryKey: [...publishQueryKeys.canvasById(variables.canvasId), 'settings', variables.technology]
            })
        }
    })
}

/**
 * Hook for managing publication settings with auto-save functionality
 *
 * Combines loading, saving, and auto-save into a single convenient hook.
 *
 * @param canvasId - Canvas/Space ID
 * @param technology - Technology identifier
 * @param options - Configuration options
 * @returns Object with settings data, save functions, and status
 *
 * @example
 * ```tsx
 * const {
 *   settings,
 *   isLoading,
 *   updateSettings,
 *   saveNow,
 *   autoSaveStatus
 * } = usePublicationSettings('canvas-123', 'arjs', {
 *   autoSaveDelay: 500,
 *   enableAutoSave: true
 * })
 *
 * // Update settings (will auto-save after delay)
 * updateSettings({ isPublic: true })
 *
 * // Or save immediately
 * await saveNow()
 * ```
 */
export function usePublicationSettings(
    canvasId: string | undefined,
    technology: string,
    options?: {
        autoSaveDelay?: number
        enableAutoSave?: boolean
        onSaveSuccess?: () => void
        onSaveError?: (error: Error) => void
    }
) {
    const { data: loadedSettings, isLoading, error } = useLoadPublicationSettings(canvasId, technology)
    const { mutateAsync: saveSettings } = useSavePublicationSettings()

    // Local state for settings (allows optimistic updates)
    const [localSettings, setLocalSettings] = useState<any>(null)

    // Update local settings when loaded settings change
    useEffect(() => {
        if (loadedSettings !== undefined) {
            setLocalSettings(loadedSettings)
        }
    }, [loadedSettings])

    // Save function for auto-save hook
    const handleSave = useCallback(
        async (data: any) => {
            if (!canvasId) {
                throw new Error('Canvas ID is required for saving')
            }
            try {
                await saveSettings({
                    canvasId,
                    technology,
                    settings: data
                })
                options?.onSaveSuccess?.()
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Failed to save settings')
                options?.onSaveError?.(error)
                throw error
            }
        },
        [canvasId, technology, saveSettings, options]
    )

    // Auto-save hook
    const {
        status: autoSaveStatus,
        hasUnsavedChanges,
        triggerSave
    } = useAutoSave({
        data: localSettings,
        onSave: handleSave,
        delay: options?.autoSaveDelay ?? 500,
        enabled: (options?.enableAutoSave ?? true) && !!canvasId && localSettings !== null
    })

    // Update settings function
    const updateSettings = useCallback((updates: any) => {
        setLocalSettings((prev: any) => {
            if (typeof updates === 'function') {
                return updates(prev)
            }
            return prev ? { ...prev, ...updates } : updates
        })
    }, [])

    return {
        settings: localSettings ?? loadedSettings,
        isLoading,
        error,
        updateSettings,
        saveNow: triggerSave,
        autoSaveStatus,
        hasUnsavedChanges
    }
}
