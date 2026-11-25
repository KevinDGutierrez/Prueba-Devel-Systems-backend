const { getConnectionPool, sql } = require('../config/database');

class RespuestaModel {
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
          v.valor_texto,
          v.valor_numero,
          v.valor_fecha
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

      let valorFinal = null;
      if (row.tipo_campo === 'numero') {
        valorFinal = row.valor_numero !== null ? Number(row.valor_numero) : null;
      } else if (row.tipo_campo === 'fecha') {
        valorFinal = row.valor_fecha ? row.valor_fecha.toISOString().split('T')[0] : null;
      } else {
        valorFinal = row.valor_texto;
      }

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
