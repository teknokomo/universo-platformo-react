# @universo/block-editor

Общие примитивы авторинга Editor.js для frontend-пакетов Universo.

## Ответственность

- Держать визуальную реализацию Editor.js вне административного shell и опубликованного runtime.
- Давать один переиспользуемый редактор блочного контента и locale-aware helper-ы.
- Использовать канонические контракты блоков из `@universo/types`, а не определять локальные форматы хранения.
- Сохранять единое поведение загрузки инструментов Editor.js, fallback-валидации и операций с локализованным контентом во всех потребителях.

## Публичный API

- `EditorJsBlockEditor`
- `EditorJsBlockEditorLabels`
- `EditorJsBlockEditorProps`
- `addEditorJsContentLocale`
- `collectEditorJsContentLocales`
- `normalizeEditorContentLocale`
- `removeEditorJsContentLocale`
- `renameEditorJsContentLocale`
- `resolveEditorJsContentPrimaryLocale`
- `setEditorJsContentPrimaryLocale`

## Разработка

```bash
pnpm --filter @universo/block-editor build
pnpm --filter @universo/block-editor lint
pnpm --filter @universo/block-editor test
```

## Связанные пакеты

- `@universo/types` владеет каноническими контрактами блочного контента и валидацией.
- `@universo/template-mui` реэкспортирует пакет для административных сценариев авторинга.
- `@universo/apps-template-mui` использует пакет напрямую в опубликованных приложениях.
