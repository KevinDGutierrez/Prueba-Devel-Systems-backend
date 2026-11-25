const express = require('express');
const router = express.Router();
const EncuestaController = require('../controllers/EncuestaController');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', EncuestaController.listar);
router.post('/', requireRole('Super Admin', 'Admin'), EncuestaController.crear);
router.get('/:id', EncuestaController.obtener);
router.put('/:id', requireRole('Super Admin', 'Admin'), EncuestaController.actualizar);
router.delete('/:id', requireRole('Super Admin', 'Admin'), EncuestaController.eliminar);

router.get('/:id/resultados', EncuestaController.obtenerResultados);

module.exports = router;
