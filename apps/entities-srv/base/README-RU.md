# Сервис сущностей

Сервис `entities-srv` управляет иерархическими сущностями, созданными на основе шаблонов и связанных ресурсов.

## API

- **Шаблоны** `/templates`
  - `GET /templates` — список шаблонов
  - `POST /templates` — создание шаблона
  - `GET /templates/:id` — получение шаблона
  - `PUT /templates/:id` — обновление шаблона
  - `DELETE /templates/:id` — удаление шаблона
- **Сущности** `/`
  - `GET /` — список сущностей
  - `POST /` — создание сущности
  - `GET /:id` — получение сущности
  - `PUT /:id` — обновление сущности
  - `DELETE /:id` — удаление сущности
  - `GET /:id/children` — дочерние сущности
  - `GET /:id/parents` — цепочка родителей
- **Владельцы** `/:entityId/owners`
  - `GET /:entityId/owners` — список владельцев
  - `POST /:entityId/owners` — добавление владельца
  - `PUT /owners/:id` — обновление владельца
  - `DELETE /owners/:id` — удаление владельца
- **Ресурсы** `/:entityId/resources`
  - `GET /:entityId/resources` — список ресурсов
  - `POST /:entityId/resources` — привязка ресурса
  - `PUT /:entityId/resources/:id` — обновление связи
  - `DELETE /:entityId/resources/:id` — удаление связи

## Модель данных

Ключевые сущности:
- **EntityStatus** — статусы
- **EntityTemplate** — шаблоны
- **Entity** — экземпляры
- **EntityOwner** — владельцы
- **EntityResource** — привязанные ресурсы
- **EntityRelation** — произвольные связи между сущностями

## Разработка

```bash
pnpm --filter @universo/entities-srv build
```
