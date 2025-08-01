# Архитектура Builder Systems

Архитектура Builder Systems обеспечивает модульный подход к генерации кода в шаблонах MMOOMM. Эта система была рефакторена из монолитного файла в 1,211 строк в чистую, поддерживаемую архитектуру с сокращением кода на 79% при сохранении всей функциональности.

## Обзор

Архитектура Builder Systems состоит из нескольких специализированных модулей:

- **Основные системы** - Центральная координация и генерация сцены
- **Встроенные системы** - JavaScript системы, встроенные в HTML
- **HTML системы** - Генерация HTML документов и реестр
- **Системы инициализации** - Инициализация PlayCanvas и сцены
- **Глобальные объекты** - Управление жизненным циклом объектов window

## Компоненты архитектуры

### Основные системы

Расположены в `builderSystems/core/`

#### BuilderSystemsManager
Центральный координатор для всех builder систем.

**Обязанности:**
- Координация всех подсистем
- Генерация полных HTML документов
- Управление интеграцией встроенного JavaScript
- Предоставление единого API для template builders

**Ключевые методы:**
```typescript
generateCompleteHTML(entities, components, events): string
generateEmbeddedJavaScript(): string
initializeAllSystems(): void
```

#### DefaultSceneGenerator
Генерирует конфигурации сцены по умолчанию и обработку ошибок.

**Возможности:**
- Настройка освещения по умолчанию
- Конфигурация камеры
- Генерация сцены ошибок
- Проверка сцены

### Встроенные системы

Расположены в `builderSystems/systems/`

#### embeddedControlsSystem
Управляет системами управления космическим кораблем, встроенными в HTML.

**Возможности:**
- Управление движением WASD
- Поворот камеры (Q/Z, E/C)
- Управление лазерной добычей (Space)
- Торговые взаимодействия (F)

#### embeddedHUDSystem
Обеспечивает функциональность интерфейса пользователя.

**Возможности:**
- Отображение инвентаря в реальном времени
- Информация о состоянии корабля
- Счетчики ресурсов
- Торговый интерфейс

#### embeddedPhysicsSystem
Обрабатывает инициализацию и управление физикой.

**Возможности:**
- Физика невесомости космоса
- Настройка обнаружения коллизий
- Управление rigidbody
- Конфигурация физического мира

#### embeddedHelperFunctions
Утилитарные функции для игровой механики.

**Возможности:**
- Вспомогательные функции торговли (`tradeAll`, `tradeHalf`)
- Инициализация космических управлений
- Утилиты управления сущностями

### HTML системы

Расположены в `builderSystems/htmlSystems/`

#### htmlDocumentGenerator
Генерирует полные HTML документы со встроенным JavaScript.

**Возможности:**
- Генерация HTML структуры
- Интеграция CSS стилей
- Встраивание JavaScript
- Интеграция библиотеки PlayCanvas

#### embeddedSystemsRegistry
Реестр для всех встроенных JavaScript систем.

**Возможности:**
- Регистрация и поиск систем
- Управление зависимостями
- Контроль порядка выполнения
- Координация глобальных объектов

### Системы инициализации

Расположены в `builderSystems/initialization/`

#### playcanvasInitializer
Обрабатывает инициализацию движка PlayCanvas.

**Возможности:**
- Настройка и конфигурация canvas
- Инициализация движка
- Настройки графики
- Оптимизация производительности

#### sceneInitializer
Управляет настройкой сцены и созданием сущностей.

**Возможности:**
- Создание иерархии сцены
- Создание экземпляров сущностей
- Прикрепление компонентов
- Настройка системы событий

### Управление глобальными объектами

Расположено в `builderSystems/globalObjects/`

#### globalObjectsManager
Управляет жизненным циклом объектов window и глобальным состоянием.

**Возможности:**
- Регистрация объектов window
- Управление глобальным состоянием
- Межсистемная коммуникация
- Очистка памяти

## Соглашение об именовании файлов

Все файлы следуют согласованному именованию camelCase:

```
builderSystems/
├── core/
│   ├── builderSystemsManager.ts
│   ├── defaultSceneGenerator.ts
│   └── index.ts
├── systems/
│   ├── embeddedControlsSystem.ts
│   ├── embeddedHUDSystem.ts
│   ├── embeddedPhysicsSystem.ts
│   ├── embeddedHelperFunctions.ts
│   └── index.ts
├── htmlSystems/
│   ├── htmlDocumentGenerator.ts
│   ├── embeddedSystemsRegistry.ts
│   └── index.ts
├── initialization/
│   ├── playcanvasInitializer.ts
│   ├── sceneInitializer.ts
│   └── index.ts
└── globalObjects/
    ├── globalObjectsManager.ts
    └── index.ts
```

