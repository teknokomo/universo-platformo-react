# Template Packages

Template packages are specialized modules that handle the conversion of UPDL structures into specific target platforms and formats. They provide a modular, maintainable approach to supporting different export technologies.

## Overview

Template packages extend the Universo Platformo ecosystem by providing dedicated implementations for specific use cases:

- **AR.js Quizzes**: Educational content with marker-based AR
- **PlayCanvas MMO**: 3D space simulation games
- **Future Templates**: Extensible architecture for new platforms

## Architecture

### Template Registry System

The template system uses a registry pattern for dynamic loading:

```typescript
// Registration
TemplateRegistry.registerTemplate({
  id: 'quiz',
  name: 'AR.js Quiz',
  builder: ARJSQuizBuilder
})

// Usage
const builder = TemplateRegistry.createBuilder('quiz')
const result = await builder.buildFromFlowData(flowData)
```

### Package Structure

Each template package follows a standardized structure:

```
template-name/
├── base/
│   ├── src/
│   │   ├── platform/        # Platform-specific implementations
│   │   ├── handlers/        # UPDL node handlers
│   │   ├── builders/        # Main builder classes
│   │   ├── common/          # Shared utilities
│   │   └── index.ts         # Package entry point
│   ├── dist/                # Compiled output (CJS, ESM, types)
│   ├── package.json
│   └── README.md
```

## Core Template Packages

### Quiz Template (`@universo/template-quiz`)

**Purpose**: Creates AR.js educational quizzes with lead collection

**Key Features**:
- Multi-scene quiz flows
- Marker-based AR tracking
- Automatic scoring system
- Lead data collection
- Results display

**Usage**:
```typescript
import { ARJSQuizBuilder } from '@universo/template-quiz'

const builder = new ARJSQuizBuilder()
const result = await builder.buildFromFlowData(flowDataString)
```

**Supported UPDL Nodes**:
- Space: Quiz scenes and results
- Data: Questions and answers
- Object: AR markers and 3D objects
- Event: User interactions
- Action: Navigation and scoring

### MMOOMM Template (`@universo/template-mmoomm`)

**Purpose**: Creates PlayCanvas space MMO experiences

**Key Features**:
- 3D space simulation
- Physics-based movement
- Industrial laser mining
- Real-time multiplayer
- Entity component system

**Usage**:
```typescript
import { PlayCanvasMMOOMMBuilder } from '@universo/template-mmoomm'

const builder = new PlayCanvasMMOOMMBuilder()
const result = await builder.buildFromFlowData(flowDataString)
```

**Supported UPDL Nodes**:
- Space: Game worlds and regions
- Entity: Ships, asteroids, stations
- Component: Physics, rendering, behavior
- Event: Game events and triggers
- Action: Player actions and responses

## Creating New Template Packages

### Step 1: Package Setup

Create the package structure:

```bash
mkdir -p packages/template-mytemplate/base/src
cd packages/template-mytemplate/base
```

Initialize `package.json`:

```json
{
  "name": "@universo/template-mytemplate",
  "version": "1.0.0",
  "main": "dist/cjs/index.js",
  "module": "dist/esm/index.js",
  "types": "dist/types/index.d.ts",
  "dependencies": {
    "@universo-platformo/types": "workspace:*",
    "@universo-platformo/utils": "workspace:*"
  }
}
```

## Conventions: Exports and TS i18n

### Exports Map and Artifacts

- Provide dual builds and types:
  - `main`: `dist/cjs/index.js`
  - `module`: `dist/esm/index.js`
  - `types`: `dist/types/index.d.ts`
- Use an explicit `exports` map for multi‑entry packages (e.g., `./arjs`, `./playcanvas`) pointing to `dist/esm/...`, `dist/cjs/...`, and `dist/types/...`.
- Ensure all runtime entry points are compiled to `dist` (UI should not import `src`).

### TypeScript i18n Entry Points

- Implement the i18n entry as a TypeScript file (`src/i18n/index.ts`) to guarantee inclusion in `dist` and better type safety.
- Import JSON locales with `"resolveJsonModule": true` or export a small inline dictionary.
- Provide a typed helper that returns a single namespace, e.g.:

```ts
// src/i18n/index.ts
import en from './locales/en/main.json'
import ru from './locales/ru/main.json'

export type TemplateNamespace = { /* ...shape... */ }

export const translations = {
  en: { template: en.template },
  ru: { template: ru.template }
}

export function getTemplateTranslations(lang: string): TemplateNamespace {
  return translations[lang]?.template || translations.en.template
}
```

See also: Creating New packages/Packages → `docs/en/universo-platformo/shared-guides/creating-apps.md`.

### Step 2: Implement Builder Class

Create the main builder class:

