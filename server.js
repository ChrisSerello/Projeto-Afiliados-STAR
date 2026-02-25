// server.js — Vercel-compatible (JWT cookies, sem sessão PostgreSQL)
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const nodemailer = require('nodemailer');
const emailConfig = require('./config-email');
const multer = require('multer');
const supabase = require('./db');

require('dotenv').config();

const app = express();
const JWT_SECRET = process.env.SESSION_SECRET || 'secreto-sistema-afiliados';
const IS_PROD = process.env.NODE_ENV === 'production';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ─── EMAIL ─────────────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport(emailConfig);

// ─── MULTER (armazena em memória, envia pro Supabase Storage) ──────────────

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Formato inválido. Use PDF, JPG ou PNG.'));
    }
});

// ─── FUNÇÃO DE EMAIL ────────────────────────────────────────────────────────

async function enviarNotificacaoCliente(clienteData, afiliado) {
    try {
        const emailEmpresa = emailConfig.emailEmpresa;
        const emailKaique = 'kaique.silva@starbank.tec.br';

        const corpoEmail = `
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
        `;

        const promises = [
            transporter.sendMail({ from: emailConfig.from, to: emailEmpresa, subject: `Novo Cliente Cadastrado - ${clienteData.nome}`, html: corpoEmail }),
            transporter.sendMail({ from: emailConfig.from, to: emailKaique, subject: `Novo Cliente Cadastrado - ${clienteData.nome}`, html: corpoEmail }),
        ];

        if (afiliado && afiliado.email) {
            promises.push(transporter.sendMail({
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
            }));
        }

        await Promise.all(promises);
        console.log('Emails enviados com sucesso');
        return true;
    } catch (error) {
        console.error('Erro ao enviar emails:', error);
        return false;
    }
}

// ─── MIDDLEWARES ────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/assets', express.static(path.join(__dirname, 'public')));

// ─── HELPERS JWT ────────────────────────────────────────────────────────────

function criarTokenCookie(res, payload, cookieName) {
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
    res.cookie(cookieName, token, {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    });
}

// ─── MIDDLEWARES DE AUTENTICAÇÃO ───────────────────────────────────────────

function verificarAutenticacao(req, res, next) {
    const token = req.cookies?.auth_token;
    if (!token) {
        if (req.originalUrl.startsWith('/api')) return res.status(401).json({ erro: 'Não autenticado' });
        return res.redirect('/login');
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.afiliadoId = decoded.afiliadoId;
        req.codigoAfiliado = decoded.codigoAfiliado;
        next();
    } catch {
        res.clearCookie('auth_token');
        if (req.originalUrl.startsWith('/api')) return res.status(401).json({ erro: 'Não autenticado' });
        res.redirect('/login');
    }
}

function verificarAdmin(req, res, next) {
    const token = req.cookies?.admin_token;
    if (!token) return res.redirect('/admin');
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const emailsAutorizados = ['christian.serello@starbank.tec.br', 'kaique.silva@starbank.tec.br'];
        if (emailsAutorizados.includes(decoded.adminEmail)) {
            req.adminEmail = decoded.adminEmail;
            return next();
        }
        res.clearCookie('admin_token');
        res.redirect('/admin');
    } catch {
        res.clearCookie('admin_token');
        res.redirect('/admin');
    }
}

// ─── HELPER PARA SERVIR HTML SEM CACHE ─────────────────────────────────────

function serveHTML(res, filePath) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.sendFile(filePath);
}

// ─── ROTAS PÚBLICAS ────────────────────────────────────────────────────────

