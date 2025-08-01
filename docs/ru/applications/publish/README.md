# Система публикации

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo React. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

Система публикации предоставляет комплексные механизмы для экспорта пространств UPDL на различные платформы и их совместного использования с публичными URL.

## Обзор системы

Система публикации состоит из двух основных компонентов, работающих вместе для предоставления полного решения публикации контента:

- **Фронтенд (publish-frt)**: Клиентская обработка, конструкторы шаблонов и пользовательский интерфейс
- **Бэкенд (publish-srv)**: Управление данными, API конечные точки и определения типов

## Архитектура

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   Редактор      │───▶│   Узлы UPDL     │───▶│  Система        │
│   Flowise       │    │   (Данные потока)│    │  публикации     │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │                 │
                                              │  Публичные URL  │
                                              │  /p/{uuid}      │
                                              │                 │
                                              └─────────────────┘
```

## Фронтенд (publish-frt)

Фронтенд приложение обрабатывает весь пользовательский рабочий процесс публикации, включая финальное преобразование данных в просматриваемые форматы.

### Ключевые возможности

- **Клиентская обработка UPDL**: Использует класс `UPDLProcessor` для преобразования сырых `flowData` из бэкенда в валидные AR.js и PlayCanvas опыты
- **Конструкторы на основе шаблонов**: Гибкая система конструкторов с `ARJSBuilder` и `PlayCanvasBuilder`, поддерживающая множественные шаблоны
- **Шаблон MMOOMM Space MMO**: Комплексная среда космического MMO с промышленной лазерной добычей, физическим полетом и управлением инвентарем в реальном времени
- **Продвинутые игровые механики**: Система сущностей с кораблями, астероидами, станциями, воротами и сетевыми возможностями
- **Интеграция Supabase**: Сохраняет конфигурации публикации
- **Поддержка AR викторин**: Образовательные викторины с подсчетом очков и сбором лидов

### Поддерживаемые платформы

#### Экспорт AR.js
- **AR на основе маркеров**: Паттерн, штрих-код и NFT маркеры
- **Конфигурация библиотек**: Пользовательские источники библиотек (CDN или локальные)
- **Шаблоны викторин**: Образовательный контент с подсчетом очков
- **Мобильная оптимизация**: Адаптивный дизайн для мобильных устройств

#### Экспорт PlayCanvas
- **3D окружения**: Полный рендеринг 3D сцен
- **Шаблон MMOOMM**: Космическое MMO с добычей и торговлей
- **Интеграция физики**: Реалистичная симуляция физики
- **Системы сущностей**: Сложное управление игровыми объектами

### Критическая реализация: Рендеринг на основе Iframe

**ВАЖНО**: Контент AR.js и PlayCanvas должен рендериться с использованием подхода iframe для правильной загрузки библиотек и выполнения скриптов.

```typescript
// ✅ ПРАВИЛЬНО: подход iframe (полное выполнение скриптов)
const iframe = document.createElement('iframe')
iframe.style.width = '100%'
iframe.style.height = '100%'
iframe.style.border = 'none'
container.appendChild(iframe)

const iframeDoc = iframe.contentDocument
iframeDoc.open()
iframeDoc.write(html) // Сгенерированный HTML с тегами <script>
iframeDoc.close()
```

## Бэкенд (publish-srv)

Бэкенд сервис предоставляет управление данными и API конечные точки как workspace пакет (`@universo/publish-srv`).

### Ключевые возможности

- **Управление публикациями**: API конечные точки для создания и получения записей публикации
- **Поставщик данных потока**: Обслуживает сырые `flowData` из базы данных, делегируя всю обработку UPDL фронтенду
- **Централизованные типы**: Экспортирует общие UPDL и связанные с публикацией TypeScript типы
- **Модульность и разделение**: Полностью независим от бизнес-логики `packages/server`
- **Асинхронная инициализация маршрутов**: Предотвращает состояния гонки с соединениями базы данных

### API конечные точки

#### Создание публикации
```
POST /api/v1/publish/arjs
POST /api/v1/publish/playcanvas

