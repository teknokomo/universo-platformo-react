# Current research

---

# Question

Мне кажется у нас в структуре /apps уже куча файлов в которых есть генерация нужного HTML как для гибридного подхода, который мы не доделали, так и для "Потоковой генерации" на стороне фронта. То что сделано не подойдёт или всё нормально и можно использовать? Всё это нужно глубоко изучить и предложить для обсуждения обновлённый план действий.

---

# Answer

Ниже приводится детальный разбор того, что уже реализовано, найденные несоответствия и обновлённый план доработок.

1.  Что уже есть  
    1.1. В фронтенде (`apps/publish-frt`) компоненты  
        • `ARJSPublisher` — UI для настройки публикации, формирует HTML через свой `ARJSExporter` и вызывает `publishARJSProject`.  
        • `updlApi.publishARJSProject` → POST `/api/updl/publish/arjs` с телом `{ sceneId, title, html, markerType, markerValue, isPublic }`.  
        • `ARJSExporter.generateHTML` — покрывает все данные сцены, конвертацию UPDL-нод → A-Frame и генерацию правильного HTML.  
    1.2. В бэкенде для UPDL-публикаций (`apps/publish-srv`) настроены:  
        • Маршруты `/api/updl/scene/:id`, `/api/updl/publish/arjs`, `/api/updl/publication/arjs/:id`, `/api/updl/publications/arjs` и статический возврат HTML в `/api/updl/p/arjs/:id`.  
        • В контроллере `UPDLController.publishUPDLToARJS`  
            – записывается `index.html` в папку `public/published/<publishId>/index.html`  
            – сохраняются метаданные в in-memory “базу”  
            – возвращается объект с полем `url: <baseUrl>/published/<publishId>/`  
    1.3. Статическая раздача (`server.ts`)  
        • `express.static(publicDir)` на корень папки `public`  
        • `GET /p/:id` → `public/p/<id>/index.html`  
        • `GET /published/:id` → `public/published/<id>`  

2.  Найденные проблемы  
    – UI копирует полный URL из поля `url` (вместо относительного пути) и снова префиксует `window.location.origin`, получается `http://…http://…`.  
    –  Контроллер отдаёт `url = <baseUrl>/published/<id>/`, а статический маршрут — `/p/:id` и `/published/:id` с неправильным путём (без `index.html`).  
    –  Папки для `/p/<id>` и `public/p/<id>` вообще не используются, а HTML кладётся в `public/published/<id>`.  
    –  В роутах UPDL есть `/api/updl/p/arjs/:id`, а в статике — `/p/:id`, но UI открывает `/p/<id>`, что на текущем стеке не сработает.  

3.  Обновлённый план действий  
    3.1. Унификация путей публикации  
        a) В `UPDLController.publishUPDLToARJS` возвращать относительный путь, например  
           `{ data: { publicationId, path: `/p/${publicationId}` } }`  
        b) В `apps/publish-srv/base/src/server.ts` добавить или поправить маршрут:  
           ```typescript
           // English comments for code changes
           // Universo Platformo | Serve AR.js published HTML under /p/:id
           expressApp.get('/p/:id', (req, res) => {
             const fn = path.join(publicDir, 'published', req.params.id, 'index.html')
             res.sendFile(fn)
           })
           ```  
        c) Удалить или скорректировать второй роут `/published/:id` (он дублирует `/p/:id`) или перенести туда для совместимости.  

    3.2. Поправка UI — корректная обработка URL  
        –  В `updlApi.publishARJSProject` после получения ответа из `POST /api/updl/publish/arjs` сохранять в `publishUrl` именно относительный `path`, а не полный URL.  
        –  В `ARJSPublisher.copyToClipboard` использовать просто `window.location.origin + publishUrl`, где `publishUrl = '/p/<id>'`.  

    3.3. Тестирование поточной генерации  
        –  Убедиться, что опция `generationMode = 'streaming'` при публикации влияет на батчинг/статус (метод `updatePublicationStatus`), и что в контроллере UPDL есть логика для этой ветки (может потребоваться доработить создание метаданных).  

    3.4. Интеграция в основной Flowise  
        –  Если финальное приложение будет запускаться под портом 8080 (Flowise), нужно замаунтить роуты UPDL-публикаций прямо в основной экспресс-сервер (`packages/server/src/index.ts`), чтобы `/api/updl/*` и `/p/:id` работали без дополнительного proxy.  
        –  В `packages/server` добавить `import updlRoutes from '../../apps/publish-srv/base/src/routes/updlRoutes'` и `app.use(updlRoutes)`.

