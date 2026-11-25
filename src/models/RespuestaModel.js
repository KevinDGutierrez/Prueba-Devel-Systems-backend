const { getConnectionPool, sql } = require('../config/database');
const { decryptValue } = require('../utils/encryption');

class RespuestaModel {
  static async findRespuestasByEncuestaPaginated(idEncuesta, page = 1, limit = 100) {
    const pool = await getConnectionPool();
    const offset = (page - 1) * limit;

    const countResult = await pool.request()
      .input('id_encuesta', sql.Int, idEncuesta)
      .query('SELECT COUNT(*) AS total FROM Respuestas WHERE id_encuesta = @id_encuesta');
    const total = countResult.recordset[0]?.total || 0;

    if (total === 0) {
      return { rows: [], total: 0 };
    }

    const respuestasResult = await pool.request()
      .input('id_encuesta', sql.Int, idEncuesta)
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, limit)
      .query(`
        SELECT id_respuesta, id_encuesta, fecha_respuesta, direccion_ip
        FROM Respuestas
        WHERE id_encuesta = @id_encuesta
        ORDER BY fecha_respuesta DESC, id_respuesta DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);

    const respuestas = respuestasResult.recordset;
    if (respuestas.length === 0) {
      return { rows: [], total };
    }

    const idsList = respuestas.map((r) => Number(r.id_respuesta)).join(',');
    const valoresResult = await pool.request()
      .input('ids', sql.VarChar(sql.MAX), idsList)
      .query(`
        SELECT 
          v.id_respuesta,
          v.id_campo,
          c.nombre_campo,
          c.titulo_etiqueta,
          c.tipo_campo,
          v.valor_cifrado,
          v.iv,
          v.auth_tag
        FROM ValoresRespuesta v
        INNER JOIN CamposEncuesta c ON v.id_campo = c.id_campo
        INNER JOIN STRING_SPLIT(@ids, ',') s ON v.id_respuesta = TRY_CAST(s.value AS BIGINT)
      `);

    const valoresPorRespuesta = new Map();
    for (const row of valoresResult.recordset) {
      if (!valoresPorRespuesta.has(row.id_respuesta)) {
        valoresPorRespuesta.set(row.id_respuesta, []);
      }

      const valorFinal = decryptValue(row.valor_cifrado, row.iv, row.auth_tag, row.tipo_campo);

      valoresPorRespuesta.get(row.id_respuesta).push({
        id_campo: row.id_campo,
        nombre_campo: row.nombre_campo,
        titulo_etiqueta: row.titulo_etiqueta,
        tipo_campo: row.tipo_campo,
        valor: valorFinal
      });
    }

    const rows = respuestas.map((r) => ({
      id_respuesta: r.id_respuesta,
      fecha_respuesta: r.fecha_respuesta,
      direccion_ip: r.direccion_ip,
      valores: valoresPorRespuesta.get(r.id_respuesta) || []
    }));

    return { rows, total };
  }

  static async findRespuestasByEncuesta(idEncuesta) {
    const pool = await getConnectionPool();
    const respuestasResult = await pool.request()
      .input('id_encuesta', sql.Int, idEncuesta)
      .query(`
        SELECT id_respuesta, id_encuesta, fecha_respuesta, direccion_ip
        FROM Respuestas
        WHERE id_encuesta = @id_encuesta
        ORDER BY fecha_respuesta DESC
      `);

    const respuestas = respuestasResult.recordset;
    if (respuestas.length === 0) {
      return [];
    }

    const valoresResult = await pool.request()
      .input('id_encuesta', sql.Int, idEncuesta)
      .query(`
        SELECT 
          v.id_respuesta,
          v.id_campo,
          c.nombre_campo,
          c.titulo_etiqueta,
          c.tipo_campo,
          v.valor_cifrado,
          v.iv,
          v.auth_tag
        FROM ValoresRespuesta v
        INNER JOIN Respuestas r ON v.id_respuesta = r.id_respuesta
        INNER JOIN CamposEncuesta c ON v.id_campo = c.id_campo
        WHERE r.id_encuesta = @id_encuesta
      `);

    const valoresPorRespuesta = new Map();
    for (const row of valoresResult.recordset) {
      if (!valoresPorRespuesta.has(row.id_respuesta)) {
        valoresPorRespuesta.set(row.id_respuesta, []);
      }

      const valorFinal = decryptValue(row.valor_cifrado, row.iv, row.auth_tag, row.tipo_campo);

      valoresPorRespuesta.get(row.id_respuesta).push({
        id_campo: row.id_campo,
        nombre_campo: row.nombre_campo,
        titulo_etiqueta: row.titulo_etiqueta,
        tipo_campo: row.tipo_campo,
        valor: valorFinal
      });
    }

    return respuestas.map(r => ({
      id_respuesta: r.id_respuesta,
      fecha_respuesta: r.fecha_respuesta,
      direccion_ip: r.direccion_ip,
      valores: valoresPorRespuesta.get(r.id_respuesta) || []
    }));
  }
}

module.exports = RespuestaModel;
