# Current Research Context

**Purpose**: This file serves as a scratchpad for ongoing deep research findings from external analyses (other AI agents or sources). Use it to store detailed information or references that are currently being investigated, so as not to clutter the main context files. Keep it summarized and relevant. This file can be more free-form, but should still be in English and cleaned up when research is concluded (important findings can be moved into the relevant permanent files, and outdated info removed).

**Usage Guidelines**:
- Record ongoing research, external analysis, and temporary findings
- Use English language and structured notes (bullet points or short sections)
- Cite sources or link references when applicable
- Move relevant findings to permanent docs when research is concluded
- Remove outdated information to keep file current and relevant

## Current Research Activities

Короткое состояние: изучил имеющиеся roadmap-документы в `docs/en/roadmap/*` и текущую структуру `apps/`. Готов предложить цельную архитектуру и список приложений в `apps/` с назначением и границами сервисов, учитывая UPDL-узлы и интеграцию с PlayCanvas.

### Целевая архитектура (высокоуровнево)
- Архитектурный стиль: микросервисы с API-first и событийным взаимодействием.
- Авторитетный сервер для игровой логики: клиент (PlayCanvas) отправляет интенты, расчёты на сервере.
- Данные: Supabase PostgreSQL, схема per-service; Realtime — как событийная шина на этапе MVP, затем возможность вынести в отдельный брокер.
- Интеграция UPDL: узлы высокого уровня маппятся на REST/Events сервисов; `template-engine-srv` генерирует PlayCanvas-клиент с SDK.
- Пакеты общего назначения в `packages/` для типов, SDK, UI, утилит; публикация через PNPM workspaces.

### Структура `apps/` (предложения)
```txt
apps/
  updl/                            # уже есть: визуальный редактор (флоу/узлы)
  publish-frt/                     # уже есть: фронтенд публикации (AR.js, PlayCanvas)
  publish-srv/                     # уже есть: бэкенд публикации/шаблонов (будет разделён)

  # Платформа
  workflow-engine-srv/             # исполнение чатфлоу/геймфлоу (интеграция с UPDL)
  node-registry-srv/               # реестр UPDL-узлов/версий/схем
  template-engine-srv/             # генерация PlayCanvas/AR.js из флоу (+пакет ассетов)
  api-gateway-srv/                 # единая точка входа, версионирование, авторизация, rate limit
  api-docs-frt/                    # UI документации API (может использовать packages/api-documentation)
  profile-frt/                     # уже есть
  profile-srv/                     # уже есть

  # Технические системы
  auth-enhanced-frt/               # SSO/настройки безопасности/2FA
  auth-enhanced-srv/               # расширенная авторизация, роли/скоупы, гейм-сессии
  multiplayer-srv/                 # авторитетный WebSocket-сервер (сессии, позиции, события)
  security-srv/                    # античит/аудит/правила безопасности зон
  analytics-enhanced-frt/          # расширенная аналитика UI
  analytics-enhanced-srv/          # сбор метрик/ивентов, отчёты
  monitoring-frt/                  # панели статуса (стэк Grafana/Prometheus снаружи)
  backup-srv/                      # бэкапы/репликация (интерфейсы/джобы)

  # Игровая механика (Game Mechanics)
  resources-frt/                   # инвентарь, материалы, трансфер
  resources-srv/                   # материалы, плотности, ограничения массы/объёма
  ships-frt/                       # флот, конфигуратор
  ships-srv/                       # типы кораблей, модули, статы
  economy-frt/                     # кошелёк Inmo, курсы миров, история
  economy-srv/                     # балансы, конвертация, прайсинг, комиссии
  mining-frt/                      # UI майнинга/лазеры
  mining-srv/                      # спавн/истощение астероидов, серверная добыча
  stations-frt/                    # станции, доки, услуги
  stations-srv/                    # сервисы станций, парковка, хранение
  navigation-frt/                  # карты/ворота/маршруты
  navigation-srv/                  # миры/ворота/прыжки/инстансы
  combat-frt/                      # таргетинг/боевой UI
  combat-srv/                      # урон/броня/смерть/дропаут
  skills-frt/                      # очередь скиллов/прогресс
  skills-srv/                      # тренировка во времени/бонусы
  sovereignty-frt/                 # владение территориями
  sovereignty-srv/                 # влияние/окна уязвимости/структуры
  industry-frt/                    # производство/чертежи
  industry-srv/                    # линии, рецепты, расчёты времени/ресурсов

  # Социальные системы (Social)
  corporations-frt/                # корпорации, роли, управление
  corporations-srv/                # иерархии ролей, активы, логи
  diplomacy-frt/                   # альянсы, войны, договоры
  diplomacy-srv/                   # стояния, события дипломатии
  trading-frt/                     # маркет, ордера, контракты
  trading-srv/                     # книги ордеров, клиринг, комиссии
  communications-frt/              # чат/почта/форумы
  communications-srv/              # каналы, модерирование, хранение
  reputation-frt/                  # репутация/статусы
  reputation-srv/                  # расчёт репутации/штрафы/бонусы
  events-frt/                      # ивенты/уведомления
  events-srv/                      # диспетчер игровых событий/таймеры/календарь
```