4.  Итоги  
    –  Генерация HTML и сам алгоритм экспорта уже реализованы в `ARJSExporter`.  
    –  Требуются только мелкие «склейки»:  
      • привести URL к единому виду (`/p/<id>`),  
      • поправить маршруты отдачи статического контента,  
      • синхронизировать UI и бекенд на этих путях,  
      • смонтировать роуты в основной сервер Flowise.  

После этих правок можно будет в интерфейсе AR.js-публикации увидеть и скопировать ссылку вида  
```
http://localhost:8080/p/778d565f-e9cc-4dd8-b8ef-7a097ecb18f3
```  
и по ней сразу открыть ваше веб-AR приложение, запрашивающее камеру и накладывающее модели через метку Hiro.


---


# Question

Поскольку мне нужно быстрее создать MVP, я предполагаю, что нужно создать функционал, который пока не будет использовать для хранения своих параметров Supabase. То есть несмотря на то, что в интерфейсе публикации мы оставим как бы выбор вариантов маркера, эти данные не будут пока сохраняться и всё будет работать только на основе маркера Hiro, что будет задано жёстко. В остальном нужно реализовать всё так, как я предлагал. Чтобы пользователь заходил по ссылке типа http://localhost:3000/p/78cdad94-1cd6-4587-86ae-d2adb414fc96 и запускался процесс при котором на основе созданных UPDL-узлов будет запускаться генерация AR.js приложения и отображаться тот объект, который был задан в UPDL узлах, этого Chatflow.

---

# Answer


# План реализации MVP для потоковой генерации AR.js из UPDL-узлов

## Этап 1: Создание статической страницы для AR.js-приложения

1. Создать HTML-файл `index.html` в директории `apps/publish-srv/base/public/p/`:
   - Добавить A-Frame и AR.js библиотеки
   - Настроить базовую сцену с маркером Hiro (жёстко заданным)
   - Добавить JavaScript для получения chatflowId из URL и вызова API

## Этап 2: Реализация API-эндпоинта для стриминга UPDL-данных

1. Добавить маршрут в `apps/publish-srv/base/src/routes/publishRoutes.ts`:
   ```typescript
   router.get('/updl/:chatflowId', (req, res) => publishController.streamUPDL(req, res))
   ```

2. Создать метод в `apps/publish-srv/base/src/controllers/publishController.ts`:
   ```typescript
   public async streamUPDL(req: Request, res: Response): Promise<void> {
     try {
       // Извлекаем chatflowId из параметров запроса
       const chatflowId = req.params.chatflowId
       
       // Модифицируем запрос для совместимости с utilBuildUPDLflow
       req.params.id = chatflowId
       
       // Вызываем существующую функцию для построения UPDL-сцены
       const result = await utilBuildUPDLflow(req, true)
       res.status(200).json(result)
     } catch (error) {
       console.error('Error in streamUPDL:', error)
       res.status(500).json({ 
         error: 'Failed to stream UPDL scene', 
         details: error instanceof Error ? error.message : error 
       })
     }
   }
   ```

## Этап 3: Упрощение функции публикации AR.js

1. Модифицировать метод `publishARJS` в `PublishController`:
   ```typescript
   public async publishARJS(req: Request, res: Response): Promise<void> {
     const { chatflowId, projectName } = req.body
     
     if (!chatflowId) {
       res.status(400).json({ success: false, error: 'Missing required parameter: chatflowId' })
       return
     }
     
     // Просто формируем URL без сохранения настроек в БД
     const publicUrl = `/p/${chatflowId}`
     
     res.status(201).json({
       success: true,
       publicationId: chatflowId,
       publicUrl,
       projectName: projectName || `AR.js Project ${new Date().toLocaleDateString()}`,
       createdAt: new Date().toISOString(),
       marker: 'hiro', // Жёстко заданный маркер
       generationMode: 'streaming' // Жёстко заданный режим
     })
   }
   ```

## Этап 4: Клиентская HTML-страница для AR.js

