---
description: Узнайте, как использовать интеграции внешних API с Flowise
---

# Взаимодействие с API

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

> **🔄 Статус перевода**: Этот документ переведен с английского языка и проходит процесс адаптации для русскоязычной аудитории. Если вы заметили неточности в переводе или терминологии, пожалуйста, создайте issue в репозитории.

***

Спецификация OpenAPI (OAS) определяет стандартный, языково-независимый интерфейс для HTTP API. Цель этого случая использования - заставить LLM автоматически выяснить, какой API вызвать, при этом все еще имея состояние разговора с пользователем.

## Цепочка OpenAPI

1. В этом руководстве мы собираемся использовать [Klarna OpenAPI](https://gist.github.com/HenryHengZJ/b60f416c42cb9bcd3160fe797421119a)

{% code overflow="wrap" %}
```json
{
  "openapi": "3.0.1",
  "info": {
    "version": "v0",
    "title": "Open AI Klarna product Api"
  },
  "servers": [
    {
      "url": "https://www.klarna.com/us/shopping"
    }
  ],
  "tags": [
    {
      "name": "open-ai-product-endpoint",
      "description": "Open AI Product Endpoint. Query for products."
    }
  ],
  "paths": {
    "/public/openai/v0/products": {
      "get": {
        "tags": [
          "open-ai-product-endpoint"
        ],
        "summary": "API for fetching Klarna product information",
        "operationId": "productsUsingGET",
        "parameters": [
          {
            "name": "countryCode",
            "in": "query",
            "description": "ISO 3166 country code with 2 characters based on the user location. Currently, only US, GB, DE, SE and DK are supported.",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "q",
            "in": "query",
            "description": "A precise query that matches one very small category or product that needs to be searched for to find the products the user is looking for. If the user explicitly stated what they want, use that as a query. The query is as specific as possible to the product name or category mentioned by the user in its singular form, and don't contain any clarifiers like latest, newest, cheapest, budget, premium, expensive or similar. The query is always taken from the latest topic, if there is a new topic a new query is started. If the user speaks another language than English, translate their request into English (example: translate fia med knuff to ludo board game)!",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "size",
            "in": "query",
            "description": "number of products returned",
            "required": false,
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "min_price",
            "in": "query",
            "description": "(Optional) Minimum price in local currency for the product searched for. Either explicitly stated by the user or implicitly inferred from a combination of the user's request and the kind of product searched for.",
            "required": false,
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "max_price",
            "in": "query",
            "description": "(Optional) Maximum price in local currency for the product searched for. Either explicitly stated by the user or implicitly inferred from a combination of the user's request and the kind of product searched for.",
            "required": false,
            "schema": {
              "type": "integer"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Products found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ProductResponse"
                }
              }
            }
          },
          "503": {
            "description": "one or more services are unavailable"
          }
        },
        "deprecated": false
      }
    }
  },
  "components": {
    "schemas": {
      "Product": {
        "type": "object",
        "properties": {
          "attributes": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "name": {
            "type": "string"
          },
          "price": {
            "type": "string"
          },
          "url": {
            "type": "string"
          }
        },
        "title": "Product"
      },
      "ProductResponse": {
        "type": "object",
        "properties": {
          "products": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/Product"
            }
          }
        },
        "title": "ProductResponse"
      }
    }
  }
}
```
{% endcode %}

2. Вы можете использовать [конвертер JSON в YAML](https://jsonformatter.org/json-to-yaml) и сохранить его как файл `.yaml`, и загрузить его в **цепочку OpenAPI**, затем протестировать, задав несколько вопросов. **Цепочка OpenAPI** отправит всю спецификацию в LLM и заставит LLM автоматически использовать правильный метод и параметры для вызова API.

<figure><img src="../.gitbook/assets/image (133).png" alt=""><figcaption></figcaption></figure>

3. Однако, если вы хотите вести обычный разговорный чат, это не сможет этого сделать. Вы увидите следующую ошибку. Это потому, что цепочка OpenAPI имеет следующий промпт:

```
Используйте предоставленные API для ответа на этот пользовательский запрос
```

Поскольку мы "принуждаем" его всегда находить API для ответа на пользовательский запрос, в случаях обычного разговора, который не имеет отношения к OpenAPI, он не может этого сделать.

<figure><img src="../.gitbook/assets/image (134).png" alt="" width="361"><figcaption></figcaption></figure>

Использование этого метода может не работать хорошо, если у вас большая спецификация OpenAPI. Это потому, что мы включаем все спецификации как часть сообщения, отправляемого в LLM. Затем мы полагаемся на LLM, чтобы выяснить правильный URL, параметры запроса, тело запроса и другие необходимые параметры, нужные для ответа на пользовательский запрос. Как вы можете себе представить, если ваши спецификации OpenAPI сложные, есть более высокая вероятность, что LLM будет галлюцинировать.

## Агент инструментов + набор инструментов OpenAPI

Чтобы решить вышеуказанную ошибку, мы можем использовать агент. Из официальной поваренной книги OpenAI: [Вызов функций со спецификацией OpenAPI](https://cookbook.openai.com/examples/function_calling_with_an_openapi_spec), рекомендуется преобразовать каждый API в инструмент сам по себе, вместо подачи всех API в LLM как одно сообщение. Агент также способен к человекоподобному взаимодействию, с возможностью решать, какой инструмент использовать в зависимости от запроса пользователя.

Набор инструментов OpenAPI преобразует каждый из API из файла YAML в набор инструментов. Таким образом, пользователям не нужно создавать [пользовательский инструмент](../integrations/langchain/tools/custom-tool.md) для каждого API.

1. Подключите **агент инструментов** с **набором инструментов OpenAPI**. Здесь мы загружаем спецификацию YAML для OpenAI API. Файл спецификации можно найти внизу страницы.

<figure><img src="../.gitbook/assets/image (25).png" alt=""><figcaption></figcaption></figure>

2. Давайте попробуем это!

<figure><img src="../.gitbook/assets/image (1) (1) (1) (1) (1) (1) (2).png" alt=""><figcaption></figcaption></figure>

Как вы могли заметить из чата, агент способен вести обычный разговор и использовать подходящий инструмент для ответа на пользовательский запрос. Если вы используете аналитический инструмент, вы можете увидеть список инструментов, которые мы преобразовали из файла YAML:

<figure><img src="../.gitbook/assets/image (2) (1) (1) (1) (1) (1) (2) (1).png" alt=""><figcaption></figcaption></figure>

## Заключение

Мы успешно создали агента, который может взаимодействовать с API при необходимости и все еще способен обрабатывать состояние разговоров с пользователями. Ниже приведены шаблоны, используемые в этом разделе:

{% file src="../.gitbook/assets/OpenAPI Chatflow.json" %}

{% file src="../.gitbook/assets/OpenAPI Toolkit with ToolAgent Chatflow.json" %}

{% file src="../.gitbook/assets/openai_openapi.yaml" %}
