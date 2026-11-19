// Error que se lanza cuando no se cumple una regla (por ejemplo: "el correo ya existe").
//estado → 400 dato inválido, 404 no existe, 409 choca con algo que ya existe

class ErrorDeRegla extends Error {
    constructor(mensaje, estado = 400, extra = {}) {
        super(mensaje);
        this.estado = estado;
        this.extra = extra;
    }
}

// Responde un error al front  Si es otro error: 500 con un mensaje general (el detalle solo va a la consola).
function responderError(res, error, mensajeGeneral) {
    if (error instanceof ErrorDeRegla) {
        return res.status(error.estado).json({ mensaje: error.message, ...error.extra });
    }

    console.error(mensajeGeneral + ':', error.message);
    return res.status(500).json({ mensaje: mensajeGeneral });
}

module.exports = { ErrorDeRegla, responderError };
