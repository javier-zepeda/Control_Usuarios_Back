const {
    listarUsuarios,
    obtenerUsuario,
    crearUsuario,
    cambiarNombre,
    cambiarEstado,
    cambiarRolesEnAplicacion
} = require('../services/usuarios.service');
const {
    validarNuevoUsuario,
    validarNombre,
    validarEstado,
    validarRolesDeAplicacion,
    validarFiltros
} = require('../validators/usuarios.validator');
const { leerId } = require('../validators/comunes.validator');
const { responderError } = require('../helpers/errores.helper');

// Cada función: 1) lee y valida lo que manda el front, 2) llama al servicio, 3) responde.

// GET /api/usuarios?buscar=&aplicacion=&activo=
async function obtenerUsuarios(req, res) {
    try {
        const { errores, datos } = validarFiltros(req.query);
        if (errores.length > 0) {
            return res.status(400).json({ mensaje: 'Filtros no válidos', errores: errores });
        }

        const usuarios = await listarUsuarios(datos);
        res.json(usuarios);
    } catch (error) {
        responderError(res, error, 'Error al obtener los usuarios');
    }
}

// GET /api/usuarios/:id
async function obtenerUnUsuario(req, res) {
    try {
        const idUsuario = leerId(req.params.id);
        if (idUsuario === null) {
            return res.status(400).json({ mensaje: 'El número de usuario no es válido' });
        }

        const usuario = await obtenerUsuario(idUsuario);
        if (usuario === null) {
            return res.status(404).json({ mensaje: 'El usuario no existe' });
        }

        // El front lo usa para esconder "Desactivar" y los roles propios del Control de Usuarios
        usuario.es_usted = usuario.id === req.usuario.id;
        res.json(usuario);
    } catch (error) {
        responderError(res, error, 'Error al obtener el usuario');
    }
}

// POST /api/usuarios
async function agregarUsuario(req, res) {
    try {
        const { errores, datos } = validarNuevoUsuario(req.body);
        if (errores.length > 0) {
            return res.status(400).json({ mensaje: 'Revise los datos del usuario', errores: errores });
        }

        const idUsuario = await crearUsuario(datos, req.usuario);
        res.status(201).json({ mensaje: 'Usuario creado', id: idUsuario });
    } catch (error) {
        responderError(res, error, 'Error al crear el usuario');
    }
}

// PUT /api/usuarios/:id   { nombre }
async function editarNombre(req, res) {
    try {
        const idUsuario = leerId(req.params.id);
        if (idUsuario === null) {
            return res.status(400).json({ mensaje: 'El número de usuario no es válido' });
        }

        const { errores, datos } = validarNombre(req.body);
        if (errores.length > 0) {
            return res.status(400).json({ mensaje: 'Revise el nombre', errores: errores });
        }

        const huboCambio = await cambiarNombre(idUsuario, datos.nombre, req.usuario);
        res.json({ mensaje: huboCambio ? 'Nombre actualizado' : 'Sin cambios' });
    } catch (error) {
        responderError(res, error, 'Error al cambiar el nombre');
    }
}

// PUT /api/usuarios/:id/estado   { activo: true | false }
async function editarEstado(req, res) {
    try {
        const idUsuario = leerId(req.params.id);
        if (idUsuario === null) {
            return res.status(400).json({ mensaje: 'El número de usuario no es válido' });
        }

        const { errores, datos } = validarEstado(req.body);
        if (errores.length > 0) {
            return res.status(400).json({ mensaje: 'Revise los datos', errores: errores });
        }

        await cambiarEstado(idUsuario, datos.activo, req.usuario);
        res.json({ mensaje: datos.activo ? 'Usuario activado' : 'Usuario desactivado' });
    } catch (error) {
        responderError(res, error, 'Error al cambiar el estado del usuario');
    }
}

// PUT /api/usuarios/:id/aplicaciones/:idAplicacion/roles   { roles: [3, 4] }
async function editarRolesEnAplicacion(req, res) {
    try {
        const idUsuario = leerId(req.params.id);
        const idAplicacion = leerId(req.params.idAplicacion);
        if (idUsuario === null || idAplicacion === null) {
            return res.status(400).json({ mensaje: 'El número de usuario o de aplicación no es válido' });
        }

        const { errores, datos } = validarRolesDeAplicacion(req.body);
        if (errores.length > 0) {
            return res.status(400).json({ mensaje: 'Revise los roles', errores: errores });
        }

        const huboCambio = await cambiarRolesEnAplicacion(idUsuario, idAplicacion, datos.roles, req.usuario);

        let mensaje = 'Sin cambios';
        if (huboCambio) {
            mensaje = datos.roles.length === 0 ? 'Acceso quitado' : 'Roles actualizados';
        }
        res.json({ mensaje: mensaje });
    } catch (error) {
        responderError(res, error, 'Error al cambiar los roles');
    }
}

module.exports = {
    obtenerUsuarios,
    obtenerUnUsuario,
    agregarUsuario,
    editarNombre,
    editarEstado,
    editarRolesEnAplicacion
};
