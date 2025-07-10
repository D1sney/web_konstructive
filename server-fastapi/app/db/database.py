import os
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import logging

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Загрузка переменных окружения
load_dotenv()

# Параметры подключения к базе данных
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "database_name")

# Строка подключения к MySQL
SQLALCHEMY_DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

try:
    # Создание движка SQLAlchemy
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    logger.info(f"Успешное подключение к базе данных: {DB_HOST}:{DB_PORT}/{DB_NAME}")
    
    # Попытка подключения для проверки
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        logger.info("Проверка соединения: успешно")
except Exception as e:
    logger.error(f"Ошибка при подключении к базе данных: {e}")
    raise

# Создание сессии
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# База для моделей SQLAlchemy
Base = declarative_base()

# Функция для получения сессии базы данных
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 