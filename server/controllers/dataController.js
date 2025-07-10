const pool = require('../db/db');

// Получение списка таблиц в базе данных
const getTables = async (req, res) => {
  try {
    const query = `
      SELECT table_name as TABLE_NAME
      FROM information_schema.tables 
      WHERE table_schema = ?
      ORDER BY table_name;
    `;
    
    // Получаем имя базы данных из .env или используем значение по умолчанию
    const dbName = process.env.DB_NAME || 'database_name';
    
    const [rows] = await pool.query(query, [dbName]);
    return res.json(rows);
  } catch (error) {
    console.error('Ошибка при получении списка таблиц:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Получение информации о структуре таблицы (колонки)
const getTableColumns = async (req, res) => {
  try {
    const { tableName } = req.params;
    const dbName = process.env.DB_NAME || 'database_name';
    
    const query = `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = ? AND table_name = ?
      ORDER BY ordinal_position;
    `;
    
    const [rows] = await pool.query(query, [dbName, tableName]);
    return res.json(rows);
  } catch (error) {
    console.error('Ошибка при получении структуры таблицы:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Получение данных из таблицы с поддержкой поиска
const getTableData = async (req, res) => {
  try {
    const { tableName } = req.params;
    const { search, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    console.log('Запрос данных из таблицы:', tableName);
    console.log('Параметры поиска:', { search, page, limit, offset });
    
    // Получаем список столбцов для таблицы
    const dbName = process.env.DB_NAME || 'database_name';
    
    try {
      // Сначала получим одну запись из таблицы, чтобы определить структуру
      const sampleQuery = `SELECT * FROM \`${tableName}\` LIMIT 1`;
      const [sampleRows] = await pool.query(sampleQuery);
      
      if (sampleRows && sampleRows.length > 0) {
        // Получаем имена столбцов из первой записи
        const columns = Object.keys(sampleRows[0]);
        console.log('Столбцы из первой записи:', columns);
        
        if (columns.length === 0) {
          console.error('Не удалось получить столбцы из данных');
          return res.status(500).json({ error: 'Ошибка при получении структуры таблицы' });
        }
        
        let query = `SELECT * FROM \`${tableName}\``;
        const queryParams = [];
        
        // Если есть поисковый запрос, добавляем условия поиска по всем столбцам
        if (search && search.trim()) {
          try {
            // Безопасная обработка поисковой строки
            const searchValue = search.trim();
            
            // Формируем условия поиска для каждого столбца
            const searchConditions = columns.map(col => {
              if (!col) return null;
              return `\`${col}\` LIKE ?`;
            }).filter(Boolean); // Удаляем null значения
            
            // Добавляем условие WHERE, если есть хотя бы одно условие поиска
            if (searchConditions.length > 0) {
              query += ' WHERE ' + searchConditions.join(' OR ');
              
              // Добавляем параметры поиска для каждого столбца
              searchConditions.forEach(() => {
                queryParams.push(`%${searchValue}%`);
              });
            }
            
            console.log('SQL запрос с условиями поиска:', query);
            console.log('Параметры запроса:', queryParams);
          } catch (searchError) {
            console.error('Ошибка при формировании поискового запроса:', searchError);
            // Если произошла ошибка при формировании поискового запроса, просто продолжаем без поиска
          }
        }
        
        // Добавляем пагинацию
        query += ' LIMIT ? OFFSET ?';
        queryParams.push(parseInt(limit), parseInt(offset));
        
        // Получаем общее количество записей для пагинации
        let countQuery = `SELECT COUNT(*) as total FROM \`${tableName}\``;
        let countParams = [];
        
        // Добавляем условие поиска к запросу подсчета, если оно есть
        if (search && search.trim()) {
          try {
            const searchValue = search.trim();
            
            // Используем тот же подход для запроса подсчета
            const searchConditions = columns.map(col => {
              if (!col) return null;
              return `\`${col}\` LIKE ?`;
            }).filter(Boolean); // Удаляем null значения
            
            if (searchConditions.length > 0) {
              countQuery += ' WHERE ' + searchConditions.join(' OR ');
              
              searchConditions.forEach(() => {
                countParams.push(`%${searchValue}%`);
              });
            }
          } catch (searchError) {
            console.error('Ошибка при формировании запроса подсчета:', searchError);
          }
        }
        
        console.log('Запрос для подсчета записей:', countQuery);
        console.log('Параметры запроса для подсчета:', countParams);
        
        // Выполняем запрос для подсчета общего количества записей
        const [countRows] = await pool.query(countQuery, countParams);
        const totalCount = countRows[0].total;
        
        // Выполняем основной запрос для получения данных
        const [rows] = await pool.query(query, queryParams);
        
        console.log('Успешно получены данные:', rows.length);
        
        return res.json({
          data: rows,
          pagination: {
            total: totalCount,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(totalCount / limit)
          }
        });
      } else {
        console.error('Таблица пуста или не существует');
        return res.status(404).json({ error: 'Таблица пуста или не существует' });
      }
    } catch (dbError) {
      console.error('Ошибка при выполнении запроса к базе данных:', dbError);
      console.error(dbError.stack); // Выводим полный стек ошибки
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
  } catch (error) {
    console.error('Ошибка при получении данных из таблицы:', error);
    console.error(error.stack); // Выводим полный стек ошибки
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Добавление новой записи в таблицу
const addTableRow = async (req, res) => {
  try {
    const { tableName } = req.params;
    const data = req.body;
    
    console.log(`Добавление новой записи в таблицу ${tableName}:`, data);
    
    const columns = Object.keys(data);
    const values = Object.values(data);
    
    if (columns.length === 0) {
      console.error('Отсутствуют данные для добавления');
      return res.status(400).json({ error: 'Отсутствуют данные для добавления' });
    }
    
    // Создаем плейсхолдеры для запроса (?)
    const placeholders = columns.map(() => '?').join(', ');
    
    const query = `
      INSERT INTO \`${tableName}\` (${columns.map(c => `\`${c}\``).join(', ')}) 
      VALUES (${placeholders});
    `;
    
    console.log('SQL запрос для добавления:', query);
    console.log('Параметры запроса:', values);
    
    const [result] = await pool.query(query, values);
    
    console.log('Результат добавления:', result);
    
    // Получаем имя первичного ключа таблицы для поиска добавленной записи
    const dbName = process.env.DB_NAME || 'database_name';
    const pkQuery = `
      SELECT column_name
      FROM information_schema.key_column_usage
      WHERE constraint_name = 'PRIMARY'
      AND table_schema = ?
      AND table_name = ?;
    `;
    
    const [pkRows] = await pool.query(pkQuery, [dbName, tableName]);
    
    let pkColumn = 'id'; // Значение по умолчанию
    let insertId = result.insertId;
    
    if (pkRows.length > 0) {
      pkColumn = pkRows[0].column_name;
      console.log(`Найден первичный ключ для таблицы ${tableName}: ${pkColumn}`);
    } else {
      console.log(`Первичный ключ для таблицы ${tableName} не найден, используем id по умолчанию`);
      
      // Если первичный ключ не найден, но был указан в данных, используем его
      if (data.id) {
        insertId = data.id;
        pkColumn = 'id';
      } else if (data.ID) {
        insertId = data.ID;
        pkColumn = 'ID';
      } else {
        // Попробуем получить первую запись, чтобы определить поля
        const sampleQuery = `SELECT * FROM \`${tableName}\` LIMIT 1`;
        try {
          const [sampleRows] = await pool.query(sampleQuery);
          if (sampleRows && sampleRows.length > 0) {
            // Проверяем, есть ли поле id
            const keys = Object.keys(sampleRows[0]);
            const idKey = keys.find(key => key.toLowerCase() === 'id');
            if (idKey) {
              pkColumn = idKey;
              console.log(`Используем колонку ${pkColumn} как первичный ключ`);
            } else {
              // Если нет поля id, используем первое поле
              pkColumn = keys[0];
              console.log(`Используем первую колонку ${pkColumn} как первичный ключ`);
            }
          }
        } catch (err) {
          console.error('Ошибка при попытке определить структуру таблицы:', err);
        }
      }
    }
    
    // Получаем добавленную запись
    let selectQuery;
    let selectParams;
    
    if (insertId) {
      selectQuery = `SELECT * FROM \`${tableName}\` WHERE \`${pkColumn}\` = ?`;
      selectParams = [insertId];
    } else {
      // Если нет insertId, пытаемся найти запись по всем полям
      const conditions = columns.map(col => `\`${col}\` = ?`).join(' AND ');
      selectQuery = `SELECT * FROM \`${tableName}\` WHERE ${conditions} ORDER BY \`${pkColumn}\` DESC LIMIT 1`;
      selectParams = values;
    }
    
    console.log('SQL запрос для получения добавленной записи:', selectQuery);
    console.log('Параметры запроса:', selectParams);
    
    const [rows] = await pool.query(selectQuery, selectParams);
    
    if (rows.length === 0) {
      console.log('Запись добавлена, но не удалось её получить');
      return res.status(201).json({ 
        message: 'Запись добавлена успешно', 
        insertId: result.insertId 
      });
    }
    
    console.log('Добавленная запись:', rows[0]);
    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Ошибка при добавлении записи:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Обновление записи в таблице
const updateTableRow = async (req, res) => {
  try {
    const { tableName, id } = req.params;
    const data = req.body;
    
    console.log(`Обновление записи в таблице ${tableName} с ID ${id}:`, data);
    
    // Получаем имя первичного ключа таблицы
    const dbName = process.env.DB_NAME || 'database_name';
    const pkQuery = `
      SELECT column_name
      FROM information_schema.key_column_usage
      WHERE constraint_name = 'PRIMARY'
      AND table_schema = ?
      AND table_name = ?;
    `;
    
    const [pkRows] = await pool.query(pkQuery, [dbName, tableName]);
    
    let pkColumn = 'id'; // Значение по умолчанию
    
    if (pkRows.length > 0) {
      pkColumn = pkRows[0].column_name;
      console.log(`Найден первичный ключ для таблицы ${tableName}: ${pkColumn}`);
    } else {
      console.log(`Первичный ключ для таблицы ${tableName} не найден, используем id по умолчанию`);
      
      // Попробуем получить первую запись, чтобы определить поля
      const sampleQuery = `SELECT * FROM \`${tableName}\` LIMIT 1`;
      try {
        const [sampleRows] = await pool.query(sampleQuery);
        if (sampleRows && sampleRows.length > 0) {
          // Проверяем, есть ли поле id
          const keys = Object.keys(sampleRows[0]);
          const idKey = keys.find(key => key.toLowerCase() === 'id');
          if (idKey) {
            pkColumn = idKey;
            console.log(`Используем колонку ${pkColumn} как первичный ключ`);
          } else {
            // Если нет поля id, используем первое поле
            pkColumn = keys[0];
            console.log(`Используем первую колонку ${pkColumn} как первичный ключ`);
          }
        }
      } catch (err) {
        console.error('Ошибка при попытке определить структуру таблицы:', err);
      }
    }
    
    const columns = Object.keys(data);
    const values = Object.values(data);
    
    // Создаем SET часть запроса
    const setClause = columns.map(col => `\`${col}\` = ?`).join(', ');
    
    const query = `
      UPDATE \`${tableName}\` 
      SET ${setClause} 
      WHERE \`${pkColumn}\` = ?;
    `;
    
    values.push(id);
    
    console.log('SQL запрос для обновления:', query);
    console.log('Параметры запроса:', values);
    
    const [result] = await pool.query(query, values);
    
    console.log('Результат обновления:', result);
    
    if (result.affectedRows === 0) {
      console.log(`Запись с ID ${id} не найдена в таблице ${tableName}`);
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    
    // Получаем обновленную запись
    const selectQuery = `SELECT * FROM \`${tableName}\` WHERE \`${pkColumn}\` = ?`;
    const [rows] = await pool.query(selectQuery, [id]);
    
    if (rows.length === 0) {
      console.log(`Не удалось получить обновленную запись с ID ${id}`);
      return res.status(404).json({ error: 'Запись не найдена после обновления' });
    }
    
    console.log('Обновленная запись:', rows[0]);
    return res.json(rows[0]);
  } catch (error) {
    console.error('Ошибка при обновлении записи:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Удаление записи из таблицы
const deleteTableRow = async (req, res) => {
  try {
    const { tableName, id } = req.params;
    
    console.log(`Удаление записи из таблицы ${tableName} с ID ${id}`);
    
    // Получаем имя первичного ключа таблицы
    const dbName = process.env.DB_NAME || 'database_name';
    const pkQuery = `
      SELECT column_name
      FROM information_schema.key_column_usage
      WHERE constraint_name = 'PRIMARY'
      AND table_schema = ?
      AND table_name = ?;
    `;
    
    const [pkRows] = await pool.query(pkQuery, [dbName, tableName]);
    
    let pkColumn = 'id'; // Значение по умолчанию
    
    if (pkRows.length > 0) {
      pkColumn = pkRows[0].column_name;
      console.log(`Найден первичный ключ для таблицы ${tableName}: ${pkColumn}`);
    } else {
      console.log(`Первичный ключ для таблицы ${tableName} не найден, используем id по умолчанию`);
      
      // Попробуем получить первую запись, чтобы определить поля
      const sampleQuery = `SELECT * FROM \`${tableName}\` LIMIT 1`;
      try {
        const [sampleRows] = await pool.query(sampleQuery);
        if (sampleRows && sampleRows.length > 0) {
          // Проверяем, есть ли поле id
          const keys = Object.keys(sampleRows[0]);
          const idKey = keys.find(key => key.toLowerCase() === 'id');
          if (idKey) {
            pkColumn = idKey;
            console.log(`Используем колонку ${pkColumn} как первичный ключ`);
          } else {
            // Если нет поля id, используем первое поле
            pkColumn = keys[0];
            console.log(`Используем первую колонку ${pkColumn} как первичный ключ`);
          }
        }
      } catch (err) {
        console.error('Ошибка при попытке определить структуру таблицы:', err);
      }
    }
    
    // Сначала получаем запись, которую собираемся удалить
    const selectQuery = `SELECT * FROM \`${tableName}\` WHERE \`${pkColumn}\` = ?`;
    console.log('SQL запрос для поиска записи:', selectQuery);
    console.log('Параметр запроса:', id);
    
    const [selectRows] = await pool.query(selectQuery, [id]);
    
    if (selectRows.length === 0) {
      console.log(`Запись с ID ${id} не найдена в таблице ${tableName}`);
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    
    const deletedItem = selectRows[0];
    console.log('Найдена запись для удаления:', deletedItem);
    
    // Удаляем запись
    const query = `
      DELETE FROM \`${tableName}\` 
      WHERE \`${pkColumn}\` = ?;
    `;
    
    console.log('SQL запрос для удаления:', query);
    console.log('Параметр запроса:', id);
    
    const [result] = await pool.query(query, [id]);
    
    console.log('Результат удаления:', result);
    
    if (result.affectedRows === 0) {
      console.log(`Не удалось удалить запись с ID ${id}`);
      return res.status(404).json({ error: 'Запись не найдена или не может быть удалена' });
    }
    
    console.log(`Запись с ID ${id} успешно удалена из таблицы ${tableName}`);
    return res.json({ message: 'Запись успешно удалена', deleted: deletedItem });
  } catch (error) {
    console.error('Ошибка при удалении записи:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
};

module.exports = {
  getTables,
  getTableColumns,
  getTableData,
  addTableRow,
  updateTableRow,
  deleteTableRow
}; 