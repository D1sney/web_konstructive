import os
from fastapi import FastAPI, Depends, HTTPException, Query, Path
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from typing import Dict, List, Any, Optional
import pymysql
import pymysql.cursors
from dotenv import load_dotenv

# Загрузка переменных окружения
load_dotenv()

# Создание приложения FastAPI
app = FastAPI(
    title="Конструктивный API для MySQL",
    description="API для управления базой данных MySQL",
    version="1.0.0"
)

# Настройка CORS
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Параметры подключения к базе данных
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "database_name")

# Функция для создания соединения с базой данных
def get_db_connection():
    try:
        connection = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            cursorclass=pymysql.cursors.DictCursor
        )
        return connection
    except Exception as e:
        print(f"Ошибка подключения к базе данных: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка подключения к базе данных: {str(e)}")

# Корневой маршрут
@app.get("/")
async def root():
    return {
        "message": "Добро пожаловать в Конструктивный API для MySQL",
        "docs": "/docs",
        "api": "/api/tables"
    }

# Получение списка таблиц
@app.get("/api/tables")
async def get_tables():
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            query = """
                SELECT table_name as TABLE_NAME
                FROM information_schema.tables 
                WHERE table_schema = %s
                ORDER BY table_name;
            """
            cursor.execute(query, (DB_NAME,))
            tables = cursor.fetchall()
            connection.close()
            return tables
    except Exception as e:
        print(f"Ошибка при получении списка таблиц: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка сервера: {str(e)}")

