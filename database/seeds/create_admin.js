const { getConnectionPool, sql } = require('../../src/config/database');
const argon2 = require('argon2');
require('dotenv').config();

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || process.argv[2];
  const password = process.env.ADMIN_PASSWORD || process.argv[3];
  const nombre = process.env.ADMIN_NAME || process.argv[4] || 'Administrador ACME';
  const username = process.env.ADMIN_USERNAME || process.argv[5] || (email ? email.split('@')[0] : null);

  if (!email || !password || !username) {
    console.error('[Seed] Debe configurar ADMIN_EMAIL, ADMIN_PASSWORD y ADMIN_USERNAME (o pasarlos por CLI).');
    process.exit(1);
  }

  try {
    const pool = await getConnectionPool();
    const hash = await argon2.hash(password, { type: argon2.argon2id });

    const check = await pool.request()
      .input('email', sql.NVarChar(150), email.trim().toLowerCase())
      .query('SELECT id_usuario FROM Usuarios WHERE email = @email');

    if (check.recordset.length > 0) {
      await pool.request()
        .input('email', sql.NVarChar(150), email.trim().toLowerCase())
        .input('username', sql.VarChar(80), username.trim().toLowerCase())
        .input('hash', sql.NVarChar(255), hash)
        .input('rol', sql.VarChar(20), 'Super Admin')
        .query('UPDATE Usuarios SET username = @username, password_hash = @hash, rol = @rol, activo = 1 WHERE email = @email');
      console.log(`[Seed] Usuario ${email} actualizado a Super Admin con Argon2id.`);
      process.exit(0);
    }

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

    console.log(`[Seed] Super Admin creado con Argon2id.`);
    process.exit(0);
  } catch (err) {
    console.error('[Seed] Error:', err.message);
    process.exit(1);
  }
}

seedAdmin();
