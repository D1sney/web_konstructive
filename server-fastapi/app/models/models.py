from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional, Union
from datetime import date, datetime

# Общие модели данных
class TableData(BaseModel):
    data: List[Dict[str, Any]]
    pagination: Dict[str, Any]

class TableColumn(BaseModel):
    column_name: str
    data_type: str
    is_nullable: str

class TableName(BaseModel):
    TABLE_NAME: str

class Pagination(BaseModel):
    page: int = Field(1, gt=0)
    limit: int = Field(50, gt=0)
    search: Optional[str] = None

class TableRowOperation(BaseModel):
    message: str
    insertId: Optional[int] = None

class DeletedRow(BaseModel):
    message: str
    deleted: Dict[str, Any]

# Функция для создания динамической Pydantic модели
def create_dynamic_model(name: str, fields: Dict[str, Any]):
    """
    Создаёт динамическую Pydantic модель на основе полей таблицы.
    
    Args:
        name: Имя модели
        fields: Словарь полей и их типов
    
    Returns:
        Pydantic модель
    """
    # Преобразуем типы SQL в типы Python
    field_types = {}
    for field_name, field_type in fields.items():
        if 'int' in field_type.lower():
            field_types[field_name] = (Optional[int], None)
        elif 'float' in field_type.lower() or 'double' in field_type.lower() or 'decimal' in field_type.lower():
            field_types[field_name] = (Optional[float], None)
        elif 'date' in field_type.lower() and 'time' not in field_type.lower():
            field_types[field_name] = (Optional[date], None)
        elif 'datetime' in field_type.lower() or 'timestamp' in field_type.lower():
            field_types[field_name] = (Optional[datetime], None)
        elif 'bool' in field_type.lower():
            field_types[field_name] = (Optional[bool], None)
        else:
            field_types[field_name] = (Optional[str], None)
    
    # Создаём модель
    return type(name, (BaseModel,), field_types) 