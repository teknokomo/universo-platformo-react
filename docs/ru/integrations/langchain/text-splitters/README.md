---
description: Узлы разделителей текста LangChain
---

# Разделители текста

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo React. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

> **🔄 Статус перевода**: Этот документ переведен с английского языка и проходит процесс адаптации для русскоязычной аудитории. Если вы заметили неточности в переводе или терминологии, пожалуйста, создайте issue в репозитории.

***

**Когда вы хотите работать с длинными фрагментами текста, необходимо разбить этот текст на части.**\
Как бы просто это ни звучало, здесь есть много потенциальной сложности. В идеале вы хотите держать семантически связанные фрагменты текста вместе. То, что означает "семантически связанный", может зависеть от типа текста. Этот раздел демонстрирует несколько способов сделать это.

## Что такое разделители текста?

Разделители текста - это специализированные инструменты для разбиения больших документов на управляемые части (чанки), которые:

- **Сохраняют семантическую связность** - держат связанную информацию вместе
- **Оптимизируют размер** для обработки моделями и векторными базами данных
- **Обеспечивают перекрытие** для сохранения контекста между частями
- **Адаптируются к типу контента** - код, markdown, HTML, обычный текст
- **Учитывают ограничения токенов** различных моделей

### Зачем нужно разбиение текста?

```yaml
reasons_for_text_splitting:
  performance:
    - "Ускорение поиска по векторной базе данных"
    - "Снижение времени обработки LLM"
    - "Оптимизация использования памяти"
  
  quality:
    - "Повышение точности поиска"
    - "Улучшение релевантности результатов"
    - "Сохранение контекста в небольших фрагментах"
  
  cost:
    - "Снижение количества токенов для обработки"
    - "Оптимизация затрат на API вызовы"
    - "Эффективное использование ресурсов"
  
  technical:
    - "Соблюдение лимитов токенов модели"
    - "Параллельная обработка фрагментов"
    - "Масштабируемость системы"
```

## Принцип работы разделителей текста

**На высоком уровне разделители текста работают следующим образом:**

1. **Разбивают текст** на небольшие, семантически значимые части (часто предложения).
2. **Начинают объединять** эти небольшие части в более крупную часть, пока не достигнут определенного размера (измеряемого некоторой функцией).
3. **Как только достигают этого размера**, делают эту часть отдельным фрагментом текста, а затем начинают создавать новую часть текста с некоторым перекрытием (чтобы сохранить контекст между частями).

### Архитектура разделения

```
Исходный документ → Предварительное разбиение → Объединение в чанки → Добавление перекрытий → Финальные чанки
        ↓                    ↓                      ↓                    ↓                    ↓
   Длинный текст → Предложения/абзацы → Чанки нужного размера → Контекстные связи → Готовые фрагменты
```

**Это означает, что есть две разные оси, по которым вы можете настроить свой разделитель текста:**

1. **Как разбивается текст** - стратегия разделения
2. **Как измеряется размер части** - метрика размера

### Стратегии разделения

```python
# Различные стратегии разделения текста
splitting_strategies = {
    "character_based": {
        "description": "Разделение по символам",
        "separators": ["\n\n", "\n", " ", ""],
        "use_case": "Простые тексты, общие документы",
        "pros": ["Простота", "Универсальность"],
        "cons": ["Может разрывать семантические единицы"]
    },
    
    "recursive_character": {
        "description": "Рекурсивное разделение по символам",
        "separators": ["\n\n", "\n", " ", ""],
        "use_case": "Большинство текстовых документов",
        "pros": ["Сохраняет структуру", "Гибкость"],
        "cons": ["Сложнее настройка"]
    },
    
    "token_based": {
        "description": "Разделение по токенам",
        "separators": "Токены модели",
        "use_case": "Точный контроль токенов",
        "pros": ["Точность", "Соответствие лимитам модели"],
        "cons": ["Зависимость от токенизатора"]
    },
    
    "semantic_based": {
        "description": "Семантическое разделение",
        "separators": "Смысловые границы",
        "use_case": "Высококачественная обработка",
        "pros": ["Максимальная релевантность"],
        "cons": ["Вычислительная сложность"]
    }
}
```

### Метрики размера

