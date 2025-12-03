# Общая структура приложений и маппинг UPDL

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

Этот раздел описывает сводную структуру `packages/` и соответствие высокоуровневых узлов UPDL сервисам платформы. Служит точкой входа перед чтением страниц отдельных приложений. Глобальный контекст см. [Об Universo Platformo](../universo-platformo/about.md).

## Категории приложений

-   **Платформенные приложения**: `api-gateway`, `template-engine`, `node-registry`, `workflow-engine`, `api-docs`
-   **Технические системы**: `auth-enhanced`, `multiplayer`, `security`, `analytics-enhanced`, `monitoring`, `backup`
-   **Игровые механики**: `resources`, `ships`, `economy`, `mining`, `stations`, `navigation`, `combat`, `skills`, `sovereignty`, `industry`
-   **Социальные системы**: `corporations`, `diplomacy`, `trading`, `communications`, `reputation`, `events`
-   **Существующие**: `updl`, `publish-frontend/srv`, `profile-frontend/srv`, `analytics-frontend`, `auth-frontend`

## Ожидаемая структура каталогов (укрупнённо)

```txt
packages/
  updl/
  publish-frontend/
  publish-backend/
  profile-frontend/
  profile-backend/
  analytics-frontend/
  auth-frontend/

  # Платформа
  api-gateway-backend/
  template-engine-backend/
  node-registry-backend/
  workflow-engine-backend/
  api-docs-frontend/

  # Технические системы
  auth-enhanced-frontend/
  auth-enhanced-backend/
  multiplayer-backend/
  security-backend/
  analytics-enhanced-frontend/
  analytics-enhanced-backend/
  monitoring-frontend/
  backup-backend/

  # Игровые механики
  resources-frontend/  resources-backend/
  ships-frontend/      ships-backend/
  economy-frontend/    economy-backend/
  mining-frontend/     mining-backend/
  stations-frontend/   stations-backend/
  navigation-frontend/ navigation-backend/
  combat-frontend/     combat-backend/
  skills-frontend/     skills-backend/
  sovereignty-frontend/ sovereignty-backend/
  industry-frontend/    industry-backend/

  # Социальные системы
  corporations-frontend/ corporations-backend/
  diplomacy-frontend/    diplomacy-backend/
  trading-frontend/      trading-backend/
  communications-frontend/ communications-backend/
  reputation-frontend/     reputation-backend/
  events-frontend/         events-backend/
```

## Маппинг UPDL → сервисы (кратко)

-   **Space** → `navigation-backend`, `stations-backend`, `security-backend`, `sovereignty-backend`
-   **Entity** → `ships-backend`, `resources-backend`, `mining-backend`, `industry-backend`
-   **Component** → `ships-backend`, `stations-backend`, `skills-backend`, `industry-backend`
-   **Event** → `multiplayer-backend`, `combat-backend`, `trading-backend`, `events-backend`
-   **Action** → `combat-backend`, `trading-backend`, `mining-backend`, `industry-backend`
-   **Data** → `resources-backend`, `economy-backend`, `analytics-enhanced-backend`
-   **Universo** → `workflow-engine-backend`, `node-registry-backend`, `security-backend`

## Стандарт скелета каталогов (для страниц приложений)

```txt
packages/<service>-backend/base/
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

packages/<service>-frontend/base/
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