### Границы и взаимодействия (коротко)
- Синхронно: REST через `api-gateway-srv` (версионирование `/api/v1/...`), JWT/скоупы, rate-limit.
- Асинхронно: Supabase Realtime каналы per-домен на MVP; далее опционально Redis Pub/Sub или RabbitMQ.
- Авторитетная симуляция: `multiplayer-srv` валидирует интенты (движение/майнинг/боёвка), обновляет состояние, пушит события.
- Сохранение состояния: каждый `*-srv` владеет своей схемой БД, публикует доменные события (event sourcing для критических доменов: экономика, боёвка).
- Интеграция PlayCanvas: `template-engine-srv` собирает клиент + `@universo-platformo/client-sdk` (из `packages/`), автогенерирует API-клиенты и типы.

### Минимальный состав таблиц (Supabase, per-service схемы)
- `resources.*`: `material_types`, `inventories`, `transfers`, `logs`
- `ships.*`: `ship_types`, `ships`, `modules`, `fits`
- `economy.*`: `wallets`, `currencies`, `rates`, `transactions`
- `mining.*`: `belts`, `asteroids`, `yield_events`
- `stations.*`: `stations`, `services`, `docks`, `storage`
- `navigation.*`: `worlds`, `gates`, `routes`, `instances`
- `combat.*`: `engagements`, `damage_logs`, `losses`
- `skills.*`: `skills`, `training_queues`, `bonuses`
- `sovereignty.*`: `systems`, `structures`, `ownership`, `timers`
- `industry.*`: `blueprints`, `production_lines`, `jobs`
- `corporations.*`: `corps`, `members`, `roles`, `assets`, `logs`
- `diplomacy.*`: `alliances`, `standings`, `treaties`
- `trading.*`: `markets`, `orders`, `contracts`, `fills`
- `communications.*`: `channels`, `messages`, `moderation`
- `reputation.*`: `scores`, `events`, `penalties`
- `events.*`: `scheduled_events`, `subscriptions`
- Техсервисы: `auth.*` (сессии/ключи), `analytics.*` (events/metrics)

### Маппинг UPDL → сервисы
- Space → `navigation-srv`, `stations-srv`, `security-srv`, `sovereignty-srv`
- Entity → `ships-srv`, `resources-srv`, `mining-srv`, `industry-srv`
- Component → `ships-srv`, `stations-srv`, `skills-srv`, `industry-srv`
- Event → `multiplayer-srv`, `combat-srv`, `trading-srv`, `events-srv`
- Action → `combat-srv`, `trading-srv`, `mining-srv`, `industry-srv`
- Data → `resources-srv`, `economy-srv`, `analytics-enhanced-srv`
- Universo → `workflow-engine-srv`, `node-registry-srv`, `security-srv`

