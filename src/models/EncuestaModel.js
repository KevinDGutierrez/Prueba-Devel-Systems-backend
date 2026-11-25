const { getConnectionPool, sql } = require('../config/database');

class EncuestaModel {
  static async findAllByUsuario(idUsuario, rol) {
    const pool = await getConnectionPool();
    const request = pool.request();
    
    let query = `
      SELECT 
        e.id_encuesta,
        e.uuid_publico,
        e.titulo,
        e.descripcion,
        e.estado,
        e.version,
        e.fecha_creacion,
        e.fecha_actualizacion,
        u.nombre_completo AS creador,
        (SELECT COUNT(1) FROM CamposEncuesta c WHERE c.id_encuesta = e.id_encuesta AND c.activo = 1) AS total_campos,
        (SELECT COUNT(1) FROM Respuestas r WHERE r.id_encuesta = e.id_encuesta) AS total_respuestas
      FROM Encuestas e
      INNER JOIN Usuarios u ON e.id_usuario_creador = u.id_usuario
      WHERE e.estado != 'eliminada'
    `;

    if (rol === 'Usuarios') {
      query += ` AND e.estado = 'activa'`;
    }

    query += ` ORDER BY e.fecha_creacion DESC`;

    const result = await request.query(query);
    return result.recordset;
  }

  static async findById(idEncuesta, idUsuario = null, rol = 'Super Admin') {
    const pool = await getConnectionPool();
    const request = pool.request().input('id_encuesta', sql.Int, idEncuesta);

    let query = `
      SELECT id_encuesta, uuid_publico, id_usuario_creador, titulo, descripcion, estado, version, fecha_creacion, fecha_actualizacion
      FROM Encuestas
      WHERE id_encuesta = @id_encuesta AND estado != 'eliminada'
    `;

    if (rol === 'Usuarios') {
      query += ` AND estado = 'activa'`;
    }

    const result = await request.query(query);
    return result.recordset[0] || null;
  }

  static async findByUuidPublico(uuidPublico) {
    const pool = await getConnectionPool();
    const result = await pool.request()
      .input('uuid_publico', sql.VarChar(64), uuidPublico)
      .query(`
        SELECT id_encuesta, uuid_publico, titulo, descripcion, estado, version, fecha_creacion
        FROM Encuestas
        WHERE uuid_publico = @uuid_publico
      `);
    return result.recordset[0] || null;
  }

  static async softDelete(idEncuesta) {
    const pool = await getConnectionPool();
    const result = await pool.request()
      .input('id_encuesta', sql.Int, idEncuesta)
      .query(`
        UPDATE Encuestas
        SET estado = 'eliminada', fecha_actualizacion = SYSUTCDATETIME()
        WHERE id_encuesta = @id_encuesta AND estado <> 'eliminada'
      `);
    return result.rowsAffected[0] > 0;
  }

  static async deletePermanent(idEncuesta) {
    const pool = await getConnectionPool();
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();

      const r1 = new sql.Request(transaction);
      r1.input('id_encuesta', sql.Int, idEncuesta);
      await r1.query(`
        DELETE vr
        FROM ValoresRespuesta vr
        INNER JOIN Respuestas r ON vr.id_respuesta = r.id_respuesta
        WHERE r.id_encuesta = @id_encuesta
      `);

      const r2 = new sql.Request(transaction);
      r2.input('id_encuesta', sql.Int, idEncuesta);
      await r2.query(`DELETE FROM Respuestas WHERE id_encuesta = @id_encuesta`);

      const r3 = new sql.Request(transaction);
      r3.input('id_encuesta', sql.Int, idEncuesta);
      await r3.query(`DELETE FROM CamposEncuesta WHERE id_encuesta = @id_encuesta`);

      const r4 = new sql.Request(transaction);
      r4.input('id_encuesta', sql.Int, idEncuesta);
      const delResult = await r4.query(`DELETE FROM Encuestas WHERE id_encuesta = @id_encuesta`);

      await transaction.commit();
      return delResult.rowsAffected[0] > 0;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
}

module.exports = EncuestaModel;
