# Общая структура приложений и маппинг UPDL

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo React. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

Этот раздел описывает сводную структуру `packages/` и соответствие высокоуровневых узлов UPDL сервисам платформы. Служит точкой входа перед чтением страниц отдельных приложений. Глобальный контекст см. [Об Universo Platformo](../universo-platformo/about.md).

## Категории приложений

-   **Платформенные приложения**: `api-gateway`, `template-engine`, `node-registry`, `workflow-engine`, `api-docs`
-   **Технические системы**: `auth-enhanced`, `multiplayer`, `security`, `analytics-enhanced`, `monitoring`, `backup`
-   **Игровые механики**: `resources`, `ships`, `economy`, `mining`, `stations`, `navigation`, `combat`, `skills`, `sovereignty`, `industry`
-   **Социальные системы**: `corporations`, `diplomacy`, `trading`, `communications`, `reputation`, `events`
-   **Существующие**: `updl`, `publish-frt/srv`, `profile-frt/srv`, `analytics-frt`, `auth-frt`

## Ожидаемая структура каталогов (укрупнённо)

```txt
packages/
  updl/
  publish-frt/
  publish-srv/
  profile-frt/
  profile-srv/
  analytics-frt/
  auth-frt/

  # Платформа
  api-gateway-srv/
  template-engine-srv/
  node-registry-srv/
  workflow-engine-srv/
  api-docs-frt/

  # Технические системы
  auth-enhanced-frt/
  auth-enhanced-srv/
  multiplayer-srv/
  security-srv/
  analytics-enhanced-frt/
  analytics-enhanced-srv/
  monitoring-frt/
  backup-srv/

  # Игровые механики
  resources-frt/  resources-srv/
  ships-frt/      ships-srv/
  economy-frt/    economy-srv/
  mining-frt/     mining-srv/
  stations-frt/   stations-srv/
  navigation-frt/ navigation-srv/
  combat-frt/     combat-srv/
  skills-frt/     skills-srv/
  sovereignty-frt/ sovereignty-srv/
  industry-frt/    industry-srv/

  # Социальные системы
  corporations-frt/ corporations-srv/
  diplomacy-frt/    diplomacy-srv/
  trading-frt/      trading-srv/
  communications-frt/ communications-srv/
  reputation-frt/     reputation-srv/
  events-frt/         events-srv/
```

## Маппинг UPDL → сервисы (кратко)

-   **Space** → `navigation-srv`, `stations-srv`, `security-srv`, `sovereignty-srv`
-   **Entity** → `ships-srv`, `resources-srv`, `mining-srv`, `industry-srv`
-   **Component** → `ships-srv`, `stations-srv`, `skills-srv`, `industry-srv`
-   **Event** → `multiplayer-srv`, `combat-srv`, `trading-srv`, `events-srv`
-   **Action** → `combat-srv`, `trading-srv`, `mining-srv`, `industry-srv`
-   **Data** → `resources-srv`, `economy-srv`, `analytics-enhanced-srv`
-   **Universo** → `workflow-engine-srv`, `node-registry-srv`, `security-srv`

## Стандарт скелета каталогов (для страниц приложений)

```txt
packages/<service>-srv/base/
  package.json
  README-RU.md
  src/
    api/
      routes/
      controllers/
      dto/
      validators/
    domain/
      models/
      services/
      events/
    infra/
      db/
      repos/
      clients/
    ws/
    index.ts

packages/<service>-frt/base/
  package.json
  README-RU.md
  gulpfile.ts
  src/
    app/
    components/
    services/api/
    store/
    utils/
```

## Навигация

-   Категории и страницы приложений см. в оглавлении слева и в разделе `docs/ru/applications/`.
