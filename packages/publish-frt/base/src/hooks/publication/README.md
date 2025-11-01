# Publication Hooks

This directory contains React hooks for managing publication-related operations using TanStack Query.

## Available Hooks

### usePublicationLinks

Manages publication links with automatic caching and invalidation.

```tsx
import { usePublicationLinks, useCreateGroupLink, useDeleteLink } from '@universo/publish-frt/hooks/publication'

function MyComponent() {
    // Fetch links
    const { data: links, isLoading } = usePublicationLinks({
        technology: 'arjs',
        versionGroupId: 'v1'
    })

    // Create new link
    const { mutateAsync: createLink } = useCreateGroupLink()

    const handleCreate = async () => {
        await createLink({
            canvasId: 'canvas-123',
            technology: 'arjs',
            versionGroupId: 'v1'
        })
    }

    // Delete link
    const { mutateAsync: deleteLink } = useDeleteLink()

    const handleDelete = async (linkId: string) => {
        await deleteLink(linkId)
    }
}
```

### usePublicationSettings

Manages publication settings with auto-save functionality.

```tsx
import { usePublicationSettings } from '@universo/publish-frt/hooks/publication'

function MyComponent({ canvasId }: { canvasId: string }) {
    const { settings, isLoading, updateSettings, saveNow, autoSaveStatus, hasUnsavedChanges } = usePublicationSettings(canvasId, 'arjs', {
        autoSaveDelay: 500,
        enableAutoSave: true,
        onSaveSuccess: () => console.log('Saved!'),
        onSaveError: (error) => console.error('Save failed:', error)
    })

    // Update settings (will auto-save after delay)
    const handleChange = (field: string, value: any) => {
        updateSettings({ [field]: value })
    }

    // Or save immediately
    const handleSaveNow = async () => {
        await saveNow()
    }

    return (
        <div>
            {autoSaveStatus === 'saving' && <span>Saving...</span>}
            {autoSaveStatus === 'saved' && <span>Saved!</span>}
            {hasUnsavedChanges && <span>Unsaved changes</span>}
        </div>
    )
}
```

### useCanvasData

Fetches canvas/space data with automatic caching.

```tsx
import { useCanvasData, useVersionGroupId } from '@universo/publish-frt/hooks/publication'

function MyComponent({ unikId, canvasId }: { unikId: string; canvasId: string }) {
    const { data: canvas, isLoading } = useCanvasData(unikId, canvasId)
    const versionGroupId = useVersionGroupId(canvas)

    return <div>{isLoading ? 'Loading...' : `Version: ${versionGroupId}`}</div>
}
```

### useVersionResolution

Resolves version information from canvas data with comprehensive version management.

```tsx
import { useVersionResolution } from '@universo/publish-frt/hooks/publication'

function MyComponent({ unikId, spaceId, canvasId }: { unikId: string; spaceId: string; canvasId: string }) {
    const { versionGroupId, versions, activeVersion, latestVersion, isLoading } = useVersionResolution(unikId, spaceId, canvasId)

    if (isLoading) return <div>Loading versions...</div>

    return (
        <div>
            <p>Version Group: {versionGroupId}</p>
            <p>Active Version: {activeVersion?.versionLabel}</p>
            <p>Latest Version: {latestVersion?.versionLabel}</p>
            <p>Total Versions: {versions.length}</p>
        </div>
    )
}
```

### usePublicationState

Manages publication creation and deletion operations with progress tracking.

```tsx
import { usePublicationState } from '@universo/publish-frt/hooks/publication'

function MyComponent({ canvasId }: { canvasId: string }) {
    const { createARJSPublication, deletePublication, isCreating, isDeleting, creationProgress } = usePublicationState()

    const handleCreate = async () => {
        try {
            const result = await createARJSPublication({
                canvasId,
                versionGroupId: 'v1',
                settings: {
                    isPublic: true,
                    arDisplayType: 'marker'
                    // ... other settings
                }
            })
            console.log('Publication created:', result.publicationId)
        } catch (error) {
            console.error('Failed to create publication:', error)
        }
    }

    const handleDelete = async (publicationId: string) => {
        try {
            await deletePublication(publicationId)
            console.log('Publication deleted')
        } catch (error) {
            console.error('Failed to delete publication:', error)
        }
    }

    return (
        <div>
            <button onClick={handleCreate} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Publication'}
            </button>

            {isCreating && (
                <div>
                    <p>{creationProgress.message}</p>
                    <progress value={creationProgress.progress} max={100} />
                </div>
            )}

            <button onClick={() => handleDelete('pub-123')} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete Publication'}
            </button>
        </div>
    )
}
```

## Benefits

1. **Automatic Caching**: TanStack Query handles caching automatically
2. **Request Deduplication**: Multiple components requesting same data share a single request
3. **Auto-Invalidation**: Mutations automatically invalidate related queries
4. **Loading States**: Built-in loading, error, and success states
5. **Auto-Save**: Settings hooks include debounced auto-save functionality
6. **Type Safety**: Full TypeScript support with proper types

## Migration Guide

### Before (Direct API calls)

```tsx
const [settings, setSettings] = useState(null)
const [loading, setLoading] = useState(true)

useEffect(() => {
    const loadSettings = async () => {
        try {
            const data = await ARJSPublicationApi.loadARJSSettings(canvasId)
            setSettings(data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }
    loadSettings()
}, [canvasId])

const handleSave = async () => {
    await ARJSPublicationApi.saveARJSSettings(canvasId, settings)
}
```

### After (Using hooks)

```tsx
const { settings, isLoading, updateSettings, autoSaveStatus } = usePublicationSettings(canvasId, 'arjs', {
    enableAutoSave: true
})

// Settings auto-save on change
const handleChange = (updates) => {
    updateSettings(updates)
}
```

## Query Keys

All hooks use centralized query keys from `@/api/queryKeys`:

-   `publishQueryKeys.links()` - All publication links
-   `publishQueryKeys.linksByTechnology(tech)` - Links for specific technology
-   `publishQueryKeys.canvasById(id)` - Canvas data
-   `publishQueryKeys.canvasByUnik(unikId, canvasId)` - Canvas data with unik context

This ensures proper cache invalidation and prevents key collisions.
