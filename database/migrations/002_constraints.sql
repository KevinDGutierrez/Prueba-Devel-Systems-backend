-- 002_constraints.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Restricción en Encuestas.estado
IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_Encuestas_Estado')
BEGIN
    ALTER TABLE Encuestas
    ADD CONSTRAINT CK_Encuestas_Estado 
    CHECK (estado IN ('activa', 'inactiva', 'eliminada'));
END
GO

-- 2. Restricción en CamposEncuesta.tipo_campo
IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_CamposEncuesta_TipoCampo')
BEGIN
    ALTER TABLE CamposEncuesta
    ADD CONSTRAINT CK_CamposEncuesta_TipoCampo 
    CHECK (tipo_campo IN ('texto', 'numero', 'fecha'));
END
GO

-- 3. Unicidad de nombre_campo por encuesta para campos activos
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_CamposEncuesta_NombrePorEncuesta')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_CamposEncuesta_NombrePorEncuesta
    ON CamposEncuesta (id_encuesta, nombre_campo)
    WHERE activo = 1;
END
GO

-- 4. Unicidad de respuesta-campo 
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_ValoresRespuesta_RespuestaCampo')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_ValoresRespuesta_RespuestaCampo
    ON ValoresRespuesta (id_respuesta, id_campo);
END
GO
