// GET /api/sesion/perfil Devuelve quién es el usuario
function obtenerMiPerfil(req, res) {
  res.json(req.usuario);
}

module.exports = { obtenerMiPerfil };