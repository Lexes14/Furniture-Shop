const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CartItem = sequelize.define('cartItem', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  cartId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'cart_id',
  },
  itemId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'item_id',
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  unitPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'unit_price',
  },
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
}, {
  tableName: 'cart_items',
  indexes: [
    { unique: true, fields: ['cart_id', 'item_id'] },
    { fields: ['cart_id'] },
    { fields: ['item_id'] },
  ],
});

module.exports = CartItem;