# Template Quiz

Quiz template system for AR.js and other 3D technologies in Universo Platformo.

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
    chatflowId?: string
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