```typescript
// src/MyTemplateBuilder.ts
import { ITemplateBuilder, IFlowData, BuildOptions, BuildResult } from '@universo-platformo/types'
import { UPDLProcessor } from '@universo-platformo/utils'

export class MyTemplateBuilder implements ITemplateBuilder {
  getTemplateInfo() {
    return {
      id: 'mytemplate',
      name: 'My Template',
      description: 'Custom template description',
      version: '1.0.0',
      technology: 'web'
    }
  }

  async buildFromFlowData(flowDataString: string, options: BuildOptions = {}): Promise<BuildResult> {
    // Process flow data
    const result = UPDLProcessor.processFlowData(flowDataString)
    
    // Create flow data structure
    const flowData: IFlowData = {
      flowData: flowDataString,
      updlSpace: result.updlSpace,
      multiScene: result.multiScene
    }
    
    // Build template
    const html = await this.build(flowData, options)
    
    return {
      success: true,
      html,
      metadata: {
        templateId: 'mytemplate',
        buildTime: Date.now()
      }
    }
  }

  private async build(flowData: IFlowData, options: BuildOptions): Promise<string> {
    // Implement your template logic here
    return '<html><!-- Your template output --></html>'
  }
}
```

### Step 3: Create Node Handlers

Implement handlers for different UPDL node types:

```typescript
// src/handlers/EntityHandler.ts
export class EntityHandler {
  process(entities: any[], options: BuildOptions = {}): string {
    return entities.map(entity => this.processEntity(entity, options)).join('\n')
  }

  private processEntity(entity: any, options: BuildOptions): string {
    const entityType = entity.data?.entityType || 'default'
    
    switch (entityType) {
      case 'player':
        return this.generatePlayerEntity(entity)
      case 'npc':
        return this.generateNPCEntity(entity)
      default:
        return this.generateDefaultEntity(entity)
    }
  }

  private generatePlayerEntity(entity: any): string {
    // Generate player-specific code
    return `<!-- Player entity: ${entity.id} -->`
  }

  // ... other entity generators
}
```

### Step 4: Build System Configuration

Add TypeScript configurations for dual build:

**tsconfig.json** (CommonJS):
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist/cjs",
    "module": "CommonJS",
    "target": "ES2020"
  },
  "include": ["src/**/*"]
}
```

**tsconfig.esm.json** (ES Modules):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist/esm",
    "module": "ES2020"
  }
}
```

**tsconfig.types.json** (Type Declarations):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist/types",
    "declaration": true,
    "emitDeclarationOnly": true
  }
}
```

### Step 5: Package Scripts

Add build scripts to `package.json`:

```json
{
  "scripts": {
    "build": "pnpm run build:cjs && pnpm run build:esm && pnpm run build:types",
    "build:cjs": "tsc -p tsconfig.json",
    "build:esm": "tsc -p tsconfig.esm.json",
    "build:types": "tsc -p tsconfig.types.json",
    "clean": "rimraf dist"
  }
}
```

### Step 6: Registration

Register your template in the main application:

```typescript
// In publish-frt/src/builders/common/TemplateRegistry.ts
import { MyTemplateBuilder } from '@universo/template-mytemplate'

// Register template
const myTemplateInfo = new MyTemplateBuilder().getTemplateInfo()
TemplateRegistry.registerTemplate({
  id: myTemplateInfo.id,
  name: myTemplateInfo.name,
  description: myTemplateInfo.description,
  version: myTemplateInfo.version,
  technology: myTemplateInfo.technology,
  builder: MyTemplateBuilder
})
```

## Best Practices

### Code Organization

- **Separate Concerns**: Use dedicated handlers for different node types
- **Modular Design**: Keep platform-specific code isolated
- **Shared Utilities**: Extract common functionality to utility modules

### Error Handling

```typescript
try {
  const result = await builder.buildFromFlowData(flowData)
  return result
} catch (error) {
  return {
    success: false,
    error: error.message,
    html: this.generateErrorHTML(error)
  }
}
```

### Performance Optimization

- **Lazy Loading**: Load heavy dependencies only when needed
- **Caching**: Cache processed templates for repeated use
- **Streaming**: Use streaming for large template outputs

### Testing

Create comprehensive tests for your template:

```typescript
// tests/MyTemplateBuilder.test.ts
import { MyTemplateBuilder } from '../src/MyTemplateBuilder'

describe('MyTemplateBuilder', () => {
  let builder: MyTemplateBuilder

  beforeEach(() => {
    builder = new MyTemplateBuilder()
  })

  test('should build template from flow data', async () => {
    const flowData = '{"nodes": [], "edges": []}'
    const result = await builder.buildFromFlowData(flowData)
    
    expect(result.success).toBe(true)
    expect(result.html).toContain('<html>')
  })
})
```

## Integration with Publish System

Template packages integrate seamlessly with the publish system:

1. **Registration**: Templates are automatically registered at startup
2. **Selection**: Users select templates through the UI
3. **Processing**: The system routes flow data to the appropriate template
4. **Output**: Generated content is served to users

## Migration from Inline Templates

When migrating from inline template implementations:

1. **Extract Logic**: Move template-specific code to dedicated packages
2. **Update Imports**: Change imports to use package names
3. **Remove Inline Code**: Delete old template implementations
4. **Update Registry**: Register new template packages
5. **Test Integration**: Verify functionality with new packages

## Troubleshooting

### Common Issues

- **Build Failures**: Check TypeScript configuration
- **Import Errors**: Verify package dependencies
- **Registration Issues**: Ensure proper template registration

### Debug Tips

- Use detailed logging in template builders
- Test with minimal flow data first
- Check generated HTML output
- Verify UPDL processing results
