const { getConnectionPool, sql } = require('../config/database');
const argon2 = require('argon2');

class UsuarioModel {
  static async findByEmail(email) {
    const pool = await getConnectionPool();
    const result = await pool.request()
      .input('email', sql.NVarChar(150), email)
      .query(`
        SELECT id_usuario, nombre_completo, username, email, password_hash, rol, activo, fecha_creacion
        FROM Usuarios
        WHERE email = @email
      `);
    return result.recordset[0] || null;
  }

  static async findByUsernameOrEmail(identifier) {
    const pool = await getConnectionPool();
    const result = await pool.request()
      .input('identifier', sql.NVarChar(150), identifier)
      .query(`
        SELECT id_usuario, nombre_completo, username, email, password_hash, rol, activo, fecha_creacion
        FROM Usuarios
        WHERE email = @identifier OR username = @identifier
      `);
    return result.recordset[0] || null;
  }

  static async findById(id) {
    const pool = await getConnectionPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT id_usuario, nombre_completo, username, email, rol, activo, fecha_creacion
        FROM Usuarios
        WHERE id_usuario = @id
      `);
    return result.recordset[0] || null;
  }

  static async findAll() {
    const pool = await getConnectionPool();
    const result = await pool.request().query(`
      SELECT id_usuario, nombre_completo, username, email, rol, activo, fecha_creacion
      FROM Usuarios
      ORDER BY id_usuario ASC
    `);
    return result.recordset;
  }

  static async create({ nombre_completo, username, email, password, rol }) {
    const pool = await getConnectionPool();
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = (username || cleanEmail.split('@')[0]).trim().toLowerCase();
    const result = await pool.request()
      .input('nombre', sql.NVarChar(150), nombre_completo)
      .input('username', sql.VarChar(80), cleanUsername)
      .input('email', sql.NVarChar(150), cleanEmail)
      .input('hash', sql.NVarChar(255), hash)
      .input('rol', sql.VarChar(20), rol || 'Usuarios')
      .query(`
        INSERT INTO Usuarios (nombre_completo, username, email, password_hash, rol, activo)
        OUTPUT INSERTED.id_usuario, INSERTED.nombre_completo, INSERTED.username, INSERTED.email, INSERTED.rol, INSERTED.activo
        VALUES (@nombre, @username, @email, @hash, @rol, 1)
      `);
    return result.recordset[0];
  }

  static async updateRol(idUsuario, nuevoRol) {
    const pool = await getConnectionPool();
    const result = await pool.request()
      .input('id', sql.Int, idUsuario)
      .input('rol', sql.VarChar(20), nuevoRol)
      .query(`
        UPDATE Usuarios
        SET rol = @rol, fecha_actualizacion = SYSUTCDATETIME()
        WHERE id_usuario = @id
      `);
    return result.rowsAffected[0] > 0;
  }

  static async updateEstado(idUsuario, activo) {
    const pool = await getConnectionPool();
    const result = await pool.request()
      .input('id', sql.Int, idUsuario)
      .input('activo', sql.Bit, activo ? 1 : 0)
      .query(`
        UPDATE Usuarios
        SET activo = @activo, fecha_actualizacion = SYSUTCDATETIME()
        WHERE id_usuario = @id
      `);
    return result.rowsAffected[0] > 0;
  }

  static async hashPassword(password) {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  static async verifyPassword(plainPassword, passwordHash) {
    try {
      return await argon2.verify(passwordHash, plainPassword);
    } catch {
      return false;
    }
  }
}

module.exports = UsuarioModel;
