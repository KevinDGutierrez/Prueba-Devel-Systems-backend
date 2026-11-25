const { runMigrations } = require('./runner');
const { getConnectionPool, sql } = require('../src/config/database');
const argon2 = require('argon2');

async function seedSuperAdminIfEmpty(pool) {
  const count = await pool.request().query('SELECT COUNT(*) AS total FROM Usuarios');
  const total = count.recordset[0].total;

  if (total > 0) {
    console.log('[Init] Usuarios existentes detectados, no se crea administrador automático.');
    return;
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const nombre = process.env.ADMIN_NAME || 'Administrador ACME';
  const username = process.env.ADMIN_USERNAME || (email ? email.split('@')[0] : null);

  if (!email || !password || !username) {
    console.warn('[Init] ADVERTENCIA: No hay usuarios y ADMIN_EMAIL, ADMIN_PASSWORD o ADMIN_USERNAME no están configuradas.');
    console.warn('[Init] Configura esas variables en .env para crear el Super Admin automáticamente.');
    return;
  }

  console.log('[Init] Tabla Usuarios vacía. Creando Super Admin inicial...');
  const hash = await argon2.hash(password, { type: argon2.argon2id });

  await pool.request()
    .input('nombre', sql.NVarChar(150), nombre)
    .input('username', sql.VarChar(80), username.trim().toLowerCase())
    .input('email', sql.NVarChar(150), email.trim().toLowerCase())
    .input('hash', sql.NVarChar(255), hash)
    .input('rol', sql.VarChar(20), 'Super Admin')
    .query(`
      INSERT INTO Usuarios (nombre_completo, username, email, password_hash, rol, activo)
      VALUES (@nombre, @username, @email, @hash, @rol, 1)
    `);

  console.log(`[Init] Super Admin creado con Argon2id: ${email} / username: ${username}`);
}

async function initDatabase() {
  console.log('[Init] Verificando base de datos...');
  const result = await runMigrations();
  console.log(`[Init] Base de datos: ${result.database}`);

  if (result.executed.length > 0) {
    console.log(`[Init] Migraciones aplicadas: ${result.executed.join(', ')}`);
  } else {
    console.log('[Init] Esquema al día, no hay migraciones pendientes.');
  }

  const pool = await getConnectionPool();
  await seedSuperAdminIfEmpty(pool);

  return result;
}

module.exports = { initDatabase };
