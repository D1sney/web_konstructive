from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import logging
from sqlalchemy import text
from ..db.database import get_db
from ..models.models import TableName, TableColumn, TableData, Pagination, TableRowOperation, DeletedRow

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Создание роутера
router = APIRouter(prefix="/api", tags=["database"])

# Получение списка таблиц
@router.get("/tables", response_model=List[TableName])
async def get_tables(db: Session = Depends(get_db)):
    """
    Получение списка всех таблиц в базе данных
    """
    try:
        logger.info("Запрос на получение списка таблиц")
        
        query = text("""
            SELECT table_name as TABLE_NAME
            FROM information_schema.tables 
            WHERE table_schema = :db_name
            ORDER BY table_name;
        """)
        
        # Получаем имя базы данных из текущего соединения
        db_name_query = text("SELECT DATABASE() as db_name")
        db_result = db.execute(db_name_query).fetchone()
        db_name = db_result.db_name if db_result else None
        
        logger.info(f"Используемая база данных: {db_name}")
        
        if not db_name:
            raise HTTPException(status_code=500, detail="Не удалось определить имя базы данных")
        
        result = db.execute(query, {"db_name": db_name}).fetchall()
        tables = [{"TABLE_NAME": row.TABLE_NAME} for row in result]
        
        logger.info(f"Найдено {len(tables)} таблиц")
        return tables
    except Exception as e:
        logger.error(f"Ошибка при получении списка таблиц: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка сервера: {str(e)}")

