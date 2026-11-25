const jwt = require('jsonwebtoken');
const UsuarioModel = require('../models/UsuarioModel');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'acme_surveys_dev_secret_jwt_key_devel_systems_2026';
const JWT_EXPIRES_IN = '24h';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const loginAttempts = new Map();

function getAttemptKey(req, email) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  return `${ip}:${email}`;
}

function registerFailedAttempt(key) {
  const now = Date.now();
  const record = loginAttempts.get(key) || { count: 0, lockedUntil: null };
  const nextCount = record.count + 1;
  const lockedUntil = nextCount >= MAX_LOGIN_ATTEMPTS ? now + LOCKOUT_DURATION_MS : null;
  loginAttempts.set(key, { count: nextCount, lockedUntil });
  return { count: nextCount, lockedUntil };
}

class AuthController {
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Debe ingresar email y contraseña'
        });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const attemptKey = getAttemptKey(req, normalizedEmail);
      const attemptRecord = loginAttempts.get(attemptKey);

      if (attemptRecord?.lockedUntil && Date.now() < attemptRecord.lockedUntil) {
        const remainingMinutes = Math.ceil((attemptRecord.lockedUntil - Date.now()) / 60000);
        return res.status(429).json({
          success: false,
          message: `Demasiados intentos fallidos. Intenta nuevamente en ${remainingMinutes} ${remainingMinutes === 1 ? 'minuto' : 'minutos'}.`
        });
      }

      if (attemptRecord?.lockedUntil && Date.now() >= attemptRecord.lockedUntil) {
        loginAttempts.delete(attemptKey);
      }

      const usuario = await UsuarioModel.findByEmail(normalizedEmail);
      if (!usuario) {
        const failed = registerFailedAttempt(attemptKey);
        if (failed.lockedUntil) {
          return res.status(429).json({
            success: false,
            message: 'Demasiados intentos fallidos. Intenta nuevamente en 15 minutos.'
          });
        }
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      if (!usuario.activo) {
        return res.status(403).json({
          success: false,
          message: 'Usuario suspendido'
        });
      }

      const isMatch = await UsuarioModel.verifyPassword(password, usuario.password_hash);
      if (!isMatch) {
        const failed = registerFailedAttempt(attemptKey);
        if (failed.lockedUntil) {
          return res.status(429).json({
            success: false,
            message: 'Demasiados intentos fallidos. Intenta nuevamente en 15 minutos.'
          });
        }
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      loginAttempts.delete(attemptKey);

      const token = jwt.sign(
        { sub: usuario.id_usuario },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.json({
        success: true,
        token
      });
    } catch (error) {
      next(error);
    }
  }

  static async me(req, res) {
    res.json({
      success: true,
      usuario: {
        id_usuario: req.user.id_usuario,
        nombre_completo: req.user.nombre_completo,
        email: req.user.email,
        rol: req.user.rol
      }
    });
  }

  static async listarUsuarios(req, res, next) {
    try {
      const usuarios = await UsuarioModel.findAll();
      res.json({
        success: true,
        data: usuarios
      });
    } catch (error) {
      next(error);
    }
  }

  static validarContrasena(password) {
    if (!password || typeof password !== 'string') return false;
    const tieneMinimo8 = password.length >= 8;
    const tieneMayuscula = /[A-Z]/.test(password);
    const tieneMinuscula = /[a-z]/.test(password);
    const tieneNumero = /[0-9]/.test(password);
    const tieneEspecial = /[^A-Za-z0-9]/.test(password);
    return tieneMinimo8 && tieneMayuscula && tieneMinuscula && tieneNumero && tieneEspecial;
  }

  static async crearUsuario(req, res, next) {
    try {
      const { nombre_completo, email, password, rol } = req.body;

      if (!nombre_completo || !email || !password) {
        return res.status(400).json({ success: false, message: 'Datos incompletos' });
      }

      if (!AuthController.validarContrasena(password)) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña debe contener al menos 8 caracteres, una letra mayúscula, una minúscula, un número y un carácter especial'
        });
      }

      if (rol === 'Super Admin') {
        return res.status(400).json({ success: false, message: 'Solo puede existir un único Super Admin en el sistema' });
      }

      const existente = await UsuarioModel.findByEmail(email.trim().toLowerCase());
      if (existente) {
        return res.status(400).json({ success: false, message: 'El correo ya está registrado' });
      }

      const nuevo = await UsuarioModel.create({ nombre_completo, email, password, rol: rol || 'Usuarios' });
      res.status(201).json({ success: true, data: nuevo });
    } catch (error) {
      next(error);
    }
  }

  static async actualizarRol(req, res, next) {
    try {
      const idTarget = parseInt(req.params.id, 10);
      const { rol } = req.body;

      if (rol === 'Super Admin') {
        return res.status(400).json({ success: false, message: 'No se pueden promover usuarios a Super Admin. Solo existe uno único' });
      }

      if (!['Admin', 'Usuarios'].includes(rol)) {
        return res.status(400).json({ success: false, message: 'Rol inválido' });
      }

      const target = await UsuarioModel.findById(idTarget);
      if (!target) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }

      if (target.rol === 'Super Admin') {
        return res.status(400).json({ success: false, message: 'El rol de Super Admin es único e inmutable' });
      }

      await UsuarioModel.updateRol(idTarget, rol);
      res.json({ success: true, message: 'Rol actualizado' });
    } catch (error) {
      next(error);
    }
  }

  static async toggleEstado(req, res, next) {
    try {
      const idTarget = parseInt(req.params.id, 10);
      const { activo } = req.body;

      const target = await UsuarioModel.findById(idTarget);
      if (!target) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }

      if (target.rol === 'Super Admin') {
        return res.status(400).json({ success: false, message: 'El Super Admin no puede ser suspendido' });
      }

      if (target.id_usuario === req.user.id_usuario) {
        return res.status(400).json({ success: false, message: 'No puedes suspenderte a ti mismo' });
      }

      await UsuarioModel.updateEstado(idTarget, activo);
      res.json({ success: true, message: 'Estado actualizado' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
