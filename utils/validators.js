// Validações compartilhadas do servidor

/**
 * Valida CPF incluindo os dígitos verificadores.
 * @param {string} cpf - CPF com ou sem formatação
 * @returns {boolean}
 */
function validarCPF(cpf) {
    const numeros = String(cpf).replace(/\D/g, '');

    if (numeros.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(numeros)) return false; // ex: 111.111.111-11

    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(numeros[i]) * (10 - i);
    let digito1 = (soma * 10) % 11;
    if (digito1 === 10 || digito1 === 11) digito1 = 0;
    if (digito1 !== parseInt(numeros[9])) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(numeros[i]) * (11 - i);
    let digito2 = (soma * 10) % 11;
    if (digito2 === 10 || digito2 === 11) digito2 = 0;
    return digito2 === parseInt(numeros[10]);
}

/**
 * Valida formato de email.
 * @param {string} email
 * @returns {boolean}
 */
function validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
}

/**
 * Valida que a string não está vazia após trim.
 * @param {string} valor
 * @returns {boolean}
 */
function naoVazio(valor) {
    return typeof valor === 'string' && valor.trim().length > 0;
}

module.exports = { validarCPF, validarEmail, naoVazio };