Body: {
    "chatflowId": "uuid",
    "isPublic": true,
    "projectName": "My Experience",
    "libraryConfig": { ... }
}
```

#### Получение данных публикации
```
GET /api/v1/publish/arjs/public/:publicationId
GET /api/v1/publish/playcanvas/public/:publicationId

Response: {
    "success": true,
    "flowData": "{\"nodes\":[...],\"edges\":[...]}",
    "libraryConfig": { ... }
}
```

## Шаблон MMOOMM

Шаблон MMOOMM (Massive Multiplayer Online Object Mining Management) предоставляет:

### Основные возможности
- **Система промышленной лазерной добычи**: Автонаведение лазерной добычи с 3-секундными циклами
- **Управление космическим кораблем**: Движение WASD+QZ с физическими механиками полета
- **Управление инвентарем**: Грузовой отсек 20м³ с отслеживанием вместимости в реальном времени
- **Система сущностей**: Корабли, астероиды, станции и ворота с сетевыми возможностями
- **HUD в реальном времени**: Прогресс добычи, статус груза и системные индикаторы

### Игровые механики
- **Добыча**: Нацеливание на астероиды в радиусе 75 единиц, извлечение 1.5м³ ресурсов за цикл
- **Движение**: Полное 6DOF движение корабля с следованием камеры
- **Физика**: Обнаружение столкновений, динамика твердых тел и реалистичная космическая физика

## Рабочий процесс

Полный рабочий процесс публикации:

1. **Загрузка настроек**: Автоматически загружается из Supabase при монтировании компонента
2. **Конфигурация**: Пользователь настраивает параметры проекта (название, маркер, источники библиотек)
3. **Публикация**: Пользователь переключает "Сделать публичным" - запускает публикацию и сохраняет состояние
4. **API запрос**: Фронтенд отправляет POST запрос на соответствующую конечную точку
5. **Публичный доступ**: Публичный URL (`/p/{publicationId}`) рендерит соответствующий просмотрщик
6. **Получение данных**: Просмотрщик делает GET запрос для данных потока
7. **Обработка UPDL**: `UPDLProcessor` анализирует и преобразует данные потока
8. **Генерация конструктора**: Конструкторы шаблонов преобразуют пространство UPDL в целевой формат
9. **Рендеринг Iframe**: Сгенерированный HTML рендерится в iframe для правильного выполнения

## Интеграция Supabase

Сохранение состояния публикации обрабатывается через Supabase:

### Структура множественных технологий
Настройки хранятся в поле `chatbotConfig` со структурой:
```json
{
    "chatbot": { ... },
    "arjs": { ... },
    "playcanvas": { ... }
}
```

### Логика эксклюзивной публикации
Система обеспечивает, что только одна технология может быть публичной одновременно:
- Независимые состояния публикации для каждой технологии
- Автоматическое отключение других технологий при включении одной
- Управление глобальным статусом публикации

## Разработка

### Настройка
```bash
# Установить зависимости
pnpm install

# Собрать фронтенд
pnpm --filter publish-frt build

# Собрать бэкенд
pnpm --filter @universo/publish-srv build
```

### Режим разработки
```bash
# Разработка фронтенда
pnpm --filter publish-frt dev

# Разработка бэкенда
pnpm --filter @universo/publish-srv dev
```

## Соображения безопасности

- **Аутентификация**: Валидация JWT токенов для всех операций
- **Валидация ввода**: Комплексная валидация запросов
- **Изоляция Iframe**: Безопасный рендеринг контента в изолированных контекстах
- **Конфигурация CORS**: Правильная обработка межсайтовых запросов

## Будущие улучшения

- **Дополнительные платформы**: Поддержка Three.js, Babylon.js и других движков
- **Коллаборация в реальном времени**: Многопользовательское редактирование и публикация
- **Контроль версий**: Версионирование публикаций и возможности отката
- **Интеграция аналитики**: Отслеживание использования и метрики производительности

## Следующие шаги

- [Система UPDL](../updl/README.md) - Изучите универсальный язык определения платформ
- [Шаблоны MMOOMM](../../universo-platformo/mmoomm-templates/README.md) - Исследуйте предварительно созданные шаблоны
- [Экспорт на множественные платформы](../../universo-platformo/export/README.md) - Экспорт на разные платформы
