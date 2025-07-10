import os
import uvicorn
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

if __name__ == "__main__":
    # Получаем порт из переменной окружения или используем значение по умолчанию
    port = int(os.getenv("API_PORT", 5000))
    
    # Запускаем сервер
    print(f"Запуск сервера на порту {port}")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True) 