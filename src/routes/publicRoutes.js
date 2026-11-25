const express = require('express');
const router = express.Router();
const PublicController = require('../controllers/PublicController');

router.get('/encuesta/:uuid', PublicController.obtenerEncuestaPublica);
router.post('/encuesta/:uuid/responder', PublicController.responderEncuestaPublica);

module.exports = router;
