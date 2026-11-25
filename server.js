require('dotenv').config();
const app = require('./src/app');
const initDatabase = require('./database/initDb');
const { getConnectionPool, closeConnectionPool } = require('./src/config/database');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await initDatabase();
    await getConnectionPool();

    const server = app.listen(PORT, () => {
      console.log(`Backend escuchando en puerto ${PORT}`);
    });

    const gracefulShutdown = async () => {
      server.close(async () => {
        await closeConnectionPool();
        process.exit(0);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    process.exit(1);
  }
}

startServer();
