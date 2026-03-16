// ──── LOCAL INTERFACES (codebase convention — duplicated per migration file) ────

export interface SqlMigrationStatement {
    sql: string
    warningMessage?: string
}

export interface SqlMigrationDefinition {
    id: string
    version: string
    summary: string
    up: readonly SqlMigrationStatement[]
    down: readonly SqlMigrationStatement[]
}

// ──── LOCAL HELPERS ────

const normalizeSql = (value: string): string => value.replace(/\s+/g, ' ').trim()

const createDropPolicyIfTableExistsStatement = (policyName: string, schemaName: string, tableName: string): SqlMigrationStatement => ({
    sql: `
DO $$
BEGIN
    IF to_regclass('${schemaName}.${tableName}') IS NOT NULL THEN
        BEGIN
            EXECUTE format(
                'DROP POLICY IF EXISTS %I ON %I.%I',
                '${policyName}',
                '${schemaName}',
                '${tableName}'
            );
        EXCEPTION
            WHEN undefined_table THEN NULL;
        END;
    END IF;
END $$;
    `
})

const createPolicyStatement = (
    policyName: string,
    schemaName: string,
    tableName: string,
    forClause: string,
    usingClause: string,
    withCheckClause?: string
): SqlMigrationStatement => ({
    sql: `CREATE POLICY ${policyName} ON ${schemaName}.${tableName} ${forClause} USING (${usingClause})${
        withCheckClause ? ` WITH CHECK (${withCheckClause})` : ''
    }`
})

const createDropConstraintStatement = (schemaName: string, tableName: string, constraintName: string): SqlMigrationStatement => ({
    sql: `ALTER TABLE IF EXISTS ${schemaName}.${tableName} DROP CONSTRAINT IF EXISTS ${constraintName}`
})

const createCheckConstraintStatement = (
    schemaName: string,
    tableName: string,
    constraintName: string,
    expression: string
): SqlMigrationStatement => ({
    sql: `ALTER TABLE IF EXISTS ${schemaName}.${tableName} ADD CONSTRAINT ${constraintName} CHECK (${expression})`
})

// ──── VLC SEED HELPER ────

const vlc = (en: string, ru: string): string => {
    const obj = {
        _schema: '1',
        _primary: 'en',
        locales: {
            en: {
                content: en,
                version: 1,
                isActive: true,
                createdAt: '2024-12-06T00:00:00.000Z',
                updatedAt: '2024-12-06T00:00:00.000Z'
            },
            ru: {
                content: ru,
                version: 1,
                isActive: true,
                createdAt: '2024-12-06T00:00:00.000Z',
                updatedAt: '2024-12-06T00:00:00.000Z'
            }
        }
    }
    return `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`
}

// ──── SYSTEM FIELDS TEMPLATE ────

const SYSTEM_FIELDS = `
    _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_created_by UUID,
    _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_updated_by UUID,
    _upl_version INTEGER NOT NULL DEFAULT 1,
    _upl_archived BOOLEAN NOT NULL DEFAULT false,
    _upl_archived_at TIMESTAMPTZ,
    _upl_archived_by UUID,
    _upl_deleted BOOLEAN NOT NULL DEFAULT false,
    _upl_deleted_at TIMESTAMPTZ,
    _upl_deleted_by UUID,
    _upl_purge_after TIMESTAMPTZ,
    _upl_locked BOOLEAN NOT NULL DEFAULT false,
    _upl_locked_at TIMESTAMPTZ,
    _upl_locked_by UUID,
    _upl_locked_reason TEXT,
    _app_published BOOLEAN NOT NULL DEFAULT true,
    _app_published_at TIMESTAMPTZ,
    _app_published_by UUID,
    _app_archived BOOLEAN NOT NULL DEFAULT false,
    _app_archived_at TIMESTAMPTZ,
    _app_archived_by UUID,
    _app_deleted BOOLEAN NOT NULL DEFAULT false,
    _app_deleted_at TIMESTAMPTZ,
    _app_deleted_by UUID,
    _app_owner_id UUID,
    _app_access_level VARCHAR(20) NOT NULL DEFAULT 'private'`

