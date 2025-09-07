# @universo/spaces-frt

Фронтенд для Пространств и Холстов (Spaces/Canvases). Выделен из Flowise UI с минимальной связностью.

## Технологии
- React 18, React Router
- MUI (Material UI)
- ReactFlow — редактор графа
- dnd-kit — перетаскивание вкладок
- Axios — HTTP клиент с JWT и refresh

## Структура
- `src/api` — клиент (`client.js`) и API Spaces/Canvases
- `src/hooks` — `useApi`, `useCanvases` (локальная копия)
- `src/views/canvas` — экран холста и стили
- `src/views/spaces` — список пространств
- `src/components` — общие компоненты пакета
- `src/entry/routes.jsx` — конфигурация роутов `/uniks/:unikId`

## Алиасы
- `@/*` → локальный `src/*`
- `@ui/*` → Flowise `packages/ui/src/*` (временный мост до полной миграции)

## Сборка
```
pnpm --filter @universo/spaces-frt build
pnpm --filter @universo/spaces-frt lint
```

## Примечания по миграции
- Локализованы HTTP‑клиент и `useCanvases`.
- Постепенно заменяем импорты `@ui/*` на локальные; после отвязки неиспользуемые файлы в Flowise будут удалены.
