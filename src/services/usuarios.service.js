const { QueryTypes } = require('sequelize');
const baseDatos = require('../config/baseDatos');
const { CODIGO_APLICACION } = require('../config/aplicacion');
const { ErrorDeRegla } = require('../helpers/errores.helper');
const { buscarAplicacion, buscarRolesDeAplicacion } = require('./aplicaciones.service');
const { revisarQueQuedeAdministrador } = require('./protecciones.service');
const bitacora = require('./bitacora.service');

// Usuarios del Portal y sus roles en cada aplicación.

// Reglas:
//   1. No se borra a nadie: se desactiva. Desactivar lo bloquea en TODAS las aplicaciones.
//   2. Tener acceso a una aplicación = tener al menos un rol de ella.
//   3. La contraseña (password) del Cotizador nunca se toca.
//   4. es_defecto no se usa: al insertar queda en 0 por su valor por defecto.
//   5. Al cambiar roles solo se borran los que se quitan y se insertan los nuevos,
//      así los que se quedan conservan su es_defecto del Portal.
//   6. Nadie se desactiva a sí mismo ni cambia sus propios roles del Control de Usuarios,
//      y siempre debe quedar al menos un administrador (protecciones.service.js).
//   7. Cada cambio deja su renglón en la bitácora, en la misma transacción.

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

// Lista de usuarios con las aplicaciones a las que tienen acceso.
async function listarUsuarios(filtros) {
    const condiciones = [];
    const parametros = {};

    if (filtros.buscar !== '') {
        condiciones.push('(u.nombre LIKE :buscar OR u.email LIKE :buscar)');
        parametros.buscar = '%' + filtros.buscar + '%';
    }
    if (filtros.activo !== null) {
        condiciones.push('u.activo = :activo');
        parametros.activo = filtros.activo ? 1 : 0;
    }
    if (filtros.aplicacionId !== null) {
        condiciones.push(
            `EXISTS (SELECT 1
                     FROM dbo.COTI_tbl_usuario_rol ur
                     JOIN dbo.COTI_tbl_roles r ON r.id = ur.rol_id
                     WHERE ur.usuario_id = u.id AND r.aplicacion_id = :aplicacion_id)`
        );
        parametros.aplicacion_id = filtros.aplicacionId;
    }

    let donde = '';
    if (condiciones.length > 0) {
        donde = 'WHERE ' + condiciones.join(' AND ');
    }

    const usuarios = await baseDatos.query(
        `SELECT u.id, u.nombre, u.email AS correo, u.activo
         FROM dbo.COTI_tbl_usuarios u
         ${donde}
         ORDER BY u.nombre`,
        { replacements: parametros, type: QueryTypes.SELECT }
    );

    if (usuarios.length === 0) {
        return [];
    }

    // Los accesos de todos en una sola consulta (y no una por persona)
    const accesos = await buscarAccesos(usuarios.map((usuario) => usuario.id));

    for (const usuario of usuarios) {
        const deEsteUsuario = accesos.filter((fila) => fila.usuario_id === usuario.id);

        // En la lista solo se muestran las aplicaciones, sin el detalle de roles
        usuario.aplicaciones = agruparPorAplicacion(deEsteUsuario).map((aplicacion) => ({
            id: aplicacion.id,
            codigo: aplicacion.codigo,
            nombre: aplicacion.nombre
        }));
    }

    return usuarios;
}

// Un usuario con sus roles agrupados por aplicación, o null si no existe
async function obtenerUsuario(idUsuario) {
    const usuario = await buscarUsuarioPorId(idUsuario);

    if (usuario === null) {
        return null;
    }

    const accesos = await buscarAccesos([idUsuario]);
    usuario.aplicaciones = agruparPorAplicacion(accesos);

    return usuario;
}

// ---------------------------------------------------------------------------
// Cambios
// ---------------------------------------------------------------------------

