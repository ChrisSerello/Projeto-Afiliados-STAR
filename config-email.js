// CONFIGURAÇÃO DE EMAIL
// Substitua estes valores com suas informações reais

const emailConfig = {
    // Configuração do serviço de email
    service: 'gmail', // Opções: 'gmail', 'outlook', 'yahoo', ou configure com SMTP customizado
    
    // Credenciais de autenticação
    auth: {
        user: 'seu-email@gmail.com', // SEU EMAIL QUE ENVIARÁ AS MENSAGENS
        pass: 'sua-senha-app' // SENHA DE APLICAÇÃO (não é sua senha normal!)
    },
    
    // Email da empresa que receberá as notificações
    emailEmpresa: 'christian.serello@starbank.tec.br', // EMAIL DA SUA EMPRESA
    
    // Configurações adicionais (opcional)
    from: '"Sistema de Afiliados" <seu-email@gmail.com>' // Nome que aparecerá no remetente
};

// INSTRUÇÕES DE CONFIGURAÇÃO:

/*
PARA GMAIL:
1. Ative a verificação em duas etapas na sua conta Google
2. Acesse: https://myaccount.google.com/apppasswords
3. Selecione "App" = "Outro (nome personalizado)"
4. Digite "Sistema de Afiliados" e clique em Gerar
5. Use a senha gerada no campo 'pass' acima

PARA OUTLOOK/HOTMAIL:
1. Use as mesmas configurações, mas service: 'outlook'
2. Você pode precisar gerar uma senha de aplicação também

PARA OUTROS SERVIÇOS:
Use configuração SMTP customizada:

const emailConfig = {
    host: 'smtp.seuprovedor.com',
    port: 587,
    secure: false,
    auth: {
        user: 'seu-email@dominio.com',
        pass: 'sua-senha'
    }
};
*/

module.exports = emailConfig;
