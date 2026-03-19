// CONFIGURAÇÃO DE EMAIL — Resend
const emailConfig = {
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY
    },
    emailEmpresa: process.env.EMAIL_EMPRESA || 'christian.serello@starbank.tec.br',
    from: process.env.EMAIL_FROM || '"StarCard" <onboarding@resend.dev>'
};

module.exports = emailConfig;
