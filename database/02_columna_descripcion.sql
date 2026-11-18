/* =============================================================================
   CONTROL DE USUARIOS - 02. Columna "descripcion" en roles y permisos
   -----------------------------------------------------------------------------
   1. Agrega la columna descripcion VARCHAR(300) NULL a las dos tablas.
      - Acepta vacíos: lo que ya existe sigue funcionando igual.s
   2. Llena las descripciones de Control de Usuarios y de Pases
      (las de Pases se copian de Pases_Salida_Back/src/config/descripcionesSeguridad.js).
      Las demás aplicaciones quedan vacías: se llenan desde la pantalla.

   - Solo llena las descripciones que están vacías: si alguien ya escribió una,
     no se la cambia.
   - Se puede ejecutar varias veces: no duplica nada.
   ============================================================================= */
USE [Dev-QA];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;          -- si algo falla, se deshace todo
SET QUOTED_IDENTIFIER ON;   -- lo exige un índice filtrado de COTI_tbl_roles
GO

/* ---------------------------------------------------------------------------
   1. Columnas
   Van en su propio bloque (GO): SQL Server no deja usar una columna en el
   mismo bloque en que se crea.
   --------------------------------------------------------------------------- */
IF COL_LENGTH('dbo.COTI_tbl_roles', 'descripcion') IS NULL
    ALTER TABLE dbo.COTI_tbl_roles ADD descripcion VARCHAR(300) NULL;

IF COL_LENGTH('dbo.COTI_tbl_permisos', 'descripcion') IS NULL
    ALTER TABLE dbo.COTI_tbl_permisos ADD descripcion VARCHAR(300) NULL;
GO

/* ---------------------------------------------------------------------------
   2. Descripciones
   --------------------------------------------------------------------------- */
BEGIN TRANSACTION;

-- aplicacion = código en dbo.tbl_aplicaciones
DECLARE @roles TABLE (aplicacion VARCHAR(20), nombre VARCHAR(100), descripcion VARCHAR(300),
                      PRIMARY KEY (aplicacion, nombre));
INSERT INTO @roles (aplicacion, nombre, descripcion) VALUES
    -- Control de Usuarios
    ('CONTROL_USUARIOS', 'Administrador IT', 'Solo para IT: todo, en todas las aplicaciones'),

    -- Pases de Salida
    ('PASES_TALLER', 'Administrador IT', 'Solo para IT: todo, incluido cambiar los permisos de los roles'),
    ('PASES_TALLER', 'Administrador',    'Todo: pases de todos los talleres, catálogos y administración de usuarios (no cambia permisos de roles)'),
    ('PASES_TALLER', 'Administrativo',   'Pases de todos los talleres: crea, edita (también autorizados), autoriza e imprime'),
    ('PASES_TALLER', 'Jefe de Taller',   'Pases de sus talleres: crea, edita los pendientes, autoriza prueba en carretera, vehículo interno, suministros y traslado, e imprime'),
    ('PASES_TALLER', 'Receptor',         'Pases de sus talleres: crea, edita los pendientes e imprime'),
    ('PASES_TALLER', 'Cajero',           'Pases de sus talleres: autoriza unidad terminada e imprime'),
    ('PASES_TALLER', 'Cajero Receptor',  'Pases de sus talleres: crea, edita, autoriza unidad terminada (también al crear con factura) e imprime');

DECLARE @permisos TABLE (aplicacion VARCHAR(20), nombre VARCHAR(100), descripcion VARCHAR(300),
                         PRIMARY KEY (aplicacion, nombre));
