const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/category');
const cartRoutes = require('./routes/cart');
const inquiryRoutes = require('./routes/inquiry');
const itemRoutes = require('./routes/item');
const orderRoutes = require('./routes/order');
const chartRoutes = require('./routes/chart');
const pdfRoutes = require('./routes/pdf');
const transactionRoutes = require('./routes/transaction');
const reportRoutes = require('./routes/report');
const stockRoutes = require('./routes/stock');
const reservationRoutes = require('./routes/reservation');
const userRoutes = require('./routes/user');

function createApp() {
  const app = express();

  const allowedOrigins = (process.env.CLIENT_URL || '').split(',').map((origin) => origin.trim()).filter(Boolean);

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS policy does not allow this origin'));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ success: true, message: 'Furniture Shop API is running' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/inquiries', inquiryRoutes);
  app.use('/api/items', itemRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/charts', chartRoutes);
  app.use('/api/pdf', pdfRoutes);
  app.use('/api/transactions', transactionRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/stocks', stockRoutes);
  app.use('/api/reservations', reservationRoutes);
  app.use('/api/users', userRoutes);

  app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });

  app.use((error, _req, res, _next) => {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  });

  return app;
}

module.exports = createApp;