const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');

router.post('/login', AuthController.login);
router.post('/logout', AuthController.logout);
router.get('/me', authMiddleware, AuthController.me);

router.get('/usuarios', authMiddleware, requireRole('Super Admin', 'Admin'), AuthController.listarUsuarios);
router.post('/usuarios', authMiddleware, requireRole('Super Admin', 'Admin'), AuthController.crearUsuario);
router.put('/usuarios/:id/rol', authMiddleware, requireRole('Super Admin'), AuthController.actualizarRol);
router.put('/usuarios/:id/estado', authMiddleware, requireRole('Super Admin', 'Admin'), AuthController.toggleEstado);

module.exports = router;
