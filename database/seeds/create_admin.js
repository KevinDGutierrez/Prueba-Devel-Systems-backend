const { getConnectionPool, sql } = require('../../src/config/database');
const argon2 = require('argon2');

async function seedAdmin() {
  const email = process.argv[2] || 'admin@acme.com';
  const password = process.argv[3] || 'Admin123*!';
  const nombre = process.argv[4] || 'Administrador ACME';

  try {
    const pool = await getConnectionPool();
    const hash = await argon2.hash(password, { type: argon2.argon2id });

    const check = await pool.request()
      .input('email', sql.NVarChar(150), email)
      .query('SELECT id_usuario FROM Usuarios WHERE email = @email');

    if (check.recordset.length > 0) {
      await pool.request()
        .input('email', sql.NVarChar(150), email)
        .input('hash', sql.NVarChar(255), hash)
        .input('rol', sql.VarChar(20), 'Super Admin')
        .query('UPDATE Usuarios SET password_hash = @hash, rol = @rol, activo = 1 WHERE email = @email');
      console.log(`[Seed] Usuario ${email} actualizado a Super Admin con Argon2id.`);
      process.exit(0);
    }

    await pool.request()
      .input('nombre', sql.NVarChar(150), nombre)
      .input('email', sql.NVarChar(150), email)
      .input('hash', sql.NVarChar(255), hash)
      .input('rol', sql.VarChar(20), 'Super Admin')
      .query(`
        INSERT INTO Usuarios (nombre_completo, email, password_hash, rol, activo)
        VALUES (@nombre, @email, @hash, @rol, 1)
      `);

    console.log(`[Seed] Super Admin creado con Argon2id.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedAdmin();