```python
# Способы измерения размера чанков
size_metrics = {
    "character_count": {
        "description": "Количество символов",
        "function": "len(text)",
        "pros": ["Простота", "Скорость"],
        "cons": ["Не учитывает токены модели"]
    },
    
    "token_count": {
        "description": "Количество токенов",
        "function": "tokenizer.encode(text)",
        "pros": ["Точность для модели", "Соответствие лимитам"],
        "cons": ["Зависимость от токенизатора", "Медленнее"]
    },
    
    "word_count": {
        "description": "Количество слов",
        "function": "len(text.split())",
        "pros": ["Интуитивность", "Языковая независимость"],
        "cons": ["Неточность для некоторых языков"]
    },
    
    "sentence_count": {
        "description": "Количество предложений",
        "function": "sentence_tokenizer(text)",
        "pros": ["Семантическая целостность"],
        "cons": ["Сложность определения границ"]
    }
}
```

## Выбор подходящего разделителя

### Матрица выбора разделителя

```python
# Руководство по выбору разделителя
splitter_selection_guide = {
    "document_types": {
        "plain_text": {
            "recommended": "RecursiveCharacterTextSplitter",
            "alternatives": ["CharacterTextSplitter"],
            "settings": {
                "chunk_size": 1000,
                "chunk_overlap": 200,
                "separators": ["\n\n", "\n", " ", ""]
            }
        },
        
        "markdown": {
            "recommended": "MarkdownTextSplitter",
            "alternatives": ["RecursiveCharacterTextSplitter"],
            "settings": {
                "chunk_size": 1000,
                "chunk_overlap": 200,
                "headers_to_split_on": [
                    ("#", "Header 1"),
                    ("##", "Header 2"),
                    ("###", "Header 3")
                ]
            }
        },
        
        "code": {
            "recommended": "CodeTextSplitter",
            "alternatives": ["RecursiveCharacterTextSplitter"],
            "settings": {
                "chunk_size": 1500,
                "chunk_overlap": 300,
                "language": "python"  # или другой язык
            }
        },
        
        "html": {
            "recommended": "HTMLToMarkdownTextSplitter",
            "alternatives": ["RecursiveCharacterTextSplitter"],
            "settings": {
                "chunk_size": 1000,
                "chunk_overlap": 200,
                "convert_to_markdown": True
            }
        },
        
        "academic_papers": {
            "recommended": "RecursiveCharacterTextSplitter",
            "alternatives": ["TokenTextSplitter"],
            "settings": {
                "chunk_size": 1500,
                "chunk_overlap": 300,
                "separators": ["\n\n", "\n", ". ", " ", ""]
            }
        },
        
        "legal_documents": {
            "recommended": "RecursiveCharacterTextSplitter",
            "alternatives": ["CharacterTextSplitter"],
            "settings": {
                "chunk_size": 800,
                "chunk_overlap": 150,
                "separators": ["\n\n", "\n", ". ", " ", ""]
            }
        }
    }
}
```

### Настройка параметров

```python
# Оптимальные параметры для различных сценариев
parameter_optimization = {
    "chunk_size": {
        "small_chunks": {
            "size": 200-500,
            "use_case": "Точный поиск, короткие ответы",
            "pros": ["Высокая точность", "Быстрый поиск"],
            "cons": ["Потеря контекста", "Больше чанков"]
        },
        
        "medium_chunks": {
            "size": 500-1500,
            "use_case": "Общее использование, RAG системы",
            "pros": ["Баланс точности и контекста"],
            "cons": ["Компромиссное решение"]
        },
        
        "large_chunks": {
            "size": 1500-3000,
            "use_case": "Сохранение контекста, суммаризация",
            "pros": ["Максимальный контекст"],
            "cons": ["Медленный поиск", "Меньшая точность"]
        }
    },
    
    "chunk_overlap": {
        "no_overlap": {
            "overlap": 0,
            "use_case": "Уникальная информация в каждом чанке",
            "pros": ["Нет дублирования"],
            "cons": ["Потеря контекста на границах"]
        },
        
        "small_overlap": {
            "overlap": "10-15% от chunk_size",
            "use_case": "Минимальное дублирование",
            "pros": ["Экономия места", "Некоторый контекст"],
            "cons": ["Ограниченная связность"]
        },
        
        "medium_overlap": {
            "overlap": "15-25% от chunk_size",
            "use_case": "Стандартное использование",
            "pros": ["Хороший баланс"],
            "cons": ["Умеренное дублирование"]
        },
        
        "large_overlap": {
            "overlap": "25-40% от chunk_size",
            "use_case": "Максимальная связность",
            "pros": ["Отличная связность"],
            "cons": ["Значительное дублирование"]
        }
    }
}
```

