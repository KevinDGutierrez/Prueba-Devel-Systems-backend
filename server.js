require('dotenv').config();
if (!process.env.JWT_SECRET) {
  console.error('Falta la variable de entorno obligatoria JWT_SECRET');
  process.exit(1);
}
if (!process.env.DATA_ENCRYPTION_KEY) {
  console.error('Falta la variable de entorno obligatoria DATA_ENCRYPTION_KEY');
  process.exit(1);
}
const app = require('./src/app');
const { initDatabase } = require('./database/initDb');
const { getConnectionPool, closeConnectionPool } = require('./src/config/database');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log('[Server] Iniciando ACME Surveys Backend...');
    await initDatabase();
    await getConnectionPool();
    console.log('[Server] Conexión al pool de base de datos establecida.');

    const server = app.listen(PORT, () => {
      console.log(`[Server] Backend escuchando en puerto ${PORT}`);
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
    console.error('[Server] Error crítico al iniciar el servidor (conexión a SQL Server o migraciones):', error.message);
    process.exit(1);
  }
}

startServer();
