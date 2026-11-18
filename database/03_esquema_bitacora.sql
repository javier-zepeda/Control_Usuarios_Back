/* =============================================================================
   CONTROL DE USUARIOS - 03. Esquema Control_Usuarios y tabla bitacora
   -----------------------------------------------------------------------------
   Tablas nuevas Control_Usuarios.bitacora → quién cambió qué, cuándo y en qué aplicación

   - Cada cambio que haga el Control de Usuarios se guarda aquí, en la misma
     transacción que el cambio: si falla uno, no se guarda ninguno.
   - "antes" y "despues" guardan cómo estaba y cómo quedó, en JSON.
   - Los renglones nunca se editan ni se borran: solo se agregan.
   - No toca ninguna tabla existente.
   - Se puede ejecutar varias veces: no duplica nada.
   ============================================================================= */
USE [Dev-QA];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ---------------------------------------------------------------------------
   Esquema
   CREATE SCHEMA tiene que ir solo en su bloque; por eso va dentro de EXEC.
   --------------------------------------------------------------------------- */
IF SCHEMA_ID(N'Control_Usuarios') IS NULL
    EXEC (N'CREATE SCHEMA Control_Usuarios AUTHORIZATION dbo');
GO

/* ---------------------------------------------------------------------------
   Bitácora

   accion: qué se hizo
       USUARIO_CREAR, USUARIO_EDITAR, USUARIO_ACTIVAR, USUARIO_DESACTIVAR,
       ROLES_USUARIO_CAMBIAR,
       ROL_CREAR, ROL_EDITAR, ROL_ACTIVAR, ROL_DESACTIVAR, PERMISOS_ROL_CAMBIAR,
       PERMISO_DESCRIPCION
     (no lleva CHECK: si después se agrega una acción, no hay que cambiar la tabla)

   tipo_objeto + objeto_id: a qué se le hizo el cambio
       USUARIO → id de dbo.COTI_tbl_usuarios
       ROL     → id de dbo.COTI_tbl_roles
       PERMISO → id de dbo.COTI_tbl_permisos
     (objeto_id no lleva llave foránea porque puede apuntar a tres tablas)
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'Control_Usuarios.bitacora', N'U') IS NULL
CREATE TABLE Control_Usuarios.bitacora (
    id_bitacora    BIGINT IDENTITY(1,1) NOT NULL,
    fecha          DATETIME2(3)  NOT NULL CONSTRAINT DF_bitacora_fecha DEFAULT (SYSDATETIME()),
    usuario_id     INT           NOT NULL,   -- quién hizo el cambio
    correo         VARCHAR(150)  NOT NULL,   -- su correo en ese momento
    accion         VARCHAR(40)   NOT NULL,
    aplicacion_id  INT           NULL,       -- vacío si el cambio no es de una aplicación (por ejemplo, desactivar un usuario)
    tipo_objeto    VARCHAR(20)   NOT NULL,
    objeto_id      INT           NOT NULL,
    descripcion    NVARCHAR(500) NOT NULL,   -- texto que se lee fácil: "Le dio el rol Cajero en Pases a Juan Pérez"
    antes          NVARCHAR(MAX) NULL,       -- JSON: cómo estaba
    despues        NVARCHAR(MAX) NULL,       -- JSON: cómo quedó
    CONSTRAINT PK_bitacora             PRIMARY KEY CLUSTERED (id_bitacora),
    CONSTRAINT FK_bitacora_usuario     FOREIGN KEY (usuario_id)    REFERENCES dbo.COTI_tbl_usuarios (id),
    CONSTRAINT FK_bitacora_aplicacion  FOREIGN KEY (aplicacion_id) REFERENCES dbo.tbl_aplicaciones (id),
    CONSTRAINT CK_bitacora_tipo_objeto CHECK (tipo_objeto IN ('USUARIO', 'ROL', 'PERMISO')),
    CONSTRAINT CK_bitacora_antes       CHECK (antes   IS NULL OR ISJSON(antes)   = 1),
    CONSTRAINT CK_bitacora_despues     CHECK (despues IS NULL OR ISJSON(despues) = 1)
);
GO

/* ---------------------------------------------------------------------------
   Índices para los filtros de la pantalla Bitácora
   --------------------------------------------------------------------------- */
-- Por fecha (la lista normal, lo más reciente primero)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_bitacora_fecha' AND object_id = OBJECT_ID(N'Control_Usuarios.bitacora'))
    CREATE INDEX IX_bitacora_fecha ON Control_Usuarios.bitacora (fecha DESC);

-- Historial de un usuario, rol o permiso (por ejemplo, abajo en la ficha del usuario)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_bitacora_objeto' AND object_id = OBJECT_ID(N'Control_Usuarios.bitacora'))
    CREATE INDEX IX_bitacora_objeto ON Control_Usuarios.bitacora (tipo_objeto, objeto_id, fecha DESC);

-- Lo que hizo una persona de IT
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_bitacora_usuario' AND object_id = OBJECT_ID(N'Control_Usuarios.bitacora'))
    CREATE INDEX IX_bitacora_usuario ON Control_Usuarios.bitacora (usuario_id, fecha DESC);

-- Lo que cambió en una aplicación
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_bitacora_aplicacion' AND object_id = OBJECT_ID(N'Control_Usuarios.bitacora'))
    CREATE INDEX IX_bitacora_aplicacion ON Control_Usuarios.bitacora (aplicacion_id, fecha DESC);
GO

/* ---------------------------------------------------------------------------
   Revisión
   --------------------------------------------------------------------------- */
-- Columnas de la tabla
SELECT COLUMN_NAME AS columna, DATA_TYPE AS tipo, CHARACTER_MAXIMUM_LENGTH AS largo, IS_NULLABLE AS acepta_vacio
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'Control_Usuarios' AND TABLE_NAME = 'bitacora'
ORDER BY ORDINAL_POSITION;

-- Índices (deben salir PK_bitacora y los 4 IX_)
SELECT name AS indice
FROM sys.indexes
WHERE object_id = OBJECT_ID(N'Control_Usuarios.bitacora') AND name IS NOT NULL
ORDER BY name;
GO