## Продвинутые техники разделения

### Адаптивное разделение

```python
class AdaptiveTextSplitter:
    def __init__(self, base_chunk_size=1000, min_chunk_size=200, max_chunk_size=2000):
        self.base_chunk_size = base_chunk_size
        self.min_chunk_size = min_chunk_size
        self.max_chunk_size = max_chunk_size
    
    def split_text(self, text, document_type="general"):
        # Анализ характеристик текста
        text_stats = self.analyze_text(text)
        
        # Адаптация параметров на основе анализа
        adapted_params = self.adapt_parameters(text_stats, document_type)
        
        # Выбор оптимального разделителя
        splitter = self.select_splitter(adapted_params)
        
        return splitter.split_text(text)
    
    def analyze_text(self, text):
        return {
            "length": len(text),
            "avg_sentence_length": self.calculate_avg_sentence_length(text),
            "paragraph_count": text.count('\n\n'),
            "has_code": self.detect_code_blocks(text),
            "has_tables": self.detect_tables(text),
            "language": self.detect_language(text)
        }
    
    def adapt_parameters(self, stats, document_type):
        # Логика адаптации параметров
        if stats["has_code"]:
            return {"chunk_size": 1500, "overlap": 300}
        elif stats["avg_sentence_length"] > 100:
            return {"chunk_size": 1200, "overlap": 250}
        else:
            return {"chunk_size": 1000, "overlap": 200}
```

### Семантическое разделение

```python
class SemanticTextSplitter:
    def __init__(self, embedding_model, similarity_threshold=0.8):
        self.embedding_model = embedding_model
        self.similarity_threshold = similarity_threshold
    
    def split_text(self, text):
        # Разбиение на предложения
        sentences = self.split_into_sentences(text)
        
        # Получение эмбеддингов для каждого предложения
        embeddings = [self.embedding_model.embed(sent) for sent in sentences]
        
        # Группировка семантически похожих предложений
        chunks = self.group_by_similarity(sentences, embeddings)
        
        return chunks
    
    def group_by_similarity(self, sentences, embeddings):
        chunks = []
        current_chunk = [sentences[0]]
        current_embedding = embeddings[0]
        
        for i in range(1, len(sentences)):
            similarity = self.cosine_similarity(current_embedding, embeddings[i])
            
            if similarity >= self.similarity_threshold:
                current_chunk.append(sentences[i])
                # Обновление эмбеддинга чанка
                current_embedding = self.update_chunk_embedding(
                    current_embedding, embeddings[i]
                )
            else:
                chunks.append(' '.join(current_chunk))
                current_chunk = [sentences[i]]
                current_embedding = embeddings[i]
        
        if current_chunk:
            chunks.append(' '.join(current_chunk))
        
        return chunks
```

### Контекстно-осведомленное разделение

```python
class ContextAwareTextSplitter:
    def __init__(self, chunk_size=1000, overlap=200):
        self.chunk_size = chunk_size
        self.overlap = overlap
    
    def split_text(self, text, metadata=None):
        # Извлечение структурной информации
        structure = self.extract_structure(text)
        
        # Разделение с учетом структуры
        chunks = self.structure_aware_split(text, structure)
        
        # Добавление контекстных метаданных
        enriched_chunks = self.add_context_metadata(chunks, structure, metadata)
        
        return enriched_chunks
    
    def extract_structure(self, text):
        return {
            "headers": self.find_headers(text),
            "lists": self.find_lists(text),
            "tables": self.find_tables(text),
            "code_blocks": self.find_code_blocks(text),
            "quotes": self.find_quotes(text)
        }
    
    def add_context_metadata(self, chunks, structure, metadata):
        enriched = []
        
        for i, chunk in enumerate(chunks):
            chunk_metadata = {
                "chunk_index": i,
                "total_chunks": len(chunks),
                "structure_elements": self.identify_elements_in_chunk(chunk, structure),
                "previous_context": chunks[i-1][-100:] if i > 0 else None,
                "next_context": chunks[i+1][:100] if i < len(chunks)-1 else None
            }
            
            if metadata:
                chunk_metadata.update(metadata)
            
            enriched.append({
                "content": chunk,
                "metadata": chunk_metadata
            })
        
        return enriched
```

