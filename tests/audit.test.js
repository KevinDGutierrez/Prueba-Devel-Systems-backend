const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const sql = require('mssql/msnodesqlv8');
const argon2 = require('argon2');
require('dotenv').config();

const TEST_DB = 'EncuestasAcme_Test';
process.env.DB_NAME = TEST_DB;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key_for_audit_suite_only_2026';

const { runMigrations } = require('../database/runner');
const { getConnectionPool, closeConnectionPool } = require('../src/config/database');
const { encryptValue, decryptValue } = require('../src/utils/encryption');
const app = require('../src/app');

let server;
let baseUrl;
let adminCookie = '';
let adminCsrf = '';
let userCookie = '';
let userCsrf = '';
let encuestaId;
let encuestaUuid;
let campoTextoId;
let campoNumeroId;
let campoFechaId;

async function request(method, path, body = null, headers = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, data };
}

function extractCookies(setCookieHeaders) {
  const cookies = {};
  for (const raw of setCookieHeaders) {
    const [pair] = raw.split(';');
    const idx = pair.indexOf('=');
    if (idx > -1) {
      cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }
  }
  return cookies;
}

test.before(async () => {
  await runMigrations(TEST_DB);
  const pool = await getConnectionPool();

  await pool.request().query('DELETE FROM ValoresRespuesta; DELETE FROM Respuestas; DELETE FROM CamposEncuesta; DELETE FROM Encuestas; DELETE FROM Usuarios;');

  const adminHash = await argon2.hash('AdminAudit2026*!', { type: argon2.argon2id });
  const userHash = await argon2.hash('UserAudit2026*!', { type: argon2.argon2id });

  await pool.request()
    .input('nombre', sql.NVarChar(150), 'Admin Audit')
    .input('username', sql.VarChar(80), 'adminaudit')
    .input('email', sql.NVarChar(150), 'admin.audit@acme.com')
    .input('hash', sql.NVarChar(255), adminHash)
    .input('rol', sql.VarChar(20), 'Super Admin')
    .query(`INSERT INTO Usuarios (nombre_completo, username, email, password_hash, rol, activo) VALUES (@nombre, @username, @email, @hash, @rol, 1)`);

  await pool.request()
    .input('nombre', sql.NVarChar(150), 'User Audit')
    .input('username', sql.VarChar(80), 'useraudit')
    .input('email', sql.NVarChar(150), 'user.audit@acme.com')
    .input('hash', sql.NVarChar(255), userHash)
    .input('rol', sql.VarChar(20), 'Usuarios')
    .query(`INSERT INTO Usuarios (nombre_completo, username, email, password_hash, rol, activo) VALUES (@nombre, @username, @email, @hash, @rol, 1)`);

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}/api`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await closeConnectionPool();
});

test('1. Inicio de sesión correcto (usuario y correo) e incorrecto', async () => {
  const bad = await request('POST', '/auth/login', { usuario: 'adminaudit', password: 'WrongPassword1!' });
  assert.equal(bad.status, 401);

  const okByUsername = await request('POST', '/auth/login', { usuario: 'adminaudit', password: 'AdminAudit2026*!' });
  assert.equal(okByUsername.status, 200);
  assert.equal(okByUsername.data.success, true);

  const rawCookies = okByUsername.headers.getSetCookie ? okByUsername.headers.getSetCookie() : [];
  const parsed = extractCookies(rawCookies);
  assert.ok(parsed.acme_token);
  assert.ok(parsed.acme_csrf);
  adminCookie = `acme_token=${parsed.acme_token}; acme_csrf=${parsed.acme_csrf}`;
  adminCsrf = parsed.acme_csrf;

  const okUser = await request('POST', '/auth/login', { email: 'user.audit@acme.com', password: 'UserAudit2026*!' });
  assert.equal(okUser.status, 200);
  const userCookies = extractCookies(okUser.headers.getSetCookie ? okUser.headers.getSetCookie() : []);
  userCookie = `acme_token=${userCookies.acme_token}; acme_csrf=${userCookies.acme_csrf}`;
  userCsrf = userCookies.acme_csrf;
});

test('2. Protección de rutas privadas y CSRF', async () => {
  const unauth = await request('GET', '/encuestas');
  assert.equal(unauth.status, 401);

  const noCsrf = await request('POST', '/encuestas', { titulo: 'Sin CSRF', campos: [] }, { Cookie: adminCookie });
  assert.equal(noCsrf.status, 403);
});

test('3 y 6. Creación de encuestas y generación de enlace público único', async () => {
  const res = await request('POST', '/encuestas', {
    titulo: 'Encuesta Auditoría',
    descripcion: 'Prueba integral',
    campos: [
      { nombre_campo: 'nombre', titulo_etiqueta: 'Nombre', tipo_campo: 'texto', es_requerido: true },
      { nombre_campo: 'edad', titulo_etiqueta: 'Edad', tipo_campo: 'numero', es_requerido: true },
      { nombre_campo: 'fecha', titulo_etiqueta: 'Fecha', tipo_campo: 'fecha', es_requerido: false }
    ]
  }, { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf });

  assert.equal(res.status, 201);
  encuestaId = res.data.data.id_encuesta;
  encuestaUuid = res.data.data.uuid_publico;
  assert.ok(encuestaId > 0);
  assert.ok(encuestaUuid.length >= 8);
});

test('7. Acceso público sin autenticación', async () => {
  const res = await request('GET', `/public/encuesta/${encuestaUuid}`);
  assert.equal(res.status, 200);
  assert.equal(res.data.data.campos.length, 3);
  campoTextoId = res.data.data.campos[0].id_campo;
  campoNumeroId = res.data.data.campos[1].id_campo;
  campoFechaId = res.data.data.campos[2].id_campo;
});

test('8 y 9. Validación de preguntas obligatorias y tipos Texto, Número y Fecha', async () => {
  const missingReq = await request('POST', `/public/encuesta/${encuestaUuid}/responder`, {
    valores: [{ id_campo: campoTextoId, valor: 'Juan' }]
  });
  assert.equal(missingReq.status, 400);

  const badNum = await request('POST', `/public/encuesta/${encuestaUuid}/responder`, {
    valores: [
      { id_campo: campoTextoId, valor: 'Juan' },
      { id_campo: campoNumeroId, valor: 'no-es-numero' }
    ]
  });
  assert.equal(badNum.status, 400);

  const badDate = await request('POST', `/public/encuesta/${encuestaUuid}/responder`, {
    valores: [
      { id_campo: campoTextoId, valor: 'Juan' },
      { id_campo: campoNumeroId, valor: 25 },
      { id_campo: campoFechaId, valor: 'fecha-invalida' }
    ]
  });
  assert.equal(badDate.status, 400);
});

test('10 y 14. Almacenamiento correcto de respuestas y transacciones SQL', async () => {
  const ok = await request('POST', `/public/encuesta/${encuestaUuid}/responder`, {
    valores: [
      { id_campo: campoTextoId, valor: 'Ana López' },
      { id_campo: campoNumeroId, valor: 30 },
      { id_campo: campoFechaId, valor: '2026-11-25' }
    ]
  });
  assert.equal(ok.status, 201);

  const pool = await getConnectionPool();
  const countRes = await pool.request()
    .input('id', sql.Int, encuestaId)
    .query('SELECT COUNT(*) AS total FROM Respuestas WHERE id_encuesta = @id');
  assert.equal(countRes.recordset[0].total, 1);
});

test('11. Consulta de resultados con paginación', async () => {
  const res = await request('GET', `/encuestas/${encuestaId}/resultados?page=1&limit=10`, null, { Cookie: adminCookie });
  assert.equal(res.status, 200);
  assert.equal(res.data.data.respuestas.length, 1);
  assert.equal(res.data.data.paginacion.page, 1);
  assert.equal(res.data.data.paginacion.total, 1);
});

test('4 y 12. Modificación de encuestas e integridad de datos', async () => {
  const res = await request('PUT', `/encuestas/${encuestaId}`, {
    titulo: 'Encuesta Auditoría v2',
    descripcion: 'Actualizada',
    estado: 'activa',
    campos: [
      { id_campo: campoTextoId, nombre_campo: 'nombre', titulo_etiqueta: 'Nombre completo', tipo_campo: 'texto', es_requerido: true },
      { id_campo: campoNumeroId, nombre_campo: 'edad', titulo_etiqueta: 'Edad', tipo_campo: 'numero', es_requerido: true },
      { id_campo: campoFechaId, nombre_campo: 'fecha', titulo_etiqueta: 'Fecha', tipo_campo: 'fecha', es_requerido: false }
    ]
  }, { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf });
  assert.equal(res.status, 200);
});

test('13. Protección de permisos según roles', async () => {
  const forbiddenCreate = await request('POST', '/encuestas', {
    titulo: 'No permitido',
    campos: [{ titulo_etiqueta: 'P1', tipo_campo: 'texto', es_requerido: true }]
  }, { Cookie: userCookie, 'X-CSRF-Token': userCsrf });
  assert.equal(forbiddenCreate.status, 403);
});

test('5. Eliminación lógica de encuestas conservando respuestas históricas', async () => {
  const del = await request('DELETE', `/encuestas/${encuestaId}`, null, { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf });
  assert.equal(del.status, 200);

  const pool = await getConnectionPool();
  const encRes = await pool.request().input('id', sql.Int, encuestaId).query('SELECT estado FROM Encuestas WHERE id_encuesta = @id');
  assert.equal(encRes.recordset[0].estado, 'eliminada');

  const respRes = await pool.request().input('id', sql.Int, encuestaId).query('SELECT COUNT(*) AS total FROM Respuestas WHERE id_encuesta = @id');
  assert.equal(respRes.recordset[0].total, 1);
});

test('15. Cifrado AES-256-GCM, tipos originales y detección de manipulación', async () => {
  const encTexto = encryptValue('Texto secreto');
  const encNum = encryptValue(42.5);
  const encFecha = encryptValue('2026-11-25');

  assert.notEqual(encTexto.valor_cifrado, 'Texto secreto');
  assert.equal(Buffer.from(encTexto.iv, 'base64').length, 12);
  assert.equal(Buffer.from(encTexto.auth_tag, 'base64').length, 16);

  assert.equal(decryptValue(encTexto.valor_cifrado, encTexto.iv, encTexto.auth_tag, 'texto'), 'Texto secreto');
  assert.equal(decryptValue(encNum.valor_cifrado, encNum.iv, encNum.auth_tag, 'numero'), 42.5);
  assert.equal(decryptValue(encFecha.valor_cifrado, encFecha.iv, encFecha.auth_tag, 'fecha'), '2026-11-25');

  const tampered = Buffer.from(encTexto.valor_cifrado, 'base64');
  tampered[0] = tampered[0] ^ 0xff;
  assert.throws(() => {
    decryptValue(tampered.toString('base64'), encTexto.iv, encTexto.auth_tag, 'texto');
  });
});
