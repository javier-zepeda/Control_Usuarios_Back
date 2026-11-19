const { QueryTypes } = require('sequelize');
const baseDatos = require('../config/baseDatos');
const { CODIGO_APLICACION, PERMISO_ADMINISTRADOR } = require('../config/aplicacion');
const { ErrorDeRegla } = require('../helpers/errores.helper');

// Protecciones para que el Control de Usuarios nunca se quede sin administrador EL Control de Usuarios, 
// el permiso roles.editar_permisos.


async function contarAdministradores(transaccion) {
    const filas = await baseDatos.query(
        `SELECT COUNT(DISTINCT u.id) AS total
         FROM dbo.COTI_tbl_usuario_rol ur WITH (UPDLOCK, HOLDLOCK)
         JOIN dbo.COTI_tbl_usuarios u     ON u.id = ur.usuario_id
         JOIN dbo.COTI_tbl_roles r        ON r.id = ur.rol_id
         JOIN dbo.tbl_aplicaciones a      ON a.id = r.aplicacion_id
         JOIN dbo.COTI_tbl_rol_permiso rp ON rp.rol_id = r.id
         JOIN dbo.COTI_tbl_permisos p     ON p.id = rp.permiso_id
         WHERE a.codigo = :codigo
           AND p.nombre = :permiso
           AND u.activo = 1
           AND r.activo = 1
           AND a.activo = 1`,
        {
            replacements: { codigo: CODIGO_APLICACION, permiso: PERMISO_ADMINISTRADOR },
            type: QueryTypes.SELECT,
            transaction: transaccion
        }
    );

    return filas[0].total;
}

// Lanza un error si, con los cambios de la transacción, no quedó ningún administrador
async function revisarQueQuedeAdministrador(transaccion) {
    const total = await contarAdministradores(transaccion);

    if (total === 0) {
        throw new ErrorDeRegla(
            'No se puede: el Control de Usuarios se quedaría sin administrador. ' +
            'Dele el rol Administrador IT a otra persona antes.',
            409
        );
    }
}

module.exports = { revisarQueQuedeAdministrador };
