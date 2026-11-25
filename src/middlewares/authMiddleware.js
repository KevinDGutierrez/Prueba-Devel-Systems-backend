const jwt = require('jsonwebtoken');
const UsuarioModel = require('../models/UsuarioModel');
require('dotenv').config();

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no configurado');
  }
  return process.env.JWT_SECRET;
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const key = part.slice(0, idx).trim();
      const val = decodeURIComponent(part.slice(idx + 1).trim());
      cookies[key] = val;
    }
  });
  return cookies;
}

async function authMiddleware(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies.acme_token;
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const token = cookieToken || bearerToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Acceso no autorizado'
    });
  }

  const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (cookieToken && mutatingMethods.includes(req.method)) {
    const csrfCookie = cookies.acme_csrf;
    const csrfHeader = req.headers['x-csrf-token'];
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return res.status(403).json({
        success: false,
        message: 'Token CSRF inválido o faltante'
      });
    }
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const usuario = await UsuarioModel.findById(decoded.sub);
    
    if (!usuario || !usuario.activo) {
      return res.status(401).json({
        success: false,
        message: 'Sesión no válida o usuario inactivo'
      });
    }

    req.user = usuario;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Token expirado o inválido'
    });
  }
}

function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user || !rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({
        success: false,
        message: 'No cuenta con los privilegios suficientes para realizar esta acción'
      });
    }
    next();
  };
}

module.exports = {
  authMiddleware,
  requireRole
};
