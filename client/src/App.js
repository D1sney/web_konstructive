import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import TableList from './components/TableList';
import TableView from './components/TableView';

function App() {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Загружаем список таблиц при первой загрузке приложения
  useEffect(() => {
    fetchTables();
  }, []);

  // Функция для получения списка таблиц
  const fetchTables = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/tables');
      // Проверяем формат ответа и преобразуем если нужно
      let tablesData = response.data;
      
      if (Array.isArray(tablesData)) {
        // Данные уже в массиве - оставляем как есть
        setTables(tablesData);
      } else if (typeof tablesData === 'object' && !Array.isArray(tablesData)) {
        // Если пришел объект, а не массив, преобразуем в массив объектов
        const tablesArray = Object.keys(tablesData).map(key => {
          return { TABLE_NAME: tablesData[key] };
        });
        setTables(tablesArray);
      } else {
        // Если формат неизвестен, просто логируем и оставляем как есть
        console.warn('Неизвестный формат данных таблиц:', tablesData);
        setTables(Array.isArray(tablesData) ? tablesData : []);
      }
      
      setLoading(false);
    } catch (err) {
      setError('Ошибка при загрузке таблиц. Убедитесь, что сервер запущен.');
      toast.error('Ошибка при загрузке таблиц');
      setLoading(false);
      console.error('Ошибка при загрузке таблиц:', err);
    }
  };

  // Обработчик выбора таблицы
  const handleSelectTable = (tableName) => {
    setSelectedTable(tableName);
  };

  // Обработчик возврата к списку таблиц
  const handleBackToList = () => {
    setSelectedTable(null);
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Управление базой данных</h1>
      </header>

      {loading ? (
        <p>Загрузка...</p>
      ) : error ? (
        <div className="error-message">
          <p>{error}</p>
          <button className="btn btn-primary" onClick={fetchTables}>Повторить попытку</button>
        </div>
      ) : selectedTable ? (
        <TableView 
          tableName={selectedTable}
          onBack={handleBackToList}
        />
      ) : (
        <TableList 
          tables={tables} 
          onSelectTable={handleSelectTable} 
        />
      )}
    </div>
  );
}

export default App; 