// Crea un usuario y, si vienen, le da sus accesos.
//   datos    → { nombre, correo, accesos: [{ aplicacionId, roles: [ids] }] } ya validados
//   operador → quien hace el cambio (req.usuario)
// Devuelve el id del usuario nuevo.
async function crearUsuario(datos, operador) {
    try {
        return await baseDatos.transaction(async (transaccion) => {
            const existente = await buscarUsuarioPorCorreo(datos.correo, transaccion);

            if (existente !== null) {
                throw new ErrorDeRegla('Ya existe un usuario con ese correo', 409, { id: existente.id });
            }

            // Primero se revisan todos los accesos; si uno está mal, no se crea nada
            const accesosRevisados = [];
            for (const acceso of datos.accesos) {
                const aplicacion = await buscarAplicacionParaCambiar(acceso.aplicacionId, transaccion);
                const rolesApp = await buscarRolesDeAplicacion(aplicacion.id, transaccion);
                const roles = revisarRoles(aplicacion, rolesApp, acceso.roles, []);

                accesosRevisados.push({ aplicacion: aplicacion, roles: roles });
            }

            // Sin contraseña: entra con su cuenta de Microsoft
            const filas = await baseDatos.query(
                `INSERT INTO dbo.COTI_tbl_usuarios (nombre, email, activo, password)
                 OUTPUT INSERTED.id
                 VALUES (:nombre, :correo, 1, NULL)`,
                {
                    replacements: { nombre: datos.nombre, correo: datos.correo },
                    type: QueryTypes.SELECT,
                    transaction: transaccion
                }
            );
            const idUsuario = filas[0].id;

            for (const acceso of accesosRevisados) {
                await insertarRoles(transaccion, idUsuario, acceso.roles.map((rol) => rol.id));
            }

            let descripcion = 'Creó al usuario ' + datos.nombre + ' (' + datos.correo + ')';
            if (accesosRevisados.length > 0) {
                descripcion += ' con acceso a ' + accesosRevisados.map((acceso) => acceso.aplicacion.nombre).join(', ');
            }

            await bitacora.registrar(transaccion, operador, {
                accion: 'USUARIO_CREAR',
                aplicacionId: null,
                tipoObjeto: 'USUARIO',
                objetoId: idUsuario,
                descripcion: descripcion,
                antes: null,
                despues: {
                    nombre: datos.nombre,
                    correo: datos.correo,
                    accesos: accesosRevisados.map((acceso) => ({
                        aplicacion: acceso.aplicacion.codigo,
                        roles: nombresDe(acceso.roles)
                    }))
                }
            });

            return idUsuario;
        });
    } catch (error) {
        // Por si dos personas crean el mismo correo al mismo tiempo (índice único de email)
        if (error.name === 'SequelizeUniqueConstraintError') {
            throw new ErrorDeRegla('Ya existe un usuario con ese correo', 409);
        }
        throw error;
    }
}

// Cambia el nombre. Devuelve false si el nombre ya era ese (no hay nada que guardar).
async function cambiarNombre(idUsuario, nombre, operador) {
    return baseDatos.transaction(async (transaccion) => {
        const usuario = await buscarUsuarioParaCambiar(idUsuario, transaccion);

        if (usuario.nombre === nombre) {
            return false;
        }

        await baseDatos.query(
            `UPDATE dbo.COTI_tbl_usuarios SET nombre = :nombre WHERE id = :id`,
            { replacements: { nombre: nombre, id: idUsuario }, transaction: transaccion }
        );

        await bitacora.registrar(transaccion, operador, {
            accion: 'USUARIO_EDITAR',
            aplicacionId: null,
            tipoObjeto: 'USUARIO',
            objetoId: idUsuario,
            descripcion: 'Cambió el nombre de "' + usuario.nombre + '" a "' + nombre + '"',
            antes: { nombre: usuario.nombre },
            despues: { nombre: nombre }
        });

        return true;
    });
}

// Activa o desactiva a un usuario (en TODAS las aplicaciones)
async function cambiarEstado(idUsuario, activo, operador) {
    await baseDatos.transaction(async (transaccion) => {
        const usuario = await buscarUsuarioParaCambiar(idUsuario, transaccion);

        if (usuario.activo === activo) {
            throw new ErrorDeRegla(activo ? 'El usuario ya está activo' : 'El usuario ya está inactivo');
        }
        if (!activo && idUsuario === operador.id) {
            throw new ErrorDeRegla('No puede desactivarse a sí mismo', 409);
        }

        await baseDatos.query(
            `UPDATE dbo.COTI_tbl_usuarios SET activo = :activo WHERE id = :id`,
            { replacements: { activo: activo ? 1 : 0, id: idUsuario }, transaction: transaccion }
        );

        // Si era administrador del Control de Usuarios, que quede al menos otro
        if (!activo) {
            await revisarQueQuedeAdministrador(transaccion);
        }

        let descripcion = 'Activó a ' + usuario.nombre;
        if (!activo) {
            descripcion = 'Desactivó a ' + usuario.nombre + ' (queda sin acceso a todas las aplicaciones)';
        }

        await bitacora.registrar(transaccion, operador, {
            accion: activo ? 'USUARIO_ACTIVAR' : 'USUARIO_DESACTIVAR',
            aplicacionId: null,
            tipoObjeto: 'USUARIO',
            objetoId: idUsuario,
            descripcion: descripcion,
            antes: { activo: usuario.activo },
            despues: { activo: activo }
        });
    });
}

