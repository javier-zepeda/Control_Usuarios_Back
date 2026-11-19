const { Router } = require('express');
const { autenticar } = require('../middlewares/autenticacion.middleware');
const { requierePermiso } = require('../middlewares/permisos.middleware');
const {
    obtenerUsuarios,
    obtenerUnUsuario,
    agregarUsuario,
    editarNombre,
    editarEstado,
    editarRolesEnAplicacion
} = require('../controllers/usuarios.controller');

const router = Router();

// GET /api/usuarios?buscar=&aplicacion=&activo=  → buscar usuarios
router.get('/', autenticar, requierePermiso('usuarios.ver'), obtenerUsuarios);

// GET /api/usuarios/:id                          → un usuario con sus roles por aplicación
router.get('/:id', autenticar, requierePermiso('usuarios.ver'), obtenerUnUsuario);

// POST /api/usuarios                             → crear usuario (y sus accesos, si vienen)
router.post('/', autenticar, requierePermiso('usuarios.crear'), agregarUsuario);

// PUT /api/usuarios/:id                          → cambiar el nombre
router.put('/:id', autenticar, requierePermiso('usuarios.editar'), editarNombre);

// PUT /api/usuarios/:id/estado                   → activar o desactivar (en todas las aplicaciones)
router.put('/:id/estado', autenticar, requierePermiso('usuarios.editar'), editarEstado);

// PUT /api/usuarios/:id/aplicaciones/:idAplicacion/roles → sus roles en esa aplicación ([] quita el acceso)
router.put('/:id/aplicaciones/:idAplicacion/roles', autenticar, requierePermiso('usuarios.asignar_roles'), editarRolesEnAplicacion);

module.exports = router;
