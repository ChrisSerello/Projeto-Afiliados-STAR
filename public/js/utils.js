// utils.js — Funções utilitárias compartilhadas entre as páginas

/**
 * Formata string de CPF para "000.000.000-00"
 */
function formatarCPF(valor) {
    return valor
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
        .slice(0, 14);
}

/**
 * Formata string de telefone para "(00) 00000-0000"
 */
function formatarTelefone(valor) {
    return valor
        .replace(/\D/g, '')
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d{4})$/, '$1-$2')
        .slice(0, 15);
}

/**
 * Valida CPF incluindo os dígitos verificadores.
 * @returns {boolean}
 */
function validarCPF(cpf) {
    const numeros = cpf.replace(/\D/g, '');
    if (numeros.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(numeros)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(numeros[i]) * (10 - i);
    let d1 = (soma * 10) % 11;
    if (d1 === 10 || d1 === 11) d1 = 0;
    if (d1 !== parseInt(numeros[9])) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(numeros[i]) * (11 - i);
    let d2 = (soma * 10) % 11;
    if (d2 === 10 || d2 === 11) d2 = 0;
    return d2 === parseInt(numeros[10]);
}

/**
 * Valida formato de email.
 * @returns {boolean}
 */
function validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Aplica máscara de CPF num input ao digitar.
 * Uso: inputEl.addEventListener('input', e => e.target.value = mascaraCPF(e.target.value))
 */
function mascaraCPF(e) {
    e.target.value = formatarCPF(e.target.value);
}

/**
 * Aplica máscara de telefone num input ao digitar.
 */
function mascaraTelefone(e) {
    e.target.value = formatarTelefone(e.target.value);
}

// Aliases em inglês para compatibilidade com código legado
const formatCPF = formatarCPF;
const formatPhone = formatarTelefone;
const validateCPF = validarCPF;
const validateEmail = validarEmail;