app.get('/', (req, res) => serveHTML(res, path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => serveHTML(res, path.join(__dirname, 'public', 'login.html')));
app.get('/esqueci-senha', (req, res) => serveHTML(res, path.join(__dirname, 'public', 'esqueci-senha.html')));
app.get('/redefinir-senha', (req, res) => serveHTML(res, path.join(__dirname, 'public', 'redefinir-senha.html')));
app.get('/formulario-starbank', (req, res) => serveHTML(res, path.join(__dirname, 'public', 'formulario-starbank.html')));

// ─── AUTENTICAÇÃO ──────────────────────────────────────────────────────────

app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const { data: afiliado, error } = await supabase
            .from('afiliados')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !afiliado) return res.status(401).json({ erro: 'Email ou senha incorretos' });

        const senhaCorreta = await bcrypt.compare(senha, afiliado.senha);
        if (!senhaCorreta) return res.status(401).json({ erro: 'Email ou senha incorretos' });

        criarTokenCookie(res, {
            afiliadoId: afiliado.id,
            codigoAfiliado: afiliado.codigo_afiliado
        }, 'auth_token');

        res.json({ sucesso: true, redirect: '/dashboard' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.redirect('/login');
});

// ─── RESET DE SENHA ────────────────────────────────────────────────────────

