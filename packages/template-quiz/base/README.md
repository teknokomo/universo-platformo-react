# Template Quiz

Quiz template system for AR.js and other 3D technologies in Universo Platformo.

See also: Creating New packages/Packages (best practices)

- ../../../docs/en/universo-platformo/shared-guides/creating-apps.md
## Overview

This package provides a modular quiz template system that generates interactive AR experiences using AR.js technology. It supports multi-scene quizzes, point systems, lead collection, and analytics.

## Features

-   **AR.js Integration**: Generate AR experiences with marker tracking
-   **Interactive Quizzes**: Support for multiple-choice questions with visual feedback
-   **Multi-scene Support**: Create complex quiz flows with multiple questions
-   **Points System**: Optional scoring and feedback system
-   **Lead Collection**: Collect user information (name, email, phone)
-   **Analytics Integration**: Track user interactions and quiz performance
-   **High-level UPDL Nodes**: Uses modern Entity+Component architecture

## Installation

```bash
pnpm add @universo/template-quiz
```

### Dependencies

This package uses centralized UPDL processing from the Universo Platformo ecosystem:

-   `@universo-platformo/utils` - Centralized UPDLProcessor and validation utilities
-   `@universo-platformo/types` - Shared UPDL type definitions and interfaces

These dependencies are automatically installed and provide consistent UPDL processing across all template packages.

## Usage

### Basic Usage

```typescript
import { ARJSQuizBuilder, getQuizTemplateConfig } from '@universo/template-quiz'

// Create builder instance
const builder = new ARJSQuizBuilder()

// Get template configuration
const config = getQuizTemplateConfig()

// Build AR.js HTML from flow data
const html = await builder.build(flowData, {
    markerType: 'preset',
    markerValue: 'hiro',
    includeStartCollectName: true,
    includeEndScore: true
})
```

### Template Configuration

```typescript
import { getQuizTemplateConfig } from '@universo/template-quiz'

const config = getQuizTemplateConfig()
// Returns:
// {
//   id: 'quiz-arjs',
//   name: 'templateQuiz.name',
//   description: 'templateQuiz.description',
//   version: '1.0.0',
//   technology: 'arjs',
//   i18nNamespace: 'templateQuiz',
//   supportedNodes: ['Space', 'Entity', 'Component', 'Event', 'Action', 'Data', 'Universo'],
//   features: ['multiScene', 'pointsSystem', 'leadCollection', 'analytics'],
//   defaults: { ... }
// }
```

### Internationalization

```typescript
import { templateQuizTranslations, getTemplateQuizTranslations } from '@universo/template-quiz'

// Get all translations
const allTranslations = templateQuizTranslations

// Get translations for specific language
const enTranslations = getTemplateQuizTranslations('en')
const ruTranslations = getTemplateQuizTranslations('ru')
```

## Architecture

### Supported UPDL Nodes

The template uses high-level UPDL nodes only:

-   **Space**: Quiz scenes and environments
-   **Entity**: Answer buttons and interactive elements
-   **Component**: Render components for visual elements
-   **Event**: User interaction events (clicks, selections)
-   **Action**: Navigation and scoring actions
-   **Data**: Quiz questions, answers, and state
-   **Universo**: Analytics and system integration

### Build Options

```typescript
interface BuildOptions {
    markerType?: 'preset' | 'pattern'
    markerValue?: string
    includeStartCollectName?: boolean
    includeEndScore?: boolean
    generateAnswerGraphics?: boolean
    canvasId?: string
    arDisplayType?: 'marker' | 'wallpaper'
}
```

## Data Types

### Quiz Plan Structure

```typescript
interface QuizPlan {
    items: QuizItem[]
}

interface QuizItem {
    question: string
    answers: QuizAnswer[]
}

interface QuizAnswer {
    text: string
    isCorrect: boolean
    pointsValue?: number
    enablePoints?: boolean
}
```

## Development

### Debug Logging

The generated quiz runtime uses a silent-by-default logging system.

Key points:

- All verbose scene / object / points / flow logs are wrapped with a lightweight `dbg()` helper.
- Two-layer flag system:
    - Build-time constant: `const QUIZ_DEBUG = false;` (change in source if you need a permanently verbose build).
    - Runtime mutable state: internal `QUIZ_DEBUG_STATE` controlled through a public API.
- Public API:
    - `window.setQuizDebug(true)` – enables verbose logging after the quiz iframe/script has loaded.
    - `window.setQuizDebug(false)` – disables it again.
- When disabled, only absolutely critical errors (unexpected exceptions) surface via `console.error`.

Runtime categories (enabled only when debug ON):

- `[MultiSceneQuiz]` – scene transitions, question numbering
- `[PointsManager]` – point increments / resets
- `[LeadCollection]` – (non-sensitive) data collection flow & save attempts
- `[QuizResults]` – result screen context, final score diagnostics

Production-visible (still suppressed when debug OFF unless an error):

- Lead save attempt/success are now also suppressed unless debug ON; to audit saving turn debug ON prior to completion if needed.

Example (in browser DevTools console):

```js
// Enable verbose quiz diagnostics
window.setQuizDebug(true)

// Later disable
window.setQuizDebug(false)
```

If you need to pre-enable debug for all users of a particular build, modify the constant in `DataHandler.generateMultiSceneScript` before building.

### Building

```bash
# Build all formats (CommonJS + ESM + Types)
pnpm build

# Build specific format
pnpm build:cjs    # CommonJS
pnpm build:esm    # ES Modules
pnpm build:types  # TypeScript declarations

# Development mode
pnpm dev
```

### Linting

```bash
pnpm lint
pnpm lint:fix
```

### Testing

```bash
pnpm --filter @universo/template-quiz test
```

The Vitest suite keeps AR.js quiz serialization, lead capture, and scoring flows in sync with the documented behaviour.

## Integration

This package is designed to integrate with:

-   **Universo Platformo**: Main platform system
-   **Space Builder**: AI-powered quiz generation
-   **Publish System**: Template registry and deployment
-   **i18n System**: Multi-language support

## License

MIT License - see LICENSE file for details.

## Contributing

Please read CONTRIBUTING.md for details on our code of conduct and the process for submitting pull requests.
