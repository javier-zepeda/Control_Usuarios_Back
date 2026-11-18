/* =============================================================================
   CONTROL DE USUARIOS - 01. Aplicación, roles y permisos
   -----------------------------------------------------------------------------
   Registra el Control de Usuarios como una aplicación más del Portal, usando

   1. Aplicación "Control de Usuarios" con código 'CONTROL_USUARIOS'.
   2. Sus 8 permisos.
   3. Rol "Administrador IT" con todos los permisos.
   4. Primer administrador: las personas de la lista de correos (ya deben
      existir en COTI_tbl_usuarios). Es el único acceso que se da por script.

   ============================================================================= */
USE [Dev-QA];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;          -- si algo falla, se deshace todo
SET QUOTED_IDENTIFIER ON;   -- lo exige un índice filtrado de COTI_tbl_roles
GO

BEGIN TRANSACTION;

/* ---------------------------------------------------------------------------
   Correos de IT que tendrán el rol Administrador IT (cambiar según el ambiente)
   --------------------------------------------------------------------------- */
DECLARE @correos_it TABLE (correo VARCHAR(150) PRIMARY KEY);
INSERT INTO @correos_it (correo) VALUES
    ('javier_zepeda@codaca.com.gt');

IF EXISTS (SELECT 1 FROM @correos_it c
           WHERE NOT EXISTS (SELECT 1 FROM dbo.COTI_tbl_usuarios u
                             WHERE LOWER(u.email) = LOWER(c.correo) AND u.activo = 1))
    THROW 50000, N'Uno de los correos de IT no existe en COTI_tbl_usuarios o está inactivo.', 1;

/* ---------------------------------------------------------------------------
   1. Aplicación
   Se busca por código y no por id, porque el id cambia entre ambientes.
   --------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.tbl_aplicaciones WHERE codigo = 'CONTROL_USUARIOS')
    INSERT INTO dbo.tbl_aplicaciones (nombre, codigo, activo)
    VALUES ('Control de Usuarios', 'CONTROL_USUARIOS', 1);

DECLARE @app_id INT = (SELECT id FROM dbo.tbl_aplicaciones WHERE codigo = 'CONTROL_USUARIOS');

PRINT CONCAT(N'Aplicación CONTROL_USUARIOS -> id ', @app_id);

/* ---------------------------------------------------------------------------
   2. Permisos
   --------------------------------------------------------------------------- */
DECLARE @permisos TABLE (nombre VARCHAR(100) PRIMARY KEY);
INSERT INTO @permisos (nombre) VALUES
    ('usuarios.ver'),             -- ver usuarios y sus accesos
    ('usuarios.crear'),           -- crear usuarios
    ('usuarios.editar'),          -- cambiar el nombre, activar y desactivar
    ('usuarios.asignar_roles'),   -- dar y quitar roles en cualquier aplicación
    ('roles.ver'),                -- ver roles y permisos de cada aplicación
    ('roles.editar'),             -- crear, renombrar, activar/desactivar roles y editar descripciones
    ('roles.editar_permisos'),    -- cambiar qué permisos tiene un rol
    ('bitacora.ver');             -- ver la bitácora

INSERT INTO dbo.COTI_tbl_permisos (nombre, aplicacion_id)
SELECT p.nombre, @app_id
FROM @permisos p
WHERE NOT EXISTS (SELECT 1 FROM dbo.COTI_tbl_permisos x
                  WHERE x.aplicacion_id = @app_id AND x.nombre = p.nombre);

/* ---------------------------------------------------------------------------
   3. Rol Administrador IT con todos los permisos de esta aplicación
   --------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.COTI_tbl_roles WHERE aplicacion_id = @app_id AND nombre = 'Administrador IT')
    INSERT INTO dbo.COTI_tbl_roles (nombre, activo, aplicacion_id, es_defecto_app)
    VALUES ('Administrador IT', 1, @app_id, 0);

DECLARE @rol_it INT = (SELECT id FROM dbo.COTI_tbl_roles
                       WHERE aplicacion_id = @app_id AND nombre = 'Administrador IT');

INSERT INTO dbo.COTI_tbl_rol_permiso (rol_id, permiso_id)
SELECT @rol_it, p.id
FROM dbo.COTI_tbl_permisos p
WHERE p.aplicacion_id = @app_id
  AND NOT EXISTS (SELECT 1 FROM dbo.COTI_tbl_rol_permiso rp
                  WHERE rp.rol_id = @rol_it AND rp.permiso_id = p.id);

/* ---------------------------------------------------------------------------
   4. Primer administrador (conserva los roles que ya tenía en otras apps)
   --------------------------------------------------------------------------- */
INSERT INTO dbo.COTI_tbl_usuario_rol (usuario_id, rol_id, es_defecto)
SELECT u.id, @rol_it, 0
FROM @correos_it c
JOIN dbo.COTI_tbl_usuarios u ON LOWER(u.email) = LOWER(c.correo)
WHERE NOT EXISTS (SELECT 1 FROM dbo.COTI_tbl_usuario_rol ur
                  WHERE ur.usuario_id = u.id AND ur.rol_id = @rol_it);

COMMIT TRANSACTION;
GO

/* ---------------------------------------------------------------------------
   Revisión
   --------------------------------------------------------------------------- */
-- La aplicación
SELECT id, nombre, codigo, activo
FROM dbo.tbl_aplicaciones
WHERE codigo = 'CONTROL_USUARIOS';

-- Roles con sus permisos (Administrador IT debe tener 8)
SELECT r.nombre AS rol, COUNT(rp.permiso_id) AS permisos
FROM dbo.COTI_tbl_roles r
JOIN dbo.tbl_aplicaciones a ON a.id = r.aplicacion_id AND a.codigo = 'CONTROL_USUARIOS'
LEFT JOIN dbo.COTI_tbl_rol_permiso rp ON rp.rol_id = r.id
GROUP BY r.nombre;

-- Quiénes tienen el rol Administrador IT
SELECT u.id, u.nombre, u.email
FROM dbo.COTI_tbl_usuario_rol ur
JOIN dbo.COTI_tbl_roles r    ON r.id = ur.rol_id
JOIN dbo.COTI_tbl_usuarios u ON u.id = ur.usuario_id
JOIN dbo.tbl_aplicaciones a  ON a.id = r.aplicacion_id
WHERE a.codigo = 'CONTROL_USUARIOS' AND r.nombre = 'Administrador IT';
GO
