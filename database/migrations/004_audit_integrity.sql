SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('Usuarios', 'rol') IS NULL
BEGIN
    ALTER TABLE Usuarios ADD rol VARCHAR(20) NOT NULL CONSTRAINT DF_Usuarios_Rol DEFAULT 'Usuarios';
END
GO

IF COL_LENGTH('Usuarios', 'username') IS NULL
BEGIN
    ALTER TABLE Usuarios ADD username VARCHAR(80) NULL;
END
GO

IF EXISTS (SELECT 1 FROM Usuarios WHERE username IS NULL)
BEGIN
    UPDATE Usuarios
    SET username = LEFT(email, CHARINDEX('@', email + '@') - 1) + '_' + CAST(id_usuario AS VARCHAR(10))
    WHERE username IS NULL;
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Usuarios') AND name = 'username' AND is_nullable = 1)
BEGIN
    ALTER TABLE Usuarios ALTER COLUMN username VARCHAR(80) NOT NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_Usuarios_Username' AND object_id = OBJECT_ID('Usuarios'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_Usuarios_Username ON Usuarios (username);
END
GO

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ValoresRespuesta_Campo' AND object_id = OBJECT_ID('ValoresRespuesta'))
BEGIN
    DROP INDEX IX_ValoresRespuesta_Campo ON ValoresRespuesta;
END
GO

CREATE NONCLUSTERED INDEX IX_ValoresRespuesta_Campo
ON ValoresRespuesta (id_campo)
INCLUDE (id_respuesta, valor_cifrado, iv, auth_tag);
GO
