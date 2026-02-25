# Sistema de Afiliados

Um sistema completo para gerenciamento de afiliados com tracking personalizado de clientes.

## Funcionalidades

### Para Afiliados
- **Login Seguro**: Sistema de autenticação com senha criptografada
- **Dashboard Personalizado**: Visualize suas estatísticas e desempenho
- **Link Exclusivo**: Cada afiliado recebe seu link único para compartilhar
- **Acompanhamento em Tempo Real**: Veja quantos clientes cadastrou através de seu link
- **Compartilhamento Fácil**: Integração com WhatsApp e email

### Para Clientes
- **Formulário Simples**: Cadastro rápido e intuitivo em 3 passos
- **Validação de Dados**: CPF e email validados automaticamente
- **Identificação do Afiliado**: Sistema reconhece automaticamente quem indicou

### Para Administradores
- **Painel Completo**: Gerencie todos os afiliados e clientes
- **Estatísticas Detalhadas**: Visualize métricas e desempenho geral
- **Criação de Afiliados**: Cadastre novos afiliados facilmente
- **Relatórios**: Acompanhe o crescimento da rede

## Tecnologias Utilizadas

- **Backend**: Node.js com Express
- **Banco de Dados**: SQLite
- **Frontend**: HTML5, CSS3, JavaScript Vanilla
- **Estilização**: Bootstrap 5
- **Ícones**: Font Awesome
- **Segurança**: bcryptjs para criptografia de senhas

## Instalação

1. **Instale as dependências**:
```bash
npm install
```

2. **Inicie o servidor**:
```bash
npm start
```

Ou para desenvolvimento:
```bash
npm run dev
```

3. **Acesse o sistema**:
- Página inicial: http://localhost:3000
- Painel administrativo: http://localhost:3000/admin

## Estrutura do Projeto

```
afiliados/
├── server.js              # Servidor principal e rotas da API
├── package.json           # Dependências do projeto
├── afiliados.db          # Banco de dados SQLite (criado automaticamente)
├── public/               # Arquivos estáticos
│   ├── index.html        # Página inicial
│   ├── login.html        # Login de afiliados
│   ├── dashboard.html    # Dashboard do afiliado
│   ├── formulario.html   # Formulário de clientes
│   └── admin.html        # Painel administrativo
└── README.md             # Este arquivo
```

## Como Funciona

### 1. Criação de Afiliados
O administrador acessa `/admin` e cria novos afiliados com nome, email e senha. Cada afiliado recebe automaticamente um código único de 8 caracteres.

### 2. Acesso dos Afiliados
Os afiliados fazem login em `/login` e acessam seu dashboard pessoal onde encontram:
- Seu link personalizado: `http://localhost:3000/formulario?afiliado=CODIGO`
- Estatísticas de clientes cadastrados
- Opções de compartilhamento

### 3. Cadastro de Clientes
Quando um cliente acessa o link do afiliado e preenche o formulário, o sistema:
- Identifica automaticamente o afiliado através da URL
- Valida os dados informados
- Associa o cliente ao afiliado correspondente
- Armazena todas as informações no banco de dados

### 4. Acompanhamento
Tanto os afiliados quanto os administradores podem acompanhar em tempo real:
- Quantidade de clientes cadastrados
- Qual afiliado indicou cada cliente
- Estatísticas gerais do sistema

## Segurança

- **Senhas Criptografadas**: Todas as senhas são armazenadas usando bcrypt
- **Sessões Seguras**: Sistema de sessões para controle de acesso
- **Validação de Dados**: Validação no frontend e backend
- **Proteção CSRF**: Tokens de segurança em formulários

## Personalização

### Alterar Cores e Estilos
As cores principais estão definidas no CSS:
- Primary: `#667eea` (roxo)
- Secondary: `#764ba2` (roxo escuro)

### Modificar Informações do Formulário
Edite o arquivo `public/formulario.html` para adicionar/remover campos.

### Configurar Porta
Altere a constante `PORT` no arquivo `server.js`.

## API Endpoints

### Autenticação
- `POST /login` - Login de afiliados
- `GET /logout` - Logout

### Afiliados
- `GET /api/dados-afiliado` - Dados do afiliado logado
- `POST /api/criar-afiliado` - Criar novo afiliado
- `GET /api/afiliados` - Listar todos os afiliados

### Clientes
- `POST /api/cadastrar-cliente` - Cadastrar novo cliente
- `GET /api/clientes` - Listar todos os clientes

### Estatísticas
- `GET /api/estatisticas` - Dados estatísticos do sistema

## Contribuição

Sinta-se à vontade para contribuir com melhorias, correções de bugs ou novas funcionalidades.

## Licença

Este projeto está sob licença MIT.
