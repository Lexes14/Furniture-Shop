const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrderItem = sequelize.define('orderItem', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  orderId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'order_id',
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
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  subtotal: {
    type: DataTypes.VIRTUAL(DataTypes.DECIMAL(10, 2), ['quantity', 'price']),
    get() {
      return Number((this.getDataValue('quantity') * this.getDataValue('price')).toFixed(2));
    },
  },
}, {
  tableName: 'order_items',
  indexes: [
    { fields: ['order_id'] },
    { fields: ['item_id'] },
  ],
});

module.exports = OrderItem;