app.post('/api/esqueci-senha', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ erro: 'E-mail obrigatório' });

    try {
        const { data: afiliado } = await supabase
            .from('afiliados')
            .select('*')
            .eq('email', email)
            .single();

        if (!afiliado) return res.json({ sucesso: true });

        const token = uuidv4();
        const expiraEm = new Date(Date.now() + 60 * 60 * 1000).toISOString();

        const { error: insertError } = await supabase
            .from('reset_tokens')
            .insert({ email, token, expira_em: expiraEm });

        if (insertError) return res.status(500).json({ erro: 'Erro ao gerar token' });

        const linkReset = `${BASE_URL}/redefinir-senha?token=${token}`;

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
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.post('/api/redefinir-senha', async (req, res) => {
    const { token, novaSenha } = req.body;
    if (!token || !novaSenha) return res.status(400).json({ erro: 'Dados incompletos' });
    if (novaSenha.length < 6) return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres' });

    try {
        const agora = new Date().toISOString();

        const { data: tokenData } = await supabase
            .from('reset_tokens')
            .select('*')
            .eq('token', token)
            .eq('usado', 0)
            .gt('expira_em', agora)
            .single();

        if (!tokenData) return res.status(400).json({ erro: 'Link inválido ou expirado' });

        const senhaHash = await bcrypt.hash(novaSenha, 10);

        await supabase
            .from('afiliados')
            .update({ senha: senhaHash })
            .eq('email', tokenData.email);

        await supabase
            .from('reset_tokens')
            .update({ usado: 1 })
            .eq('token', token);

        res.json({ sucesso: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// ─── DASHBOARD DO AFILIADO ─────────────────────────────────────────────────

app.get('/dashboard', verificarAutenticacao, (req, res) => {
    serveHTML(res, path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/api/dados-afiliado', verificarAutenticacao, async (req, res) => {
    const afiliadoId = req.afiliadoId;
    try {
        const { data: afiliado } = await supabase
            .from('afiliados')
            .select('nome, email, codigo_afiliado')
            .eq('id', afiliadoId)
            .single();

        const { count: total_clientes } = await supabase
            .from('clientes')
            .select('*', { count: 'exact', head: true })
            .eq('id_afiliado', afiliadoId);

        res.json({
            afiliado,
            total_clientes: total_clientes || 0,
            link_afiliado: `${BASE_URL}/?afiliado=${afiliado.codigo_afiliado}`
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.get('/api/meus-clientes', verificarAutenticacao, async (req, res) => {
    const afiliadoId = req.afiliadoId;
    try {
        const { data: rows, error } = await supabase
            .from('clientes')
            .select('id, nome, email, telefone, cpf, criado_em, link_id')
            .eq('id_afiliado', afiliadoId)
            .order('criado_em', { ascending: false });

        if (error) throw error;
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.get('/api/cliente/:id', verificarAutenticacao, async (req, res) => {
    const afiliadoId = req.afiliadoId;
    const clienteId = req.params.id;
    try {
        const { data: cliente, error } = await supabase
            .from('clientes')
            .select('*, afiliados(nome, codigo_afiliado)')
            .eq('id', clienteId)
            .eq('id_afiliado', afiliadoId)
            .single();

        if (error || !cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });

        const resposta = {
            ...cliente,
            nome_afiliado: cliente.afiliados?.nome,
            codigo_afiliado_ref: cliente.afiliados?.codigo_afiliado
        };
        delete resposta.afiliados;

        res.json(resposta);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.post('/api/gerar-link', verificarAutenticacao, async (req, res) => {
    const afiliadoId = req.afiliadoId;
    const linkId = uuidv4().substring(0, 12);
    try {
        const { error } = await supabase
            .from('links_cadastro')
            .insert({ id_afiliado: afiliadoId, link_id: linkId });

        if (error) throw error;

        res.json({ sucesso: true, link: `${BASE_URL}/formulario?link=${linkId}`, link_id: linkId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao gerar link' });
    }
});

// ─── FORMULÁRIO STARBANK ───────────────────────────────────────────────────

app.get('/api/afiliado-publico', async (req, res) => {
    const { codigo } = req.query;
    if (!codigo) return res.status(400).json({ erro: 'Código não informado' });

    try {
        const { data: afiliado, error } = await supabase
            .from('afiliados')
            .select('nome, codigo_afiliado')
            .eq('codigo_afiliado', codigo)
            .single();

        if (error || !afiliado) return res.status(404).json({ erro: 'Afiliado não encontrado' });
        res.json(afiliado);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.post('/api/enviar-formulario', upload.single('holerite'), async (req, res) => {
    try {
        const { codigo_afiliado, nome_afiliado, nome_completo, cpf, data_nascimento, celular, orgao, tipo_vinculo, objetivo, bancos_atuais } = req.body;

        if (!nome_completo || !cpf || !celular || !orgao || !tipo_vinculo || !objetivo) {
            return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
        }

        let holeriteUrl = null;
        if (req.file) {
            const ext = req.file.originalname.split('.').pop();
            const fileName = `holerite-${Date.now()}.${ext}`;

            const { error: uploadError } = await supabase.storage
                .from('holerites')
                .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });

            if (!uploadError) {
                const { data: urlData } = supabase.storage
                    .from('holerites')
                    .getPublicUrl(fileName);
                holeriteUrl = urlData.publicUrl;
            } else {
                console.error('Erro no upload do holerite:', uploadError);
            }
        }

        const { error: insertError } = await supabase
            .from('formularios_servidor')
            .insert({
                codigo_afiliado, nome_afiliado, nome_completo, cpf,
                data_nascimento, celular, orgao, tipo_vinculo,
                objetivo, bancos_atuais, holerite_path: holeriteUrl
            });

        if (insertError) throw insertError;

        try {
            const corpoEmail = `
                <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #1e0a40, #6b21a8); padding: 28px; border-radius: 12px 12px 0 0; text-align: center;">
                        <h2 style="color: #fff; margin: 0;">🏦 StarBank — Novo Formulário</h2>
                        <p style="color: rgba(255,255,255,0.6); margin: 6px 0 0; font-size: 13px;">Benefício ao Servidor</p>
                    </div>
                    <div style="background: #f8f7ff; padding: 28px; border-radius: 0 0 12px 12px; border: 1px solid #e2e0f0;">
                        <p><strong>Afiliado:</strong> ${nome_afiliado || '—'} (${codigo_afiliado || '—'})</p>
                        <p><strong>Nome:</strong> ${nome_completo}</p>
                        <p><strong>CPF:</strong> ${cpf}</p>
                        <p><strong>Nascimento:</strong> ${data_nascimento || '—'}</p>
                        <p><strong>Celular:</strong> ${celular}</p>
                        <p><strong>Órgão:</strong> ${orgao}</p>
                        <p><strong>Vínculo:</strong> ${tipo_vinculo}</p>
                        <p><strong>Objetivo:</strong> ${objetivo}</p>
                        <p><strong>Bancos atuais:</strong> ${bancos_atuais || 'Não informado'}</p>
                        ${holeriteUrl ? `<p>📎 <a href="${holeriteUrl}">Ver Holerite</a></p>` : ''}
                        <p style="color: #8b83b0; font-size: 12px; margin-top: 16px;">Recebido em: ${new Date().toLocaleString('pt-BR')}</p>
                    </div>
                </div>
            `;

            const destinatarios = [emailConfig.emailEmpresa, 'kaique.silva@starbank.tec.br'];

            if (codigo_afiliado) {
                const { data: afiliadoEmail } = await supabase
                    .from('afiliados')
                    .select('email')
                    .eq('codigo_afiliado', codigo_afiliado)
                    .single();
                if (afiliadoEmail?.email) destinatarios.push(afiliadoEmail.email);
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
    } catch (error) {
        console.error('Erro no formulário:', error);
        res.status(500).json({ erro: 'Erro interno no servidor.' });
    }
});

app.get('/api/admin/formularios', verificarAdmin, async (req, res) => {
    try {
        const { data: rows, error } = await supabase
            .from('formularios_servidor')
            .select('*')
            .order('criado_em', { ascending: false });

        if (error) throw error;
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// ─── FORMULÁRIO DE CLIENTE ──────────────────────────────────────────────────

app.get('/formulario', (req, res) => {
    serveHTML(res, path.join(__dirname, 'public', 'formulario-cliente.html'));
});

app.post('/api/cadastrar-cliente', async (req, res) => {
    const { nome, email, telefone, cpf, codigo_afiliado, link_id } = req.body;
    try {
        let afiliado = null;

        if (codigo_afiliado) {
            const { data } = await supabase
                .from('afiliados')
                .select('*')
                .eq('codigo_afiliado', codigo_afiliado)
                .single();
            afiliado = data;
        } else if (link_id) {
            const { data } = await supabase
                .from('links_cadastro')
                .select('afiliados(*)')
                .eq('link_id', link_id)
                .single();
            afiliado = data?.afiliados || null;
        }

        const idAfiliado = afiliado ? afiliado.id : null;

        const { data: novoCliente, error } = await supabase
            .from('clientes')
            .insert({ nome, email, telefone, cpf, id_afiliado: idAfiliado, codigo_afiliado, link_id })
            .select('id')
            .single();

        if (error) throw error;

        const clienteData = { id: novoCliente.id, nome, email, telefone, cpf };
        const emailEnviado = await enviarNotificacaoCliente(clienteData, afiliado);

        res.json({ sucesso: true, mensagem: 'Cliente cadastrado com sucesso!', id_cliente: novoCliente.id, email_enviado: emailEnviado });
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

app.get('/admin', (req, res) => serveHTML(res, path.join(__dirname, 'public', 'admin-login.html')));

app.post('/admin/login', (req, res) => {
    const { email, senha } = req.body;
    const emailsAutorizados = ['christian.serello@starbank.tec.br', 'kaique.silva@starbank.tec.br'];
    if (!emailsAutorizados.includes(email)) return res.status(403).json({ erro: 'Não autorizado' });
    if (senha !== 'admin123') return res.status(401).json({ erro: 'Senha incorreta' });

    criarTokenCookie(res, { adminEmail: email }, 'admin_token');
    res.json({ sucesso: true, redirect: '/admin/dashboard' });
});

app.get('/admin/dashboard', verificarAdmin, (req, res) => {
    serveHTML(res, path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin/logout', (req, res) => {
    res.clearCookie('admin_token');
    res.redirect('/admin');
});

app.post('/api/criar-afiliado', verificarAdmin, async (req, res) => {
    const { nome, email, senha } = req.body;
    try {
        const senhaHash = await bcrypt.hash(senha, 10);
        const codigoAfiliado = uuidv4().substring(0, 8);

        const { error } = await supabase
            .from('afiliados')
            .insert({ nome, email, senha: senhaHash, codigo_afiliado: codigoAfiliado });

        if (error) {
            if (error.message.includes('unique') || error.code === '23505') {
                return res.status(400).json({ erro: 'Email já cadastrado' });
            }
            throw error;
        }

        res.json({ sucesso: true, mensagem: 'Afiliado criado com sucesso!', codigo_afiliado: codigoAfiliado });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.get('/api/estatisticas', async (req, res) => {
    try {
        const { count: totalAfiliados } = await supabase
            .from('afiliados')
            .select('*', { count: 'exact', head: true });

        const { count: totalClientes } = await supabase
            .from('clientes')
            .select('*', { count: 'exact', head: true });

        const mediaClientes = totalAfiliados > 0 ? totalClientes / totalAfiliados : 0;

        const { data: afiliados } = await supabase
            .from('afiliados')
            .select('id, nome');

        let topAfiliado = '-';
        let maxClientes = -1;

        for (const af of (afiliados || [])) {
            const { count } = await supabase
                .from('clientes')
                .select('*', { count: 'exact', head: true })
                .eq('id_afiliado', af.id);

            if (count > maxClientes) {
                maxClientes = count;
                topAfiliado = af.nome;
            }
        }

        res.json({ total_afiliados: totalAfiliados, total_clientes: totalClientes, media_clientes: mediaClientes, top_afiliado: topAfiliado });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.get('/api/afiliados', async (req, res) => {
    try {
        const { data: afiliados, error } = await supabase
            .from('afiliados')
            .select('*')
            .order('criado_em', { ascending: false });

        if (error) throw error;

        const resultado = await Promise.all(afiliados.map(async (af) => {
            const { count } = await supabase
                .from('clientes')
                .select('*', { count: 'exact', head: true })
                .eq('id_afiliado', af.id);
            return { ...af, total_clientes: count || 0 };
        }));

        res.json(resultado);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.get('/api/admin/clientes', verificarAdmin, async (req, res) => {
    const { afiliado_id, busca, data_inicio, data_fim } = req.query;
    try {
        let query = supabase
            .from('clientes')
            .select('*, afiliados(nome, email, codigo_afiliado)')
            .order('criado_em', { ascending: false });

        if (afiliado_id) query = query.eq('id_afiliado', afiliado_id);
        if (data_inicio) query = query.gte('criado_em', data_inicio);
        if (data_fim) query = query.lte('criado_em', data_fim + 'T23:59:59');

        const { data: rows, error } = await query;
        if (error) throw error;

        let resultado = rows;
        if (busca) {
            const b = busca.toLowerCase();
            resultado = rows.filter(c =>
                c.nome?.toLowerCase().includes(b) ||
                c.email?.toLowerCase().includes(b) ||
                c.cpf?.includes(b)
            );
        }

        resultado = resultado.map(c => ({
            ...c,
            nome_afiliado: c.afiliados?.nome,
            email_afiliado: c.afiliados?.email,
            codigo_afiliado_ref: c.afiliados?.codigo_afiliado,
            afiliados: undefined
        }));

        res.json(resultado);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.get('/api/admin/afiliados-filtro', verificarAdmin, async (req, res) => {
    try {
        const { data: afiliados, error } = await supabase
            .from('afiliados')
            .select('id, nome, email, codigo_afiliado')
            .order('nome');

        if (error) throw error;

        const resultado = await Promise.all(afiliados.map(async (af) => {
            const { count } = await supabase
                .from('clientes')
                .select('*', { count: 'exact', head: true })
                .eq('id_afiliado', af.id);
            return { ...af, total_clientes: count || 0 };
        }));

        res.json(resultado);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

module.exports = app;