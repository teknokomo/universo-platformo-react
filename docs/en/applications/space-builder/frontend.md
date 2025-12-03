# `packages/space-builder-frontend` — Space Builder Frontend — [Status: MVP]

User interface for converting natural language requests into valid flow graphs from UPDL nodes.

## Purpose

Provides user interface for quiz generation based on natural language using LLM models. Supports three-step workflow: prepare, preview, and generate.

## Key Features

- **Quiz Generation UI**: FAB + MUI Dialog + i18n + React hooks
- **Three-step workflow**: Prepare → Preview → Settings → Generate
- **Model selection**: Integration with credentials and test providers
- **Application modes**: Append / Replace / Create New Space
- **Iterative refinement**: Ability to refine quiz plan

## Architecture

### Workflow

1. **Prepare**: Paste study material (1-5000 chars), optionally add additional conditions (0-500 chars), choose question and answer counts
2. **Preview**: View quiz proposal, request changes via "What to change?" field
3. **Settings**: Choose creation mode, name collection settings, and final score display
4. **Generate**: Build UPDL graph from plan and apply to canvas

### Application Modes (Creation mode)

- **Append**: Merge with current canvas (ID remap + safe vertical offset)
- **Replace**: Clear current canvas and set generated graph
- **Create new space**: Open new tab for new space

## Components

### SpaceBuilderFab

Main component — floating action button with full generation dialog.

```tsx
import { SpaceBuilderFab } from '@universo/space-builder-frontend'

<SpaceBuilderFab
    models={availableChatModels}
    onApply={(graph, mode) => {
        if (mode === 'append') return handleAppendGeneratedGraphBelow(graph)
        if (mode === 'newSpace') return handleNewSpaceFromGeneratedGraph(graph)
        handleApplyGeneratedGraph(graph)
    }}
/>
```

### Hooks

- **useSpaceBuilder**: Main hook for state management and generation logic
- **useModelSelection**: Model selection and configuration management
- **useQuizPlan**: Quiz plan management and revision

## i18n Integration

```ts
import i18n from '@/i18n'
import { registerSpaceBuilderI18n } from '@universo/space-builder-frontend'
registerSpaceBuilderI18n(i18n)
```

## Build

Dual build system (CJS + ESM) for optimal compatibility:

```bash
pnpm build --filter @universo/space-builder-frontend
```

## Technologies

- **React**: UI framework
- **Material-UI**: Interface components
- **TypeScript**: Type safety
- **i18next**: Internationalization

## See Also

- [Space Builder Backend](./backend.md) - Backend component with API
- [Space Builder README](./README.md) - System overview
