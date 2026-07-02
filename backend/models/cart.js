const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Cart = sequelize.define('cart', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    unique: true,
    field: 'user_id',
  },
  status: {
    type: DataTypes.ENUM('active', 'converted', 'abandoned'),
    allowNull: false,
    defaultValue: 'active',
  },
}, {
  tableName: 'carts',
  indexes: [
    { unique: true, fields: ['user_id'] },
    { fields: ['status'] },
  ],
});

module.exports = Cart;