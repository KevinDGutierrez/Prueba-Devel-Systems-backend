-- 003_indexes.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Búsqueda rápida de encuestas por uuid_publico 
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Encuestas_UuidPublico')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Encuestas_UuidPublico
    ON Encuestas (uuid_publico)
    INCLUDE (id_encuesta, titulo, estado, version);
END
GO

-- 2. Listado de encuestas por usuario creador y estado
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Encuestas_Usuario_Estado')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Encuestas_Usuario_Estado
    ON Encuestas (id_usuario_creador, estado, fecha_creacion DESC);
END
GO

-- 3. Búsqueda y orden de campos por encuesta
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_CamposEncuesta_Encuesta_Orden')
BEGIN
    CREATE NONCLUSTERED INDEX IX_CamposEncuesta_Encuesta_Orden
    ON CamposEncuesta (id_encuesta, activo, orden ASC)
    INCLUDE (nombre_campo, titulo_etiqueta, tipo_campo, es_requerido);
END
GO

-- 4. Búsqueda de respuestas por encuesta
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Respuestas_Encuesta_Fecha')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Respuestas_Encuesta_Fecha
    ON Respuestas (id_encuesta, fecha_respuesta DESC);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ValoresRespuesta_Campo')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ValoresRespuesta_Campo
    ON ValoresRespuesta (id_campo)
    INCLUDE (id_respuesta, valor_cifrado, iv, auth_tag);
END
GO
