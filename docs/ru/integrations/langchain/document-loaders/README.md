---
description: Узлы загрузчиков документов LangChain
---

# Загрузчики документов

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo React. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

> **🔄 Статус перевода**: Этот документ переведен с английского языка и проходит процесс адаптации для русскоязычной аудитории. Если вы заметили неточности в переводе или терминологии, пожалуйста, создайте issue в репозитории.

***

Загрузчики документов позволяют загружать документы из различных источников, таких как PDF, TXT, CSV, Notion, Confluence и т.д. Они часто используются вместе с [векторными хранилищами](../vector-stores/) для загрузки в виде эмбеддингов, которые затем могут быть извлечены при запросе.

## Что такое загрузчики документов?

Загрузчики документов - это специализированные компоненты, которые:

- **Извлекают контент** из различных источников данных
- **Нормализуют формат** для дальнейшей обработки
- **Сохраняют метаданные** о источнике и структуре
- **Разбивают большие документы** на управляемые части
- **Обрабатывают различные форматы** файлов и API

### Посмотрите введение в загрузчики документов

{% embed url="https://youtu.be/kMtf9sNIcao" %}

## Категории загрузчиков документов

### 1. Файловые загрузчики
- **PDF Files** - документы в формате PDF
- **Text Files** - простые текстовые файлы
- **Microsoft Office** - Word, Excel, PowerPoint
- **CSV Files** - табличные данные
- **JSON Files** - структурированные данные

### 2. Веб-загрузчики
- **Web Scrapers** - извлечение контента с веб-сайтов
- **API Loaders** - загрузка через REST API
- **Search APIs** - поиск и загрузка результатов
- **Crawlers** - обход и индексация сайтов

### 3. Облачные загрузчики
- **Google Drive** - документы из Google Drive
- **Google Sheets** - электронные таблицы
- **S3 File Loader** - файлы из Amazon S3
- **Document Store** - корпоративные хранилища

### 4. Платформенные загрузчики
- **Notion** - страницы и базы данных Notion
- **Confluence** - корпоративная wiki
- **Jira** - задачи и проекты
- **GitHub** - репозитории и документация
- **Airtable** - базы данных Airtable

## Архитектура загрузчиков документов

```
Источник данных → Загрузчик → Парсер → Нормализация → Разбиение → Документы
      ↓              ↓          ↓           ↓            ↓           ↓
   Файлы/API → Извлечение → Обработка → Метаданные → Чанки → Vector Store
```

### Компоненты загрузчика:

1. **Коннектор** - подключение к источнику данных
2. **Парсер** - извлечение текста и структуры
3. **Метаданные экстрактор** - сбор информации о документе
4. **Текст процессор** - очистка и нормализация
5. **Чанкер** - разбиение на части

## Лучшие практики использования загрузчиков

### 1. Выбор подходящего загрузчика

```python
# Для простых текстовых файлов
text_loader = TextFileLoader("document.txt")

# Для PDF с сохранением структуры
pdf_loader = PDFLoader(
    "document.pdf",
    extract_images=True,
    preserve_layout=True
)

# Для веб-контента
web_loader = WebScraper(
    urls=["https://example.com"],
    css_selector=".content",
    remove_elements=[".ads", ".navigation"]
)

# Для API данных
api_loader = APILoader(
    endpoint="https://api.example.com/documents",
    headers={"Authorization": "Bearer token"},
    pagination=True
)
```

### 2. Настройка метаданных

```python
# Обогащение документов метаданными
class EnhancedLoader:
    def __init__(self, base_loader):
        self.base_loader = base_loader
    
    def load(self):
        documents = self.base_loader.load()
        
        for doc in documents:
            # Добавление временных меток
            doc.metadata["loaded_at"] = datetime.now().isoformat()
            
            # Определение языка
            doc.metadata["language"] = self.detect_language(doc.page_content)
            
            # Вычисление хеша для дедупликации
            doc.metadata["content_hash"] = hashlib.md5(
                doc.page_content.encode()
            ).hexdigest()
            
            # Извлечение ключевых слов
            doc.metadata["keywords"] = self.extract_keywords(doc.page_content)
        
        return documents
```

### 3. Обработка ошибок и повторные попытки

```python
import time
from typing import List, Optional

class RobustLoader:
    def __init__(self, loader, max_retries=3, backoff_factor=2):
        self.loader = loader
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
    
    def load_with_retry(self) -> List[Document]:
        for attempt in range(self.max_retries):
            try:
                return self.loader.load()
            
            except Exception as e:
                if attempt == self.max_retries - 1:
                    raise e
                
                wait_time = self.backoff_factor ** attempt
                print(f"Попытка {attempt + 1} неудачна: {e}")
                print(f"Повтор через {wait_time} секунд...")
                time.sleep(wait_time)
        
        return []
```

