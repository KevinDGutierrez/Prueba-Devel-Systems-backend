const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sql = require('mssql/msnodesqlv8');
require('dotenv').config();

function getMasterConfig() {
  if (process.env.DB_USER && process.env.DB_PASSWORD) {
    return {
      server: process.env.DB_SERVER || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 1433,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'master',
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false',
        enableArithAbort: true
      }
    };
  }
  const server = process.env.DB_SERVER || '(local)';
  return {
    connectionString: `Driver={ODBC Driver 18 for SQL Server};Server=${server};Database=master;Trusted_Connection=yes;TrustServerCertificate=yes;`,
    driver: 'msnodesqlv8'
  };
}

function getTargetConfig(dbName) {
  if (process.env.DB_USER && process.env.DB_PASSWORD) {
    return {
      server: process.env.DB_SERVER || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 1433,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: dbName,
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false',
        enableArithAbort: true
      }
    };
  }
  const server = process.env.DB_SERVER || '(local)';
  return {
    connectionString: `Driver={ODBC Driver 18 for SQL Server};Server=${server};Database=${dbName};Trusted_Connection=yes;TrustServerCertificate=yes;`,
    driver: 'msnodesqlv8'
  };
}

function splitBatches(sqlText) {
  return sqlText
    .split(/^\s*GO\s*;?\s*$/im)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
}

async function ensureDatabase(targetDb) {
  const masterPool = await new sql.ConnectionPool(getMasterConfig()).connect();
  try {
    const check = await masterPool.request()
      .input('dbName', sql.NVarChar(128), targetDb)
      .query('SELECT database_id FROM sys.databases WHERE name = @dbName');
    if (check.recordset.length === 0) {
      const safeName = targetDb.replace(/[\[\]]/g, '');
      await masterPool.request().query(`CREATE DATABASE [${safeName}]`);
    }
  } finally {
    await masterPool.close();
  }
}

async function runMigrations(dbNameOverride) {
  const targetDb = dbNameOverride || process.env.DB_NAME || 'EncuestasAcme';
  await ensureDatabase(targetDb);

  const pool = await new sql.ConnectionPool(getTargetConfig(targetDb)).connect();
  const executed = [];

  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '_Migrations')
      BEGIN
        CREATE TABLE _Migrations (
          id_migracion INT IDENTITY(1,1) PRIMARY KEY,
          nombre_script NVARCHAR(255) NOT NULL UNIQUE,
          checksum NVARCHAR(64) NULL,
          fecha_ejecucion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
        );
      END
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const existing = await pool.request()
        .input('nombre', sql.NVarChar(255), file)
        .query('SELECT id_migracion FROM _Migrations WHERE nombre_script = @nombre');

      if (existing.recordset.length > 0) {
        continue;
      }

      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const checksum = crypto.createHash('sha256').update(content).digest('hex');
      const batches = splitBatches(content);

      for (const batch of batches) {
        await pool.request().query(batch);
      }

      await pool.request()
        .input('nombre', sql.NVarChar(255), file)
        .input('checksum', sql.NVarChar(64), checksum)
        .query('INSERT INTO _Migrations (nombre_script, checksum) VALUES (@nombre, @checksum)');

      executed.push(file);
    }

    return { database: targetDb, executed };
  } finally {
    await pool.close();
  }
}

if (require.main === module) {
  runMigrations()
    .then((res) => {
      console.log(`[Migrate] Base de datos ${res.database}: ${res.executed.length} migraciones ejecutadas.`);
      if (res.executed.length > 0) {
        console.log(`[Migrate] Aplicadas: ${res.executed.join(', ')}`);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migrate] Error:', err.message);
      process.exit(1);
    });
}

module.exports = { runMigrations, ensureDatabase, splitBatches };