# Получение информации о структуре таблицы (колонки)
@router.get("/tables/{table_name}/columns", response_model=List[TableColumn])
async def get_table_columns(
    table_name: str = Path(..., description="Имя таблицы"),
    db: Session = Depends(get_db)
):
    """
    Получение структуры таблицы (колонки)
    """
    try:
        logger.info(f"Запрос структуры таблицы: {table_name}")
        
        # Получаем имя текущей базы данных
        db_name_query = text("SELECT DATABASE() as db_name")
        db_result = db.execute(db_name_query).fetchone()
        db_name = db_result.db_name if db_result else None
        
        if not db_name:
            raise HTTPException(status_code=500, detail="Не удалось определить имя базы данных")
        
        query = text("""
            SELECT 
                column_name, 
                data_type, 
                is_nullable 
            FROM 
                information_schema.columns 
            WHERE 
                table_schema = :db_name AND 
                table_name = :table_name
            ORDER BY 
                ordinal_position
        """)
        
        result = db.execute(query, {"db_name": db_name, "table_name": table_name}).fetchall()
        
        if not result:
            raise HTTPException(status_code=404, detail=f"Таблица '{table_name}' не найдена")
        
        columns = [
            {
                "column_name": row.column_name,
                "data_type": row.data_type,
                "is_nullable": row.is_nullable
            } for row in result
        ]
        
        logger.info(f"Найдено {len(columns)} колонок в таблице '{table_name}'")
        return columns
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении структуры таблицы '{table_name}': {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка сервера: {str(e)}")

# Получение данных из таблицы с поддержкой поиска
@router.get("/tables/{table_name}/data", response_model=TableData)
async def get_table_data(
    table_name: str = Path(..., description="Имя таблицы"),
    page: int = Query(1, ge=1, description="Номер страницы"),
    limit: int = Query(50, ge=1, le=500, description="Количество записей на странице"),
    search: Optional[str] = Query(None, description="Поисковый запрос"),
    db: Session = Depends(get_db)
):
    """
    Получение данных из таблицы с поддержкой поиска и пагинации
    """
    try:
        logger.info(f"Запрос данных из таблицы: {table_name}")
        logger.info(f"Параметры: page={page}, limit={limit}, search={search}")
        
        offset = (page - 1) * limit
        
        # Сначала получим одну запись из таблицы, чтобы определить структуру
        sample_query = text(f"SELECT * FROM `{table_name}` LIMIT 1")
        
        try:
            sample_result = db.execute(sample_query).fetchone()
        except Exception as e:
            logger.error(f"Ошибка при запросе к таблице '{table_name}': {e}")
            raise HTTPException(status_code=404, detail=f"Таблица '{table_name}' не найдена или ошибка доступа")
        
        if not sample_result:
            # Таблица существует, но пуста - вернем пустой результат
            logger.info(f"Таблица '{table_name}' пуста")
            return {"data": [], "pagination": {"total": 0, "page": page, "limit": limit, "pages": 0}}
        
        # Получаем имена столбцов
        columns = sample_result._fields
        
        # Формируем запрос с поиском
        query_parts = [f"SELECT * FROM `{table_name}`"]
        count_query_parts = [f"SELECT COUNT(*) as total FROM `{table_name}`"]
        query_params = {}
        
        # Если есть поисковый запрос, добавляем условия поиска по всем столбцам
        if search:
            search_conditions = []
            for idx, col in enumerate(columns):
                param_name = f"search_{idx}"
                search_conditions.append(f"`{col}` LIKE :{param_name}")
                query_params[param_name] = f"%{search}%"
            
            if search_conditions:
                search_clause = " OR ".join(search_conditions)
                query_parts.append(f"WHERE {search_clause}")
                count_query_parts.append(f"WHERE {search_clause}")
        
        # Добавляем пагинацию
        query_parts.append("LIMIT :limit OFFSET :offset")
        query_params.update({"limit": limit, "offset": offset})
        
        # Собираем финальные запросы
        data_query = text(" ".join(query_parts))
        count_query = text(" ".join(count_query_parts))
        
        logger.info(f"SQL запрос данных: {data_query}")
        logger.info(f"SQL запрос подсчета: {count_query}")
        
        # Выполняем запросы
        result = db.execute(data_query, query_params).fetchall()
        count_result = db.execute(count_query, {k: v for k, v in query_params.items() if k not in ['limit', 'offset']}).fetchone()
        
        total_count = count_result.total if count_result else 0
        
        # Преобразуем результаты в словари
        rows = []
        for row in result:
            row_dict = {col: getattr(row, col) for col in columns}
            rows.append(row_dict)
        
        logger.info(f"Получено {len(rows)} записей из {total_count}")
        
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
        logger.error(f"Ошибка при получении данных из таблицы '{table_name}': {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка сервера: {str(e)}")

# Добавление новой записи в таблицу
@router.post("/tables/{table_name}/data", response_model=Dict[str, Any])
async def add_table_row(
    table_name: str = Path(..., description="Имя таблицы"),
    data: Dict[str, Any] = Body(..., description="Данные для добавления"),
    db: Session = Depends(get_db)
):
    """
    Добавление новой записи в таблицу
    """
    try:
        logger.info(f"Добавление записи в таблицу '{table_name}'")
        logger.info(f"Данные для добавления: {data}")
        
        if not data:
            raise HTTPException(status_code=400, detail="Отсутствуют данные для добавления")
        
        columns = list(data.keys())
        placeholders = [f":{col}" for col in columns]
        
        # Формируем запрос
        query = text(f"""
            INSERT INTO `{table_name}` 
            ({', '.join([f'`{col}`' for col in columns])})
            VALUES ({', '.join(placeholders)})
        """)
        
        logger.info(f"SQL запрос: {query}")
        
        # Выполняем запрос
        result = db.execute(query, data)
        db.commit()
        
        insert_id = result.lastrowid
        logger.info(f"Запись добавлена с ID: {insert_id}")
        
        # Получаем имя первичного ключа
        pk_query = text("""
            SELECT column_name
            FROM information_schema.key_column_usage
            WHERE constraint_name = 'PRIMARY'
            AND table_schema = DATABASE()
            AND table_name = :table_name
        """)
        
        pk_result = db.execute(pk_query, {"table_name": table_name}).fetchone()
        
        pk_column = pk_result.column_name if pk_result else 'id'
        logger.info(f"Первичный ключ таблицы: {pk_column}")
        
        # Получаем добавленную запись
        if insert_id:
            select_query = text(f"SELECT * FROM `{table_name}` WHERE `{pk_column}` = :id")
            row = db.execute(select_query, {"id": insert_id}).fetchone()
            
            if row:
                # Преобразуем запись в словарь
                inserted_data = {col: getattr(row, col) for col in row._fields}
                logger.info(f"Добавленная запись: {inserted_data}")
                return inserted_data
            else:
                return {"message": "Запись добавлена успешно", "insertId": insert_id}
        else:
            return {"message": "Запись добавлена успешно"}
    except Exception as e:
        db.rollback()
        logger.error(f"Ошибка при добавлении записи в таблицу '{table_name}': {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при добавлении записи: {str(e)}")

# Обновление записи в таблице
@router.put("/tables/{table_name}/data/{row_id}", response_model=Dict[str, Any])
async def update_table_row(
    table_name: str = Path(..., description="Имя таблицы"),
    row_id: str = Path(..., description="ID записи для обновления"),
    data: Dict[str, Any] = Body(..., description="Данные для обновления"),
    db: Session = Depends(get_db)
):
    """
    Обновление записи в таблице
    """
    try:
        logger.info(f"Обновление записи с ID {row_id} в таблице '{table_name}'")
        logger.info(f"Данные для обновления: {data}")
        
        # Получаем имя первичного ключа
        pk_query = text("""
            SELECT column_name
            FROM information_schema.key_column_usage
            WHERE constraint_name = 'PRIMARY'
            AND table_schema = DATABASE()
            AND table_name = :table_name
        """)
        
        pk_result = db.execute(pk_query, {"table_name": table_name}).fetchone()
        
        if pk_result:
            pk_column = pk_result.column_name
            logger.info(f"Первичный ключ таблицы: {pk_column}")
        else:
            # Если первичный ключ не найден, пробуем использовать стандартные имена
            logger.warning(f"Первичный ключ для таблицы '{table_name}' не найден, используем id по умолчанию")
            # Получаем структуру таблицы
            try:
                sample_query = text(f"SELECT * FROM `{table_name}` LIMIT 1")
                sample_row = db.execute(sample_query).fetchone()
                if sample_row:
                    columns = sample_row._fields
                    # Ищем поле с именем id (без учета регистра)
                    pk_column = next((col for col in columns if col.lower() == 'id'), columns[0])
                else:
                    pk_column = 'id'
            except Exception:
                pk_column = 'id'
        
        # Формируем запрос на обновление
        set_clauses = [f"`{col}` = :{col}" for col in data.keys()]
        query = text(f"""
            UPDATE `{table_name}` 
            SET {', '.join(set_clauses)}
            WHERE `{pk_column}` = :row_id
        """)
        
        # Параметры запроса
        params = {**data, "row_id": row_id}
        
        logger.info(f"SQL запрос: {query}")
        
        # Выполняем запрос
        result = db.execute(query, params)
        db.commit()
        
        affected_rows = result.rowcount
        logger.info(f"Обновлено записей: {affected_rows}")
        
        if affected_rows == 0:
            raise HTTPException(status_code=404, detail=f"Запись с ID {row_id} не найдена")
        
        # Получаем обновленную запись
        select_query = text(f"SELECT * FROM `{table_name}` WHERE `{pk_column}` = :id")
        updated_row = db.execute(select_query, {"id": row_id}).fetchone()
        
        if updated_row:
            # Преобразуем запись в словарь
            updated_data = {col: getattr(updated_row, col) for col in updated_row._fields}
            logger.info(f"Обновленная запись: {updated_data}")
            return updated_data
        else:
            raise HTTPException(status_code=404, detail=f"Запись с ID {row_id} не найдена после обновления")
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Ошибка при обновлении записи в таблице '{table_name}': {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при обновлении записи: {str(e)}")

# Удаление записи из таблицы
@router.delete("/tables/{table_name}/data/{row_id}", response_model=DeletedRow)
async def delete_table_row(
    table_name: str = Path(..., description="Имя таблицы"),
    row_id: str = Path(..., description="ID записи для удаления"),
    db: Session = Depends(get_db)
):
    """
    Удаление записи из таблицы
    """
    try:
        logger.info(f"Удаление записи с ID {row_id} из таблицы '{table_name}'")
        
        # Получаем имя первичного ключа
        pk_query = text("""
            SELECT column_name
            FROM information_schema.key_column_usage
            WHERE constraint_name = 'PRIMARY'
            AND table_schema = DATABASE()
            AND table_name = :table_name
        """)
        
        pk_result = db.execute(pk_query, {"table_name": table_name}).fetchone()
        
        if pk_result:
            pk_column = pk_result.column_name
            logger.info(f"Первичный ключ таблицы: {pk_column}")
        else:
            # Если первичный ключ не найден, пробуем использовать стандартные имена
            logger.warning(f"Первичный ключ для таблицы '{table_name}' не найден, используем id по умолчанию")
            try:
                sample_query = text(f"SELECT * FROM `{table_name}` LIMIT 1")
                sample_row = db.execute(sample_query).fetchone()
                if sample_row:
                    columns = sample_row._fields
                    # Ищем поле с именем id (без учета регистра)
                    pk_column = next((col for col in columns if col.lower() == 'id'), columns[0])
                else:
                    pk_column = 'id'
            except Exception:
                pk_column = 'id'
        
        # Получаем запись перед удалением
        select_query = text(f"SELECT * FROM `{table_name}` WHERE `{pk_column}` = :id")
        row_to_delete = db.execute(select_query, {"id": row_id}).fetchone()
        
        if not row_to_delete:
            raise HTTPException(status_code=404, detail=f"Запись с ID {row_id} не найдена")
        
        # Преобразуем запись в словарь
        deleted_data = {col: getattr(row_to_delete, col) for col in row_to_delete._fields}
        logger.info(f"Найдена запись для удаления: {deleted_data}")
        
        # Формируем запрос на удаление
        delete_query = text(f"DELETE FROM `{table_name}` WHERE `{pk_column}` = :id")
        
        # Выполняем запрос
        result = db.execute(delete_query, {"id": row_id})
        db.commit()
        
        affected_rows = result.rowcount
        logger.info(f"Удалено записей: {affected_rows}")
        
        if affected_rows == 0:
            raise HTTPException(status_code=404, detail=f"Запись с ID {row_id} не найдена или не может быть удалена")
        
        return {
            "message": "Запись успешно удалена", 
            "deleted": deleted_data
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Ошибка при удалении записи из таблицы '{table_name}': {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при удалении записи: {str(e)}") 