// ──── SEED INSERT HELPER ────

const seedInsert = (
    table: string,
    codename: string,
    nameEn: string,
    nameRu: string,
    descEn: string,
    descRu: string,
    sortOrder: number
): SqlMigrationStatement => ({
    sql: `
INSERT INTO start.${table} (codename, name, description, sort_order, is_active)
VALUES (
    '${codename}',
    ${vlc(nameEn, nameRu)},
    ${vlc(descEn, descRu)},
    ${sortOrder},
    true
)
ON CONFLICT (codename) WHERE _upl_deleted = false AND _app_deleted = false
DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
             sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active
    `
})

// ──── FULL MIGRATION DEFINITION ────

const createStartSchemaMigrationDefinition: SqlMigrationDefinition = {
    id: 'CreateStartSchema1710000000000',
    version: '1710000000000',
    summary: 'Create start platform schema with catalog tables, user selections, RLS, and seed data',
    up: [
        // 1. Schema creation
        { sql: `CREATE SCHEMA IF NOT EXISTS start` },

        // 2. Catalog tables
        {
            sql: `
CREATE TABLE IF NOT EXISTS start.cat_goals (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
    codename VARCHAR(50) NOT NULL,
    name JSONB NOT NULL DEFAULT '{}',
    description JSONB DEFAULT '{}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,${SYSTEM_FIELDS}
)
            `
        },
        {
            sql: `
CREATE TABLE IF NOT EXISTS start.cat_topics (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
    codename VARCHAR(50) NOT NULL,
    name JSONB NOT NULL DEFAULT '{}',
    description JSONB DEFAULT '{}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,${SYSTEM_FIELDS}
)
            `
        },
        {
            sql: `
CREATE TABLE IF NOT EXISTS start.cat_features (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
    codename VARCHAR(50) NOT NULL,
    name JSONB NOT NULL DEFAULT '{}',
    description JSONB DEFAULT '{}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,${SYSTEM_FIELDS}
)
            `
        },

        // 3. Relation table
        {
            sql: `
CREATE TABLE IF NOT EXISTS start.rel_user_selections (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
    user_id UUID NOT NULL,
    catalog_kind VARCHAR(20) NOT NULL,
    item_id UUID NOT NULL,${SYSTEM_FIELDS}
)
            `
        },
        createDropConstraintStatement('start', 'rel_user_selections', 'user_selections_catalog_kind_check'),
        createCheckConstraintStatement(
            'start',
            'rel_user_selections',
            'user_selections_catalog_kind_check',
            `catalog_kind IN ('goals', 'topics', 'features')`
        ),

        // 4. Indexes — must precede seed INSERTs that use ON CONFLICT
        {
            sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_goals_codename_active
                  ON start.cat_goals (codename) WHERE _upl_deleted = false AND _app_deleted = false`
        },
        {
            sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_topics_codename_active
                  ON start.cat_topics (codename) WHERE _upl_deleted = false AND _app_deleted = false`
        },
        {
            sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_features_codename_active
                  ON start.cat_features (codename) WHERE _upl_deleted = false AND _app_deleted = false`
        },
        {
            sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_selections_unique
                  ON start.rel_user_selections (user_id, catalog_kind, item_id)
                  WHERE _upl_deleted = false AND _app_deleted = false`
        },
        // Performance indexes
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_goals_active
                  ON start.cat_goals (sort_order) WHERE _upl_deleted = false AND _app_deleted = false AND is_active = true`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_topics_active
                  ON start.cat_topics (sort_order) WHERE _upl_deleted = false AND _app_deleted = false AND is_active = true`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_features_active
                  ON start.cat_features (sort_order) WHERE _upl_deleted = false AND _app_deleted = false AND is_active = true`
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_user_selections_user
                  ON start.rel_user_selections (user_id) WHERE _upl_deleted = false AND _app_deleted = false`
        },

        // 5. Enable RLS
        { sql: `ALTER TABLE start.cat_goals ENABLE ROW LEVEL SECURITY` },
        { sql: `ALTER TABLE start.cat_topics ENABLE ROW LEVEL SECURITY` },
        { sql: `ALTER TABLE start.cat_features ENABLE ROW LEVEL SECURITY` },
        { sql: `ALTER TABLE start.rel_user_selections ENABLE ROW LEVEL SECURITY` },

        // 6. Seed data — Goals (10 items)
        seedInsert(
            'cat_goals',
            'teknokomo-era',
            'Teknokomo Era',
            'Эра Текнокомо',
            'The sixth technological revolution, maximum robotization and resource accessibility for all workers. Humanity directs its forces toward exploring the Universe, developing family and society, while justice becomes the norm, not the exception.',
            'Шестой технологический уклад, максимальная роботизация и доступность ресурсов для всех трудящихся. Человечество направляет силы на познание Вселенной, развитие семьи и общества, а справедливость становится нормой, а не исключением.',
            1
        ),
        seedInsert(
            'cat_goals',
            'world-communism',
            'World Communism',
            'Всемирный коммунизм',
            'A classless, moneyless, and stateless society based on self-governance and cooperation. Production and resources serve the common good, and personal freedom is combined with collective responsibility — without violence or coercion.',
            'Бесклассовое, безденежное и безгосударственное общество, основанное на самоуправлении и сотрудничестве. Производство и ресурсы служат общему благу, а свобода личности сочетается с ответственностью перед коллективом — без насилия и принуждения.',
            2
        ),
        seedInsert(
            'cat_goals',
            'global-cooperation',
            'Global Cooperation',
            'Глобальная кооперация',
            'A world where cooperatives and communities unite through shared projects, knowledge, and infrastructure. Transparent rules, joint ownership of labor results, and mutual aid become the foundation of the economy.',
            'Мир, где кооперативы и сообщества объединяются через общие проекты, знания и инфраструктуру. Прозрачные правила, совместное владение результатами труда и взаимопомощь становятся основой экономики.',
            3
        ),
        seedInsert(
            'cat_goals',
            'social-capitalism',
            'Social Capitalism',
            'Социальный капитализм',
            'A market economy with strong social support: the state and institutions maintain a basic level of well-being, reduce inequality, and support equal opportunities without breaking competition and entrepreneurship.',
            'Рыночная экономика с сильной социальной опорой: государство и институты удерживают базовый уровень благополучия, снижают неравенство и поддерживают равные возможности, не ломая конкуренцию и предпринимательство.',
            4
        ),
        seedInsert(
            'cat_goals',
            'anarchist-communities',
            'Anarchist Communities',
            'Анархические сообщества',
            'Stateless forms of self-governance where order rests on voluntary agreements, reputation, and horizontal associations. Functions of rules, arbitration, and security are provided by communities, cooperatives, or private institutions through trust, without a monopoly of power.',
            'Безгосударственные формы самоуправления, где порядок держится на добровольных соглашениях, репутации и горизонтальных объединениях. Функции правил, арбитража и безопасности обеспечиваются общинами, кооперативами или частными институтами через доверие, без монополии власти.',
            5
        ),
        seedInsert(
            'cat_goals',
            'space-empire',
            'Space Empire',
            'Космическая империя',
            'Expansion into space and unification of stations, settlements, and colonies under a single legal framework and development strategy. Governance is concentrated in a hereditary or elected emperor who approves imperial standards for security, communications, and logistics through a network of governors and departments.',
            'Экспансия в космос и объединение станций, поселений и колоний под единой правовой рамкой и стратегией развития. Управление сосредоточено у наследственного или выборного императора, который утверждает имперские стандарты безопасности, связи и логистики через сеть наместников и ведомств.',
            6
        ),
        seedInsert(
            'cat_goals',
            'market-socialism',
            'Market Socialism',
            'Рыночный социализм',
            'A compromise between public ownership and market incentives: enterprises can be publicly owned, while resource distribution and consumer choice happen through the market, not just through directives.',
            'Компромисс между общественной собственностью и рыночными стимулами: предприятия могут быть общественными, а распределение ресурсов и выбор потребления — происходить через рынок, а не только через директивы.',
            7
        ),
        seedInsert(
            'cat_goals',
            'technocratic-governance',
            'Technocratic Governance',
            'Технократическое управление',
            'A model where decisions rely on data, scientific methods, and verifiable expertise, with key roles given to competent specialists. Transparent criteria and accountability are important so expertise serves society rather than becoming a closed caste.',
            'Модель, где решения опираются на данные, научные методы и проверяемую экспертизу, а ключевые роли получают компетентные специалисты. Важны прозрачные критерии и подотчётность, чтобы экспертиза служила обществу, а не превращалась в закрытую касту.',
            8
        ),
        seedInsert(
            'cat_goals',
            'expert-meritocracy',
            'Expert Meritocracy',
            'Экспертная меритократия',
            'Advancement and influence are tied to measurable results and real contribution, with management decisions made by people with confirmed competence. The system is maintained by clear metrics, audits, and protection against nepotism and merit substitution.',
            'Продвижение и влияние завязаны на измеримые результаты и реальную пользу, а управленческие решения принимают люди с подтверждённой компетентностью. Система держится на понятных метриках, проверках и защите от кумовства и подмены «заслуг».',
            9
        ),
        seedInsert(
            'cat_goals',
            'ecological-technocivilization',
            'Ecological Technocivilization',
            'Экологическая техноцивилизация',
            'Technologies work alongside nature: clean energy, closed material cycles, repairability, and reuse instead of disposability. The goal is quality of life growth while simultaneously restoring ecosystems and reducing pollution.',
            'Технологии работают вместе с природой: чистая энергия, замкнутые циклы материалов, ремонтопригодность и повторное использование вместо одноразовости. Цель — рост качества жизни при одновременном восстановлении экосистем и снижении загрязнения.',
            10
        ),

        // 9. Seed data — Topics (10 items)
        seedInsert(
            'cat_topics',
            'computer-games',
            'Computer Games',
            'Компьютерные игры',
            'PC and console games: from story adventures to strategies and MMOs. Interest in mechanics, progression, competitiveness, and cooperative gameplay.',
            'Игры на ПК и консолях: от сюжетных приключений до стратегий и MMO. Интерес к механикам, прогрессии, соревновательности и совместному прохождению.',
            1
        ),
        seedInsert(
            'cat_topics',
            'board-games',
            'Board Games',
            'Настольные игры',
            'Board games, card games, wargames, and role-playing systems — everything that brings people together at one table. Interest in tactics, cooperation, history, and atmosphere.',
            'Настолки, карточные игры, варгеймы и ролевые системы — всё, что собирает людей за одним столом. Интерес к тактике, кооперации, истории и атмосфере.',
            2
        ),
        seedInsert(
            'cat_topics',
            'sports-lifestyle',
            'Sports & Active Lifestyle',
            'Спорт и активный образ жизни',
            'Training, team sports, running, hiking, martial arts, or fitness habits. Interest in discipline, endurance, and balance of body and mind.',
            'Тренировки, командные виды спорта, бег, туризм, единоборства или фитнес-привычки. Интерес к дисциплине, выносливости и балансу тела и разума.',
            3
        ),
        seedInsert(
            'cat_topics',
            'programming',
            'Programming & Development',
            'Программирование и разработка',
            'Creating applications, websites, games, and tools — from idea to release. Interest in architecture, code quality, automation, and engineering thinking.',
            'Создание приложений, сайтов, игр и инструментов — от идеи до релиза. Интерес к архитектуре, качеству кода, автоматизации и инженерному мышлению.',
            4
        ),
        seedInsert(
            'cat_topics',
            'robotics',
            'Robotics & Automation',
            'Робототехника и автоматизация',
            'Robots, sensors, smart devices, and control systems — from prototypes to industry. Interest in how hardware and software together change the real world.',
            'Роботы, датчики, умные устройства и системы управления — от прототипов до промышленности. Интерес к тому, как «железо» и софт вместе меняют реальный мир.',
            5
        ),
        seedInsert(
            'cat_topics',
            'science',
            'Science & Knowledge',
            'Наука и популяризация знаний',
            'Interest in research, experiments, reading popular science, and analyzing complex topics. Understanding the world more deeply and sharing knowledge with others matters.',
            'Интерес к исследованиям, экспериментам, чтению научпопа и разбору сложных тем. Важно понимать мир глубже и делиться знаниями с другими.',
            6
        ),
        seedInsert(
            'cat_topics',
            'space-futurism',
            'Space & Futurism',
            'Космос и футурология',
            'Space missions, stations, civilization scenarios, and future technologies. Interest in big goals, distant horizons, and designing the future.',
            'Космические миссии, станции, цивилизационные сценарии и технологии будущего. Интерес к большим целям, дальним горизонтам и проектированию будущего.',
            7
        ),
        seedInsert(
            'cat_topics',
            'cinema',
            'Cinema & Screenwriting',
            'Кино, сериалы и сценаристика',
            'Stories, characters, dramaturgy, editing, worldbuilding, and visual language. Interest in creating projects that inspire and unite people.',
            'Истории, персонажи, драматургия, монтаж, миростроение и визуальный язык. Интерес к созданию проектов, которые вдохновляют и объединяют людей.',
            8
        ),
        seedInsert(
            'cat_topics',
            'design-3d',
            'Design & 3D Visualization',
            'Дизайн, 3D и визуализация',
            'Graphics, UI/UX, 3D models, animation, and visual concepts. Interest in form, clarity, aesthetics, and how visuals affect meaning.',
            'Графика, UI/UX, 3D-модели, анимация и визуальные концепты. Интерес к форме, ясности, эстетике и тому, как визуал влияет на смысл.',
            9
        ),
        seedInsert(
            'cat_topics',
            'learning',
            'Learning & Self-Development',
            'Обучение и саморазвитие',
            'Courses, books, practices, methodologies, languages, and skills — everything that helps growth. Interest in systematic development and meaningful life.',
            'Курсы, книги, практики, методики, языки и навыки — всё, что помогает расти. Интерес к системному развитию и осмысленной жизни.',
            10
        ),

        // 10. Seed data — Features (10 items)
        seedInsert(
            'cat_features',
            'kiberplano',
            'Universo Kiberplano',
            'Universo Kiberplano',
            'A global planning and execution system: links goals, plans, tasks, and resources into a unified picture. Helps coordinate execution, see progress, and launch robotized processes — from local projects to large programs.',
            'Система мирового планирования и реализации: связывает цели, планы, задачи и ресурсы в единую картину. Помогает координировать исполнение, видеть прогресс и запускать роботизированные процессы — от локальных проектов до крупных программ.',
            1
        ),
        seedInsert(
            'cat_features',
            'mmoomm',
            'Universo MMOOMM',
            'Universo MMOOMM',
            'An MMO world for uniting people and collaborative creation: design, build, manage, and experiment in a virtual environment. Use scenarios, cooperation, and digital prototypes to transfer the best solutions to reality.',
            'MMO-мир для объединения людей и совместного созидания: проектируйте, стройте, управляйте и экспериментируйте в виртуальной среде. Используйте сценарии, кооперацию и цифровые прототипы, чтобы переносить лучшие решения в реальность.',
            2
        ),
        seedInsert(
            'cat_features',
            'cad-system',
            'CAD System',
            'CAD-система',
            'An environment for creating and modifying 2D drawings and 3D models of products, assemblies, and infrastructure. Supports collaboration, version control, and technical documentation output, with models usable for analysis and simulations.',
            'Среда для создания и изменения 2D-чертежей и 3D-моделей изделий, узлов и инфраструктуры. Поддерживает совместную работу, контроль версий и выпуск технической документации, а модели можно использовать для анализа и симуляций.',
            3
        ),
        seedInsert(
            'cat_features',
            'erp-system',
            'ERP System',
            'ERP-система',
            'A unified organizational management framework: finance, procurement, sales, production, warehousing, personnel, and reporting. All in one logic and one data source — for less chaos and more manageability.',
            'Единый контур управления организацией: финансы, закупки, продажи, производство, склад, персонал и отчётность. Всё в одной логике и в одном источнике данных — чтобы меньше хаоса и больше управляемости.',
            4
        ),
        seedInsert(
            'cat_features',
            'plm-system',
            'PLM System',
            'PLM-система',
            'Product lifecycle management: from idea and design to manufacturing, service, and updates. Organizes data, versions, specifications, and team collaboration around the product.',
            'Управление жизненным циклом продукта: от идеи и проектирования до производства, сервиса и обновлений. Упорядочивает данные, версии, спецификации и совместную работу команд вокруг продукта.',
            5
        ),
        seedInsert(
            'cat_features',
            'crm-system',
            'CRM System',
            'CRM-система',
            'Customer relationship management: contacts, deals, communications, support, and repeat sales. Helps build trust, see interaction history, and systematically develop the community/market.',
            'Управление отношениями с клиентами: контакты, сделки, коммуникации, поддержка и повторные продажи. Помогает выстраивать доверие, видеть историю взаимодействия и системно развивать сообщество/рынок.',
            6
        ),
        seedInsert(
            'cat_features',
            'bpm-workflow',
            'BPM / Workflow System',
            'BPM / Workflow-система',
            'Process modeling and automation: requests, approvals, regulations, task routes, and responsibility. Makes work transparent: who does what, in what timeframe, and with what result.',
            'Моделирование и автоматизация процессов: заявки, согласования, регламенты, маршруты задач и ответственность. Делает работу прозрачной: кто что делает, в какие сроки и с каким результатом.',
            7
        ),
        seedInsert(
            'cat_features',
            'wms-system',
            'WMS System',
            'WMS-система',
            'Warehouse and inventory management: receiving, placement, assembly, packaging, shipping, and inventorying. Provides precise control of goods movement and reduces time losses and errors.',
            'Управление складом и запасами: приёмка, размещение, сборка, упаковка, отгрузка, инвентаризация. Даёт точный контроль движения товаров и снижает потери времени и ошибок.',
            8
        ),
        seedInsert(
            'cat_features',
            'tms-system',
            'TMS System',
            'TMS-система',
            'Transportation planning and optimization: routes, carrier selection, statuses, tracking, and analytics. Helps deliver faster, transport cheaper, and better oversee logistics end-to-end.',
            'Планирование и оптимизация перевозок: маршруты, выбор перевозчиков, статусы, трекинг и аналитика. Помогает быстрее доставлять, дешевле перевозить и лучше видеть логистику «от и до».',
            9
        ),
        seedInsert(
            'cat_features',
            'courier-delivery',
            'Courier Delivery System',
            'Система курьерской доставки',
            'Courier and last-mile management: order distribution, route optimization, ETA, client notifications, and delivery confirmation. Especially useful for urban logistics, services, and projects with frequent deliveries.',
            'Управление курьерами и последней милей: распределение заказов, оптимизация маршрутов, ETA, уведомления клиентам, подтверждение доставки. Особенно полезна для городской логистики, сервисов и проектов с частыми доставками.',
            10
        )
    ],
    down: [
        createDropPolicyIfTableExistsStatement('admin_manage_all_selections', 'start', 'rel_user_selections'),
        createDropPolicyIfTableExistsStatement('users_manage_own_selections', 'start', 'rel_user_selections'),
        createDropPolicyIfTableExistsStatement('users_read_own_selections', 'start', 'rel_user_selections'),
        createDropPolicyIfTableExistsStatement('admin_manage_features', 'start', 'cat_features'),
        createDropPolicyIfTableExistsStatement('authenticated_read_features', 'start', 'cat_features'),
        createDropPolicyIfTableExistsStatement('admin_manage_topics', 'start', 'cat_topics'),
        createDropPolicyIfTableExistsStatement('authenticated_read_topics', 'start', 'cat_topics'),
        createDropPolicyIfTableExistsStatement('admin_manage_goals', 'start', 'cat_goals'),
        createDropPolicyIfTableExistsStatement('authenticated_read_goals', 'start', 'cat_goals'),
        { sql: `DROP TABLE IF EXISTS start.rel_user_selections CASCADE` },
        { sql: `DROP TABLE IF EXISTS start.cat_features CASCADE` },
        { sql: `DROP TABLE IF EXISTS start.cat_topics CASCADE` },
        { sql: `DROP TABLE IF EXISTS start.cat_goals CASCADE` },
        { sql: `DROP SCHEMA IF EXISTS start CASCADE` }
    ]
}

