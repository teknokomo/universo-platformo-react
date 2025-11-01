# Shared UI Components

This directory contains reusable UI components used across different publishers in the publish-frt application.

## Components

### PublicationToggle

A reusable toggle component for public/private publication state.

**Features:**

-   Accessible with proper ARIA attributes
-   Loading state indicator
-   Customizable labels and descriptions
-   Consistent styling across publishers

**Usage:**

```tsx
import { PublicationToggle } from '../../components/shared'

;<PublicationToggle checked={isPublic} onChange={handlePublicChange} disabled={false} isLoading={isPublishing} />
```

### PublicationSettingsCard

A reusable card container for publication settings with loading and error states.

**Features:**

-   Consistent loading states with skeleton
-   Error display with retry functionality
-   Flexible content slots (actions, status)
-   Accessible structure

**Usage:**

```tsx
import { PublicationSettingsCard } from '../../components/shared'

;<PublicationSettingsCard isLoading={loading} loadingMessage='Loading settings...' error={error} onRetry={handleRetry} retryLabel='Retry'>
    {/* Your settings content */}
</PublicationSettingsCard>
```

### AsyncStatusBar

A reusable status indicator for async operations (saving, loading, etc.).

**Features:**

-   Multiple status states (idle, loading, saving, saved, success, error)
-   Customizable messages
-   Inline or alert variants
-   Accessible with aria-live regions

**Usage:**

```tsx
import { AsyncStatusBar } from '../../components/shared'

;<AsyncStatusBar status={autoSaveStatus} variant='inline' size='small' />
```

### FieldError

A reusable error message component for form fields.

**Features:**

-   Consistent error styling
-   Optional error icon
-   Accessible with proper ARIA attributes
-   Compact display

**Usage:**

```tsx
import { FieldError } from '../../components/shared'

;<FieldError error={validationError} showIcon={true} />
```

## Design Principles

1. **Accessibility First**: All components include proper ARIA attributes and semantic HTML
2. **Consistent Styling**: Components follow Material-UI design patterns
3. **Flexible Props**: Components accept customization through props while maintaining sensible defaults
4. **Type Safety**: Full TypeScript support with exported prop types
5. **Memoization**: Components use React.memo for performance optimization

## Integration

These components are used in:

-   `ARJSPublisher.tsx` - AR.js publication settings
-   `PlayCanvasPublisher.tsx` - PlayCanvas publication settings

They replace duplicated UI blocks and provide a consistent user experience across different publishers.
