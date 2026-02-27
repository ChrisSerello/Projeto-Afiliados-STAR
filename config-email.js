// CONFIGURAÇÃO DE EMAIL — Resend
const emailConfig = {
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
        user: 'resend',
        pass: 're_jbSjyPP9_HjxYX2WAvY3kfmHrYCNF6nGK' // API Key do Resend
    },
    emailEmpresa: 'christian.serello@starbank.tec.br',
    from: '"StarCard" <onboarding@resend.dev>'
};

module.exports = emailConfig;