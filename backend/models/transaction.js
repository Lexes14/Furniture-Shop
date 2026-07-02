  const { DataTypes } = require('sequelize');
  const sequelize = require('../config/database');

  const Transaction = sequelize.define('transaction', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    transactionNumber: {
      type: DataTypes.STRING(60),
      allowNull: false,
      unique: true,
      field: 'transaction_number',
    },
    orderId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      unique: true,
      field: 'order_id',
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'user_id',
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    paymentMethod: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'payment_method',
    },
    status: {
      type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
      allowNull: false,
      defaultValue: 'pending',
    },
    receiptPath: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'receipt_path',
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'transactions',
    indexes: [
      { unique: true, fields: ['transaction_number'] },
      { unique: true, fields: ['order_id'] },
      { fields: ['user_id'] },
      { fields: ['status'] },
    ],
  });

  module.exports = Transaction;