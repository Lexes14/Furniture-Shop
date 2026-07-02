const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Inquiry = sequelize.define('inquiry', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'user_id',
  },
  name: {
    type: DataTypes.STRING(120),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  subject: {
    type: DataTypes.STRING(180),
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'replied', 'closed'),
    allowNull: false,
    defaultValue: 'pending',
  },
  response: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  repliedBy: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'replied_by',
  },
  repliedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'replied_at',
  },
}, {
  tableName: 'inquiries',
  indexes: [
    { fields: ['status'] },
    { fields: ['email'] },
  ],
});

module.exports = Inquiry;