const { Router } = require('express');
const baseDatos = require('../config/baseDatos');
const sesionRoutes = require('./sesion.routes');
const aplicacionesRoutes = require('./aplicaciones.routes');
const usuariosRoutes = require('./usuarios.routes');

const router = Router();

// Prueba de conexión a la base de datos
router.get('/salud', async (req, res) => {
    try {
        await baseDatos.authenticate();
        res.json({ estado: 'ok', baseDatos: 'conectada' });
    } catch (error) {
        res.status(500).json({ estado: 'error', baseDatos: 'sin conexión', detalle: error.message });
    }
});

// Quién entró: /api/sesion/perfil
router.use('/sesion', sesionRoutes);

// Aplicaciones con sus roles: /api/aplicaciones
router.use('/aplicaciones', aplicacionesRoutes);

// Usuarios y sus accesos: /api/usuarios
router.use('/usuarios', usuariosRoutes);

module.exports = router;
