const { getConnectionPool, sql } = require('../config/database');
const { nanoid } = require('nanoid');
const { encryptValue } = require('../utils/encryption');

class EncuestaService {
  static async crearEncuesta({ idUsuario, titulo, descripcion, campos }) {
    const pool = await getConnectionPool();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      const uuidPublico = nanoid(16);

      const encuestaRequest = new sql.Request(transaction);
      encuestaRequest.input('uuid', sql.VarChar(64), uuidPublico);
      encuestaRequest.input('id_usuario', sql.Int, idUsuario);
      encuestaRequest.input('titulo', sql.NVarChar(200), titulo);
      encuestaRequest.input('descripcion', sql.NVarChar(1000), descripcion || null);

      const encuestaResult = await encuestaRequest.query(`
        INSERT INTO Encuestas (uuid_publico, id_usuario_creador, titulo, descripcion, estado, version)
        OUTPUT INSERTED.id_encuesta, INSERTED.uuid_publico, INSERTED.titulo, INSERTED.descripcion, INSERTED.estado, INSERTED.fecha_creacion
        VALUES (@uuid, @id_usuario, @titulo, @descripcion, 'activa', 1)
      `);

      const nuevaEncuesta = encuestaResult.recordset[0];
      const idEncuesta = nuevaEncuesta.id_encuesta;

      const camposCreados = [];
      for (let i = 0; i < campos.length; i++) {
        const c = campos[i];
        const campoRequest = new sql.Request(transaction);
        
        campoRequest.input('id_encuesta', sql.Int, idEncuesta);
        campoRequest.input('nombre_campo', sql.VarChar(100), c.nombre_campo.trim());
        campoRequest.input('titulo_etiqueta', sql.NVarChar(250), c.titulo_etiqueta.trim());
        campoRequest.input('tipo_campo', sql.VarChar(20), c.tipo_campo.toLowerCase());
        campoRequest.input('es_requerido', sql.Bit, c.es_requerido ? 1 : 0);
        campoRequest.input('orden', sql.Int, c.orden || (i + 1));

        const campoResult = await campoRequest.query(`
          INSERT INTO CamposEncuesta (id_encuesta, nombre_campo, titulo_etiqueta, tipo_campo, es_requerido, orden, activo)
          OUTPUT INSERTED.id_campo, INSERTED.nombre_campo, INSERTED.titulo_etiqueta, INSERTED.tipo_campo, INSERTED.es_requerido, INSERTED.orden
          VALUES (@id_encuesta, @nombre_campo, @titulo_etiqueta, @tipo_campo, @es_requerido, @orden, 1)
        `);

        camposCreados.push(campoResult.recordset[0]);
      }

      await transaction.commit();

      return {
        ...nuevaEncuesta,
        campos: camposCreados
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async actualizarEncuesta({ idEncuesta, idUsuario, rol, titulo, descripcion, estado, campos }) {
    const pool = await getConnectionPool();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      const checkReq = new sql.Request(transaction);
      checkReq.input('id_encuesta', sql.Int, idEncuesta);
      
      let checkQuery = `
        SELECT id_encuesta, id_usuario_creador 
        FROM Encuestas 
        WHERE id_encuesta = @id_encuesta AND estado != 'eliminada'
      `;

      if (rol === 'Usuarios') {
        checkReq.input('id_usuario', sql.Int, idUsuario);
        checkQuery += ` AND id_usuario_creador = @id_usuario`;
      }

      const checkRes = await checkReq.query(checkQuery);
      if (checkRes.recordset.length === 0) {
        throw new Error('Encuesta no encontrada o sin autorización');
      }

      const updateEncReq = new sql.Request(transaction);
      updateEncReq.input('id_encuesta', sql.Int, idEncuesta);
      updateEncReq.input('titulo', sql.NVarChar(200), titulo);
      updateEncReq.input('descripcion', sql.NVarChar(1000), descripcion || null);
      updateEncReq.input('estado', sql.VarChar(20), estado || 'activa');

      await updateEncReq.query(`
        UPDATE Encuestas
        SET titulo = @titulo,
            descripcion = @descripcion,
            estado = @estado,
            version = version + 1,
            fecha_actualizacion = SYSUTCDATETIME()
        WHERE id_encuesta = @id_encuesta
      `);

      if (Array.isArray(campos)) {
        const idsPresentes = campos.filter(c => c.id_campo).map(c => parseInt(c.id_campo, 10));
        
        const deactReq = new sql.Request(transaction);
        deactReq.input('id_encuesta', sql.Int, idEncuesta);
        
        let deactQuery = `
          UPDATE CamposEncuesta 
          SET activo = 0 
          WHERE id_encuesta = @id_encuesta
        `;
        if (idsPresentes.length > 0) {
          deactQuery += ` AND id_campo NOT IN (${idsPresentes.join(',')})`;
        }
        await deactReq.query(deactQuery);

        for (let i = 0; i < campos.length; i++) {
          const c = campos[i];
          const campoReq = new sql.Request(transaction);
          campoReq.input('id_encuesta', sql.Int, idEncuesta);
          campoReq.input('nombre_campo', sql.VarChar(100), c.nombre_campo.trim());
          campoReq.input('titulo_etiqueta', sql.NVarChar(250), c.titulo_etiqueta.trim());
          campoReq.input('tipo_campo', sql.VarChar(20), c.tipo_campo.toLowerCase());
          campoReq.input('es_requerido', sql.Bit, c.es_requerido ? 1 : 0);
          campoReq.input('orden', sql.Int, c.orden || (i + 1));

          if (c.id_campo) {
            campoReq.input('id_campo', sql.Int, c.id_campo);
            await campoReq.query(`
              UPDATE CamposEncuesta
              SET nombre_campo = @nombre_campo,
                  titulo_etiqueta = @titulo_etiqueta,
                  tipo_campo = @tipo_campo,
                  es_requerido = @es_requerido,
                  orden = @orden,
                  activo = 1
              WHERE id_campo = @id_campo AND id_encuesta = @id_encuesta
            `);
          } else {
            await campoReq.query(`
              INSERT INTO CamposEncuesta (id_encuesta, nombre_campo, titulo_etiqueta, tipo_campo, es_requerido, orden, activo)
              VALUES (@id_encuesta, @nombre_campo, @titulo_etiqueta, @tipo_campo, @es_requerido, @orden, 1)
            `);
          }
        }
      }

      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async guardarRespuestaPublica({ uuidPublico, valores, clientIp, userAgent }) {
    const pool = await getConnectionPool();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      const encReq = new sql.Request(transaction);
      encReq.input('uuid', sql.VarChar(64), uuidPublico);
      const encRes = await encReq.query(`
        SELECT id_encuesta, estado 
        FROM Encuestas 
        WHERE uuid_publico = @uuid
      `);

      if (encRes.recordset.length === 0) {
        throw new Error('La encuesta no existe');
      }

      const encuesta = encRes.recordset[0];
      if (encuesta.estado !== 'activa') {
        throw new Error('La encuesta está inactiva');
      }

      const camposReq = new sql.Request(transaction);
      camposReq.input('id_encuesta', sql.Int, encuesta.id_encuesta);
      const camposRes = await camposReq.query(`
        SELECT id_campo, nombre_campo, titulo_etiqueta, tipo_campo, es_requerido
        FROM CamposEncuesta
        WHERE id_encuesta = @id_encuesta AND activo = 1
      `);
      const campos = camposRes.recordset;

      const valoresMap = new Map();
      if (valores && typeof valores === 'object') {
        for (const item of valores) {
          valoresMap.set(item.id_campo, item.valor);
        }
      }

      for (const campo of campos) {
        const val = valoresMap.get(campo.id_campo);

        if (campo.es_requerido && (val === undefined || val === null || val === '')) {
          throw new Error(`El campo "${campo.titulo_etiqueta}" es requerido`);
        }

        if (val !== undefined && val !== null && val !== '') {
          if (campo.tipo_campo === 'numero') {
            if (isNaN(Number(val))) {
              throw new Error(`El campo "${campo.titulo_etiqueta}" debe ser número`);
            }
          } else if (campo.tipo_campo === 'fecha') {
            const parsedDate = new Date(val);
            if (isNaN(parsedDate.getTime())) {
              throw new Error(`El campo "${campo.titulo_etiqueta}" debe ser fecha`);
            }
          }
        }
      }

      const respReq = new sql.Request(transaction);
      respReq.input('id_encuesta', sql.Int, encuesta.id_encuesta);
      respReq.input('ip', sql.VarChar(45), clientIp || null);
      respReq.input('ua', sql.NVarChar(500), userAgent ? userAgent.substring(0, 500) : null);

      const respResult = await respReq.query(`
        INSERT INTO Respuestas (id_encuesta, fecha_respuesta, direccion_ip, user_agent)
        OUTPUT INSERTED.id_respuesta
        VALUES (@id_encuesta, SYSUTCDATETIME(), @ip, @ua)
      `);

      const idRespuesta = respResult.recordset[0].id_respuesta;

      for (const campo of campos) {
        const val = valoresMap.get(campo.id_campo);
        if (val === undefined || val === null || val === '') continue;

        const valReq = new sql.Request(transaction);
        valReq.input('id_respuesta', sql.BigInt, idRespuesta);
        valReq.input('id_campo', sql.Int, campo.id_campo);

        const plainToEncrypt = campo.tipo_campo === 'numero' ? Number(val) : String(val);
        const { valor_cifrado, iv, auth_tag } = encryptValue(plainToEncrypt);

        valReq.input('valor_cifrado', sql.NVarChar(sql.MAX), valor_cifrado);
        valReq.input('iv', sql.VarChar(32), iv);
        valReq.input('auth_tag', sql.VarChar(32), auth_tag);

        await valReq.query(`
          INSERT INTO ValoresRespuesta (id_respuesta, id_campo, valor_cifrado, iv, auth_tag)
          VALUES (@id_respuesta, @id_campo, @valor_cifrado, @iv, @auth_tag)
        `);
      }

      await transaction.commit();
      return { idRespuesta, success: true };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = EncuestaService;
