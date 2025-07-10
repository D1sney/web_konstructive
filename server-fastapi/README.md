# Конструктивный API для MySQL (FastAPI)

Серверная часть приложения для управления базой данных MySQL, написанная на FastAPI.

## Требования

- Python 3.8+
- MySQL/MariaDB

## Установка

1. Клонировать репозиторий
2. Установить зависимости:

```bash
pip install -r requirements.txt
```

3. Создать файл `.env` в корневой директории проекта со следующим содержимым:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=your_database_name
API_PORT=5000
```

## Запуск

Для запуска сервера выполните:

```bash
python run.py
```

Или используя uvicorn напрямую:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 5000
```

## API Endpoints

После запуска сервера API будет доступен по адресу: `http://localhost:5000/`

Документация API будет доступна по адресу:
- Swagger UI: `http://localhost:5000/docs`
- ReDoc: `http://localhost:5000/redoc`

### Основные endpoints:

- `GET /api/tables` - получение списка таблиц
- `GET /api/tables/{table_name}/columns` - получение структуры таблицы (колонки)
- `GET /api/tables/{table_name}/data` - получение данных из таблицы с поддержкой поиска и пагинации
- `POST /api/tables/{table_name}/data` - добавление новой записи
- `PUT /api/tables/{table_name}/data/{id}` - обновление записи
- `DELETE /api/tables/{table_name}/data/{id}` - удаление записи 