### Пакеты в `packages/` (дополнить)
- `@universo-platformo/types` — общие интерфейсы и OpenAPI типы
- `@universo-platformo/client-sdk` — автогенерённые REST/WebSocket клиенты для PlayCanvas
- `@universo-platformo/utils` — утилиты, валидация (zod/joi), логирование
- `@universo-platformo/ui-components` — общие React-компоненты (если нужно)
- Расширение существующих `components/`, `ui/`, `server/` с чёткими публичными API

### Этапность внедрения (очень кратко)
- Этап 1 (SP, без сохранения → с сохранением): доработка текущего PlayCanvas, подключение `resources-srv`, `ships-srv`, `economy-srv`, `auth-enhanced-srv`.
- Этап 2 (Multiplayer): `multiplayer-srv` авторитетный, серверные расчёты майнинга/боёвки, синхронизация позиций.
- Этап 3 (Социалка/рынок): `corporations`, `trading`, `diplomacy`, `stations`, `navigation`.
- Этап 4 (Продвинутое): `combat`, `skills`, `sovereignty`, `industry`, безопасность.

Хочу следующим шагом подробно расписать 1-ю волну (минимальный набор для MVP-мультиплеера с авторитетным сервером): `multiplayer-srv`, `resources-srv`, `ships-srv`, `economy-srv`, `auth-enhanced-srv`, и обновления `template-engine-srv`. Подойдёт такой состав для старта?

- Вкратце, что сделал и что дальше:
  - Сверстал полную целевую архитектуру и предложил структуру `apps/` с назначением каждого сервиса, границы доменов и маппинг UPDL.
  - Готов детализировать первую волну сервисов (контракты API, схемы БД, события, интеграция с PlayCanvas/UPDL).


  ---

  Короткое состояние: ниже — чёткая поэтапная программа работ: какие `apps/` и `packages/` создать/доработать, какие задачи закрыть на каждом шаге, критерии готовности. Заточено под экспорт в PlayCanvas с авторитетным сервером, предикцией/реконсилиацией и античитом.

### Этап 0. Подготовка репозитория и пакетов
- Создать/актуализировать пакеты:
  - `packages/@universo-platformo/types` — общие типы DTO (ECS, intents, snapshots, events).
  - `packages/@universo-platformo/client-sdk` — автогенерённый REST/WS/Colyseus SDK.
  - `packages/@universo-platformo/utils` — валидация (zod), сериализация дельт, тайм-синхронизатор.
- Обновить `docs`:
  - Протокол и тикрейт: `docs/ru/roadmap/technical-specifications/authoritative-mmo-networking.md`.
  - Масштаб мира и координаты: `docs/ru/roadmap/technical-specifications/world-scale-and-coordinates.md`.
  - Клиент/сервер мультиплеера: `docs/ru/applications/technical-systems/multiplayer.md`.

### Этап 1. Экспорт из UPDL в PlayCanvas (SP-база)
- Доработать `apps/template-engine-srv`:
  - Маппинг UPDL: `Space/Entity/Component` → сцена/префабы/материалы.
  - Манифест ассетов и вариантов визуала (Visual + Health/Integrity).
  - Инъекция клиентского SDK (PlayCanvas + colyseus.js заглушка) и env-конфига.
- Критерии готовности:
  - Экспортируется сцена с игроком и несколькими сущностями; локальное управление работает без сервера.

### Этап 2. Бэкенд ядра данных (ECS + Ресурсы)
- Создать `apps/entities-srv`:
  - Таблицы: `ecs.entities`, `ecs.components` (JSONB), `ecs.entity_relations`.
  - REST: POST `/entities/instantiate`, GET `/entities/:id`, GET `/entities/:id/tree`, PATCH `/entities/:id`.
- Создать `apps/resources-srv`:
  - Таблицы: `resources.resource`, `resources.resource_version`, `resources.resource_bom`, `resources.units`.
  - REST: каталоги ресурсов, версии (draft→publish), BOM, DAG-валидация.
- Критерии готовности:
  - Из версии ресурса (`resourceVersionId`) создаётся дерево сущностей по BOM; атрибуты агрегируются.