## Узлы разделителей текста:

* [Символьный разделитель текста](character-text-splitter.md)
* [Разделитель кода](code-text-splitter.md)
* [HTML-to-Markdown разделитель текста](html-to-markdown-text-splitter.md)
* [Markdown разделитель текста](markdown-text-splitter.md)
* [Рекурсивный символьный разделитель текста](recursive-character-text-splitter.md)
* [Токенный разделитель текста](token-text-splitter.md)

## Лучшие практики

### Тестирование и оптимизация

```python
# Система тестирования разделителей
class TextSplitterTester:
    def __init__(self):
        self.metrics = {}
    
    def test_splitter(self, splitter, test_documents):
        results = {
            "chunk_size_distribution": [],
            "overlap_effectiveness": [],
            "semantic_coherence": [],
            "processing_time": []
        }
        
        for doc in test_documents:
            start_time = time.time()
            chunks = splitter.split_text(doc["content"])
            processing_time = time.time() - start_time
            
            # Анализ результатов
            results["chunk_size_distribution"].extend([len(chunk) for chunk in chunks])
            results["overlap_effectiveness"].append(self.measure_overlap_quality(chunks))
            results["semantic_coherence"].append(self.measure_coherence(chunks))
            results["processing_time"].append(processing_time)
        
        return self.calculate_metrics(results)
    
    def measure_overlap_quality(self, chunks):
        # Измерение качества перекрытий
        overlap_scores = []
        for i in range(len(chunks) - 1):
            overlap = self.find_overlap(chunks[i], chunks[i+1])
            score = self.evaluate_overlap_quality(overlap)
            overlap_scores.append(score)
        return sum(overlap_scores) / len(overlap_scores) if overlap_scores else 0
    
    def measure_coherence(self, chunks):
        # Измерение семантической связности
        coherence_scores = []
        for chunk in chunks:
            score = self.calculate_coherence_score(chunk)
            coherence_scores.append(score)
        return sum(coherence_scores) / len(coherence_scores)
```

### Мониторинг производительности

```python
# Мониторинг производительности разделителей
class SplitterPerformanceMonitor:
    def __init__(self):
        self.metrics = {
            "processing_times": [],
            "chunk_counts": [],
            "memory_usage": [],
            "error_rates": []
        }
    
    def monitor_splitting(self, splitter_func, text):
        start_time = time.time()
        start_memory = self.get_memory_usage()
        
        try:
            chunks = splitter_func(text)
            success = True
            error = None
        except Exception as e:
            chunks = []
            success = False
            error = str(e)
        
        end_time = time.time()
        end_memory = self.get_memory_usage()
        
        # Запись метрик
        self.metrics["processing_times"].append(end_time - start_time)
        self.metrics["chunk_counts"].append(len(chunks))
        self.metrics["memory_usage"].append(end_memory - start_memory)
        self.metrics["error_rates"].append(0 if success else 1)
        
        return {
            "chunks": chunks,
            "success": success,
            "error": error,
            "processing_time": end_time - start_time,
            "memory_delta": end_memory - start_memory
        }
```

## Заключение

Разделители текста являются критически важным компонентом в системах обработки естественного языка и RAG архитектурах. Правильный выбор и настройка разделителя может значительно повлиять на качество поиска, релевантность результатов и общую производительность системы.

Ключевые принципы успешного использования разделителей текста:
- **Выбирайте разделитель** в соответствии с типом контента
- **Настраивайте параметры** на основе ваших данных и требований
- **Тестируйте различные конфигурации** для оптимизации результатов
- **Мониторьте производительность** и качество разделения
- **Учитывайте ограничения модели** при выборе размера чанков
- **Балансируйте между точностью и контекстом** при настройке перекрытий
