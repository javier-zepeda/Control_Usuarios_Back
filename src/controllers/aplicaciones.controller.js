const { listarAplicacionesConRoles } = require('../services/aplicaciones.service');
const { responderError } = require('../helpers/errores.helper');

// GET /api/aplicaciones
async function obtenerAplicaciones(req, res) {
    try {
        const aplicaciones = await listarAplicacionesConRoles();
        res.json(aplicaciones);
    } catch (error) {
        responderError(res, error, 'Error al obtener las aplicaciones');
    }
}

module.exports = { obtenerAplicaciones };
