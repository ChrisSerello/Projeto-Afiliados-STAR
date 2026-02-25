const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const nodemailer = require('nodemailer');
const emailConfig = require('./config-email');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Configuração do email transport usando o arquivo de configuração
const transporter = nodemailer.createTransport(emailConfig);

// Configuração do Multer (upload de holerite)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `holerite-${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Formato inválido. Use PDF, JPG ou PNG.'));
    }
});

// Função para enviar notificação por email
async function enviarNotificacaoCliente(clienteData, afiliado) {
    try {
        const emailEmpresa = emailConfig.emailEmpresa;
        const emailKaique = 'kaique.silva@starbank.tec.br';
        
        const mailOptionsEmpresa = {
            from: emailConfig.from,
            to: emailEmpresa,
            subject: `Novo Cliente Cadastrado - ${clienteData.nome}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #667eea;">Novo Cliente Cadastrado!</h2>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <h3>Dados do Cliente:</h3>
                        <p><strong>Nome:</strong> ${clienteData.nome}</p>
                        <p><strong>Email:</strong> ${clienteData.email}</p>
                        <p><strong>Telefone:</strong> ${clienteData.telefone || 'Não informado'}</p>
                        <p><strong>CPF:</strong> ${clienteData.cpf || 'Não informado'}</p>
                        ${afiliado ? `
                        <h3>Dados do Afiliado:</h3>
                        <p><strong>Nome:</strong> ${afiliado.nome}</p>
                        <p><strong>Email:</strong> ${afiliado.email}</p>
                        <p><strong>Código:</strong> ${afiliado.codigo_afiliado}</p>
                        ` : '<p><strong>Cadastro direto (sem afiliado)</strong></p>'}
                    </div>
                    <p style="color: #666;">Data do cadastro: ${new Date().toLocaleString('pt-BR')}</p>
                </div>
            `
        };

        const mailOptionsKaique = {
            from: emailConfig.from,
            to: emailKaique,
            subject: `Novo Cliente Cadastrado - ${clienteData.nome}`,
            html: mailOptionsEmpresa.html
        };

        let mailOptionsAfiliado = null;
        if (afiliado && afiliado.email) {
            mailOptionsAfiliado = {
                from: emailConfig.from,
                to: afiliado.email,
                subject: `Novo Cliente Cadastrado - ${clienteData.nome}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #667eea;">Parabéns! Novo Cliente Cadastrado</h2>
                        <p>Um novo cliente se cadastrou através do seu link!</p>
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <h3>Dados do Cliente:</h3>
                            <p><strong>Nome:</strong> ${clienteData.nome}</p>
                            <p><strong>Email:</strong> ${clienteData.email}</p>
                            <p><strong>Telefone:</strong> ${clienteData.telefone || 'Não informado'}</p>
                            <p><strong>CPF:</strong> ${clienteData.cpf || 'Não informado'}</p>
                        </div>
                        <p style="color: #666;">Data do cadastro: ${new Date().toLocaleString('pt-BR')}</p>
                        <p>Continue compartilhando seu link para cadastrar mais clientes!</p>
                    </div>
                `
            };
        }

        const promises = [transporter.sendMail(mailOptionsEmpresa), transporter.sendMail(mailOptionsKaique)];
        if (mailOptionsAfiliado) promises.push(transporter.sendMail(mailOptionsAfiliado));

        await Promise.all(promises);
        console.log('Emails enviados com sucesso');
        return true;
    } catch (error) {
        console.error('Erro ao enviar emails:', error);
        return false;
    }
}

// Configuração do middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'secreto-sistema-afiliados',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

app.use('/assets', express.static(path.join(__dirname, 'public')));

// Configuração do banco de dados
const db = new sqlite3.Database('./afiliados.db');

