# @universo/block-editor

Shared Editor.js authoring primitives for Universo frontend packages.

## Responsibilities

- Keep the visual Editor.js implementation outside administrative and published-app shells.
- Provide one reusable block-content editor plus locale-aware content helpers.
- Reuse canonical block contracts from `@universo/types` instead of defining package-local storage formats.
- Keep Editor.js tool loading, validation fallback behavior, and localized content operations consistent across consumers.

## Public API

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

## Development

```bash
pnpm --filter @universo/block-editor build
pnpm --filter @universo/block-editor lint
pnpm --filter @universo/block-editor test
```

## Related Packages

- `@universo/types` owns canonical block-content contracts and validation.
- `@universo/template-mui` re-exports this package for administrative authoring flows.
- `@universo/apps-template-mui` consumes this package directly in published applications.