Содержимое `apps/publish-srv/base/public/p/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>AR.js Streaming</title>
  <script src="https://aframe.io/releases/1.2.0/aframe.min.js"></script>
  <script src="https://cdn.rawgit.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>
  <style>
    body { margin: 0; overflow: hidden; }
    .loading { 
      position: fixed; top: 10px; left: 50%; 
      transform: translateX(-50%); 
      background: rgba(0,0,0,0.7); color: white; 
      padding: 10px 20px; border-radius: 4px; 
      z-index: 999; 
    }
  </style>
</head>
<body>
  <div id="loading" class="loading">Загрузка AR.js...</div>
  
  <a-scene embedded arjs="trackingMethod: best; sourceType: webcam; debugUIEnabled: false;">
    <!-- Используем жёстко заданный маркер Hiro -->
    <a-marker preset="hiro">
      <a-entity id="ar-objects"></a-entity>
    </a-marker>
    <a-entity camera></a-entity>
  </a-scene>

  <script>
    // Universo Platformo | Client-side script for AR.js streaming
    document.addEventListener('DOMContentLoaded', () => {
      const loadingEl = document.getElementById('loading');
      const pathParts = window.location.pathname.split('/');
      const chatflowId = pathParts[pathParts.length - 1];
      
      if (!chatflowId) {
        loadingEl.textContent = 'Ошибка: ID потока не найден';
        return;
      }
      
      // Дождаться инициализации AR.js
      window.addEventListener('arjs-video-loaded', () => {
        loadingEl.textContent = 'Загрузка 3D объектов...';
        
        fetch(`/api/v1/publish/updl/${chatflowId}`)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Ошибка запроса: ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            loadingEl.style.display = 'none';
            
            const scene = data.scene || data.updlScene;
            if (!scene || !scene.objects || !scene.objects.length) {
              throw new Error('Данные сцены не найдены');
            }
            
            const container = document.getElementById('ar-objects');
            
            // Создаем A-Frame элементы для каждого объекта
            scene.objects.forEach(obj => {
              let el;
              
              // Определяем тип объекта и создаем соответствующий элемент
              switch(obj.type.toLowerCase()) {
                case 'box':
                  el = document.createElement('a-box');
                  if (obj.width) el.setAttribute('width', obj.width);
                  if (obj.height) el.setAttribute('height', obj.height);
                  if (obj.depth) el.setAttribute('depth', obj.depth);
                  break;
                case 'sphere':
                  el = document.createElement('a-sphere');
                  if (obj.radius) el.setAttribute('radius', obj.radius);
                  break;
                default:
                  console.warn('Неизвестный тип объекта:', obj.type);
                  el = document.createElement('a-box');
                  break;
              }
              
              // Установка позиции, вращения и цвета
              if (obj.position) {
                el.setAttribute('position', `${obj.position.x} ${obj.position.y} ${obj.position.z}`);
              }
              
              if (obj.rotation) {
                el.setAttribute('rotation', `${obj.rotation.x} ${obj.rotation.y} ${obj.rotation.z}`);
              }
              
              if (obj.color) {
                const color = typeof obj.color === 'string' 
                  ? obj.color 
                  : `rgb(${Math.floor(obj.color.r*255)}, ${Math.floor(obj.color.g*255)}, ${Math.floor(obj.color.b*255)})`;
                el.setAttribute('color', color);
              }
              
              container.appendChild(el);
            });
          })
          .catch(error => {
            console.error('Ошибка:', error);
            loadingEl.textContent = `Ошибка: ${error.message}`;
          });
      });
    });
  </script>
</body>
</html>
```

## Полный флоу работы MVP:

1. Пользователь в Chatflow:
   - Открывает окно "Публикация и экспорт"
   - Выбирает AR.js
   - На вкладке "Публикация" нажимает "Сделать публичным" 
   - UI отправляет запрос на `POST /api/v1/publish/arjs` с `chatflowId`
   - Получает ссылку вида `http://localhost:3000/p/{chatflowId}`

2. Пользователь переходит по полученной ссылке:
   - Загружается статическая страница `p/index.html`
   - JavaScript извлекает `chatflowId` из URL
   - Запрашивает разрешение на доступ к камере

3. Когда AR.js инициализируется:
   - JavaScript делает запрос на `GET /api/v1/publish/updl/{chatflowId}`
   - На сервере `PublishController.streamUPDL` вызывает `utilBuildUPDLflow`
   - `utilBuildUPDLflow` загружает Chatflow из БД, извлекает UPDL-узлы
   - `buildUPDLSceneFromNodes` преобразует узлы в структуру сцены
   - Результат возвращается клиенту

4. Клиентский JavaScript:
   - Получает JSON с данными сцены
   - Создает A-Frame элементы для каждого объекта
   - AR.js отображает 3D-объекты поверх маркера Hiro

Этот план минимизирует изменения в существующей кодовой базе и фокусируется на MVP функционале, используя уже существующую логику для создания UPDL-сцены из `buildUPDLflow.ts`.


---





