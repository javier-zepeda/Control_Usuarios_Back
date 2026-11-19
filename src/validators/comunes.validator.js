// Funciones de validación generales que usan todos los validadores.
// Cada validador devuelve { errores, datos }:

// Texto sin espacios al inicio ni al final ('' si no es texto)
function limpiarTexto(valor) {
    if (typeof valor !== 'string') {
        return '';
    }
    return valor.trim();
}

function validarObligatorio(errores, valor, nombreCampo, largoMaximo) {
    if (valor === '') {
        errores.push('El campo «' + nombreCampo + '» es obligatorio');
        return;
    }
    if (valor.length > largoMaximo) {
        errores.push('El campo «' + nombreCampo + '» admite máximo ' + largoMaximo + ' caracteres');
    }
}

// Un número entero positivo (por ejemplo, el :id de la ruta), o null si no es válido
function leerId(valor) {
    const numero = Number(valor);

    if (!Number.isInteger(numero) || numero < 1) {
        return null;
    }
    return numero;
}

// Una lista de números enteros positivos, sin repetidos.
// Si no viene, se toma como vacía. Si no es una lista o trae algo raro, agrega un error.
function leerListaDeIds(errores, valor, nombreCampo) {
    if (valor === undefined || valor === null) {
        return [];
    }
    if (!Array.isArray(valor)) {
        errores.push('La lista de ' + nombreCampo + ' no es válida');
        return [];
    }

    const ids = [];
    for (const elemento of valor) {
        const numero = leerId(elemento);

        if (numero === null) {
            errores.push('La lista de ' + nombreCampo + ' no es válida');
            return [];
        }
        if (!ids.includes(numero)) {
            ids.push(numero);
        }
    }
    return ids;
}

module.exports = { limpiarTexto, validarObligatorio, leerId, leerListaDeIds };
