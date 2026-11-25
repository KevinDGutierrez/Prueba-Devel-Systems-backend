const { getConnectionPool, sql } = require('../config/database');

class DashboardModel {
  static async getAdminStats() {
    const pool = await getConnectionPool();

    const summaryRes = await pool.request().query(`
      SELECT 
        (SELECT COUNT(1) FROM Encuestas WHERE estado != 'eliminada') AS total_encuestas,
        (SELECT COUNT(1) FROM Encuestas WHERE estado = 'activa') AS encuestas_activas,
        (SELECT COUNT(1) FROM Encuestas WHERE estado = 'inactiva') AS encuestas_inactivas,
        (SELECT COUNT(1) FROM Respuestas r INNER JOIN Encuestas e ON r.id_encuesta = e.id_encuesta WHERE e.estado != 'eliminada') AS total_respuestas,
        (SELECT COUNT(1) FROM Usuarios WHERE activo = 1) AS total_usuarios_activos
    `);

    const recentRes = await pool.request().query(`
      SELECT TOP 5 
        e.id_encuesta,
        e.titulo,
        e.uuid_publico,
        e.estado,
        e.fecha_creacion,
        (SELECT COUNT(1) FROM Respuestas r WHERE r.id_encuesta = e.id_encuesta) AS respuestas
      FROM Encuestas e
      WHERE e.estado != 'eliminada'
      ORDER BY e.fecha_creacion DESC
    `);

    const responsesOverTimeRes = await pool.request().query(`
      SELECT 
        CONVERT(VARCHAR(10), r.fecha_respuesta, 120) AS fecha,
        COUNT(1) AS cantidad
      FROM Respuestas r
      INNER JOIN Encuestas e ON r.id_encuesta = e.id_encuesta
      WHERE e.estado != 'eliminada'
      GROUP BY CONVERT(VARCHAR(10), r.fecha_respuesta, 120)
      ORDER BY fecha DESC
    `);

    const distributionRes = await pool.request().query(`
      SELECT TOP 6
        e.titulo,
        COUNT(r.id_respuesta) AS cantidad
      FROM Encuestas e
      LEFT JOIN Respuestas r ON e.id_encuesta = r.id_encuesta
      WHERE e.estado != 'eliminada'
      GROUP BY e.id_encuesta, e.titulo
      ORDER BY cantidad DESC
    `);

    return {
      summary: summaryRes.recordset[0],
      recentSurveys: recentRes.recordset,
      responsesOverTime: responsesOverTimeRes.recordset.reverse(),
      surveyDistribution: distributionRes.recordset
    };
  }

  static async getUserStats(idUsuario) {
    const pool = await getConnectionPool();

    const summaryRes = await pool.request().query(`
      SELECT 
        (SELECT COUNT(1) FROM Encuestas WHERE estado = 'activa') AS encuestas_disponibles,
        (SELECT COUNT(1) FROM Respuestas r INNER JOIN Encuestas e ON r.id_encuesta = e.id_encuesta WHERE e.estado = 'activa') AS total_respuestas_globales
    `);

    const activeSurveysRes = await pool.request().query(`
      SELECT 
        e.id_encuesta,
        e.uuid_publico,
        e.titulo,
        e.descripcion,
        e.estado,
        e.fecha_creacion,
        (SELECT COUNT(1) FROM CamposEncuesta c WHERE c.id_encuesta = e.id_encuesta AND c.activo = 1) AS total_campos,
        (SELECT COUNT(1) FROM Respuestas r WHERE r.id_encuesta = e.id_encuesta) AS total_respuestas
      FROM Encuestas e
      WHERE e.estado = 'activa'
      ORDER BY e.fecha_creacion DESC
    `);

    const participationRes = await pool.request().query(`
      SELECT TOP 6
        e.titulo,
        COUNT(r.id_respuesta) AS total_respuestas
      FROM Encuestas e
      INNER JOIN Respuestas r ON e.id_encuesta = r.id_encuesta
      WHERE e.estado = 'activa'
      GROUP BY e.id_encuesta, e.titulo
      ORDER BY total_respuestas DESC
    `);

    return {
      summary: summaryRes.recordset[0],
      activeSurveys: activeSurveysRes.recordset,
      surveyDistribution: participationRes.recordset
    };
  }
}

module.exports = DashboardModel;
