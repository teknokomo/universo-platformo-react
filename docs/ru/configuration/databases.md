---
description: Узнайте, как подключить ваш экземпляр Universo Platformo к базе данных
---

# Базы данных

---

## Настройка

Universo Platformo поддерживает 4 типа баз данных:

- SQLite
- MySQL
- PostgreSQL
- MariaDB

### SQLite (по умолчанию)

SQLite будет базой данных по умолчанию. Эти базы данных могут быть настроены следующими переменными окружения:

```sh
DATABASE_TYPE=sqlite
DATABASE_PATH=/root/.flowise #ваше предпочтительное местоположение
```

Файл `database.sqlite` будет создан и сохранён по пути, указанному в `DATABASE_PATH`. Если не указан, путь хранения по умолчанию будет в вашем домашнем каталоге -> .flowise

**Примечание:** Если ни одна из переменных окружения не указана, SQLite будет выбрана по умолчанию.

### MySQL

```sh
DATABASE_TYPE=mysql
DATABASE_PORT=3306
DATABASE_HOST=localhost
DATABASE_NAME=flowise
DATABASE_USER=user
DATABASE_PASSWORD=123
```

### PostgreSQL

```sh
DATABASE_TYPE=postgres
DATABASE_PORT=5432
DATABASE_HOST=localhost
DATABASE_NAME=flowise
DATABASE_USER=user
DATABASE_PASSWORD=123
PGSSLMODE=require
```

### MariaDB

```bash
DATABASE_TYPE="mariadb"
DATABASE_PORT="3306"
DATABASE_HOST="localhost"
DATABASE_NAME="flowise"
DATABASE_USER="flowise"
DATABASE_PASSWORD="mypassword"
```

### Как использовать базы данных Universo Platformo SQLite и MySQL/MariaDB

{% embed url="https://youtu.be/R-6uV1Cb8I8" %}

## Резервное копирование

1. Остановите приложение Universo Platformo.
2. Убедитесь, что подключение к базе данных от других приложений отключено.
3. Сделайте резервную копию базы данных.
4. Протестируйте резервную копию.

### SQLite

1. Переименуйте файл.

   Windows:

   ```bash
   rename "DATABASE_PATH\database.sqlite" "DATABASE_PATH\BACKUP_FILE_NAME.sqlite"
   ```

   Linux:

   ```bash
   mv DATABASE_PATH/database.sqlite DATABASE_PATH/BACKUP_FILE_NAME.sqlite
   ```

2. Создайте резервную копию.

   Windows:

   ```bash
   copy DATABASE_PATH\BACKUP_FILE_NAME.sqlite DATABASE_PATH\database.sqlite
   ```

   Linux:

   ```bash
   cp DATABASE_PATH/BACKUP_FILE_NAME.sqlite DATABASE_PATH/database.sqlite
   ```

3. Протестируйте резервную копию, запустив Universo Platformo.

### PostgreSQL

1. Создайте резервную копию.

   ```bash
   pg_dump -U USERNAME -h HOST -p PORT -d DATABASE_NAME -f /PATH/TO/BACKUP_FILE_NAME.sql
   ```

2. Введите пароль базы данных.
3. Создайте тестовую базу данных.
   ```bash
   psql -U USERNAME -h HOST -p PORT -d TEST_DATABASE_NAME -f /PATH/TO/BACKUP_FILE_NAME.sql
   ```
4. Протестируйте резервную копию, запустив Universo Platformo с файлом `.env`, изменённым для подключения к резервной базе данных.

### MySQL & MariaDB

1. Создайте резервную копию.

   ```bash
   mysqldump -u USERNAME -p DATABASE_NAME > BACKUP_FILE_NAME.sql
   ```

2. Введите пароль базы данных.
3. Создайте тестовую базу данных.
   ```bash
   mysql -u USERNAME -p TEST_DATABASE_NAME < BACKUP_FILE_NAME.sql
   ```
4. Протестируйте резервную копию, запустив Universo Platformo с файлом `.env`, изменённым для подключения к резервной базе данных.