### 4. Пакетная обработка

```python
class BatchLoader:
    def __init__(self, loaders: List[BaseLoader], batch_size=10):
        self.loaders = loaders
        self.batch_size = batch_size
    
    def load_in_batches(self):
        all_documents = []
        
        for i in range(0, len(self.loaders), self.batch_size):
            batch = self.loaders[i:i + self.batch_size]
            
            # Параллельная загрузка батча
            with ThreadPoolExecutor(max_workers=self.batch_size) as executor:
                futures = [executor.submit(loader.load) for loader in batch]
                
                for future in as_completed(futures):
                    try:
                        documents = future.result()
                        all_documents.extend(documents)
                    except Exception as e:
                        print(f"Ошибка загрузки: {e}")
        
        return all_documents
```

## Специализированные загрузчики

### 1. Загрузчик с фильтрацией

```python
class FilteredLoader:
    def __init__(self, base_loader, filters):
        self.base_loader = base_loader
        self.filters = filters
    
    def load(self):
        documents = self.base_loader.load()
        filtered_docs = []
        
        for doc in documents:
            if self.should_include(doc):
                filtered_docs.append(doc)
        
        return filtered_docs
    
    def should_include(self, doc):
        # Фильтрация по размеру
        if len(doc.page_content) < self.filters.get("min_length", 0):
            return False
        
        # Фильтрация по языку
        if "language" in self.filters:
            detected_lang = self.detect_language(doc.page_content)
            if detected_lang not in self.filters["language"]:
                return False
        
        # Фильтрация по ключевым словам
        if "required_keywords" in self.filters:
            content_lower = doc.page_content.lower()
            if not any(keyword.lower() in content_lower 
                      for keyword in self.filters["required_keywords"]):
                return False
        
        return True
```

### 2. Инкрементальный загрузчик

```python
class IncrementalLoader:
    def __init__(self, base_loader, state_file="loader_state.json"):
        self.base_loader = base_loader
        self.state_file = state_file
        self.last_update = self.load_state()
    
    def load_new_documents(self):
        # Загрузка только новых или измененных документов
        all_docs = self.base_loader.load()
        new_docs = []
        
        for doc in all_docs:
            doc_modified = self.get_modification_time(doc)
            if doc_modified > self.last_update:
                new_docs.append(doc)
        
        # Обновление состояния
        self.last_update = datetime.now()
        self.save_state()
        
        return new_docs
    
    def load_state(self):
        try:
            with open(self.state_file, 'r') as f:
                state = json.load(f)
                return datetime.fromisoformat(state["last_update"])
        except FileNotFoundError:
            return datetime.min
    
    def save_state(self):
        with open(self.state_file, 'w') as f:
            json.dump({
                "last_update": self.last_update.isoformat()
            }, f)
```

## Интеграция с векторными хранилищами

### Базовая интеграция

```python
# Загрузка документов и создание векторного хранилища
def create_vector_store_from_documents(loader, embeddings):
    # Загрузка документов
    documents = loader.load()
    
    # Разбиение на чанки
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )
    splits = text_splitter.split_documents(documents)
    
    # Создание векторного хранилища
    vector_store = Chroma.from_documents(
        documents=splits,
        embedding=embeddings,
        persist_directory="./chroma_db"
    )
    
    return vector_store
```

### Продвинутая интеграция

```python
class DocumentPipeline:
    def __init__(self, loader, text_splitter, embeddings, vector_store):
        self.loader = loader
        self.text_splitter = text_splitter
        self.embeddings = embeddings
        self.vector_store = vector_store
    
    def process_documents(self):
        # 1. Загрузка документов
        documents = self.loader.load()
        print(f"Загружено {len(documents)} документов")
        
        # 2. Предобработка
        processed_docs = self.preprocess_documents(documents)
        
        # 3. Разбиение на чанки
        splits = self.text_splitter.split_documents(processed_docs)
        print(f"Создано {len(splits)} чанков")
        
        # 4. Дедупликация
        unique_splits = self.deduplicate_documents(splits)
        print(f"После дедупликации: {len(unique_splits)} чанков")
        
        # 5. Добавление в векторное хранилище
        self.vector_store.add_documents(unique_splits)
        
        return len(unique_splits)
    
    def preprocess_documents(self, documents):
        processed = []
        for doc in documents:
            # Очистка текста
            cleaned_content = self.clean_text(doc.page_content)
            
            # Обогащение метаданных
            doc.metadata.update({
                "word_count": len(cleaned_content.split()),
                "char_count": len(cleaned_content),
                "processed_at": datetime.now().isoformat()
            })
            
            doc.page_content = cleaned_content
            processed.append(doc)
        
        return processed
```

