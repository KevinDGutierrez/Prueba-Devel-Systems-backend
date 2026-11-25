const sql = require('mssql/msnodesqlv8');
require('dotenv').config();

let pool = null;

function getDbConfig() {
  const isSqlAuth = Boolean(process.env.DB_USER && process.env.DB_PASSWORD);
  
  if (isSqlAuth) {
    return {
      server: process.env.DB_SERVER || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 1433,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'EncuestasAcme',
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false',
        enableArithAbort: true
      },
      pool: {
        max: 15,
        min: 2,
        idleTimeoutMillis: 30000
      }
    };
  }

  const server = process.env.DB_SERVER || '(local)';
  const database = process.env.DB_NAME || 'EncuestasAcme';
  
  return {
    connectionString: `Driver={ODBC Driver 18 for SQL Server};Server=${server};Database=${database};Trusted_Connection=yes;TrustServerCertificate=yes;`,
    driver: 'msnodesqlv8',
    pool: {
      max: 15,
      min: 2,
      idleTimeoutMillis: 30000
    }
  };
}

async function getConnectionPool() {
  if (!pool) {
    try {
      const config = getDbConfig();
      pool = await new sql.ConnectionPool(config).connect();
      pool.on('error', () => {
        pool = null;
      });
    } catch (error) {
      pool = null;
      throw error;
    }
  }
  return pool;
}

async function closeConnectionPool() {
  if (pool) {
    try {
      await pool.close();
      pool = null;
    } catch {}
  }
}

module.exports = {
  sql,
  getConnectionPool,
  closeConnectionPool,
  getDbConfig
};
