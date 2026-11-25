const { getConnectionPool, sql } = require('../config/database');

class CampoModel {
  static async findByEncuesta(idEncuesta, soloActivos = true) {
    const pool = await getConnectionPool();
    const request = pool.request().input('id_encuesta', sql.Int, idEncuesta);
    
    let query = `
      SELECT id_campo, id_encuesta, nombre_campo, titulo_etiqueta, tipo_campo, es_requerido, orden, activo
      FROM CamposEncuesta
      WHERE id_encuesta = @id_encuesta
    `;

    if (soloActivos) {
      query += ` AND activo = 1`;
    }

    query += ` ORDER BY orden ASC, id_campo ASC`;

    const result = await request.query(query);
    return result.recordset;
  }
}

module.exports = CampoModel;
