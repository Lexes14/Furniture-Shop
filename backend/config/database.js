const { Sequelize } = require('sequelize');
require('dotenv').config();

const databaseName = process.env.DB_NAME || 'furniture_shop';
const databaseUser = process.env.DB_USER || 'root';
const databasePassword = process.env.DB_PASSWORD || '';
const databaseHost = process.env.DB_HOST || 'localhost';

const sequelize = new Sequelize(databaseName, databaseUser, databasePassword, {
  host: databaseHost,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  dialect: process.env.DB_DIALECT || 'mysql',
  logging: process.env.DB_LOGGING === 'true' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    underscored: true,
    timestamps: true,
    freezeTableName: true,
  },
});

module.exports = sequelize;