# @universo/flowise-assistants-frt

Assistants frontend package for Universo Platformo.

## Description

This package provides React components for managing AI assistants:
- Custom assistants (local, tool-based)
- OpenAI assistants
- Azure OpenAI assistants

## Features

- AssistantDialog - Main dialog for creating/editing OpenAI assistants
- AddCustomAssistantDialog - Dialog for creating custom assistants
- LoadAssistantDialog - Dialog for loading existing assistants
- CustomAssistantLayout - Layout for custom assistant canvas
- OpenAIAssistantLayout - Layout for OpenAI assistant canvas

## Usage

```jsx
import { 
    AssistantDialog,
    AddCustomAssistantDialog,
    CustomAssistantLayout,
    OpenAIAssistantLayout
} from '@universo/flowise-assistants-frt'
```

## i18n

The package includes translations for:
- English (en)
- Russian (ru)

Register the namespace in your i18n configuration:
```jsx
import '@universo/flowise-assistants-frt/i18n'
```
