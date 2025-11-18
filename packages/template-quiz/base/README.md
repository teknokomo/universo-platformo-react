# @universo/template-quiz

> 🎯 Quiz template system for AR.js and other 3D technologies in Universo Platformo

## Package Information

| Field | Value |
|-------|-------|
| **Package Name** | `@universo/template-quiz` |
| **Version** | See `package.json` |
| **Type** | TypeScript-first (AR/Quiz Template) |
| **Build** | Dual build (CommonJS + ESM) |
| **Purpose** | Interactive AR quiz generation from UPDL data |

See also: Creating New packages/Packages (best practices)

- ../../../docs/en/universo-platformo/shared-guides/creating-apps.md

## 🚀 Key Features

- 🎯 **AR.js Integration**: Generate AR experiences with marker tracking
- ❓ **Interactive Quizzes**: Multiple-choice questions with visual feedback
- 🎬 **Multi-scene Support**: Complex quiz flows with multiple questions
- 🏆 **Points System**: Optional scoring and feedback system
- 📧 **Lead Collection**: Collect user information (name, email, phone)
- 📊 **Analytics Integration**: Track user interactions and quiz performance
- 🏗️ **High-level UPDL Nodes**: Modern Entity+Component architecture

## Overview

This package provides a modular quiz template system that generates interactive AR experiences using AR.js technology. It supports multi-scene quizzes with point systems, lead collection, and analytics integration.

## Installation

```bash
pnpm add @universo/template-quiz
```

### Dependencies

-   `@universo-platformo/utils` - Centralized UPDLProcessor and validation
-   `@universo-platformo/types` - Shared UPDL type definitions

## Usage

### Basic Example

```typescript
import { ARJSQuizBuilder } from '@universo/template-quiz'

const builder = new ARJSQuizBuilder()
const html = await builder.build(flowData, {
    markerType: 'preset',
    markerValue: 'hiro',
    includeStartCollectName: true,
    includeEndScore: true
})
```

### Build Options

```typescript
interface BuildOptions {
    markerType?: 'preset' | 'pattern'      // AR marker type
    markerValue?: string                   // Marker identifier
    includeStartCollectName?: boolean      // Enable lead collection
    includeEndScore?: boolean              // Show final score
    arDisplayType?: 'marker' | 'wallpaper' // AR display mode
}
```

## Architecture

### Supported UPDL Nodes

Uses high-level UPDL architecture:

-   **Space**: Quiz scenes
-   **Entity**: Answer buttons and interactive elements
-   **Component**: Visual rendering
-   **Event**: User interactions
-   **Action**: Navigation and scoring
-   **Data**: Questions, answers, state
-   **Universo**: Analytics integration

### Quiz Data Structure

```typescript
interface QuizItem {
    question: string
    answers: QuizAnswer[]
}

interface QuizAnswer {
    text: string
    isCorrect: boolean
    pointsValue?: number
}
```

## Development

### Build Commands

```bash
pnpm build         # Full build (CJS + ESM + types)
pnpm build:cjs     # CommonJS only
pnpm build:esm     # ES modules only
pnpm lint          # Run linter
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

## Contributing

When contributing to this package:

1. Follow TypeScript best practices
2. Ensure AR.js compatibility
3. Add tests for new quiz features
4. Update both EN and RU documentation
5. Follow the project's coding standards

## Related Documentation

- [Main Apps Documentation](../README.md)
- [UPDL Node Definitions](../updl/base/README.md)
- [Publishing Frontend](../publish-frt/base/README.md)
- [AR.js Documentation](https://ar-js-org.github.io/AR.js-Docs/)

## License

MIT License - see LICENSE file for details.

---

_Universo Platformo | Quiz Template_
