// Código de esta aplicación en dbo.tbl_aplicaciones.
const CODIGO_APLICACION = 'CONTROL_USUARIOS';

// Permiso que define a un "administrador" del Control de Usuarios.
// Siempre debe quedar al menos un usuario activo que lo tenga.
const PERMISO_ADMINISTRADOR = 'roles.editar_permisos';

// Solo cuentas de la empresa: todos entran con su cuenta de Microsoft
const DOMINIO_CORREO = '@codaca.com.gt';

module.exports = { CODIGO_APLICACION, PERMISO_ADMINISTRADOR, DOMINIO_CORREO };
