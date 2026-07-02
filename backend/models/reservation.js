const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Reservation = sequelize.define('reservation', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  reservationNumber: {
    type: DataTypes.STRING(60),
    allowNull: false,
    unique: true,
    field: 'reservation_number',
  },
  userId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'user_id',
  },
  itemId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'item_id',
  },
  reservationDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'reservation_date',
  },
  reservationTime: {
    type: DataTypes.TIME,
    allowNull: false,
    field: 'reservation_time',
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'cancelled', 'completed'),
    allowNull: false,
    defaultValue: 'pending',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'reservations',
  indexes: [
    { unique: true, fields: ['reservation_number'] },
    { fields: ['user_id'] },
    { fields: ['status'] },
    { fields: ['reservation_date'] },
  ],
});

module.exports = Reservation;