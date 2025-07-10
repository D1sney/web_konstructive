import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FaEdit, FaTrashAlt, FaPlus, FaArrowLeft, FaSearch } from 'react-icons/fa';
import DataForm from './DataForm';

// Компонент для просмотра и редактирования данных таблицы
const TableView = ({ tableName, onBack }) => {
  const [columns, setColumns] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [searching, setSearching] = useState(false);

  // Загрузка данных при изменении таблицы, страницы или refresh
  useEffect(() => {
    fetchData();
  }, [tableName, page, refresh]);

  // Получение информации о колонках таблицы
  const fetchColumns = async () => {
    try {
      const response = await axios.get(`/api/tables/${tableName}/columns`);
      setColumns(response.data);
    } catch (err) {
      console.error('Ошибка при получении информации о колонках:', err);
      setError('Ошибка при получении информации о структуре таблицы');
    }
  };

  // Получение данных из таблицы
  const fetchData = async (searchQuery = '') => {
    try {
      setLoading(true);
      setError(null);
      
      // Сначала получаем информацию о колонках таблицы
      await fetchColumns();
      
      // Затем получаем данные с поддержкой поиска и пагинации
      const params = { page, limit: 10 };
      
      // Добавляем параметр поиска только если он не пустой
      if (searchQuery && searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      
      console.log('Отправляем запрос с параметрами:', params);
      
      const response = await axios.get(`/api/tables/${tableName}/data`, { params });
      
      if (response.data && response.data.data) {
        setData(response.data.data);
        if (response.data.pagination) {
          setTotalPages(response.data.pagination.pages);
        }
      } else {
        console.error('Неверный формат данных от API:', response.data);
        setData([]);
        setTotalPages(1);
      }
      
      setLoading(false);
      setSearching(false);
    } catch (err) {
      console.error('Ошибка при получении данных:', err);
      setError('Ошибка при получении данных из таблицы');
      setData([]);
      setTotalPages(1);
      setLoading(false);
      setSearching(false);
      
      // Показываем уведомление об ошибке
      toast.error('Произошла ошибка при загрузке данных');
    }
  };

  // Обработчик изменения текста поиска
  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
  };

  // Обработчик нажатия кнопки поиска
  const handleSearchClick = () => {
    if (!searchText || !searchText.trim()) {
      toast.info('Введите текст для поиска');
      return;
    }
    
    setSearching(true);
    setPage(1);
    fetchData(searchText);
  };

  // Обработчик нажатия клавиши Enter в поле поиска
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchClick();
    }
  };

  // Функция для получения имени первичного ключа
  const getPrimaryKey = () => {
    // Проверяем, есть ли колонки с информацией о первичном ключе
    const primaryKeyColumn = columns.find(col => {
      // Проверяем разные варианты имен колонок в зависимости от регистра
      const colName = col.column_name || col.COLUMN_NAME;
      const isPrimary = col.column_key === 'PRI' || col.COLUMN_KEY === 'PRI';
      return isPrimary;
    });

    if (primaryKeyColumn) {
      return primaryKeyColumn.column_name || primaryKeyColumn.COLUMN_NAME;
    }
    
    // Если не нашли явно указанный первичный ключ, предполагаем, что это первая колонка
    if (columns.length > 0) {
      return columns[0].column_name || columns[0].COLUMN_NAME;
    }
    
    // Если нет колонок, проверяем данные
    if (data.length > 0) {
      // Пробуем найти колонку id или ID
      const keys = Object.keys(data[0]);
      const idKey = keys.find(key => key.toLowerCase() === 'id');
      if (idKey) return idKey;
      
      // Если не нашли id, возвращаем первый ключ
      return keys[0];
    }
    
    return 'id'; // Возвращаем 'id' по умолчанию
  };

  // Обработчик удаления записи
  const handleDelete = async (id) => {
    if (!id) {
      toast.error('Не удалось определить идентификатор записи');
      return;
    }
    
    if (window.confirm('Вы уверены, что хотите удалить эту запись?')) {
      try {
        console.log(`Удаление записи с ID ${id} из таблицы ${tableName}`);
        const response = await axios.delete(`/api/tables/${tableName}/data/${id}`);
        
        console.log('Ответ сервера при удалении:', response.data);
        toast.success('Запись успешно удалена');
        setRefresh(prev => prev + 1); // Обновляем данные после удаления
      } catch (err) {
        console.error('Ошибка при удалении записи:', err);
        if (err.response && err.response.data && err.response.data.error) {
          toast.error(`Ошибка: ${err.response.data.error}`);
        } else {
          toast.error('Ошибка при удалении записи');
        }
      }
    }
  };

  // Обработчик редактирования записи
  const handleEdit = (item) => {
    setEditItem(item);
  };

  // Обработчик добавления новой записи
  const handleAdd = () => {
    setShowAddForm(true);
    setEditItem(null);
  };

  // Обработчик отправки формы
  const handleFormSubmit = async (formData) => {
    try {
      if (editItem) {
        // Обновление существующей записи
        const primaryKey = getPrimaryKey();
        const id = editItem[primaryKey];
        
        if (!id) {
          toast.error('Не удалось определить идентификатор записи');
          return;
        }
        
        console.log(`Обновление записи с ID ${id} в таблице ${tableName}`, formData);
        const response = await axios.put(`/api/tables/${tableName}/data/${id}`, formData);
        
        console.log('Ответ сервера при обновлении:', response.data);
        toast.success('Запись успешно обновлена');
      } else {
        // Добавление новой записи
        console.log(`Добавление новой записи в таблицу ${tableName}`, formData);
        const response = await axios.post(`/api/tables/${tableName}/data`, formData);
        
        console.log('Ответ сервера при добавлении:', response.data);
        toast.success('Запись успешно добавлена');
      }
      
      setEditItem(null);
      setShowAddForm(false);
      setRefresh(prev => prev + 1); // Обновляем данные после изменения
    } catch (err) {
      console.error('Ошибка при сохранении данных:', err);
      if (err.response && err.response.data && err.response.data.error) {
        toast.error(`Ошибка: ${err.response.data.error}`);
      } else {
        toast.error('Ошибка при сохранении данных');
      }
    }
  };

  // Обработчик изменения страницы
  const handlePageChange = (newPage) => {
    setPage(newPage);
    // Если есть активный поиск, повторяем его с новой страницей
    if (searchText) {
      fetchData(searchText);
    } else {
      fetchData();
    }
  };

  // Получение имен колонок из данных, если columns пуст
  const getColumnNames = () => {
    if (columns.length > 0) {
      return columns.map(col => col.column_name || col.COLUMN_NAME);
    }
    
    if (data.length > 0) {
      return Object.keys(data[0]);
    }
    
    return [];
  };

  // Рендеринг пагинации
  const renderPagination = () => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(
        <li key={i}>
          <button 
            className={page === i ? 'active' : ''} 
            onClick={() => handlePageChange(i)}
          >
            {i}
          </button>
        </li>
      );
    }
    return (
      <ul className="pagination">
        {pages}
      </ul>
    );
  };

  // Безопасное получение значения из объекта
  const getCellValue = (item, columnName) => {
    const value = item[columnName];
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  };

  // Очистка поиска
  const handleClearSearch = () => {
    setSearchText('');
    setSearching(false);
    setRefresh(prev => prev + 1);
  };

  return (
    <div>
      <div className="table-header">
        <button className="btn btn-secondary" onClick={onBack}>
          <FaArrowLeft /> Назад к списку
        </button>
        <h2>Таблица: {tableName}</h2>
      </div>
      
      {loading ? (
        <p>Загрузка данных...</p>
      ) : error ? (
        <div className="error-message">
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => fetchData()}>Повторить попытку</button>
        </div>
      ) : (
        <>
          <div className="search-container">
            <input
              type="text"
              className="search-input"
              placeholder="Поиск..."
              value={searchText}
              onChange={handleSearchChange}
              onKeyPress={handleKeyPress}
            />
            <button 
              className="btn btn-primary" 
              onClick={handleSearchClick}
              disabled={searching}
            >
              <FaSearch /> {searching ? 'Поиск...' : 'Поиск'}
            </button>
            {searchText && (
              <button 
                className="btn btn-secondary" 
                onClick={handleClearSearch}
              >
                Очистить
              </button>
            )}
            <button className="btn btn-success" onClick={handleAdd}>
              <FaPlus /> Добавить
            </button>
          </div>

          {data.length === 0 ? (
            <p>Нет данных для отображения.</p>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    {getColumnNames().map((columnName, index) => (
                      <th key={index}>{columnName}</th>
                    ))}
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, rowIndex) => (
                    <tr key={rowIndex}>
                      {getColumnNames().map((columnName, colIndex) => (
                        <td key={colIndex} dangerouslySetInnerHTML={{ __html: getCellValue(item, columnName) }}></td>
                      ))}
                      <td>
                        <button 
                          className="icon-button icon-edit" 
                          onClick={() => handleEdit(item)}
                          title="Редактировать"
                        >
                          <FaEdit />
                        </button>
                        <button 
                          className="icon-button icon-delete" 
                          onClick={() => handleDelete(item[getPrimaryKey()])}
                          title="Удалить"
                        >
                          <FaTrashAlt />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {totalPages > 1 && renderPagination()}
          
          {/* Форма для добавления/редактирования */}
          {(showAddForm || editItem) && (
            <DataForm 
              columns={columns} 
              initialData={editItem} 
              onSubmit={handleFormSubmit} 
              onCancel={() => { setShowAddForm(false); setEditItem(null); }}
              isEdit={!!editItem}
            />
          )}
        </>
      )}
    </div>
  );
};

export default TableView; 