### Этап 3. Авторитетный мультиплеер (Colyseus)
- Создать `apps/multiplayer-colyseus-srv` (Node/TS + Colyseus + Redis):
  - Комнаты per-мир/инстанс; фиксированный тик (30 Гц), снапшоты 10–20 Гц, дельты.
  - Интерес-менеджмент (grid/октодерево).
  - Протокол: intents (seq, tClient), `ack`, `snapshot`, `delta`, `event`.
  - Античит: лимиты скорости/ускорения/энергии/кулдаунов, верификация JWT, rate-limit.
  - Лаг-компенсация: rewind по tClient для `fire`/hitscan.
- Критерии готовности:
  - Несколько клиентов видят одинаковое состояние, не могут «ускоряться/телепортироваться», попадания считаются на сервере.
- Ссылки: [NetworkSynchronizer (идеология предикции/rewind)](https://github.com/GameNetworking/NetworkSynchronizer/discussions/116), [PlayCanvas × Colyseus](https://developer.playcanvas.com/tutorials/real-time-multiplayer-colyseus/)

### Этап 4. Клиент PlayCanvas: предикция/реконсилиация
- В `template-engine-srv` включить клиентский модуль:
  - Colyseus client; буферизация инпутов (seq, clientTime), локальная предикция движения.
  - Интерполяция/экстраполяция чужих сущностей; реконсилиация по `ack`/`snapshot`.
  - Origin rebasing (“move the world, not the user”) для больших сцен.
- Критерии готовности:
  - Плавное движение при 80–120 мс RTT; коррекции без рывков; стабильный FPS.

### Этап 5. Минимальные домены для геймплея
- `apps/ships-srv` (минимум):
  - Типы кораблей, базовые модули/масса/энергия; компонент Ship для ECS.
- `apps/combat-srv` (минимум):
  - Формулы урона/резистов (shield/armor/hull), применяются только на сервере.
- `apps/economy-srv` (минимум):
  - Кошельки/валюты (мир-внутренние + Inmo), перевод/аудит, инварианты.
- Критерии готовности:
  - Стрельба и базовый урон; списания/начисления проходят через инварианты экономики.

### Этап 6. Публикация/конфигурация/SDK
- `@universo-platformo/client-sdk`:
  - Клиент для REST и Colyseus (Room API), типы из OpenAPI/заготовок.
- `publish-frt` (если требуется UI конфигурации):
  - Подстановки env (серверы, комнаты), профили сборки.
- Критерии готовности:
  - Проект экспортируется из Chatflow (Space) одной кнопкой и поднимается с мультиплеером.

### Этап 7. Наблюдаемость и тестирование
- Метрики:
  - Тик-длительность, RTT, размеры дельт, reconciliation rate, аномалии античита.
- Нагрузочные/регрессионные:
  - WS-генератор, property-based экономика, реплей боёв.
- Критерии готовности:
  - SLO по лагу и пропускам; тесты проходят на N ботов с приемлемой деградацией.

### Этап 8. Масштабирование и шардирование
- Redis presence/pubsub, шардирование миров/инстансов.
- Миграция между шардом при переходе ворот/зон.
- Периодические снапшоты состояния комнат в БД.

### Что сделать прямо сейчас (минимальный трак)
- Создать скелеты: `apps/entities-srv`, `apps/resources-srv`, `apps/multiplayer-colyseus-srv`.
- В `template-engine-srv` добавить:
  - PlayCanvas-клиент с colyseus.js, предикцией/реконсилиацией, origin rebasing.
- Завести минимальные схемы БД и REST (entities/resources), интегрировать `multiplayer-srv` с ECS.
- Поднять демо-мир: 1 система, 3 корабля, базовая стрельба (сервер считает попадания), общий чат.

- Итог:
  - План разбит на шаги с чёткими критериями готовности. Начинаем с ядра (ECS/Resources) и авторитетного мультиплеера (Colyseus), параллельно допиливая экспорт в PlayCanvas и клиентскую предикцию/реконсилиацию.