## Узлы загрузчиков документов:

* [Airtable](airtable.md)
* [API загрузчик](api-loader.md)
* [Apify Website Content Crawler](apify-website-content-crawler.md)
* [BraveSearch загрузчик](bravesearch-api.md)
* [Cheerio Web Scraper](cheerio-web-scraper.md)
* [Confluence](confluence.md)
* [CSV файл](csv-file.md)
* [Пользовательский загрузчик документов](custom-document-loader.md)
* [Хранилище документов](document-store.md)
* [Docx файл](docx-file.md)
* [Epub файл](epub-file.md)
* [Figma](figma.md)
* [Файл](file-loader.md)
* [FireCrawl](firecrawl.md)
* [Папка](folder.md)
* [GitBook](gitbook.md)
* [Github](github.md)
* [Google Drive](google-drive.md)
* [Google Sheets](google-sheets.md)
* [Jira](jira.md)
* [Json файл](json-file.md)
* [Json Lines файл](jsonlines.md)
* [Microsoft Excel](microsoft-excel.md)
* [Microsoft Powerpoint](microsoft-powerpoint.md)
* [Microsoft Word](microsoft-word.md)
* [Notion](notion.md)
* [Oxylabs](oxylabs.md)
* [PDF файлы](pdf-file.md)
* [Простой текст](plain-text.md)
* [Playwright Web Scraper](playwright-web-scraper.md)
* [Puppeteer Web Scraper](puppeteer-web-scraper.md)
* [S3 загрузчик файлов](s3-file-loader.md)
* [SearchApi для веб-поиска](searchapi-for-web-search.md)
* [SerpApi для веб-поиска](serpapi-for-web-search.md)
* [Spider - веб-поиск и краулер](spider-web-scraper-crawler.md)
* [Текстовый файл](text-file.md)
* [Неструктурированный загрузчик файлов](unstructured-file-loader.md)
* [Неструктурированный загрузчик папок](unstructured-folder-loader.md)

## Мониторинг и оптимизация

### 1. Метрики загрузки

```python
class LoaderMetrics:
    def __init__(self):
        self.metrics = {
            "documents_loaded": 0,
            "total_size": 0,
            "load_time": 0,
            "error_count": 0,
            "success_rate": 0
        }
    
    def track_loading(self, loader_func):
        start_time = time.time()
        
        try:
            documents = loader_func()
            self.metrics["documents_loaded"] = len(documents)
            self.metrics["total_size"] = sum(
                len(doc.page_content) for doc in documents
            )
            
        except Exception as e:
            self.metrics["error_count"] += 1
            raise e
        
        finally:
            self.metrics["load_time"] = time.time() - start_time
            self.calculate_success_rate()
    
    def calculate_success_rate(self):
        total_attempts = self.metrics["documents_loaded"] + self.metrics["error_count"]
        if total_attempts > 0:
            self.metrics["success_rate"] = (
                self.metrics["documents_loaded"] / total_attempts * 100
            )
```

### 2. Кэширование результатов

```python
import hashlib
import pickle
from pathlib import Path

class CachedLoader:
    def __init__(self, base_loader, cache_dir="./loader_cache"):
        self.base_loader = base_loader
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
    
    def load(self):
        cache_key = self.generate_cache_key()
        cache_file = self.cache_dir / f"{cache_key}.pkl"
        
        # Проверка кэша
        if cache_file.exists():
            print("Загрузка из кэша...")
            with open(cache_file, 'rb') as f:
                return pickle.load(f)
        
        # Загрузка и кэширование
        print("Загрузка из источника...")
        documents = self.base_loader.load()
        
        with open(cache_file, 'wb') as f:
            pickle.dump(documents, f)
        
        return documents
    
    def generate_cache_key(self):
        # Генерация ключа на основе конфигурации загрузчика
        config_str = str(self.base_loader.__dict__)
        return hashlib.md5(config_str.encode()).hexdigest()
```

## Заключение

Загрузчики документов являются первым и критически важным этапом в построении систем обработки знаний. Правильный выбор и настройка загрузчиков определяют качество данных, доступных для дальнейшей обработки и поиска.

Ключевые принципы успешного использования загрузчиков:
- **Выбирайте специализированные загрузчики** для каждого типа источника
- **Обрабатывайте ошибки gracefully** с повторными попытками
- **Обогащайте метаданные** для лучшего поиска и фильтрации
- **Мониторьте производительность** и оптимизируйте узкие места
- **Используйте кэширование** для часто загружаемых данных
- **Планируйте инкрементальные обновления** для больших наборов данных