// Criar tabelas
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS afiliados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        codigo_afiliado TEXT UNIQUE NOT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS links_cadastro (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_afiliado INTEGER NOT NULL,
        link_id TEXT UNIQUE NOT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_afiliado) REFERENCES afiliados (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT NOT NULL,
        telefone TEXT,
        cpf TEXT,
        id_afiliado INTEGER,
        codigo_afiliado TEXT,
        link_id TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_afiliado) REFERENCES afiliados (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expira_em DATETIME NOT NULL,
        usado INTEGER DEFAULT 0,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS formularios_servidor (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo_afiliado TEXT,
        nome_afiliado TEXT,
        nome_completo TEXT NOT NULL,
        cpf TEXT,
        data_nascimento TEXT,
        celular TEXT,
        orgao TEXT,
        tipo_vinculo TEXT,
        objetivo TEXT,
        bancos_atuais TEXT,
        holerite_path TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// ─── MIDDLEWARES DE AUTENTICAÇÃO ───────────────────────────────────────────

function verificarAutenticacao(req, res, next) {
    if (req.session.afiliadoId) return next();
    if (req.originalUrl.startsWith('/api')) return res.status(401).json({ erro: 'Não autenticado' });
    res.redirect('/login');
}

function verificarAdmin(req, res, next) {
    if (req.session.adminEmail) {
        const emailsAutorizados = ['christian.serello@starbank.tec.br', 'kaique.silva@starbank.tec.br'];
        if (emailsAutorizados.includes(req.session.adminEmail)) return next();
        req.session.destroy();
        res.redirect('/admin');
    } else {
        res.redirect('/admin');
    }
}

// ─── ROTAS PÚBLICAS ────────────────────────────────────────────────────────

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/esqueci-senha', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'esqueci-senha.html'));
});

app.get('/redefinir-senha', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'redefinir-senha.html'));
});

app.get('/formulario-starbank', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'formulario-starbank.html'));
});

// ─── AUTENTICAÇÃO ──────────────────────────────────────────────────────────

app.post('/login', (req, res) => {
    const { email, senha } = req.body;
    db.get('SELECT * FROM afiliados WHERE email = ?', [email], async (err, afiliado) => {
        if (err) return res.status(500).json({ erro: 'Erro no servidor' });
        if (!afiliado) return res.status(401).json({ erro: 'Email ou senha incorretos' });

        const senhaCorreta = await bcrypt.compare(senha, afiliado.senha);
        if (!senhaCorreta) return res.status(401).json({ erro: 'Email ou senha incorretos' });

        req.session.afiliadoId = afiliado.id;
        req.session.codigoAfiliado = afiliado.codigo_afiliado;

        req.session.save((err) => {
            if (err) return res.status(500).json({ erro: 'Erro ao salvar sessão' });
            res.json({ sucesso: true, redirect: '/dashboard' });
        });
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// ─── RESET DE SENHA ────────────────────────────────────────────────────────

app.post('/api/esqueci-senha', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ erro: 'E-mail obrigatório' });

    db.get('SELECT * FROM afiliados WHERE email = ?', [email], async (err, afiliado) => {
        if (err) return res.status(500).json({ erro: 'Erro no servidor' });
        if (!afiliado) return res.json({ sucesso: true }); // Não revelar e-mails

        const token = uuidv4();
        const expiraEm = new Date(Date.now() + 60 * 60 * 1000);

        db.run('INSERT INTO reset_tokens (email, token, expira_em) VALUES (?, ?, ?)',
            [email, token, expiraEm.toISOString()],
            async (err) => {
                if (err) return res.status(500).json({ erro: 'Erro ao gerar token' });

                const linkReset = `http://localhost:3000/redefinir-senha?token=${token}`;

                try {
                    await transporter.sendMail({
                        from: emailConfig.from,
                        to: email,
                        subject: 'StarCard - Redefinição de senha',
                        html: `
                            <div style="font-family: Inter, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #0f0620; color: #fff; border-radius: 16px; overflow: hidden;">
                                <div style="background: linear-gradient(135deg, #6b21a8, #a855f7); padding: 32px; text-align: center;">
                                    <h1 style="margin: 0; font-size: 24px;">🚀 starcard</h1>
                                </div>
                                <div style="padding: 32px;">
                                    <h2 style="margin: 0 0 12px;">Redefinição de senha</h2>
                                    <p style="color: rgba(255,255,255,0.6); line-height: 1.6; margin-bottom: 28px;">
                                        Clique no botão abaixo para criar uma nova senha.
                                    </p>
                                    <a href="${linkReset}" style="display: inline-block; background: linear-gradient(135deg, #6b21a8, #a855f7); color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px;">
                                        Redefinir minha senha
                                    </a>
                                    <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin-top: 24px;">
                                        Este link expira em 1 hora.
                                    </p>
                                </div>
                            </div>
                        `
                    });
                } catch (emailErr) {
                    console.error('Erro ao enviar email de reset:', emailErr);
                }

                res.json({ sucesso: true });
            }
        );
    });
});

app.post('/api/redefinir-senha', async (req, res) => {
    const { token, novaSenha } = req.body;
    if (!token || !novaSenha) return res.status(400).json({ erro: 'Dados incompletos' });
    if (novaSenha.length < 6) return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres' });

    db.get('SELECT * FROM reset_tokens WHERE token = ? AND usado = 0 AND expira_em > ?',
        [token, new Date().toISOString()],
        async (err, tokenData) => {
            if (err) return res.status(500).json({ erro: 'Erro no servidor' });
            if (!tokenData) return res.status(400).json({ erro: 'Link inválido ou expirado' });

            try {
                const senhaHash = await bcrypt.hash(novaSenha, 10);
                db.run('UPDATE afiliados SET senha = ? WHERE email = ?', [senhaHash, tokenData.email], (err) => {
                    if (err) return res.status(500).json({ erro: 'Erro ao atualizar senha' });
                    db.run('UPDATE reset_tokens SET usado = 1 WHERE token = ?', [token]);
                    res.json({ sucesso: true });
                });
            } catch (error) {
                res.status(500).json({ erro: 'Erro no servidor' });
            }
        }
    );
});

// ─── DASHBOARD DO AFILIADO ─────────────────────────────────────────────────

app.get('/dashboard', verificarAutenticacao, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/api/dados-afiliado', verificarAutenticacao, (req, res) => {
    const afiliadoId = req.session.afiliadoId;
    db.get('SELECT nome, email, codigo_afiliado FROM afiliados WHERE id = ?', [afiliadoId], (err, afiliado) => {
        if (err) return res.status(500).json({ erro: 'Erro no servidor' });
        db.get('SELECT COUNT(*) as total_clientes FROM clientes WHERE id_afiliado = ?', [afiliadoId], (err, resultado) => {
            if (err) return res.status(500).json({ erro: 'Erro no servidor' });
            res.json({
                afiliado,
                total_clientes: resultado.total_clientes,
                link_afiliado: `http://localhost:3000/?afiliado=${afiliado.codigo_afiliado}`
            });
        });
    });
});

