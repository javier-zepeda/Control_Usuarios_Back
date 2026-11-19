const { Router } = require('express');
const { autenticar } = require('../middlewares/autenticacion.middleware');
const { requierePermiso } = require('../middlewares/permisos.middleware');
const { obtenerAplicaciones } = require('../controllers/aplicaciones.controller');

const router = Router();

// GET /api/aplicaciones → todas las aplicaciones con sus roles
router.get('/', autenticar, requierePermiso('usuarios.ver'), obtenerAplicaciones);

module.exports = router;
