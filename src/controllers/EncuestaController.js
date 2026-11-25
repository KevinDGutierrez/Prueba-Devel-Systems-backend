const EncuestaModel = require('../models/EncuestaModel');
const CampoModel = require('../models/CampoModel');
const RespuestaModel = require('../models/RespuestaModel');
const EncuestaService = require('../services/EncuestaService');
require('dotenv').config();

const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL;

class EncuestaController {
  static async listar(req, res, next) {
    try {
      const encuestas = await EncuestaModel.findAllByUsuario(req.user.id_usuario, req.user.rol);
      const encuestasConEnlace = encuestas.map(e => ({
        ...e,
        enlace_publico: `${PUBLIC_APP_URL}/encuesta/${e.uuid_publico}`
      }));

      res.json({
        success: true,
        data: encuestasConEnlace
      });
    } catch (error) {
      next(error);
    }
  }

  static async obtener(req, res, next) {
    try {
      const idEncuesta = parseInt(req.params.id, 10);
      if (isNaN(idEncuesta) || idEncuesta <= 0) {
        return res.status(400).json({ success: false, message: 'Identificador de encuesta inválido' });
      }

      const encuesta = await EncuestaModel.findById(idEncuesta, req.user.id_usuario, req.user.rol);
      if (!encuesta) {
        return res.status(404).json({
          success: false,
          message: 'Encuesta no encontrada'
        });
      }

      const campos = await CampoModel.findByEncuesta(idEncuesta, true);

      res.json({
        success: true,
        data: {
          ...encuesta,
          enlace_publico: `${PUBLIC_APP_URL}/encuesta/${encuesta.uuid_publico}`,
          campos
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async crear(req, res, next) {
    try {
      const { titulo, descripcion, campos } = req.body;

      if (!titulo || typeof titulo !== 'string' || !titulo.trim()) {
        return res.status(400).json({ success: false, message: 'El título de la encuesta es obligatorio' });
      }

      if (titulo.trim().length > 200) {
        return res.status(400).json({ success: false, message: 'El título no puede exceder 200 caracteres' });
      }

      if (descripcion && descripcion.trim().length > 1000) {
        return res.status(400).json({ success: false, message: 'La descripción no puede exceder 1000 caracteres' });
      }

      if (!Array.isArray(campos) || campos.length === 0) {
        return res.status(400).json({ success: false, message: 'Debe incluir al menos un campo dinámico en la encuesta' });
      }

      if (campos.length > 50) {
        return res.status(400).json({ success: false, message: 'Una encuesta no puede exceder 50 preguntas' });
      }

      const nombresSet = new Set();
      for (let i = 0; i < campos.length; i++) {
        const c = campos[i];
        if (!c.titulo_etiqueta || typeof c.titulo_etiqueta !== 'string' || !c.titulo_etiqueta.trim()) {
          return res.status(400).json({ success: false, message: `La pregunta #${i + 1} requiere un título o enunciado` });
        }
        if (c.titulo_etiqueta.trim().length > 250) {
          return res.status(400).json({ success: false, message: `El enunciado de la pregunta #${i + 1} no puede exceder 250 caracteres` });
        }
        if (!c.nombre_campo || typeof c.nombre_campo !== 'string' || !c.nombre_campo.trim()) {
          return res.status(400).json({ success: false, message: `La pregunta #${i + 1} requiere un identificador de campo` });
        }

        const formattedName = c.nombre_campo.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (nombresSet.has(formattedName)) {
          return res.status(400).json({ success: false, message: `El identificador de campo "${c.nombre_campo}" está duplicado` });
        }
        nombresSet.add(formattedName);

        if (!['texto', 'numero', 'fecha'].includes(c.tipo_campo)) {
          return res.status(400).json({ success: false, message: `El tipo de campo "${c.tipo_campo}" en la pregunta #${i + 1} no es válido. Tipos admitidos: texto, numero, fecha` });
        }
      }

      const nueva = await EncuestaService.crearEncuesta({
        idUsuario: req.user.id_usuario,
        titulo: titulo.trim(),
        descripcion: descripcion ? descripcion.trim() : null,
        campos
      });

      res.status(201).json({
        success: true,
        message: 'Encuesta creada exitosamente',
        data: {
          ...nueva,
          enlace_publico: `${PUBLIC_APP_URL}/encuesta/${nueva.uuid_publico}`
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async actualizar(req, res, next) {
    try {
      const idEncuesta = parseInt(req.params.id, 10);
      if (isNaN(idEncuesta) || idEncuesta <= 0) {
        return res.status(400).json({ success: false, message: 'Identificador de encuesta inválido' });
      }

      const { titulo, descripcion, estado, campos } = req.body;

      if (!titulo || typeof titulo !== 'string' || !titulo.trim()) {
        return res.status(400).json({ success: false, message: 'El título es obligatorio' });
      }

      if (titulo.trim().length > 200) {
        return res.status(400).json({ success: false, message: 'El título no puede exceder 200 caracteres' });
      }

      if (estado && !['activa', 'inactiva'].includes(estado)) {
        return res.status(400).json({ success: false, message: 'Estado no admitido' });
      }

      if (!Array.isArray(campos) || campos.length === 0) {
        return res.status(400).json({ success: false, message: 'Debe conservar al menos un campo' });
      }

      const nombresSet = new Set();
      for (let i = 0; i < campos.length; i++) {
        const c = campos[i];
        if (!c.titulo_etiqueta || !c.titulo_etiqueta.trim()) {
          return res.status(400).json({ success: false, message: `La pregunta #${i + 1} requiere enunciado` });
        }
        const formattedName = c.nombre_campo.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (nombresSet.has(formattedName)) {
          return res.status(400).json({ success: false, message: `El campo "${c.nombre_campo}" está duplicado` });
        }
        nombresSet.add(formattedName);

        if (!['texto', 'numero', 'fecha'].includes(c.tipo_campo)) {
          return res.status(400).json({ success: false, message: `Tipo inválido en pregunta #${i + 1}` });
        }
      }

      await EncuestaService.actualizarEncuesta({
        idEncuesta,
        idUsuario: req.user.id_usuario,
        rol: req.user.rol,
        titulo: titulo.trim(),
        descripcion: descripcion ? descripcion.trim() : null,
        estado: estado || 'activa',
        campos
      });

      res.json({
        success: true,
        message: 'Encuesta actualizada'
      });
    } catch (error) {
      next(error);
    }
  }

  static async eliminar(req, res, next) {
    try {
      const idEncuesta = parseInt(req.params.id, 10);
      if (isNaN(idEncuesta) || idEncuesta <= 0) {
        return res.status(400).json({ success: false, message: 'Identificador de encuesta inválido' });
      }

      const eliminado = await EncuestaModel.deletePermanent(idEncuesta);
      if (!eliminado) {
        return res.status(404).json({ success: false, message: 'No se pudo eliminar la encuesta' });
      }

      res.json({
        success: true,
        message: 'Encuesta eliminada'
      });
    } catch (error) {
      next(error);
    }
  }

  static async obtenerResultados(req, res, next) {
    try {
      const idEncuesta = parseInt(req.params.id, 10);
      if (isNaN(idEncuesta) || idEncuesta <= 0) {
        return res.status(400).json({ success: false, message: 'Identificador de encuesta inválido' });
      }

      const encuesta = await EncuestaModel.findById(idEncuesta, req.user.id_usuario, req.user.rol);
      if (!encuesta) {
        return res.status(404).json({ success: false, message: 'Encuesta no encontrada' });
      }

      const campos = await CampoModel.findByEncuesta(idEncuesta, false);
      const respuestas = await RespuestaModel.findRespuestasByEncuesta(idEncuesta);

      res.json({
        success: true,
        data: {
          encuesta: {
            id_encuesta: encuesta.id_encuesta,
            titulo: encuesta.titulo,
            descripcion: encuesta.descripcion,
            estado: encuesta.estado,
            uuid_publico: encuesta.uuid_publico,
            total_respuestas: respuestas.length
          },
          campos,
          respuestas
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = EncuestaController;