// Deja al usuario con exactamente estos roles en una aplicación.
// Una lista vacía le quita el acceso a esa aplicación.
// Los roles de otras aplicaciones no se tocan.
// Devuelve false si ya tenía esos mismos roles (no hay nada que guardar).
async function cambiarRolesEnAplicacion(idUsuario, idAplicacion, idsRoles, operador) {
    return baseDatos.transaction(async (transaccion) => {
        const usuario = await buscarUsuarioParaCambiar(idUsuario, transaccion);
        const aplicacion = await buscarAplicacionParaCambiar(idAplicacion, transaccion);
        const esEstaAplicacion = aplicacion.codigo === CODIGO_APLICACION;

        if (esEstaAplicacion && idUsuario === operador.id) {
            throw new ErrorDeRegla(
                'No puede cambiar sus propios roles del Control de Usuarios. Pídale a otra persona de IT que lo haga.',
                409
            );
        }

        const rolesApp = await buscarRolesDeAplicacion(aplicacion.id, transaccion);
        const actuales = await buscarRolesDelUsuarioEnAplicacion(idUsuario, aplicacion.id, transaccion);
        const idsActuales = actuales.map((rol) => rol.id);
        const nuevos = revisarRoles(aplicacion, rolesApp, idsRoles, idsActuales);

        const idsQuitar = idsActuales.filter((id) => !idsRoles.includes(id));
        const idsAgregar = idsRoles.filter((id) => !idsActuales.includes(id));

        if (idsQuitar.length === 0 && idsAgregar.length === 0) {
            return false;
        }

        await quitarRoles(transaccion, idUsuario, idsQuitar);
        await insertarRoles(transaccion, idUsuario, idsAgregar);

        if (esEstaAplicacion) {
            await revisarQueQuedeAdministrador(transaccion);
        }

        await bitacora.registrar(transaccion, operador, {
            accion: 'ROLES_USUARIO_CAMBIAR',
            aplicacionId: aplicacion.id,
            tipoObjeto: 'USUARIO',
            objetoId: idUsuario,
            descripcion: describirCambioDeRoles(usuario, aplicacion, actuales, nuevos),
            antes: { roles: nombresDe(actuales) },
            despues: { roles: nombresDe(nuevos) }
        });

        return true;
    });
}

// ---------------------------------------------------------------------------
// Ayudantes
// ---------------------------------------------------------------------------

async function buscarUsuarioPorId(idUsuario, transaccion = null) {
    const filas = await baseDatos.query(
        `SELECT id, nombre, email AS correo, activo
         FROM dbo.COTI_tbl_usuarios
         WHERE id = :id`,
        { replacements: { id: idUsuario }, type: QueryTypes.SELECT, transaction: transaccion }
    );

    if (filas.length === 0) {
        return null;
    }
    return filas[0];
}

async function buscarUsuarioPorCorreo(correo, transaccion = null) {
    const filas = await baseDatos.query(
        `SELECT id, nombre, email AS correo, activo
         FROM dbo.COTI_tbl_usuarios
         WHERE LOWER(email) = LOWER(:correo)`,
        { replacements: { correo: correo }, type: QueryTypes.SELECT, transaction: transaccion }
    );

    if (filas.length === 0) {
        return null;
    }
    return filas[0];
}

// El usuario, o error 404 si no existe
async function buscarUsuarioParaCambiar(idUsuario, transaccion) {
    const usuario = await buscarUsuarioPorId(idUsuario, transaccion);

    if (usuario === null) {
        throw new ErrorDeRegla('El usuario no existe', 404);
    }
    return usuario;
}

// La aplicación, o error si no existe o está inactiva
async function buscarAplicacionParaCambiar(idAplicacion, transaccion) {
    const aplicacion = await buscarAplicacion(idAplicacion, transaccion);

    if (aplicacion === null) {
        throw new ErrorDeRegla('La aplicación ' + idAplicacion + ' no existe', 404);
    }
    if (!aplicacion.activo) {
        throw new ErrorDeRegla('La aplicación ' + aplicacion.nombre + ' está inactiva: no se pueden cambiar sus roles', 409);
    }
    return aplicacion;
}

