# UI/UX Спецификации

## Краткое описание

Детальные спецификации пользовательского интерфейса и пользовательского опыта для всех приложений Universo Platformo, включая дизайн-систему, wireframes и руководства по взаимодействию.

## Содержание

- [Дизайн-система](#дизайн-система)
- [Wireframes основных интерфейсов](#wireframes-основных-интерфейсов)
- [Пользовательские потоки](#пользовательские-потоки)
- [Адаптивный дизайн](#адаптивный-дизайн)
- [Accessibility](#accessibility)

## Дизайн-система

### Цветовая палитра

```typescript
interface ColorPalette {
    primary: {
        50: '#e3f2fd';   // Очень светлый синий
        100: '#bbdefb';  // Светлый синий
        500: '#2196f3';  // Основной синий
        700: '#1976d2';  // Темный синий
        900: '#0d47a1';  // Очень темный синий
    };
    
    secondary: {
        50: '#fce4ec';   // Светлый розовый
        100: '#f8bbd9';  // Розовый
        500: '#e91e63';  // Основной розовый
        700: '#c2185b';  // Темный розовый
        900: '#880e4f';  // Очень темный розовый
    };
    
    space: {
        deep: '#0a0a0a';     // Глубокий космос
        nebula: '#1a1a2e';   // Туманность
        star: '#16213e';     // Звездное поле
        plasma: '#0f3460';   // Плазма
        energy: '#533483';   // Энергия
    };
    
    status: {
        success: '#4caf50';  // Зеленый
        warning: '#ff9800';  // Оранжевый
        error: '#f44336';    // Красный
        info: '#2196f3';     // Синий
    };
    
    security: {
        highSec: '#00e676';  // Зеленый (High-sec)
        lowSec: '#ffeb3b';   // Желтый (Low-sec)
        nullSec: '#f44336';  // Красный (Null-sec)
        wormhole: '#9c27b0'; // Фиолетовый (Wormhole)
    };
}
```

### Типографика

```typescript
interface TypographyScale {
    fontFamily: {
        primary: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif';
        monospace: 'JetBrains Mono, Consolas, Monaco, monospace';
        display: 'Orbitron, sans-serif'; // Для заголовков в космической тематике
    };
    
    fontSize: {
        xs: '0.75rem';    // 12px
        sm: '0.875rem';   // 14px
        base: '1rem';     // 16px
        lg: '1.125rem';   // 18px
        xl: '1.25rem';    // 20px
        '2xl': '1.5rem';  // 24px
        '3xl': '1.875rem'; // 30px
        '4xl': '2.25rem'; // 36px
    };
    
    fontWeight: {
        light: 300;
        normal: 400;
        medium: 500;
        semibold: 600;
        bold: 700;
    };
    
    lineHeight: {
        tight: 1.25;
        normal: 1.5;
        relaxed: 1.75;
    };
}
```

### Spacing System

```typescript
interface SpacingScale {
    // Базовая единица: 4px
    0: '0px';
    1: '4px';
    2: '8px';
    3: '12px';
    4: '16px';
    5: '20px';
    6: '24px';
    8: '32px';
    10: '40px';
    12: '48px';
    16: '64px';
    20: '80px';
    24: '96px';
    32: '128px';
}
```

### Компонентная библиотека

```typescript
interface ComponentLibrary {
    buttons: {
        primary: ButtonComponent;
        secondary: ButtonComponent;
        danger: ButtonComponent;
        ghost: ButtonComponent;
        icon: IconButtonComponent;
    };
    
    inputs: {
        text: TextInputComponent;
        number: NumberInputComponent;
        select: SelectComponent;
        multiSelect: MultiSelectComponent;
        search: SearchInputComponent;
        dateTime: DateTimePickerComponent;
    };
    
    navigation: {
        navbar: NavbarComponent;
        sidebar: SidebarComponent;
        breadcrumbs: BreadcrumbsComponent;
        tabs: TabsComponent;
        pagination: PaginationComponent;
    };
    
    feedback: {
        alert: AlertComponent;
        toast: ToastComponent;
        modal: ModalComponent;
        tooltip: TooltipComponent;
        loading: LoadingComponent;
    };
    
    dataDisplay: {
        table: TableComponent;
        card: CardComponent;
        list: ListComponent;
        avatar: AvatarComponent;
        badge: BadgeComponent;
        progress: ProgressComponent;
    };
    
    gameSpecific: {
        shipCard: ShipCardComponent;
        resourceBar: ResourceBarComponent;
        skillQueue: SkillQueueComponent;
        marketOrder: MarketOrderComponent;
        corporationMember: CorporationMemberComponent;
        securityStatus: SecurityStatusComponent;
    };
}
```

## Wireframes основных интерфейсов

### 1. UPDL Node Editor

```typescript
interface UPDLEditorWireframe {
    layout: {
        header: {
            height: '64px';
            content: ['logo', 'projectName', 'saveButton', 'userMenu'];
        };
        
        sidebar: {
            width: '280px';
            sections: [
                'nodeLibrary',
                'projectExplorer',
                'properties'
            ];
        };
        
        canvas: {
            flex: 1;
            features: [
                'zoomControls',
                'minimap',
                'gridBackground',
                'nodeConnections'
            ];
        };
        
        bottomPanel: {
            height: '200px';
            tabs: ['console', 'debugger', 'output'];
        };
    };
    
    interactions: {
        dragAndDrop: 'nodes from library to canvas';
        nodeConnection: 'click and drag between connection points';
        contextMenu: 'right-click for node options';
        keyboardShortcuts: KeyboardShortcuts;
    };
}
```

### 2. MMOOMM Game Interface

```typescript
interface MMOOMMGameWireframe {
    layout: {
        topBar: {
            height: '48px';
            content: [
                'characterName',
                'corporationLogo',
                'inmoBalance',
                'skillQueue',
                'notifications'
            ];
        };
        
        leftPanel: {
            width: '320px';
            tabs: [
                'overview',
                'inventory',
                'fleet',
                'market',
                'corporation'
            ];
        };
        
        gameView: {
            flex: 1;
            overlay: [
                'targetingInterface',
                'speedControls',
                'weaponControls',
                'navigationControls'
            ];
        };
        
        rightPanel: {
            width: '280px';
            sections: [
                'localPlayers',
                'chat',
                'systemInfo'
            ];
        };
        
        bottomBar: {
            height: '40px';
            content: [
                'systemSecurity',
                'coordinates',
                'serverStatus',
                'fps'
            ];
        };
    };
}
```

### 3. Corporation Management

```typescript
interface CorporationManagementWireframe {
    layout: {
        header: {
            content: [
                'corporationLogo',
                'corporationName',
                'memberCount',
                'totalAssets'
            ];
        };
        
        navigation: {
            tabs: [
                'overview',
                'members',
                'roles',
                'assets',
                'wallet',
                'structures',
                'diplomacy'
            ];
        };
        
        content: {
            members: {
                table: ['name', 'title', 'roles', 'lastActive', 'contribution'];
                actions: ['invite', 'promote', 'kick', 'message'];
            };
            
            assets: {
                sections: ['ships', 'resources', 'structures', 'blueprints'];
                filters: ['location', 'type', 'value'];
            };
            
            diplomacy: {
                standings: ['allies', 'neutral', 'enemies'];
                wars: ['active', 'pending', 'history'];
            };
        };
    };
}
```

### 4. Market Trading Interface

```typescript
interface MarketTradingWireframe {
    layout: {
        header: {
            content: [
                'searchBar',
                'regionSelector',
                'quickFilters'
            ];
        };
        
        leftPanel: {
            width: '300px';
            sections: [
                'itemCategories',
                'recentItems',
                'watchlist'
            ];
        };
        
        centerPanel: {
            flex: 1;
            sections: [
                'itemDetails',
                'priceChart',
                'orderBook'
            ];
        };
        
        rightPanel: {
            width: '320px';
            sections: [
                'myOrders',
                'wallet',
                'quickBuy',
                'quickSell'
            ];
        };
    };
    
    features: {
        realTimePrices: 'WebSocket updates';
        priceAlerts: 'notification system';
        bulkOperations: 'multi-item trading';
        advancedFilters: 'complex search criteria';
    };
}
```

## Пользовательские потоки

### 1. Новый игрок (Onboarding)

```typescript
interface OnboardingFlow {
    steps: [
        {
            step: 1;
            title: 'Создание аккаунта';
            actions: ['email', 'password', 'verification'];
            duration: '2 минуты';
        },
        {
            step: 2;
            title: 'Выбор мира';
            actions: ['worldSelection', 'characterCreation'];
            duration: '3 минуты';
        },
        {
            step: 3;
            title: 'Обучение основам';
            actions: ['tutorial', 'firstMission', 'skillQueue'];
            duration: '15 минут';
        },
        {
            step: 4;
            title: 'Первые действия';
            actions: ['mining', 'trading', 'socialInteraction'];
            duration: '30 минут';
        }
    ];
    
    exitPoints: [
        'skipTutorial',
        'pauseOnboarding',
        'getHelp'
    ];
    
    success_metrics: {
        completion_rate: 85;
        time_to_first_action: 300; // секунд
        retention_day_1: 70; // процент
    };
}
```

### 2. Создание корпорации

```typescript
interface CorporationCreationFlow {
    prerequisites: [
        'minimumSkillPoints',
        'inmoDeposit',
        'cleanSecurityStatus'
    ];
    
    steps: [
        {
            step: 1;
            title: 'Базовая информация';
            fields: ['name', 'ticker', 'description', 'headquarters'];
        },
        {
            step: 2;
            title: 'Настройка ролей';
            actions: ['createRoles', 'setPermissions', 'assignInitialRoles'];
        },
        {
            step: 3;
            title: 'Финансы';
            actions: ['initialDeposit', 'taxSettings', 'walletSetup'];
        },
        {
            step: 4;
            title: 'Приглашение участников';
            actions: ['sendInvites', 'setRecruitmentStatus'];
        }
    ];
    
    validation: {
        nameUniqueness: 'real-time check';
        tickerAvailability: 'real-time check';
        fundsSufficiency: 'balance verification';
    };
}
```

### 3. Территориальная война

```typescript
interface SovereigntyWarfareFlow {
    phases: [
        {
            phase: 'preparation';
            duration: '24 hours';
            actions: [
                'warDeclaration',
                'allyNotification',
                'strategyPlanning'
            ];
        },
        {
            phase: 'entosis';
            duration: '4 hours';
            actions: [
                'entosisLinking',
                'nodeCapture',
                'defenseCoordination'
            ];
        },
        {
            phase: 'reinforcement';
            duration: '24-48 hours';
            actions: [
                'structureReinforcement',
                'timerManagement',
                'finalBattle'
            ];
        },
        {
            phase: 'resolution';
            duration: '1 hour';
            actions: [
                'ownershipTransfer',
                'assetDistribution',
                'diplomaticConsequences'
            ];
        }
    ];
    
    notifications: {
        participants: 'real-time updates';
        allies: 'strategic notifications';
        neutral: 'public announcements';
    };
}
```

## Адаптивный дизайн

### Breakpoints

```typescript
interface ResponsiveBreakpoints {
    mobile: '320px - 767px';
    tablet: '768px - 1023px';
    desktop: '1024px - 1439px';
    large: '1440px+';
}
```

### Адаптивные компоненты

```typescript
interface ResponsiveComponents {
    navigation: {
        mobile: 'hamburger menu + bottom tabs';
        tablet: 'collapsible sidebar';
        desktop: 'full sidebar + top navigation';
    };
    
    gameInterface: {
        mobile: 'single panel with tabs';
        tablet: 'two-panel layout';
        desktop: 'three-panel layout';
    };
    
    dataTable: {
        mobile: 'card layout with essential data';
        tablet: 'horizontal scroll with key columns';
        desktop: 'full table with all columns';
    };
}
```

## Accessibility

### WCAG 2.1 Compliance

```typescript
interface AccessibilityFeatures {
    colorContrast: {
        normal: 4.5; // минимальное соотношение
        large: 3.0;  // для крупного текста
    };
    
    keyboardNavigation: {
        tabOrder: 'logical sequence';
        focusIndicators: 'visible and clear';
        shortcuts: KeyboardShortcuts;
    };
    
    screenReader: {
        altText: 'all images and icons';
        ariaLabels: 'interactive elements';
        landmarks: 'page structure';
    };
    
    reducedMotion: {
        respectPreference: true;
        alternativeAnimations: 'fade instead of slide';
    };
    
    colorBlindness: {
        notColorOnly: 'additional indicators';
        patterns: 'shape and texture support';
    };
}
```

### Игровая доступность

```typescript
interface GameAccessibility {
    visualImpairment: {
        highContrast: 'alternative color schemes';
        fontSize: 'scalable UI elements';
        colorBlindSupport: 'pattern-based indicators';
    };
    
    motorImpairment: {
        customKeybinds: 'remappable controls';
        clickTargets: 'minimum 44px touch targets';
        dragAlternatives: 'click-based alternatives';
    };
    
    cognitiveSupport: {
        tutorials: 'step-by-step guidance';
        tooltips: 'contextual help';
        simplifiedMode: 'reduced complexity option';
    };
    
    hearingImpairment: {
        visualAlerts: 'flash notifications';
        subtitles: 'all audio content';
        vibration: 'mobile haptic feedback';
    };
}
```

## Связанные страницы

- [Технические спецификации](README.md)
- [Приложения MMOOMM](../target-architecture/mmoomm-apps.md)
- [План реализации](../implementation-plan/README.md)

## Статус разработки

- [x] Дизайн-система определена
- [x] Wireframes созданы
- [x] Пользовательские потоки описаны
- [ ] Прототипы созданы
- [ ] Пользовательское тестирование
- [ ] Финальный дизайн

---
*Последнее обновление: 5 августа 2025*
