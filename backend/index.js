require('dotenv').config();
const createApp = require('./app');
const { sequelize } = require('./models');

async function startServer() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });

    const app = createApp();
    const port = process.env.PORT || 5000;

    app.listen(port, () => {
      console.log(`Furniture Shop backend running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();