INSERT INTO @permisos (aplicacion, nombre, descripcion) VALUES
    -- Control de Usuarios
    ('CONTROL_USUARIOS', 'usuarios.ver',           'Ver usuarios y sus accesos'),
    ('CONTROL_USUARIOS', 'usuarios.crear',         'Crear usuarios'),
    ('CONTROL_USUARIOS', 'usuarios.editar',        'Cambiar el nombre y activar o desactivar usuarios'),
    ('CONTROL_USUARIOS', 'usuarios.asignar_roles', 'Dar y quitar roles en cualquier aplicación'),
    ('CONTROL_USUARIOS', 'roles.ver',              'Ver los roles y los permisos de cada aplicación'),
    ('CONTROL_USUARIOS', 'roles.editar',           'Crear, renombrar y activar o desactivar roles, y editar descripciones'),
    ('CONTROL_USUARIOS', 'roles.editar_permisos',  'Cambiar qué permisos tiene un rol (afecta a todos los que lo tienen)'),
    ('CONTROL_USUARIOS', 'bitacora.ver',           'Ver la bitácora'),

    -- Pases de Salida
    ('PASES_TALLER', 'pases.ver',                        'Ver pases de sus talleres'),
    ('PASES_TALLER', 'pases.ver_todos',                  'Ver pases de todos los talleres (no necesita talleres asignados)'),
    ('PASES_TALLER', 'pases.crear',                      'Crear pases'),
    ('PASES_TALLER', 'pases.editar',                     'Editar pases pendientes de autorizar'),
    ('PASES_TALLER', 'pases.editar_autorizado',          'Editar pases ya autorizados'),
    ('PASES_TALLER', 'pases.autorizar',                  'Autorizar pases de todos los tipos'),
    ('PASES_TALLER', 'pases.autorizar_unidad_terminada', 'Autorizar pases de unidad terminada'),
    ('PASES_TALLER', 'pases.autorizar_operativos',       'Autorizar pases de prueba en carretera, vehículo interno, suministros y traslado'),
    ('PASES_TALLER', 'pases.autorizar_al_crear',         'Ya no se usa: los pases ya no se autorizan al crear'),
    ('PASES_TALLER', 'pases.autorizar_con_pendientes',   'Autorizar aunque haya órdenes pendientes en Integra'),
    ('PASES_TALLER', 'pases.anular',                     'Anular pases'),
    ('PASES_TALLER', 'pases.imprimir',                   'Imprimir pases'),
    ('PASES_TALLER', 'historial.ver',                    'Ver el historial de órdenes por vehículo o cliente'),
    ('PASES_TALLER', 'catalogos.ver',                    'Ver sedes y talleres'),
    ('PASES_TALLER', 'catalogos.editar',                 'Crear y editar sedes y talleres'),
    ('PASES_TALLER', 'usuarios.ver',                     'Ver usuarios, roles y permisos'),
    ('PASES_TALLER', 'usuarios.asignar_rol',             'Agregar usuarios y asignarles roles y talleres'),
    ('PASES_TALLER', 'roles.editar_permisos',            'Cambiar los permisos de un rol (afecta a todos los que lo tienen)');

-- Roles: solo los que no tienen descripción
UPDATE r
SET r.descripcion = d.descripcion
FROM dbo.COTI_tbl_roles r
JOIN dbo.tbl_aplicaciones a ON a.id = r.aplicacion_id
JOIN @roles d               ON d.aplicacion = a.codigo AND d.nombre = r.nombre
WHERE r.descripcion IS NULL;

PRINT CONCAT(N'Roles con descripción nueva: ', @@ROWCOUNT);

-- Permisos: solo los que no tienen descripción
UPDATE p
SET p.descripcion = d.descripcion
FROM dbo.COTI_tbl_permisos p
JOIN dbo.tbl_aplicaciones a ON a.id = p.aplicacion_id
JOIN @permisos d            ON d.aplicacion = a.codigo AND d.nombre = p.nombre
WHERE p.descripcion IS NULL;

PRINT CONCAT(N'Permisos con descripción nueva: ', @@ROWCOUNT);

COMMIT TRANSACTION;
GO

/* ---------------------------------------------------------------------------
   Revisión
   --------------------------------------------------------------------------- */
-- Cuántos roles y permisos tienen descripción, por aplicación
-- (Control de Usuarios: 1 rol y 8 permisos; Pases: 7 roles y sus permisos;
--  las demás en 0)
SELECT a.codigo,
       (SELECT COUNT(*) FROM dbo.COTI_tbl_roles r
        WHERE r.aplicacion_id = a.id AND r.descripcion IS NOT NULL)    AS roles_con_descripcion,
       (SELECT COUNT(*) FROM dbo.COTI_tbl_roles r
        WHERE r.aplicacion_id = a.id)                                  AS roles_total,
       (SELECT COUNT(*) FROM dbo.COTI_tbl_permisos p
        WHERE p.aplicacion_id = a.id AND p.descripcion IS NOT NULL)    AS permisos_con_descripcion,
       (SELECT COUNT(*) FROM dbo.COTI_tbl_permisos p
        WHERE p.aplicacion_id = a.id)                                  AS permisos_total
FROM dbo.tbl_aplicaciones a
ORDER BY a.id;

-- Permisos de Pases que quedaron sin descripción (debería salir vacío)
SELECT p.nombre
FROM dbo.COTI_tbl_permisos p
JOIN dbo.tbl_aplicaciones a ON a.id = p.aplicacion_id
WHERE a.codigo = 'PASES_TALLER' AND p.descripcion IS NULL;
GO
