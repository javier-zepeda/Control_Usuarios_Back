const { limpiarTexto, validarObligatorio, leerId, leerListaDeIds } = require('./comunes.validator');
const { DOMINIO_CORREO } = require('../config/aplicacion');

// Validaciones de los datos que manda el front para usuarios.

// Largo máximo de los campos de texto:
const LARGO_NOMBRE = 150;
const LARGO_CORREO = 150;

// Cuerpo esperado al crear:
// {
//   nombre: 'Juan Pérez',
//   correo: 'juan_perez@codaca.com.gt',
//   accesos: [ { aplicacion_id: 5, roles: [3, 4] } ]   ← opcional
// }
function validarNuevoUsuario(cuerpo) {
    const errores = [];

    const datos = {
        nombre: limpiarTexto(cuerpo.nombre),
        correo: limpiarTexto(cuerpo.correo).toLowerCase(),
        accesos: leerAccesos(errores, cuerpo.accesos)
    };

    validarObligatorio(errores, datos.nombre, 'nombre', LARGO_NOMBRE);
    validarObligatorio(errores, datos.correo, 'correo', LARGO_CORREO);

    if (datos.correo !== '' && !esCorreoDeLaEmpresa(datos.correo)) {
        errores.push('El correo debe ser de la empresa (termina en ' + DOMINIO_CORREO + ')');
    }

    return { errores: errores, datos: datos };
}

// Cuerpo esperado al cambiar el nombre: { nombre: 'Juan Pérez' }
function validarNombre(cuerpo) {
    const errores = [];

    const datos = { nombre: limpiarTexto(cuerpo.nombre) };
    validarObligatorio(errores, datos.nombre, 'nombre', LARGO_NOMBRE);

    return { errores: errores, datos: datos };
}

// Cuerpo esperado al activar o desactivar: { activo: true } o { activo: false }
function validarEstado(cuerpo) {
    const errores = [];

    if (typeof cuerpo.activo !== 'boolean') {
        errores.push('El campo «activo» debe ser true o false');
    }

    return { errores: errores, datos: { activo: cuerpo.activo } };
}

// Cuerpo esperado al cambiar los roles de una aplicación: { roles: [3, 4] }
// Una lista vacía quita el acceso a esa aplicación.
function validarRolesDeAplicacion(cuerpo) {
    const errores = [];

    if (!Array.isArray(cuerpo.roles)) {
        errores.push('Debe mandar la lista de roles (vacía para quitar el acceso)');
        return { errores: errores, datos: { roles: [] } };
    }

    const datos = { roles: leerListaDeIds(errores, cuerpo.roles, 'roles') };

    return { errores: errores, datos: datos };
}

// Filtros de la lista de usuarios: ?buscar=juan&aplicacion=5&activo=true
// (todos son opcionales; si uno viene mal, se avisa en vez de ignorarlo)
function validarFiltros(consulta) {
    const errores = [];

    const datos = {
        buscar: limpiarTexto(consulta.buscar),
        aplicacionId: null,
        activo: null
    };

    if (consulta.aplicacion !== undefined && consulta.aplicacion !== '') {
        datos.aplicacionId = leerId(consulta.aplicacion);
        if (datos.aplicacionId === null) {
            errores.push('El filtro «aplicacion» no es válido');
        }
    }

    if (consulta.activo === 'true') {
        datos.activo = true;
    } else if (consulta.activo === 'false') {
        datos.activo = false;
    } else if (consulta.activo !== undefined && consulta.activo !== '') {
        errores.push('El filtro «activo» debe ser true o false');
    }

    return { errores: errores, datos: datos };
}

// accesos: [ { aplicacion_id, roles: [ids] } ] → [ { aplicacionId, roles } ]
// Cada aplicación una sola vez y con al menos un rol.
function leerAccesos(errores, valor) {
    if (valor === undefined || valor === null) {
        return [];
    }
    if (!Array.isArray(valor)) {
        errores.push('La lista de accesos no es válida');
        return [];
    }

    const accesos = [];
    for (const elemento of valor) {
        const aplicacionId = leerId(elemento && elemento.aplicacion_id);

        if (aplicacionId === null) {
            errores.push('Hay un acceso sin aplicación válida');
            return [];
        }
        if (accesos.some((acceso) => acceso.aplicacionId === aplicacionId)) {
            errores.push('Una aplicación viene repetida en los accesos');
            return [];
        }

        const roles = leerListaDeIds(errores, elemento.roles, 'roles');
        if (roles.length === 0) {
            errores.push('Cada aplicación de los accesos necesita al menos un rol');
            return [];
        }

        accesos.push({ aplicacionId: aplicacionId, roles: roles });
    }
    return accesos;
}

function esCorreoDeLaEmpresa(correo) {
    const partes = correo.split('@');
    return partes.length === 2 && partes[0] !== '' && correo.endsWith(DOMINIO_CORREO);
}

module.exports = {
    validarNuevoUsuario,
    validarNombre,
    validarEstado,
    validarRolesDeAplicacion,
    validarFiltros
};