// Revisa que los roles pedidos sean de la aplicación.
// Un rol inactivo solo se acepta si el usuario ya lo tenía (para no obligar a quitárselo).
// Devuelve los roles pedidos ({ id, nombre }).
function revisarRoles(aplicacion, rolesApp, idsPedidos, idsActuales) {
    const roles = [];

    for (const idRol of idsPedidos) {
        const rol = rolesApp.find((fila) => fila.id === idRol);

        if (rol === undefined) {
            throw new ErrorDeRegla('El rol ' + idRol + ' no es de la aplicación ' + aplicacion.nombre);
        }
        if (!rol.activo && !idsActuales.includes(idRol)) {
            throw new ErrorDeRegla('El rol "' + rol.nombre + '" está inactivo: no se puede asignar');
        }

        roles.push({ id: rol.id, nombre: rol.nombre });
    }
    return roles;
}

async function buscarRolesDelUsuarioEnAplicacion(idUsuario, idAplicacion, transaccion) {
    return baseDatos.query(
        `SELECT r.id, r.nombre
         FROM dbo.COTI_tbl_usuario_rol ur
         JOIN dbo.COTI_tbl_roles r ON r.id = ur.rol_id
         WHERE ur.usuario_id = :usuario_id AND r.aplicacion_id = :aplicacion_id`,
        {
            replacements: { usuario_id: idUsuario, aplicacion_id: idAplicacion },
            type: QueryTypes.SELECT,
            transaction: transaccion
        }
    );
}

// es_defecto no se manda: queda en 0 por su valor por defecto
async function insertarRoles(transaccion, idUsuario, idsRoles) {
    for (const idRol of idsRoles) {
        await baseDatos.query(
            `INSERT INTO dbo.COTI_tbl_usuario_rol (usuario_id, rol_id)
             VALUES (:usuario_id, :rol_id)`,
            { replacements: { usuario_id: idUsuario, rol_id: idRol }, transaction: transaccion }
        );
    }
}

async function quitarRoles(transaccion, idUsuario, idsRoles) {
    for (const idRol of idsRoles) {
        await baseDatos.query(
            `DELETE FROM dbo.COTI_tbl_usuario_rol
             WHERE usuario_id = :usuario_id AND rol_id = :rol_id`,
            { replacements: { usuario_id: idUsuario, rol_id: idRol }, transaction: transaccion }
        );
    }
}

// Roles de varios usuarios, con su aplicación (una fila por rol)
async function buscarAccesos(idsUsuarios) {
    return baseDatos.query(
        `SELECT ur.usuario_id,
                a.id     AS aplicacion_id,
                a.codigo AS aplicacion_codigo,
                a.nombre AS aplicacion_nombre,
                a.activo AS aplicacion_activa,
                r.id     AS rol_id,
                r.nombre AS rol_nombre,
                r.activo AS rol_activo
         FROM dbo.COTI_tbl_usuario_rol ur
         JOIN dbo.COTI_tbl_roles r   ON r.id = ur.rol_id
         JOIN dbo.tbl_aplicaciones a ON a.id = r.aplicacion_id
         WHERE ur.usuario_id IN (:ids)
         ORDER BY a.nombre, r.nombre`,
        { replacements: { ids: idsUsuarios }, type: QueryTypes.SELECT }
    );
}

// Filas de buscarAccesos → [{ id, codigo, nombre, activo, roles: [{ id, nombre, activo }] }]
function agruparPorAplicacion(filas) {
    const aplicaciones = [];

    for (const fila of filas) {
        let aplicacion = aplicaciones.find((app) => app.id === fila.aplicacion_id);

        if (aplicacion === undefined) {
            aplicacion = {
                id: fila.aplicacion_id,
                codigo: fila.aplicacion_codigo,
                nombre: fila.aplicacion_nombre,
                activo: fila.aplicacion_activa,
                roles: []
            };
            aplicaciones.push(aplicacion);
        }

        aplicacion.roles.push({ id: fila.rol_id, nombre: fila.rol_nombre, activo: fila.rol_activo });
    }
    return aplicaciones;
}

function nombresDe(roles) {
    return roles.map((rol) => rol.nombre);
}

// Texto de la bitácora para un cambio de roles
function describirCambioDeRoles(usuario, aplicacion, actuales, nuevos) {
    if (nuevos.length === 0) {
        return 'Le quitó a ' + usuario.nombre + ' el acceso a ' + aplicacion.nombre;
    }
    if (actuales.length === 0) {
        return 'Le dio a ' + usuario.nombre + ' acceso a ' + aplicacion.nombre + ' con: ' + nombresDe(nuevos).join(', ');
    }
    return 'Cambió los roles de ' + usuario.nombre + ' en ' + aplicacion.nombre + ' a: ' + nombresDe(nuevos).join(', ');
}

module.exports = {
    listarUsuarios,
    obtenerUsuario,
    crearUsuario,
    cambiarNombre,
    cambiarEstado,
    cambiarRolesEnAplicacion
};
