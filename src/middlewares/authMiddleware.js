const jwt = require('jsonwebtoken');
const UsuarioModel = require('../models/UsuarioModel');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'acme_surveys_dev_secret_jwt_key_devel_systems_2026';

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Acceso no autorizado'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
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
