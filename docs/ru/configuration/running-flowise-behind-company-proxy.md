# Запуск Flowise за корпоративным прокси

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo React. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

> **🔄 Статус перевода**: Этот документ переведен с английского языка и проходит процесс адаптации для русскоязычной аудитории. Если вы заметили неточности в переводе или терминологии, пожалуйста, создайте issue в репозитории.

Если вы запускаете Flowise в среде, которая требует прокси, например, в корпоративной сети, вы можете настроить Flowise для маршрутизации всех его backend запросов через прокси по вашему выбору. Эта функция работает на основе пакета `global-agent`.

[https://github.com/gajus/global-agent](https://github.com/gajus/global-agent)

## Конфигурация

Есть 2 переменные окружения, которые вам понадобятся для запуска Flowise за корпоративным прокси:

| Переменная                 | Назначение                                                                       | Обязательная |
| -------------------------- | -------------------------------------------------------------------------------- | ------------ |
| `GLOBAL_AGENT_HTTP_PROXY`  | Куда проксировать все HTTP запросы сервера                                      | Да           |
| `GLOBAL_AGENT_HTTPS_PROXY` | Куда проксировать все HTTPS запросы сервера                                     | Нет          |
| `GLOBAL_AGENT_NO_PROXY`    | Шаблон URL, которые должны быть исключены из проксирования. Например: `*.foo.com,baz.com` | Нет          |

## Список разрешенных исходящих соединений

Для корпоративного плана вы должны разрешить несколько исходящих соединений для проверки лицензии. Пожалуйста, свяжитесь с support@flowiseai.com для получения дополнительной информации.
