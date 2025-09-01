# Сервис сущностей

Сервис `entities-srv` отвечает за шаблоны сущностей, их экземпляры и привязанные ресурсы.

## Возможности
- реестр шаблонов и статусов
- иерархия сущностей родитель/потомок
- владельцы и ресурсы для каждой сущности
- произвольные связи между сущностями

## API
Полный список конечных точек см. в [apps/entities-srv/base/README.md](../../../../apps/entities-srv/base/README.md).

## Модель данных
Ключевые сущности:
- **EntityStatus** — статусы
- **EntityTemplate** — шаблоны
- **Entity** — экземпляры
- **EntityOwner** — владельцы
- **EntityResource** — ссылки на ресурсы
- **EntityRelation** — произвольные связи

## Разработка
```bash
pnpm --filter @universo/entities-srv build
```

## Фронтенд

`@universo/entities-frt` предоставляет React-компоненты для списка и редактирования сущностей и шаблонов.

### Компоненты
- **EntityList** — список с поиском и фильтрами по шаблону и статусу
- **EntityDetail** — вкладки с информацией, владельцами и ресурсами
- **EntityDialog** — форма создания/редактирования
- **TemplateList** — таблица управления шаблонами
- **TemplateDialog** — форма шаблона с `ResourceConfigTree`

### Сборка
```bash
pnpm --filter @universo/entities-frt build
```
