-- 001_initial_schema.sql
-- Creación de tablas base del sistema de Encuestas ACME
-- Base de datos: EncuestasAcme
-- Compatible con SQL Server 2016+ / 2025

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '_Migrations')
BEGIN
    CREATE TABLE _Migrations (
        id_migracion INT IDENTITY(1,1) PRIMARY KEY,
        nombre_script NVARCHAR(255) NOT NULL UNIQUE,
        checksum NVARCHAR(64) NULL,
        fecha_ejecucion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

-- 1. Tabla Usuarios
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Usuarios')
BEGIN
    CREATE TABLE Usuarios (
        id_usuario INT IDENTITY(1,1) PRIMARY KEY,
        nombre_completo NVARCHAR(150) NOT NULL,
        email NVARCHAR(150) NOT NULL UNIQUE,
        password_hash NVARCHAR(255) NOT NULL,
        activo BIT NOT NULL DEFAULT 1,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        fecha_actualizacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

-- 2. Tabla Encuestas
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Encuestas')
BEGIN
    CREATE TABLE Encuestas (
        id_encuesta INT IDENTITY(1,1) PRIMARY KEY,
        uuid_publico VARCHAR(64) NOT NULL UNIQUE,
        id_usuario_creador INT NOT NULL,
        titulo NVARCHAR(200) NOT NULL,
        descripcion NVARCHAR(1000) NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'activa',
        version INT NOT NULL DEFAULT 1,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        fecha_actualizacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Encuestas_Usuarios FOREIGN KEY (id_usuario_creador)
            REFERENCES Usuarios(id_usuario)
    );
END
GO

-- 3. Tabla CamposEncuesta
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CamposEncuesta')
BEGIN
    CREATE TABLE CamposEncuesta (
        id_campo INT IDENTITY(1,1) PRIMARY KEY,
        id_encuesta INT NOT NULL,
        nombre_campo VARCHAR(100) NOT NULL,
        titulo_etiqueta NVARCHAR(250) NOT NULL,
        tipo_campo VARCHAR(20) NOT NULL,
        es_requerido BIT NOT NULL DEFAULT 1,
        orden INT NOT NULL DEFAULT 1,
        activo BIT NOT NULL DEFAULT 1,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_CamposEncuesta_Encuestas FOREIGN KEY (id_encuesta)
            REFERENCES Encuestas(id_encuesta)
    );
END
GO

-- 4. Tabla Respuestas
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Respuestas')
BEGIN
    CREATE TABLE Respuestas (
        id_respuesta BIGINT IDENTITY(1,1) PRIMARY KEY,
        id_encuesta INT NOT NULL,
        fecha_respuesta DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        direccion_ip VARCHAR(45) NULL,
        user_agent NVARCHAR(500) NULL,
        CONSTRAINT FK_Respuestas_Encuestas FOREIGN KEY (id_encuesta)
            REFERENCES Encuestas(id_encuesta)
    );
END
GO

-- 5. Tabla ValoresRespuesta
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ValoresRespuesta')
BEGIN
    CREATE TABLE ValoresRespuesta (
        id_valor BIGINT IDENTITY(1,1) PRIMARY KEY,
        id_respuesta BIGINT NOT NULL,
        id_campo INT NOT NULL,
        valor_texto NVARCHAR(MAX) NULL,
        valor_numero DECIMAL(18, 4) NULL,
        valor_fecha DATE NULL,
        CONSTRAINT FK_ValoresRespuesta_Respuestas FOREIGN KEY (id_respuesta)
            REFERENCES Respuestas(id_respuesta) ON DELETE CASCADE,
        CONSTRAINT FK_ValoresRespuesta_CamposEncuesta FOREIGN KEY (id_campo)
            REFERENCES CamposEncuesta(id_campo)
    );
END
GO
