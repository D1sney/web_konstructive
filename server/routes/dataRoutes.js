const express = require('express');
const router = express.Router();
const dataController = require('../controllers/dataController');

// Получение списка таблиц
router.get('/tables', dataController.getTables);

// Получение структуры таблицы (колонок)
router.get('/tables/:tableName/columns', dataController.getTableColumns);

// Получение данных из таблицы (с поддержкой поиска)
router.get('/tables/:tableName/data', dataController.getTableData);

// Добавление новой записи в таблицу
router.post('/tables/:tableName/data', dataController.addTableRow);

// Обновление записи в таблице
router.put('/tables/:tableName/data/:id', dataController.updateTableRow);

// Удаление записи из таблицы
router.delete('/tables/:tableName/data/:id', dataController.deleteTableRow);

module.exports = router; 