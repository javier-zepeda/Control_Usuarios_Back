const { QueryTypes } = require('sequelize');
const baseDatos = require('../config/baseDatos');
const { CODIGO_APLICACION } = require('../config/aplicacion');

// Busca al usuario en la tabla compartida de usuarios
async function buscarUsuarioPorCorreo(correo) {
  const usuarios = await baseDatos.query(
    `SELECT id, nombre, email, activo
     FROM dbo.COTI_tbl_usuarios
     WHERE LOWER(email) = LOWER(:correo)`,
    { replacements: { correo: correo }, type: QueryTypes.SELECT }
  );

  if (usuarios.length === 0) {
    return null;
  }
  return usuarios[0];
}

// Roles del usuario, solo los del Control de Usuarios
async function buscarRoles(usuarioId) {
  const filas = await baseDatos.query(
    `SELECT r.nombre
     FROM dbo.COTI_tbl_usuario_rol ur
     JOIN dbo.COTI_tbl_roles r   ON r.id = ur.rol_id
     JOIN dbo.tbl_aplicaciones a ON a.id = r.aplicacion_id
     WHERE ur.usuario_id = :usuarioId
       AND a.codigo = :codigoAplicacion
       AND r.activo = 1
       AND a.activo = 1`,
    { replacements: { usuarioId: usuarioId, codigoAplicacion: CODIGO_APLICACION }, type: QueryTypes.SELECT }
  );

  return filas.map((fila) => fila.nombre);
}

// Permisos que le dan todos sus roles del Control de Usuarios (sin repetir)
async function buscarPermisos(usuarioId) {
  const filas = await baseDatos.query(
    `SELECT DISTINCT p.nombre
     FROM dbo.COTI_tbl_usuario_rol ur
     JOIN dbo.COTI_tbl_roles r        ON r.id = ur.rol_id
     JOIN dbo.COTI_tbl_rol_permiso rp ON rp.rol_id = r.id
     JOIN dbo.COTI_tbl_permisos p     ON p.id = rp.permiso_id
     JOIN dbo.tbl_aplicaciones a      ON a.id = r.aplicacion_id
     WHERE ur.usuario_id = :usuarioId
       AND a.codigo = :codigoAplicacion
       AND p.aplicacion_id = a.id
       AND r.activo = 1
       AND a.activo = 1`,
    { replacements: { usuarioId: usuarioId, codigoAplicacion: CODIGO_APLICACION }, type: QueryTypes.SELECT }
  );

  return filas.map((fila) => fila.nombre);
}

// Arma el perfil del usuario para el Control de Usuarios.
// Devuelve null si el usuario no existe, está inactivo o no tiene ningún rol aquí.
async function obtenerPerfil(correo) {
  const usuario = await buscarUsuarioPorCorreo(correo);

  if (usuario === null) {
    return null;
  }
  if (!usuario.activo) {
    return null;
  }

  const roles = await buscarRoles(usuario.id);

  // Sin rol en el Control de Usuarios = sin acceso, aunque tenga roles en otras aplicaciones
  if (roles.length === 0) {
    return null;
  }

  const permisos = await buscarPermisos(usuario.id);

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.email,
    roles: roles,
    permisos: permisos
  };
}

module.exports = { obtenerPerfil };