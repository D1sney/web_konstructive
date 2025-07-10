import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from .routers import data_routes

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Загрузка переменных окружения
load_dotenv()

# Создание приложения FastAPI
app = FastAPI(
    title="Конструктивный API для MySQL",
    description="API для управления базой данных MySQL",
    version="1.0.0"
)

# Настройка CORS
origins = ["*"]  # В продакшене стоит ограничить список доменов

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение маршрутов
app.include_router(data_routes.router)

# Корневой маршрут
@app.get("/")
async def root():
    return {
        "message": "Добро пожаловать в Конструктивный API для MySQL",
        "docs": "/docs",
        "api": "/api/tables"
    }

# Обработка ошибок
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Необработанная ошибка: {exc}")
    return {"detail": "Внутренняя ошибка сервера"}

# Запуск приложения при выполнении скрипта напрямую
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("API_PORT", 5000))
    logger.info(f"Запуск сервера на порту {port}")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True) 