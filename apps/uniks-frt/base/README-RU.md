# Фронтенд Уников (@universo/uniks-frt)

Фронтенд-модуль, предоставляющий страницы, пункт меню и переводы для функционала **Уников** (рабочих пространств) в Universo Platformo.

## Структура проекта

```
apps/uniks-frt/base/
├── package.json
├── tsconfig.json
├── gulpfile.ts
└── src/
    ├── index.ts                # Экспорты пакета
    ├── pages/                  # Компоненты React
    ├── menu-items/             # Пункт бокового меню
    └── i18n/                   # Локализация (en, ru)
```

## Экспорты

 - `UnikList`, `UnikDetail`, `UnikDialog`
- пункт меню `unikDashboard`
- `uniksTranslations` для i18next

Пакет оформлен как workspace‑модуль и при необходимости может быть вынесен в отдельный репозиторий.
