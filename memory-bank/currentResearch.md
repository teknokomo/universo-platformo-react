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




