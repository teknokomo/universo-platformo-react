# MMOOMM Flight Simulator

Fixture MMOOMM flight simulator является продуктовой конфигурацией метахаба, а
не новым MMOOMM-специфичным пакетом. Он создаётся Playwright-генератором
`metahubs-mmoomm-flight-app-export`; результат записывается в
`tools/fixtures/metahubs-mmoomm-flight-app-snapshot.json`.

![Рантайм Space в симуляторе полёта MMOOMM](../.gitbook/assets/mmoomm-flight/runtime-space.png)

Сгенерированный метахаб подключает три generic wrapper-пакета:
`@universo-react/playcanvas-engine`, `@universo-react/colyseus-client` и
`@universo-react/colyseus-server`. Мир, корабль, станция, runtime движения и
canvas-виджет представлены через Objects, Modules и generic widget
`playcanvasCanvas` в layout приложения.

После импорта snapshot опубликуйте метахаб как приложение и откройте runtime
двумя аутентифицированными пользователями с правом редактирования контента.
Оба пользователя подключаются к одной Colyseus-комнате опубликованного
приложения. Сервер владеет позициями кораблей, выдаёт по одному стабильному кораблю
на пользователя,
принимает только намерения движения (`move_to_point`, `move_to_object`, `stop`)
и ищет свободную spawn-позицию, если точка по умолчанию заблокирована.

В центральной зоне dashboard появится ограниченный PlayCanvas canvas с простыми
белыми primitive-кораблями и белой станцией, а также видимые команды движения,
остановки, приближения и поворота камеры. Локальный корабль использует
sequenced prediction с подтверждением сервера; remote ships интерполируются из
authoritative room state. Короткие сетевые разрывы используют Colyseus
reconnection и не должны создавать дубли кораблей.

## Snapshot, созданный через PlayCanvas Editor

Канонический MMOOMM snapshot приложения, созданный через PlayCanvas Editor,
находится в `tools/fixtures/metahubs-mmoomm-app-snapshot.json`. Он создаётся
Playwright-генератором `metahubs-mmoomm-app-export`, который проходит браузерный
продуктовый сценарий вместо прямой записи snapshot.

Генератор создаёт метахаб из шаблона `basic`, подключает пакеты Colyseus и
PlayCanvas, создаёт MMOOMM Object/Set/Enumeration модель и runtime-модули через
UI метахаба, создаёт два связанных Projects instance, открывает hosted
PlayCanvas Editor для каждого целевого project, публикует оба PlayCanvas project,
настраивает runtime dashboard widgets на playable authoring manifest и visual-lab
manifest и экспортирует snapshot.

Первый project, `MMOOMM Authoring`, остаётся playable flight proof. В нём
находится базовая сцена с кораблём и станцией, и только его manifest связывается
с опубликованным flight widget `playcanvasCanvas` в разделе `Space`.

Второй project, `MMOOMM Visual Linkup Lab`, является visual comparison lab для
MVP-стиля слабого подключения к роботу-аватару. Он содержит 16 детерминированных
primitive-вариантов, разложенных в comparison grid. В каждом варианте есть ship,
station, rock asteroid и ice asteroid objects с белой полупрозрачной core
geometry, type-color additive glow shells, fog metadata и low-poly evidence там,
где вариант запрашивает угловатую geometry. Lab metadata хранится в
`metadata.mmoomm.visualLab`, поэтому она не ослабляет существующий flight
contract `metadata.mmoomm.scene`.

Runtime replay test импортирует этот snapshot, создаёт и синхронизирует
опубликованное приложение, открывает раздел `Space` и проверяет, что PlayCanvas
canvas использует опубликованный runtime manifest `MMOOMM Authoring`, созданный
через Editor, а не fallback scene data. Затем тест открывает раздел
`Visual Linkup Lab` и проверяет второй bounded widget `playcanvasCanvas` как
обычную user-facing runtime surface: static visual-lab status, nonblank WebGL
canvas, ожидаемые counts объектов и вариантов, camera controls, focus
containment, responsive viewport matrix и отсутствие technical leakage.
