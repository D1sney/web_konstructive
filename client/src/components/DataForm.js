import React, { useState, useEffect } from 'react';
import { FaSave, FaTimes } from 'react-icons/fa';

// Компонент формы для добавления/редактирования данных
const DataForm = ({ columns, initialData, onSubmit, onCancel, isEdit }) => {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  // Получение имени столбца с учетом возможных регистров
  const getColumnName = (column) => {
    return column.column_name || column.COLUMN_NAME;
  };

  // Определение, является ли колонка первичным ключом
  const isPrimaryKey = (column) => {
    const colKey = column.column_key || column.COLUMN_KEY;
    return colKey === 'PRI';
  };

  // Инициализация формы данными при редактировании
  useEffect(() => {
    if (initialData) {
      console.log('Инициализация формы данными:', initialData);
      setFormData(initialData);
    } else {
      // Для новой записи - создаем пустой объект с полями из колонок
      const newData = {};
      columns.forEach(column => {
        const columnName = getColumnName(column);
        // Для первичных ключей с автоинкрементом оставляем пустое значение
        if (isPrimaryKey(column) && column.extra === 'auto_increment') {
          newData[columnName] = '';
        } else {
          // Для других полей устанавливаем значение по умолчанию
          newData[columnName] = '';
        }
      });
      console.log('Создана новая форма с полями:', newData);
      setFormData(newData);
    }
  }, [initialData, columns]);

  // Обработчик изменения полей формы
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Очищаем ошибки при изменении поля
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  // Валидация формы
  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    columns.forEach(column => {
      const fieldName = getColumnName(column);
      const value = formData[fieldName];
      
      // Проверяем обязательные поля (не NULL)
      if (column.is_nullable === 'NO' && (value === '' || value === null)) {
        newErrors[fieldName] = 'Это поле обязательно';
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  // Обработчик отправки формы
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  // Определение типа данных для поля ввода
  const getInputType = (dataType) => {
    if (!dataType) return 'text';
    
    const type = dataType.toLowerCase();
    if (type.includes('int') || type.includes('float') || type.includes('decimal')) {
      return 'number';
    } else if (type.includes('date')) {
      return 'date';
    } else if (type.includes('time')) {
      return 'time';
    } else if (type.includes('bool')) {
      return 'checkbox';
    }
    return 'text';
  };

  // Рендеринг полей формы на основе информации о колонках
  const renderFormFields = () => {
    return columns.map((column, index) => {
      const columnName = getColumnName(column);
      const isPrimary = isPrimaryKey(column);
      const isAutoIncrement = column.extra === 'auto_increment' || column.EXTRA === 'auto_increment';
      
      // Определяем тип поля ввода в зависимости от типа данных в БД
      const dataType = column.data_type || column.DATA_TYPE || '';
      const inputType = getInputType(dataType);

      // Для первичных ключей с автоинкрементом при редактировании делаем поле недоступным для изменения
      const isReadOnly = (isEdit && isPrimary) || (isEdit && isAutoIncrement);

      return (
        <div className="form-group" key={index}>
          <label htmlFor={columnName}>
            {columnName}
            {isPrimary && <span className="primary-key" title="Первичный ключ"> 🔑</span>}
            {column.is_nullable === 'NO' && <span className="required" title="Обязательное поле">*</span>}
          </label>
          
          {inputType === 'checkbox' ? (
            <input
              type="checkbox"
              id={columnName}
              name={columnName}
              checked={Boolean(formData[columnName])}
              onChange={(e) => {
                setFormData(prev => ({
                  ...prev,
                  [columnName]: e.target.checked
                }));
              }}
              disabled={isReadOnly}
              className="form-control"
            />
          ) : (
            <input
              type={inputType}
              id={columnName}
              name={columnName}
              value={formData[columnName] !== null && formData[columnName] !== undefined ? formData[columnName] : ''}
              onChange={handleChange}
              readOnly={isReadOnly}
              className={`form-control ${errors[columnName] ? 'is-invalid' : ''}`}
              placeholder={isAutoIncrement ? 'Автоинкремент' : ''}
            />
          )}
          
          {errors[columnName] && (
            <div className="error-text">{errors[columnName]}</div>
          )}
          
          {/* Добавляем подсказку о типе данных */}
          <small className="form-text text-muted">
            {dataType}
            {isAutoIncrement && ' (автоинкремент)'}
          </small>
        </div>
      );
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">
            {isEdit ? 'Редактировать запись' : 'Добавить запись'}
          </h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          {renderFormFields()}
          
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              <FaTimes /> Отмена
            </button>
            <button type="submit" className="btn btn-primary">
              <FaSave /> Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DataForm; 