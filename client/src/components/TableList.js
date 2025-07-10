import React, { useState } from 'react';
import { FaSearch } from 'react-icons/fa';

// Компонент для отображения списка таблиц базы данных
const TableList = ({ tables, onSelectTable }) => {
  const [searchText, setSearchText] = useState('');
  
  // Фильтрация таблиц по поисковому запросу
  const filteredTables = tables.filter(table => {
    const tableName = table.TABLE_NAME || table.table_name || '';
    return tableName.toLowerCase().includes(searchText.toLowerCase());
  });

  // Обработчик изменения текста поиска
  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
  };

  return (
    <div>
      <h2>Список таблиц в базе данных</h2>
      
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Поиск таблицы..."
          value={searchText}
          onChange={handleSearchChange}
        />
        <button className="btn btn-primary">
          <FaSearch /> Поиск
        </button>
      </div>
      
      {filteredTables.length === 0 ? (
        <p>В базе данных не найдены таблицы{searchText ? ', соответствующие запросу' : ''}.</p>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Название таблицы</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredTables.map((table, index) => (
                <tr key={index}>
                  <td>{table.TABLE_NAME || table.table_name}</td>
                  <td>
                    <button 
                      className="btn btn-primary"
                      onClick={() => onSelectTable(table.TABLE_NAME || table.table_name)}
                    >
                      Просмотр
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TableList; 