## Поток интеграции

### 1. Инициализация системы

```typescript
// BuilderSystemsManager координирует все системы
const manager = new BuilderSystemsManager();
manager.initializeAllSystems();
```

### 2. Генерация HTML

```typescript
// Генерировать полный HTML со встроенными системами
const html = manager.generateCompleteHTML(entities, components, events);
```

### 3. Встраивание JavaScript

```typescript
// Встроить все JavaScript системы
const embeddedJS = manager.generateEmbeddedJavaScript();
```

### 4. Интеграция PlayCanvas

```typescript
// Инициализировать PlayCanvas с сгенерированным контентом
const playcanvasCode = playcanvasInitializer.generateInitCode();
const sceneCode = sceneInitializer.generateSceneCode();
```

## Интеграция шаблонов

### Интеграция PlayCanvasMMOOMMBuilder

```typescript
export class PlayCanvasMMOOMMBuilder extends AbstractTemplateBuilder {
  private builderSystemsManager: BuilderSystemsManager;

  constructor() {
    super();
    this.builderSystemsManager = new BuilderSystemsManager();
  }

  build(data: any): string {
    // Извлечь и обработать узлы
    const { entities, components, events } = this.extractNodes(data);
    
    // Генерировать полный HTML используя модульные системы
    return this.builderSystemsManager.generateCompleteHTML(
      entities, 
      components, 
      events
    );
  }
}
```

## Преимущества модульной архитектуры

### Поддерживаемость
- **Разделение ответственности**: Каждая система имеет конкретную ответственность
- **Организация кода**: Логическая группировка связанной функциональности
- **Легкие обновления**: Изменения изолированы в конкретных модулях

### Переиспользуемость
- **Общие шаблоны**: Системы могут быть переиспользованы в разных шаблонах
- **Библиотеки компонентов**: Встроенные системы работают как переиспользуемые компоненты
- **Наследование шаблонов**: Новые шаблоны могут расширять существующие системы

### Тестируемость
- **Модульное тестирование**: Отдельные системы могут быть протестированы изолированно
- **Интеграционное тестирование**: Взаимодействия систем могут быть проверены
- **Отладка**: Проблемы могут быть отслежены до конкретных модулей

### Производительность
- **Разделение кода**: Загружаются только необходимые системы
- **Ленивая загрузка**: Системы могут быть загружены по требованию
- **Оптимизация**: Отдельные системы могут быть оптимизированы независимо

## Лучшие практики

### Дизайн модулей
1. **Единая ответственность**: Каждый модуль должен иметь одну четкую цель
2. **Слабая связанность**: Минимизировать зависимости между модулями
3. **Высокая связность**: Связанная функциональность должна быть сгруппирована вместе

### Организация файлов
1. **Согласованное именование**: Использовать camelCase для всех имен файлов
2. **Логическая группировка**: Группировать связанные файлы в соответствующих директориях
3. **Четкие экспорты**: Использовать файлы index.ts для чистых экспортов модулей

### Качество кода
1. **TypeScript интерфейсы**: Определить четкие интерфейсы для контрактов систем
2. **Обработка ошибок**: Реализовать правильную обработку ошибок в каждой системе
3. **Документация**: Документировать ответственности и API систем

## Руководство по миграции

### От монолитного к модульному

1. **Идентификация систем**: Разбить монолитный код на логические системы
2. **Извлечение интерфейсов**: Определить четкие интерфейсы для каждой системы
3. **Создание модулей**: Реализовать каждую систему как отдельный модуль
4. **Обновление импортов**: Обновить все операторы импорта для использования новых модулей
5. **Тестирование интеграции**: Проверить, что все системы работают вместе правильно

### Обновление существующего кода

1. **Изменения импортов**: Обновить импорты для использования новой структуры модулей
2. **Изменения API**: Адаптироваться к новым API систем при необходимости
3. **Конфигурация**: Обновить конфигурацию для использования новой структуры систем

## Связанная документация

- [Система Transform для сущностей](entity-transform-system.md) - Позиционирование и масштабирование сущностей
- [Система компонентов](component-system.md) - Конфигурация сущностей на основе компонентов
- [Обзор шаблонов MMOOMM](README.md) - Общая документация шаблонов