# Получение информации о структуре таблицы (колонки)
@app.get("/api/tables/{table_name}/columns")
async def get_table_columns(table_name: str):
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            query = """
                SELECT 
                    column_name, 
                    data_type, 
                    is_nullable 
                FROM 
                    information_schema.columns 
                WHERE 
                    table_schema = %s AND 
                    table_name = %s
                ORDER BY 
                    ordinal_position
            """
            cursor.execute(query, (DB_NAME, table_name))
            columns = cursor.fetchall()
            connection.close()
            
            if not columns:
                raise HTTPException(status_code=404, detail=f"Таблица '{table_name}' не найдена")
            
            return columns
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка при получении структуры таблицы '{table_name}': {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка сервера: {str(e)}")

# Получение данных из таблицы с поддержкой поиска
@app.get("/api/tables/{table_name}/data")
async def get_table_data(
    table_name: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None)
):
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            # Сначала получим одну запись из таблицы, чтобы определить структуру
            sample_query = f"SELECT * FROM `{table_name}` LIMIT 1"
            
            try:
                cursor.execute(sample_query)
                sample_row = cursor.fetchone()
            except Exception as e:
                raise HTTPException(status_code=404, detail=f"Таблица '{table_name}' не найдена или ошибка доступа")
            
            if not sample_row:
                # Таблица существует, но пуста - вернем пустой результат
                return {"data": [], "pagination": {"total": 0, "page": page, "limit": limit, "pages": 0}}
            
            # Получаем имена столбцов
            columns = list(sample_row.keys())
            
            offset = (page - 1) * limit
            
            # Формируем запрос с поиском
            query_parts = [f"SELECT * FROM `{table_name}`"]
            count_query_parts = [f"SELECT COUNT(*) as total FROM `{table_name}`"]
            query_params = []
            
            # Если есть поисковый запрос, добавляем условия поиска по всем столбцам
            if search:
                search_conditions = []
                for col in columns:
                    search_conditions.append(f"`{col}` LIKE %s")
                    query_params.append(f"%{search}%")
                
                if search_conditions:
                    search_clause = " OR ".join(search_conditions)
                    query_parts.append(f"WHERE {search_clause}")
                    count_query_parts.append(f"WHERE {search_clause}")
            
            # Добавляем пагинацию
            query_parts.append("LIMIT %s OFFSET %s")
            query_params.extend([limit, offset])
            
            # Собираем финальные запросы
            data_query = " ".join(query_parts)
            count_query = " ".join(count_query_parts)
            
            # Выполняем запросы
            cursor.execute(data_query, query_params)
            rows = cursor.fetchall()
            
            # Запрос для подсчета общего количества записей
            count_params = query_params[:-2] if query_params else []
            cursor.execute(count_query, count_params)
            count_result = cursor.fetchone()
            total_count = count_result['total'] if count_result else 0
            
            connection.close()
            
            return {
                "data": rows,
                "pagination": {
                    "total": total_count,
                    "page": page,
                    "limit": limit,
                    "pages": (total_count + limit - 1) // limit if limit > 0 else 0
                }
            }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка при получении данных из таблицы '{table_name}': {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка сервера: {str(e)}")

# Добавление новой записи в таблицу
@app.post("/api/tables/{table_name}/data")
async def add_table_row(table_name: str, data: Dict[str, Any]):
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            if not data:
                raise HTTPException(status_code=400, detail="Отсутствуют данные для добавления")
            
            columns = list(data.keys())
            placeholders = ["%s" for _ in columns]
            values = list(data.values())
            
            # Формируем запрос
            query = f"""
                INSERT INTO `{table_name}` 
                ({', '.join([f'`{col}`' for col in columns])})
                VALUES ({', '.join(placeholders)})
            """
            
            # Выполняем запрос
            cursor.execute(query, values)
            connection.commit()
            
            insert_id = cursor.lastrowid
            
            # Получаем имя первичного ключа
            pk_query = """
                SELECT column_name
                FROM information_schema.key_column_usage
                WHERE constraint_name = 'PRIMARY'
                AND table_schema = %s
                AND table_name = %s
            """
            
            cursor.execute(pk_query, (DB_NAME, table_name))
            pk_result = cursor.fetchone()
            
            pk_column = pk_result['column_name'] if pk_result else 'id'
            
            # Получаем добавленную запись
            if insert_id:
                select_query = f"SELECT * FROM `{table_name}` WHERE `{pk_column}` = %s"
                cursor.execute(select_query, (insert_id,))
                row = cursor.fetchone()
                
                if row:
                    connection.close()
                    return row
                else:
                    connection.close()
                    return {"message": "Запись добавлена успешно", "insertId": insert_id}
            else:
                connection.close()
                return {"message": "Запись добавлена успешно"}
    except Exception as e:
        print(f"Ошибка при добавлении записи в таблицу '{table_name}': {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при добавлении записи: {str(e)}")

# Обновление записи в таблице
@app.put("/api/tables/{table_name}/data/{row_id}")
async def update_table_row(table_name: str, row_id: str, data: Dict[str, Any]):
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            # Получаем имя первичного ключа
            pk_query = """
                SELECT column_name
                FROM information_schema.key_column_usage
                WHERE constraint_name = 'PRIMARY'
                AND table_schema = %s
                AND table_name = %s
            """
            
            cursor.execute(pk_query, (DB_NAME, table_name))
            pk_result = cursor.fetchone()
            
            pk_column = pk_result['column_name'] if pk_result else 'id'
            
            # Формируем запрос на обновление
            set_clauses = [f"`{col}` = %s" for col in data.keys()]
            values = list(data.values())
            values.append(row_id)
            
            query = f"""
                UPDATE `{table_name}` 
                SET {', '.join(set_clauses)} 
                WHERE `{pk_column}` = %s
            """
            
            # Выполняем запрос
            cursor.execute(query, values)
            connection.commit()
            
            affected_rows = cursor.rowcount
            
            if affected_rows == 0:
                connection.close()
                raise HTTPException(status_code=404, detail=f"Запись с ID {row_id} не найдена")
            
            # Получаем обновленную запись
            select_query = f"SELECT * FROM `{table_name}` WHERE `{pk_column}` = %s"
            cursor.execute(select_query, (row_id,))
            updated_row = cursor.fetchone()
            
            connection.close()
            
            if updated_row:
                return updated_row
            else:
                raise HTTPException(status_code=404, detail=f"Запись с ID {row_id} не найдена после обновления")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка при обновлении записи в таблице '{table_name}': {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при обновлении записи: {str(e)}")

# Удаление записи из таблицы
@app.delete("/api/tables/{table_name}/data/{row_id}")
async def delete_table_row(table_name: str, row_id: str):
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            # Получаем имя первичного ключа
            pk_query = """
                SELECT column_name
                FROM information_schema.key_column_usage
                WHERE constraint_name = 'PRIMARY'
                AND table_schema = %s
                AND table_name = %s
            """
            
            cursor.execute(pk_query, (DB_NAME, table_name))
            pk_result = cursor.fetchone()
            
            pk_column = pk_result['column_name'] if pk_result else 'id'
            
            # Получаем запись перед удалением
            select_query = f"SELECT * FROM `{table_name}` WHERE `{pk_column}` = %s"
            cursor.execute(select_query, (row_id,))
            row_to_delete = cursor.fetchone()
            
            if not row_to_delete:
                connection.close()
                raise HTTPException(status_code=404, detail=f"Запись с ID {row_id} не найдена")
            
            # Формируем запрос на удаление
            delete_query = f"DELETE FROM `{table_name}` WHERE `{pk_column}` = %s"
            
            # Выполняем запрос
            cursor.execute(delete_query, (row_id,))
            connection.commit()
            
            affected_rows = cursor.rowcount
            connection.close()
            
            if affected_rows == 0:
                raise HTTPException(status_code=404, detail=f"Запись с ID {row_id} не найдена или не может быть удалена")
            
            return {
                "message": "Запись успешно удалена", 
                "deleted": row_to_delete
            }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка при удалении записи из таблицы '{table_name}': {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при удалении записи: {str(e)}")

if __name__ == "__main__":
    port = int(os.getenv("API_PORT", 5000))
    print(f"Запуск сервера на порту {port}")
    uvicorn.run(app, host="0.0.0.0", port=port) 