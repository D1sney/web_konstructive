const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Пытаемся загрузить .env файл если он существует
try {
  require('dotenv').config();
} catch (err) {
  console.log('.env файл не найден, используем значения по умолчанию');
}

// Создаем пул подключений к базе данных
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'database_name',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Создаем пример .env файла, если его нет
const envExample = `# Параметры подключения к базе данных MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=your_database_name

# Порт для сервера
PORT=5000
`;

const envPath = path.join(__dirname, '..', '.env.example');
if (!fs.existsSync(envPath)) {
  try {
    fs.writeFileSync(envPath, envExample);
    console.log('Создан пример .env файла (.env.example)');
  } catch (err) {
    console.error('Не удалось создать пример .env файла:', err);
  }
}

module.exports = pool; 