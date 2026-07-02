const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Stock = sequelize.define('stock', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  itemId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    unique: true,
    field: 'item_id',
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  reservedQuantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'reserved_quantity',
  },
  lowStockLevel: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5,
    field: 'low_stock_level',
  },
  location: {
    type: DataTypes.STRING(120),
    allowNull: true,
  },
  updatedBy: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'updated_by',
  },
}, {
  tableName: 'stocks',
  indexes: [
    { unique: true, fields: ['item_id'] },
    { fields: ['quantity'] },
  ],
});

module.exports = Stock;