app.get('/api/meus-clientes', verificarAutenticacao, (req, res) => {
    const afiliadoId = req.session.afiliadoId;
    db.all(`SELECT id, nome, email, telefone, cpf, criado_em, link_id FROM clientes WHERE id_afiliado = ? ORDER BY criado_em DESC`,
        [afiliadoId], (err, rows) => {
            if (err) return res.status(500).json({ erro: 'Erro no servidor' });
            res.json(rows);
        });
});

app.get('/api/cliente/:id', verificarAutenticacao, (req, res) => {
    const afiliadoId = req.session.afiliadoId;
    const clienteId = req.params.id;
    db.get(`SELECT c.*, a.nome as nome_afiliado, a.codigo_afiliado FROM clientes c LEFT JOIN afiliados a ON c.id_afiliado = a.id WHERE c.id = ? AND c.id_afiliado = ?`,
        [clienteId, afiliadoId], (err, cliente) => {
            if (err) return res.status(500).json({ erro: 'Erro no servidor' });
            if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });
            res.json(cliente);
        });
});

app.post('/api/gerar-link', verificarAutenticacao, async (req, res) => {
    const afiliadoId = req.session.afiliadoId;
    const linkId = uuidv4().substring(0, 12);
    try {
        db.run('INSERT INTO links_cadastro (id_afiliado, link_id) VALUES (?, ?)', [afiliadoId, linkId], function(err) {
            if (err) return res.status(500).json({ erro: 'Erro ao gerar link' });
            res.json({ sucesso: true, link: `http://localhost:3000/formulario?link=${linkId}`, link_id: linkId });
        });
    } catch (error) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// ─── FORMULÁRIO STARBANK ───────────────────────────────────────────────────

// API pública: buscar dados do afiliado pelo código (para pré-preencher o formulário)
app.get('/api/afiliado-publico', (req, res) => {
    const { codigo } = req.query;
    if (!codigo) return res.status(400).json({ erro: 'Código não informado' });

    db.get('SELECT nome, codigo_afiliado FROM afiliados WHERE codigo_afiliado = ?', [codigo], (err, afiliado) => {
        if (err) return res.status(500).json({ erro: 'Erro no servidor' });
        if (!afiliado) return res.status(404).json({ erro: 'Afiliado não encontrado' });
        res.json({ nome: afiliado.nome, codigo_afiliado: afiliado.codigo_afiliado });
    });
});

// API: receber formulário do servidor (com upload de holerite)
app.post('/api/enviar-formulario', upload.single('holerite'), async (req, res) => {
    try {
        const { codigo_afiliado, nome_afiliado, nome_completo, cpf, data_nascimento, celular, orgao, tipo_vinculo, objetivo, bancos_atuais } = req.body;

        if (!nome_completo || !cpf || !celular || !orgao || !tipo_vinculo || !objetivo) {
            return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
        }

        const holeriteFile = req.file ? req.file.filename : null;

        db.run(`INSERT INTO formularios_servidor (codigo_afiliado, nome_afiliado, nome_completo, cpf, data_nascimento, celular, orgao, tipo_vinculo, objetivo, bancos_atuais, holerite_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [codigo_afiliado, nome_afiliado, nome_completo, cpf, data_nascimento, celular, orgao, tipo_vinculo, objetivo, bancos_atuais, holeriteFile],
            async function(err) {
                if (err) return res.status(500).json({ erro: 'Erro ao salvar formulário.' });

                // Notificar por e-mail
                try {
                    const corpoEmail = `
                        <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: linear-gradient(135deg, #1e0a40, #6b21a8); padding: 28px; border-radius: 12px 12px 0 0; text-align: center;">
                                <h2 style="color: #fff; margin: 0;">🏦 StarBank — Novo Formulário</h2>
                                <p style="color: rgba(255,255,255,0.6); margin: 6px 0 0; font-size: 13px;">Benefício ao Servidor</p>
                            </div>
                            <div style="background: #f8f7ff; padding: 28px; border-radius: 0 0 12px 12px; border: 1px solid #e2e0f0;">
                                <h3 style="color: #6b21a8; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">👤 Afiliado</h3>
                                <p><strong>Nome:</strong> ${nome_afiliado || '—'}</p>
                                <p><strong>Código:</strong> ${codigo_afiliado || '—'}</p>
                                <hr style="border: none; border-top: 1px solid #e2e0f0; margin: 16px 0;">
                                <h3 style="color: #6b21a8; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">📋 Dados do Servidor</h3>
                                <p><strong>Nome:</strong> ${nome_completo}</p>
                                <p><strong>CPF:</strong> ${cpf}</p>
                                <p><strong>Nascimento:</strong> ${data_nascimento || '—'}</p>
                                <p><strong>Celular:</strong> ${celular}</p>
                                <p><strong>Órgão:</strong> ${orgao}</p>
                                <p><strong>Vínculo:</strong> ${tipo_vinculo}</p>
                                <hr style="border: none; border-top: 1px solid #e2e0f0; margin: 16px 0;">
                                <h3 style="color: #6b21a8; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">💰 Diagnóstico Financeiro</h3>
                                <p><strong>Objetivo:</strong> ${objetivo}</p>
                                <p><strong>Bancos atuais:</strong> ${bancos_atuais || 'Não informado'}</p>
                                ${holeriteFile ? `<p style="margin-top: 12px; color: #059669;">📎 Holerite anexado</p>` : ''}
                                <p style="color: #8b83b0; font-size: 12px; margin-top: 16px;">Recebido em: ${new Date().toLocaleString('pt-BR')}</p>
                            </div>
                        </div>
                    `;

                    const destinatarios = [emailConfig.emailEmpresa, 'kaique.silva@starbank.tec.br'];

                    if (codigo_afiliado) {
                        const afiliado = await new Promise((resolve) => {
                            db.get('SELECT email FROM afiliados WHERE codigo_afiliado = ?', [codigo_afiliado], (err, row) => resolve(row));
                        });
                        if (afiliado?.email) destinatarios.push(afiliado.email);
                    }

                    await transporter.sendMail({
                        from: emailConfig.from,
                        to: destinatarios.join(','),
                        subject: `StarBank — Novo Formulário: ${nome_completo}`,
                        html: corpoEmail
                    });
                } catch (emailErr) {
                    console.error('Erro ao enviar e-mail de notificação:', emailErr);
                }

                res.json({ sucesso: true });
            }
        );
    } catch (error) {
        console.error('Erro no formulário:', error);
        res.status(500).json({ erro: 'Erro interno no servidor.' });
    }
});

// API admin: listar formulários recebidos
app.get('/api/admin/formularios', verificarAdmin, (req, res) => {
    db.all('SELECT * FROM formularios_servidor ORDER BY criado_em DESC', (err, rows) => {
        if (err) return res.status(500).json({ erro: 'Erro no servidor' });
        res.json(rows);
    });
});

// Servir uploads para admins
app.get('/uploads/:filename', verificarAdmin, (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).json({ erro: 'Arquivo não encontrado' });
});

// ─── FORMULÁRIO DE CLIENTE ANTIGO (mantido por compatibilidade) ────────────

app.get('/formulario', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'formulario-cliente.html'));
});

app.post('/api/cadastrar-cliente', async (req, res) => {
    const { nome, email, telefone, cpf, codigo_afiliado, link_id } = req.body;
    try {
        let afiliado = null;
        let idAfiliado = null;

        if (codigo_afiliado) {
            afiliado = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM afiliados WHERE codigo_afiliado = ?', [codigo_afiliado], (err, result) => {
                    if (err) reject(err); else resolve(result);
                });
            });
            idAfiliado = afiliado ? afiliado.id : null;
        } else if (link_id) {
            afiliado = await new Promise((resolve, reject) => {
                db.get(`SELECT a.* FROM afiliados a JOIN links_cadastro l ON a.id = l.id_afiliado WHERE l.link_id = ?`,
                    [link_id], (err, result) => { if (err) reject(err); else resolve(result); });
            });
            idAfiliado = afiliado ? afiliado.id : null;
        }

        const result = await new Promise((resolve, reject) => {
            db.run('INSERT INTO clientes (nome, email, telefone, cpf, id_afiliado, codigo_afiliado, link_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [nome, email, telefone, cpf, idAfiliado, codigo_afiliado, link_id],
                function(err) { if (err) reject(err); else resolve({ id: this.lastID }); });
        });

        const clienteData = { id: result.id, nome, email, telefone, cpf };

        try {
            const emailEnviado = await enviarNotificacaoCliente(clienteData, afiliado);
            res.json({ sucesso: true, mensagem: 'Cliente cadastrado com sucesso!', id_cliente: result.id, email_enviado: emailEnviado });
        } catch (error) {
            res.json({ sucesso: true, mensagem: 'Cliente cadastrado! (Problema no envio do email)', id_cliente: result.id, email_enviado: false });
        }
    } catch (error) {
        console.error('Erro ao cadastrar cliente:', error);
        res.status(500).json({ erro: 'Erro ao cadastrar cliente' });
    }
});

app.get('/obrigado', (req, res) => {
    res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Obrigado!</title>
        <style>body{background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Arial}
        .card{background:white;border-radius:20px;padding:3rem;text-align:center;max-width:500px}h2{color:#333}p{color:#666}</style></head>
        <body><div class="card"><h2>✅ Obrigado pelo seu cadastro!</h2><p>Recebemos seus dados e entraremos em contato em breve.</p>
        <button onclick="window.location.href='/'" style="background:#667eea;color:white;border:none;padding:12px 24px;border-radius:10px;cursor:pointer;font-size:14px">Fechar</button>
        </div></body></html>`);
});

// ─── ADMIN ─────────────────────────────────────────────────────────────────

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.post('/admin/login', (req, res) => {
    const { email, senha } = req.body;
    const emailsAutorizados = ['christian.serello@starbank.tec.br', 'kaique.silva@starbank.tec.br'];
    if (!emailsAutorizados.includes(email)) return res.status(403).json({ erro: 'Não autorizado' });
    if (senha !== 'admin123') return res.status(401).json({ erro: 'Senha incorreta' });
    req.session.adminEmail = email;
    res.json({ sucesso: true, redirect: '/admin/dashboard' });
});

app.get('/admin/dashboard', verificarAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin');
});

app.post('/api/criar-afiliado', verificarAdmin, async (req, res) => {
    const { nome, email, senha } = req.body;
    try {
        const senhaHash = await bcrypt.hash(senha, 10);
        const codigoAfiliado = uuidv4().substring(0, 8);
        db.run('INSERT INTO afiliados (nome, email, senha, codigo_afiliado) VALUES (?, ?, ?, ?)',
            [nome, email, senhaHash, codigoAfiliado], function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) return res.status(400).json({ erro: 'Email já cadastrado' });
                    return res.status(500).json({ erro: 'Erro ao criar afiliado' });
                }
                res.json({ sucesso: true, mensagem: 'Afiliado criado com sucesso!', codigo_afiliado: codigoAfiliado });
            });
    } catch (error) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.get('/api/estatisticas', (req, res) => {
    db.get('SELECT COUNT(*) as total_afiliados FROM afiliados', (err, result1) => {
        if (err) return res.status(500).json({ erro: 'Erro no servidor' });
        db.get('SELECT COUNT(*) as total_clientes FROM clientes', (err, result2) => {
            if (err) return res.status(500).json({ erro: 'Erro no servidor' });
            const totalAfiliados = result1.total_afiliados;
            const totalClientes = result2.total_clientes;
            const mediaClientes = totalAfiliados > 0 ? totalClientes / totalAfiliados : 0;
            db.get(`SELECT a.nome, COUNT(c.id) as total_clientes FROM afiliados a LEFT JOIN clientes c ON a.id = c.id_afiliado GROUP BY a.id ORDER BY total_clientes DESC LIMIT 1`,
                (err, result3) => {
                    if (err) return res.status(500).json({ erro: 'Erro no servidor' });
                    res.json({ total_afiliados: totalAfiliados, total_clientes: totalClientes, media_clientes: mediaClientes, top_afiliado: result3 ? result3.nome : '-' });
                });
        });
    });
});

app.get('/api/afiliados', (req, res) => {
    db.all(`SELECT a.*, COUNT(c.id) as total_clientes FROM afiliados a LEFT JOIN clientes c ON a.id = c.id_afiliado GROUP BY a.id ORDER BY a.criado_em DESC`,
        (err, rows) => {
            if (err) return res.status(500).json({ erro: 'Erro no servidor' });
            res.json(rows);
        });
});

app.get('/api/admin/clientes', verificarAdmin, (req, res) => {
    const { afiliado_id, busca, data_inicio, data_fim } = req.query;
    let query = `SELECT c.*, a.nome as nome_afiliado, a.email as email_afiliado, a.codigo_afiliado FROM clientes c LEFT JOIN afiliados a ON c.id_afiliado = a.id WHERE 1=1`;
    const params = [];
    if (afiliado_id) { query += ' AND c.id_afiliado = ?'; params.push(afiliado_id); }
    if (busca) { query += ' AND (c.nome LIKE ? OR c.email LIKE ? OR c.cpf LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`); }
    if (data_inicio) { query += ' AND DATE(c.criado_em) >= ?'; params.push(data_inicio); }
    if (data_fim) { query += ' AND DATE(c.criado_em) <= ?'; params.push(data_fim); }
    query += ' ORDER BY c.criado_em DESC';
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ erro: 'Erro no servidor' });
        res.json(rows);
    });
});

app.get('/api/admin/afiliados-filtro', verificarAdmin, (req, res) => {
    db.all(`SELECT id, nome, email, codigo_afiliado, (SELECT COUNT(*) FROM clientes WHERE id_afiliado = a.id) as total_clientes FROM afiliados a ORDER BY nome`,
        (err, rows) => {
            if (err) return res.status(500).json({ erro: 'Erro no servidor' });
            res.json(rows);
        });
});

// ─── START ─────────────────────────────────────────────────────────────────

module.exports = app;