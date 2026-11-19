const baseDatos = require('../config/baseDatos');

// Bitácora del Control de Usuarios (tabla Control_Usuarios.bitacora).

// Largo de la columna descripcion
const LARGO_DESCRIPCION = 500;

// Guarda un renglón en la bitácora.
//   transaccion → la transacción del cambio
//   operador    → quien hace el cambio (req.usuario)
//   datos       → {
//       accion:       'USUARIO_CREAR', 'ROLES_USUARIO_CAMBIAR', ...
//       aplicacionId: id de la aplicación, o null si el cambio no es de una aplicación
//       tipoObjeto:   'USUARIO', 'ROL' o 'PERMISO'
//       objetoId:     id del usuario, rol o permiso
//       descripcion:  texto que se lee fácil
//       antes:        cómo estaba (objeto), o null
//       despues:      cómo quedó (objeto), o null
//   }

async function registrar(transaccion, operador, datos) {
    await baseDatos.query(
        `INSERT INTO Control_Usuarios.bitacora
            (usuario_id, correo, accion, aplicacion_id, tipo_objeto, objeto_id, descripcion, antes, despues)
         VALUES
            (:usuario_id, :correo, :accion, :aplicacion_id, :tipo_objeto, :objeto_id, :descripcion, :antes, :despues)`,
        {
            replacements: {
                usuario_id: operador.id,
                correo: operador.correo,
                accion: datos.accion,
                aplicacion_id: datos.aplicacionId,
                tipo_objeto: datos.tipoObjeto,
                objeto_id: datos.objetoId,
                descripcion: datos.descripcion.slice(0, LARGO_DESCRIPCION),
                antes: aJson(datos.antes),
                despues: aJson(datos.despues)
            },
            transaction: transaccion
        }
    );
}

function aJson(valor) {
    if (valor === null || valor === undefined) {
        return null;
    }
    return JSON.stringify(valor);
}

module.exports = { registrar };
