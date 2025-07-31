# SSO

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo React. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

> **🔄 Статус перевода**: Этот документ переведен с английского языка и проходит процесс адаптации для русскоязычной аудитории. Если вы заметили неточности в переводе или терминологии, пожалуйста, создайте issue в репозитории.

{% hint style="info" %}
SSO доступно только для корпоративного плана
{% endhint %}

Flowise поддерживает [OIDC](https://openid.net/), который позволяет пользователям использовать _единый вход_ (_SSO_) для доступа к приложению. В настоящее время только [Администратор организации](../using-flowise/workspaces.md#setting-up-admin-account) может настраивать конфигурации SSO.

## Microsoft

1. В портале Azure найдите Microsoft Entra ID:

<figure><img src="../.gitbook/assets/image (193).png" alt=""><figcaption></figcaption></figure>

2. На левой панели нажмите App Registrations, затем New Registration:

<figure><img src="../.gitbook/assets/image (194).png" alt=""><figcaption></figcaption></figure>

3. Введите имя приложения и выберите Single Tenant:

<figure><img src="../.gitbook/assets/image (195).png" alt=""><figcaption></figcaption></figure>

4. После создания приложения запишите Application (client) ID и Directory (tenant) ID:

<figure><img src="../.gitbook/assets/image (196).png" alt=""><figcaption></figcaption></figure>

5. На левой боковой панели нажмите Certificates & secrets -> New client secret -> Add:

<figure><img src="../.gitbook/assets/image (198).png" alt=""><figcaption></figcaption></figure>

6. После создания секрета скопируйте Value, <mark style="color:red;">а не</mark> Secret ID:

<figure><img src="../.gitbook/assets/image (199).png" alt=""><figcaption></figcaption></figure>

7. На левой боковой панели нажмите Authentication -> Add a platform -> Web:

<figure><img src="../.gitbook/assets/image (201).png" alt=""><figcaption></figcaption></figure>

8. Заполните redirect URIs. Это нужно будет изменить в зависимости от того, как вы размещаете приложение: `http[s]://[your-flowise-instance.com]/api/v1/azure/callback`:

<figure><img src="../.gitbook/assets/image (218).png" alt="" width="514"><figcaption></figcaption></figure>

9. Вы должны увидеть созданный новый Redirect URI:

<figure><img src="../.gitbook/assets/image (219).png" alt=""><figcaption></figcaption></figure>

10. Вернитесь в приложение Flowise, войдите как Администратор организации. Перейдите к SSO Config на левой боковой панели. Заполните Azure Tenant ID и Client ID из шага 4, и Client Secret из шага 6. Нажмите Test Configuration, чтобы проверить, можно ли успешно установить соединение:

<figure><img src="../.gitbook/assets/image (220).png" alt="" width="563"><figcaption></figcaption></figure>

11. Наконец, включите и сохраните настройки:

<figure><img src="../.gitbook/assets/image (221).png" alt="" width="563"><figcaption></figcaption></figure>

12. Прежде чем пользователи смогут войти с помощью SSO, их нужно сначала пригласить. Обратитесь к [Приглашение пользователей для входа через SSO](sso.md#inviting-users-for-sso-sign-in) для пошагового руководства. Приглашенные пользователи также должны быть частью Directory Users в Azure.

<figure><img src="../.gitbook/assets/image (2) (1) (2).png" alt=""><figcaption></figcaption></figure>

## Google

Чтобы включить Sign In With Google на вашем веб-сайте, вам сначала нужно настроить ваш Google API client ID. Для этого выполните следующие шаги:

1. Откройте страницу **Credentials** в [консоли Google APIs](https://console.developers.google.com/apis).
2. Нажмите **Create credentials** > **OAuth client ID**

<figure><img src="../.gitbook/assets/image (224).png" alt="" width="563"><figcaption></figcaption></figure>

3\. Выберите **Web Application**:

<figure><img src="../.gitbook/assets/image (225).png" alt="" width="504"><figcaption></figcaption></figure>

4\. Заполните redirect URIs. Это нужно будет изменить в зависимости от того, как вы размещаете приложение: `http[s]://[your-flowise-instance.com]/api/v1/google/callback`:

<figure><img src="../.gitbook/assets/image (226).png" alt="" width="563"><figcaption></figcaption></figure>

5\. После создания получите client ID и secret:

<figure><img src="../.gitbook/assets/image (227).png" alt=""><figcaption></figcaption></figure>

6\. Вернитесь в приложение Flowise, добавьте Client ID и secret. Протестируйте соединение и сохраните.

<figure><img src="../.gitbook/assets/image (228).png" alt="" width="563"><figcaption></figcaption></figure>

## Auth0

1. Зарегистрируйте аккаунт на [Auth0](https://auth0.com/), затем создайте новое приложение

<figure><img src="../.gitbook/assets/image (229).png" alt=""><figcaption></figcaption></figure>

2. Выберите **Regular Web Application**:

<figure><img src="../.gitbook/assets/image (230).png" alt=""><figcaption></figcaption></figure>

3. Настройте поля, такие как Name, Description. Запишите **Domain**, **Client ID** и **Client Secret**.

<figure><img src="../.gitbook/assets/image (231).png" alt=""><figcaption></figcaption></figure>

4\. Заполните Application URIs. Это нужно будет изменить в зависимости от того, как вы размещаете приложение: `http[s]://[your-flowise-instance.com]/api/v1/auth0/callback`:

<figure><img src="../.gitbook/assets/image (232).png" alt=""><figcaption></figcaption></figure>

5. На вкладке API убедитесь, что Auth0 Management API включен со следующими разрешениями
   * read:users
   * read:client\_grants

<figure><img src="../.gitbook/assets/image (233).png" alt=""><figcaption></figcaption></figure>

6\. Вернитесь в приложение Flowise, заполните Domain, Client ID и Secret. Протестируйте и сохраните конфигурацию.

<figure><img src="../.gitbook/assets/image (234).png" alt="" width="563"><figcaption></figcaption></figure>

## Приглашение пользователей для входа через SSO

Чтобы новый пользователь мог войти в систему, вы должны пригласить новых пользователей в приложение Flowise. Это необходимо для ведения записи о роли/рабочем пространстве приглашенного пользователя. Обратитесь к разделу [Приглашение пользователей](../using-flowise/workspaces.md#invite-user) для настройки переменных окружения.

Приглашенный пользователь получит ссылку-приглашение для входа:

<figure><img src="../.gitbook/assets/image (222).png" alt="" width="449"><figcaption></figcaption></figure>

Нажатие на кнопку приведет приглашенного пользователя прямо на экран входа Flowise SSO:

<figure><img src="../.gitbook/assets/image (210).png" alt="" width="400"><figcaption></figcaption></figure>

Или перейдите в приложение Flowise и войдите с помощью SSO:

<figure><img src="../.gitbook/assets/image (211).png" alt="" width="437"><figcaption></figcaption></figure>
