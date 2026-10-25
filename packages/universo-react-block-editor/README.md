# @universo-react/block-editor

Shared Editor.js authoring primitives for Universo frontend packages.

## Responsibilities

-   Keep the visual Editor.js implementation outside administrative and published-app shells.
-   Provide one reusable block-content editor plus locale-aware content helpers.
-   Reuse canonical block contracts from `@universo-react/types` instead of defining package-local storage formats.
-   Keep Editor.js tool loading, validation fallback behavior, and localized content operations consistent across consumers.
-   Show the raw JSON recovery field only in editable contexts; read-only consumers never expose that editing surface when Editor.js tools fail to load.

## Public API

-   `EditorJsBlockEditor`
-   `EditorJsBlockEditorLabels`
-   `EditorJsBlockEditorProps`
-   `addEditorJsContentLocale`
-   `collectEditorJsContentLocales`
-   `normalizeEditorContentLocale`
-   `removeEditorJsContentLocale`
-   `renameEditorJsContentLocale`
-   `resolveEditorJsContentPrimaryLocale`
-   `setEditorJsContentPrimaryLocale`

## Development

```bash
pnpm --filter @universo-react/block-editor build
pnpm --filter @universo-react/block-editor lint
pnpm --filter @universo-react/block-editor test
```

## Related Packages

-   `@universo-react/types` owns canonical block-content contracts and validation.
-   `@universo-react/template-mui` re-exports this package for administrative authoring flows.
-   `@universo-react/apps-template-mui` consumes this package directly in published applications.
