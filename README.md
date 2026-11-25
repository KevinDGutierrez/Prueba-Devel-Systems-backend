# ACME Surveys — Backend

API REST para la gestión de encuestas dinámicas, recolección pública de respuestas y analíticas, desarrollada con **Node.js**, **Express** y **SQL Server** bajo arquitectura **MVC**.

## Justificación de la estructura de la Base de Datos (SQL Server)

- **Modelo relacional normalizado (3FN) con soporte dinámico:**
  - `Usuarios`: centraliza identidad, credenciales con **Argon2id**, `username` único, `email` único y `rol` (`Super Admin`, `Admin`, `Usuarios`).
  - `Encuestas`: almacena metadatos, `uuid_publico` para enlaces públicos sin exponer IDs secuenciales, `version` para trazabilidad de cambios y `estado` (`activa`, `inactiva`, `eliminada`) para **eliminación lógica** conservando el historial.
  - `CamposEncuesta`: define dinámicamente las preguntas de cada encuesta (`texto`, `numero`, `fecha`, `es_requerido`, `orden`) sin alterar el esquema al crear nuevas encuestas.
  - `Respuestas` y `ValoresRespuesta`: separan la cabecera del envío (fecha, IP, user-agent) de los valores individuales. `ValoresRespuesta` almacena cada respuesta cifrada con **AES-256-GCM** mediante las columnas `valor_cifrado`, `iv` (12 bytes) y `auth_tag` (16 bytes), sin conservar copias en texto plano. Al consultar resultados, el backend descifra los valores y restaura su tipo original (`texto`, `numero` o `fecha`) según `CamposEncuesta`.
- **Integridad y rendimiento:**
  - Restricciones `CHECK` y `UNIQUE` (`UQ_ValoresRespuesta_RespuestaCampo`, `UQ_CamposEncuesta_NombrePorEncuesta`) impiden duplicados y valores inválidos a nivel de motor.
  - Índices alineados a las consultas reales (`IX_Encuestas_UuidPublico`, `IX_Respuestas_Encuesta_Fecha`, `IX_ValoresRespuesta_Campo`) y migraciones versionadas e idempotentes en `database/runner.js` con `_Migrations`.

## Justificación de la estructura de la Aplicación (MVC)

- `src/routes/`: define endpoints, `authMiddleware` y control de acceso por rol (`requireRole`).
- `src/controllers/`: recibe peticiones HTTP, valida entradas y devuelve respuestas estandarizadas sin mezclar lógica SQL.
- `src/services/`: encapsula reglas de negocio y transacciones multi-tabla con `COMMIT` y `ROLLBACK`.
- `src/models/`: concentra las consultas SQL parametrizadas contra SQL Server.
- `src/middlewares/`: centraliza seguridad transversal (JWT en cookie `HttpOnly`, validación CSRF, CORS restringido y manejo seguro de errores).
- `database/`: contiene `runner.js`, migraciones SQL ordenadas (`001`–`004`) y `seeds/create_admin.js`.

## Seguridad de la información

- **Hashing de contraseñas (Argon2id) vs. Cifrado reversible:**
  - **Hashing (Argon2id):** Es una transformación matemática de un solo sentido. Se utiliza exclusivamente para las contraseñas de `Usuarios`, generando una huella irreversible resistente a fuerza bruta. Nunca se puede recuperar la contraseña original a partir del hash.
  - **Cifrado reversible (AES-256-GCM):** Todas las respuestas almacenadas en `ValoresRespuesta` (texto, números y fechas) se cifran con `AES-256-GCM` usando un IV aleatorio de 12 bytes y `auth_tag` de 16 bytes por cada valor, con la clave `DATA_ENCRYPTION_KEY` cargada desde `.env` (nunca en código ni en SQL Server). Al consultar resultados o exportar, el backend descifra los valores y restaura sus tipos originales.
- **Autenticación y CSRF:** el JWT se emite en cookie `HttpOnly` + `SameSite=Lax` acompañado de token CSRF (`X-CSRF-Token`) para peticiones mutantes.
- **Variables de entorno:** `JWT_SECRET`, parámetros de conexión a SQL Server y credenciales iniciales del Super Admin se cargan desde `.env`.

## Inicialización automática

Al iniciar el backend con `npm start` o `npm run dev` (sin necesidad de ejecutar comandos manuales previos):
1. Comprueba si existe la base de datos `EncuestasAcme` y la crea automáticamente si no existe.
2. Ejecuta en orden las migraciones SQL pendientes registradas en `_Migrations`.
3. Verifica si la tabla `Usuarios` está vacía; si no hay usuarios, crea automáticamente el primer `Super Admin` usando `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` y `ADMIN_USERNAME` del `.env` (hasheado con Argon2id). Si ya existen usuarios, no modifica ni duplica cuentas.
4. Si falla la conexión a SQL Server o alguna migración, el servidor muestra el error y detiene el arranque.

## Comandos principales

```bash
npm install
npm start
npm run dev
node --test tests/audit.test.js
```