// ──── SPLIT INTO PREPARE / FINALIZE ────

const startSchemaPreludeStatements = createStartSchemaMigrationDefinition.up.filter(
    (statement) => normalizeSql(statement.sql) === 'CREATE SCHEMA IF NOT EXISTS start'
)

const startSchemaPostGenerationStatements = createStartSchemaMigrationDefinition.up.filter(
    (statement) =>
        !normalizeSql(statement.sql).startsWith('CREATE TABLE IF NOT EXISTS start.') &&
        normalizeSql(statement.sql) !== 'CREATE SCHEMA IF NOT EXISTS start'
)

export const prepareStartSchemaSupportMigrationDefinition: SqlMigrationDefinition = {
    id: 'PrepareStartSchemaSupport1710000000000',
    version: '1710000000000',
    summary: 'Prepare start support objects before definition-driven schema generation',
    up: startSchemaPreludeStatements,
    down: [] as const
}

export const finalizeStartSchemaSupportMigrationDefinition: SqlMigrationDefinition = {
    id: 'FinalizeStartSchemaSupport1710000000001',
    version: '1710000000001',
    summary: 'Finalize start support objects after definition-driven schema generation',
    up: startSchemaPostGenerationStatements,
    down: [] as const
}

export const applyStartSchemaPoliciesMigrationDefinition: SqlMigrationDefinition = {
    id: 'ApplyStartSchemaPolicies1733400000500',
    version: '1733400000500',
    summary: 'Apply start schema RLS policies after admin permission helpers are available',
    up: [
        createDropPolicyIfTableExistsStatement('admin_manage_all_selections', 'start', 'rel_user_selections'),
        createDropPolicyIfTableExistsStatement('users_manage_own_selections', 'start', 'rel_user_selections'),
        createDropPolicyIfTableExistsStatement('users_read_own_selections', 'start', 'rel_user_selections'),
        createDropPolicyIfTableExistsStatement('admin_manage_features', 'start', 'cat_features'),
        createDropPolicyIfTableExistsStatement('authenticated_read_features', 'start', 'cat_features'),
        createDropPolicyIfTableExistsStatement('admin_manage_topics', 'start', 'cat_topics'),
        createDropPolicyIfTableExistsStatement('authenticated_read_topics', 'start', 'cat_topics'),
        createDropPolicyIfTableExistsStatement('admin_manage_goals', 'start', 'cat_goals'),
        createDropPolicyIfTableExistsStatement('authenticated_read_goals', 'start', 'cat_goals'),
        createPolicyStatement('authenticated_read_goals', 'start', 'cat_goals', 'FOR SELECT', 'true'),
        createPolicyStatement(
            'admin_manage_goals',
            'start',
            'cat_goals',
            'FOR ALL',
            '(select admin.has_admin_permission((select auth.uid())))'
        ),
        createPolicyStatement('authenticated_read_topics', 'start', 'cat_topics', 'FOR SELECT', 'true'),
        createPolicyStatement(
            'admin_manage_topics',
            'start',
            'cat_topics',
            'FOR ALL',
            '(select admin.has_admin_permission((select auth.uid())))'
        ),
        createPolicyStatement('authenticated_read_features', 'start', 'cat_features', 'FOR SELECT', 'true'),
        createPolicyStatement(
            'admin_manage_features',
            'start',
            'cat_features',
            'FOR ALL',
            '(select admin.has_admin_permission((select auth.uid())))'
        ),
        createPolicyStatement('users_read_own_selections', 'start', 'rel_user_selections', 'FOR SELECT', 'user_id = (select auth.uid())'),
        createPolicyStatement(
            'users_manage_own_selections',
            'start',
            'rel_user_selections',
            'FOR ALL',
            'user_id = (select auth.uid())',
            'user_id = (select auth.uid())'
        ),
        createPolicyStatement(
            'admin_manage_all_selections',
            'start',
            'rel_user_selections',
            'FOR ALL',
            '(select admin.has_admin_permission((select auth.uid())))'
        )
    ],
    down: [] as const
}
