const express = require('express');
const cors = require('cors');
const dataRoutes = require('./routes/dataRoutes');
const path = require('path');

// Попытка загрузить переменные окружения
try {
  require('dotenv').config();
} catch (err) {
  console.log('Файл .env не найден, используются значения по умолчанию');
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Маршруты API
app.use('/api', dataRoutes);

// Обслуживание статических файлов React
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'));
  });
}

// Обработчик ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Что-то пошло не так!');
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`API доступен по адресу: http://localhost:${PORT}/api/tables`);
}); 