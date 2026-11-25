const sql = require('mssql/msnodesqlv8');
const argon2 = require('argon2');
require('dotenv').config();

async function initDatabase() {
  const masterConnString = `Driver={ODBC Driver 18 for SQL Server};Server=${process.env.DB_SERVER || '(local)'};Database=master;Trusted_Connection=yes;TrustServerCertificate=yes;`;
  const targetDb = process.env.DB_NAME || 'EncuestasAcme';

  let masterPool = null;
  try {
    masterPool = await new sql.ConnectionPool({
      connectionString: masterConnString,
      driver: 'msnodesqlv8'
    }).connect();

    const dbCheck = await masterPool.request()
      .input('dbName', sql.NVarChar(128), targetDb)
      .query('SELECT database_id FROM sys.databases WHERE name = @dbName');

    if (dbCheck.recordset.length === 0) {
      await masterPool.request().query(`CREATE DATABASE [${targetDb}]`);
      console.log(`[InitDB] Base de datos "${targetDb}" creada automáticamente.`);
    }

    await masterPool.close();
    masterPool = null;

    const dbConnString = `Driver={ODBC Driver 18 for SQL Server};Server=${process.env.DB_SERVER || '(local)'};Database=${targetDb};Trusted_Connection=yes;TrustServerCertificate=yes;`;
    const appPool = await new sql.ConnectionPool({
      connectionString: dbConnString,
      driver: 'msnodesqlv8'
    }).connect();

    await appPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Usuarios')
      BEGIN
        CREATE TABLE Usuarios (
          id_usuario INT IDENTITY(1,1) PRIMARY KEY,
          nombre_completo NVARCHAR(150) NOT NULL,
          email NVARCHAR(150) NOT NULL UNIQUE,
          password_hash NVARCHAR(255) NOT NULL,
          rol VARCHAR(20) NOT NULL DEFAULT 'Super Admin',
          activo BIT NOT NULL DEFAULT 1,
          fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
          fecha_actualizacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
        );
      END

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
          CONSTRAINT FK_Encuestas_Usuarios FOREIGN KEY (id_usuario_creador) REFERENCES Usuarios(id_usuario)
        );
      END

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
          CONSTRAINT FK_CamposEncuesta_Encuestas FOREIGN KEY (id_encuesta) REFERENCES Encuestas(id_encuesta)
        );
      END

      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Respuestas')
      BEGIN
        CREATE TABLE Respuestas (
          id_respuesta BIGINT IDENTITY(1,1) PRIMARY KEY,
          id_encuesta INT NOT NULL,
          fecha_respuesta DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
          direccion_ip VARCHAR(45) NULL,
          user_agent NVARCHAR(500) NULL,
          CONSTRAINT FK_Respuestas_Encuestas FOREIGN KEY (id_encuesta) REFERENCES Encuestas(id_encuesta)
        );
      END

      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ValoresRespuesta')
      BEGIN
        CREATE TABLE ValoresRespuesta (
          id_valor BIGINT IDENTITY(1,1) PRIMARY KEY,
          id_respuesta BIGINT NOT NULL,
          id_campo INT NOT NULL,
          valor_texto NVARCHAR(MAX) NULL,
          valor_numero DECIMAL(18, 4) NULL,
          valor_fecha DATE NULL,
          CONSTRAINT FK_ValoresRespuesta_Respuestas FOREIGN KEY (id_respuesta) REFERENCES Respuestas(id_respuesta) ON DELETE CASCADE,
          CONSTRAINT FK_ValoresRespuesta_CamposEncuesta FOREIGN KEY (id_campo) REFERENCES CamposEncuesta(id_campo)
        );
      END
    `);

    const adminCheck = await appPool.request()
      .input('email', sql.NVarChar(150), 'admin@acme.com')
      .query('SELECT id_usuario FROM Usuarios WHERE email = @email');

    if (adminCheck.recordset.length === 0) {
      const hashSuper = await argon2.hash('Admin123*!', { type: argon2.argon2id });
      const hashAdmin = await argon2.hash('Admin2026*!', { type: argon2.argon2id });
      const hashUser = await argon2.hash('User2026*!', { type: argon2.argon2id });

      await appPool.request()
        .input('nombre', sql.NVarChar(150), 'Super Administrador')
        .input('email', sql.NVarChar(150), 'admin@acme.com')
        .input('hash', sql.NVarChar(255), hashSuper)
        .input('rol', sql.VarChar(20), 'Super Admin')
        .query('INSERT INTO Usuarios (nombre_completo, email, password_hash, rol, activo) VALUES (@nombre, @email, @hash, @rol, 1)');

      await appPool.request()
        .input('nombre', sql.NVarChar(150), 'Admin General')
        .input('email', sql.NVarChar(150), 'admin.encuestas@acme.com')
        .input('hash', sql.NVarChar(255), hashAdmin)
        .input('rol', sql.VarChar(20), 'Admin')
        .query('INSERT INTO Usuarios (nombre_completo, email, password_hash, rol, activo) VALUES (@nombre, @email, @hash, @rol, 1)');

      await appPool.request()
        .input('nombre', sql.NVarChar(150), 'Colaborador Regular')
        .input('email', sql.NVarChar(150), 'colaborador@acme.com')
        .input('hash', sql.NVarChar(255), hashUser)
        .input('rol', sql.VarChar(20), 'Usuarios')
        .query('INSERT INTO Usuarios (nombre_completo, email, password_hash, rol, activo) VALUES (@nombre, @email, @hash, @rol, 1)');
    }

    await appPool.close();
  } catch (err) {
    if (masterPool) await masterPool.close();
  }
}

module.exports = initDatabase;
