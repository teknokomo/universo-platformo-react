# Uniks Frontend (@universo/uniks-frt)

Frontend module that provides pages, menu configuration and translations for the **Uniks** (workspace) feature in Universo Platformo.

## Project Structure

```
apps/uniks-frt/base/
├── package.json
├── tsconfig.json
├── gulpfile.ts
└── src/
    ├── index.ts                # Package exports
    ├── pages/                  # React components
    ├── menu-items/             # Sidebar menu item
    └── i18n/                   # Localization files (en, ru)
```

## Exports

 - `UnikList`, `UnikDetail`, `UnikDialog`
- `unikDashboard` menu configuration
- `uniksTranslations` for i18next

This package is a scoped workspace module and may be extracted to a standalone repository later.
