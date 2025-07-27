---
description: Изучите, как интегрировать Flowise и Zapier
---

# Zapier Zaps

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo React. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

> **🔄 Статус перевода**: Этот документ переведен с английского языка и проходит процесс адаптации для русскоязычной аудитории. Если вы заметили неточности в переводе или терминологии, пожалуйста, создайте issue в репозитории.

***

## Предварительные требования

1. [Войдите](https://zapier.com/app/login) или [зарегистрируйтесь](https://zapier.com/sign-up) в Zapier
2. Обратитесь к [развертыванию](../../configuration/deployment/) для создания облачной версии Flowise.

## Настройка

1. Перейдите в [Zapier Zaps](https://zapier.com/app/zaps)
2. Нажмите **Создать**

<figure><img src="../../.gitbook/assets/zapier/zap/1.png" alt=""><figcaption></figcaption></figure>

### Получение триггерного сообщения

1.  Нажмите или найдите **Discord**

    <figure><img src="../../.gitbook/assets/zapier/zap/2.png" alt="" width="563"><figcaption></figcaption></figure>
2.  Выберите **Новое сообщение, опубликованное в канале** как событие, затем нажмите **Продолжить**

    <figure><img src="../../.gitbook/assets/zapier/zap/3.png" alt="" width="563"><figcaption></figcaption></figure>
3.  **Войдите** в ваш аккаунт Discord

    <figure><img src="../../.gitbook/assets/zapier/zap/4.png" alt="" width="563"><figcaption></figcaption></figure>
4.  Добавьте **Zapier Bot** на ваш предпочитаемый сервер

    <figure><img src="../../.gitbook/assets/zapier/zap/5.png" alt="" width="272"><figcaption></figcaption></figure>
5.  Дайте соответствующие разрешения и нажмите **Авторизовать**, затем нажмите **Продолжить**

    <figure><img src="../../.gitbook/assets/zapier/zap/6.png" alt="" width="292"><figcaption></figcaption></figure>

    <figure><img src="../../.gitbook/assets/zapier/zap/7.png" alt="" width="290"><figcaption></figcaption></figure>
6.  Выберите ваш **предпочитаемый канал** для взаимодействия с Zapier Bot, затем нажмите **Продолжить**

    <figure><img src="../../.gitbook/assets/zapier/zap/8.png" alt="" width="563"><figcaption></figcaption></figure>
7.  **Отправьте сообщение** в ваш выбранный канал на шаге 8

    <figure><img src="../../.gitbook/assets/zapier/zap/9.png" alt="" width="563"><figcaption></figcaption></figure>
8.  Нажмите **Тестировать триггер**

    <figure><img src="../../.gitbook/assets/zapier/zap/10.png" alt="" width="563"><figcaption></figcaption></figure>
9.  Выберите ваше сообщение, затем нажмите **Продолжить с выбранной записью**

    <figure><img src="../../.gitbook/assets/zapier/zap/11.png" alt="" width="563"><figcaption></figcaption></figure>

### Фильтрация сообщений Zapier Bot

1.  Нажмите или найдите **Фильтр**

    <figure><img src="../../.gitbook/assets/zapier/zap/12.png" alt="" width="563"><figcaption></figcaption></figure>
2.  Настройте **Фильтр**, чтобы не продолжать, если получено сообщение от **Zapier Bot**, затем нажмите **Продолжить**

    <figure><img src="../../.gitbook/assets/zapier/zap/13.png" alt="" width="563"><figcaption></figcaption></figure>

### FlowiseAI генерирует результирующее сообщение

1.  Нажмите **+**, нажмите или найдите **FlowiseAI**

    <figure><img src="../../.gitbook/assets/zapier/zap/14.png" alt="" width="563"><figcaption></figcaption></figure>
2.  Выберите **Сделать предсказание** как событие, затем нажмите **Продолжить**

    <figure><img src="../../.gitbook/assets/zapier/zap/15.png" alt="" width="563"><figcaption></figcaption></figure>
3.  Нажмите **Войти** и введите ваши данные, затем нажмите **Да, продолжить к FlowiseAI**

    <figure><img src="../../.gitbook/assets/zapier/zap/16.png" alt="" width="563"><figcaption></figcaption></figure>

    <figure><img src="../../.gitbook/assets/zapier/zap/17.png" alt="" width="563"><figcaption></figcaption></figure>
4.  Выберите **Контент** из Discord и ваш ID потока, затем нажмите **Продолжить**

    <figure><img src="../../.gitbook/assets/zapier/zap/18.png" alt="" width="563"><figcaption></figcaption></figure>
5.  Нажмите **Тестировать действие** и дождитесь вашего результата

    <figure><img src="../../.gitbook/assets/zapier/zap/19.png" alt="" width="563"><figcaption></figcaption></figure>

### Отправка результирующего сообщения

1.  Нажмите **+**, нажмите или найдите **Discord**

    <figure><img src="../../.gitbook/assets/zapier/zap/20.png" alt="" width="563"><figcaption></figcaption></figure>
2.  Выберите **Отправить сообщение в канал** как событие, затем нажмите **Продолжить**

    <figure><img src="../../.gitbook/assets/zapier/zap/21.png" alt="" width="563"><figcaption></figcaption></figure>
3.  Выберите аккаунт Discord, в который вы вошли, затем нажмите **Продолжить**

    <figure><img src="../../.gitbook/assets/zapier/zap/22.png" alt="" width="563"><figcaption></figcaption></figure>
4.  Выберите ваш предпочитаемый канал для канала и выберите **Текст** и **Источник строки** (если доступно) из FlowiseAI для текста сообщения, затем нажмите **Продолжить**

    <figure><img src="../../.gitbook/assets/zapier/zap/23.png" alt="" width="563"><figcaption></figcaption></figure>
5.  Нажмите **Тестировать действие**

    <figure><img src="../../.gitbook/assets/zapier/zap/24.png" alt=""><figcaption></figcaption></figure>
6.  Вуаля [🎉](https://emojipedia.org/party-popper/) вы должны увидеть сообщение, прибывшее в ваш канал Discord

    <figure><img src="../../.gitbook/assets/zapier/zap/25.png" alt=""><figcaption></figcaption></figure>
7.  Наконец, переименуйте ваш Zap и опубликуйте его

    <figure><img src="../../.gitbook/assets/zapier/zap/26.png" alt=""><figcaption></figcaption></figure>
