const { QueryTypes } = require('sequelize');
const baseDatos = require('../config/baseDatos');

// Aplicaciones registradas en dbo.tbl_aplicaciones y sus roles las aplicaciones se crean por medio de Script en BD 

// Todas las aplicaciones (también las inactivas) con sus roles. Sirve para armar la ficha del usuario en una sola llamada.
async function listarAplicacionesConRoles() {
    const aplicaciones = await baseDatos.query(
        `SELECT id, nombre, codigo, activo
         FROM dbo.tbl_aplicaciones
         ORDER BY nombre`,
        { type: QueryTypes.SELECT }
    );

    const roles = await baseDatos.query(
        `SELECT id, nombre, descripcion, activo, es_defecto_app, aplicacion_id
         FROM dbo.COTI_tbl_roles
         ORDER BY nombre`,
        { type: QueryTypes.SELECT }
    );

    for (const aplicacion of aplicaciones) {
        aplicacion.roles = roles
            .filter((rol) => rol.aplicacion_id === aplicacion.id)
            .map((rol) => ({
                id: rol.id,
                nombre: rol.nombre,
                descripcion: rol.descripcion,
                activo: rol.activo,
                es_defecto_app: rol.es_defecto_app
            }));
    }

    return aplicaciones;
}

// Una aplicación por id, o null si no existe
async function buscarAplicacion(idAplicacion, transaccion = null) {
    const filas = await baseDatos.query(
        `SELECT id, nombre, codigo, activo
         FROM dbo.tbl_aplicaciones
         WHERE id = :id`,
        { replacements: { id: idAplicacion }, type: QueryTypes.SELECT, transaction: transaccion }
    );

    if (filas.length === 0) {
        return null;
    }
    return filas[0];
}

// Roles de una aplicación (activos e inactivos)
async function buscarRolesDeAplicacion(idAplicacion, transaccion = null) {
    return baseDatos.query(
        `SELECT id, nombre, activo
         FROM dbo.COTI_tbl_roles
         WHERE aplicacion_id = :aplicacion_id`,
        { replacements: { aplicacion_id: idAplicacion }, type: QueryTypes.SELECT, transaction: transaccion }
    );
}

module.exports = { listarAplicacionesConRoles, buscarAplicacion, buscarRolesDeAplicacion };
