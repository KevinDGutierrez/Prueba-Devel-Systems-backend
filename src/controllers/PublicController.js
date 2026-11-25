const EncuestaModel = require('../models/EncuestaModel');
const CampoModel = require('../models/CampoModel');
const EncuestaService = require('../services/EncuestaService');

class PublicController {
  static async obtenerEncuestaPublica(req, res, next) {
    try {
      const { uuid } = req.params;
      if (!uuid || typeof uuid !== 'string' || uuid.length < 5) {
        return res.status(400).json({ success: false, message: 'Enlace de encuesta inválido' });
      }

      const encuesta = await EncuestaModel.findByUuidPublico(uuid);

      if (!encuesta || encuesta.estado === 'eliminada') {
        return res.status(404).json({
          success: false,
          message: 'Encuesta no encontrada'
        });
      }

      if (encuesta.estado !== 'activa') {
        return res.status(403).json({
          success: false,
          isInactive: true,
          message: 'Esta encuesta se encuentra cerrada o inactiva en este momento'
        });
      }

      const campos = await CampoModel.findByEncuesta(encuesta.id_encuesta, true);

      res.json({
        success: true,
        data: {
          uuid_publico: encuesta.uuid_publico,
          titulo: encuesta.titulo,
          descripcion: encuesta.descripcion,
          campos: campos.map(c => ({
            id_campo: c.id_campo,
            nombre_campo: c.nombre_campo,
            titulo_etiqueta: c.titulo_etiqueta,
            tipo_campo: c.tipo_campo,
            es_requerido: Boolean(c.es_requerido),
            orden: c.orden
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async responderEncuestaPublica(req, res, next) {
    try {
      const { uuid } = req.params;
      const { valores } = req.body;

      if (!uuid || typeof uuid !== 'string') {
        return res.status(400).json({ success: false, message: 'Enlace inválido' });
      }

      if (!Array.isArray(valores)) {
        return res.status(400).json({ success: false, message: 'Estructura de respuestas inválida' });
      }

      const clientIp = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const resultado = await EncuestaService.guardarRespuestaPublica({
        uuidPublico: uuid,
        valores,
        clientIp,
        userAgent
      });

      res.status(201).json({
        success: true,
        message: 'Respuesta registrada correctamente',
        data: resultado
      });
    } catch (error) {
      if (error.message.includes('requerido') || error.message.includes('debe ser') || error.message.includes('obligatorio') || error.message.includes('inválid')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }
}

module.exports = PublicController;
