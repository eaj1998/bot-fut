# ⚽ Bot de Futebol - Campo do Viana

## 📋 Descrição

Bot inteligente para WhatsApp que automatiza a gestão de listas de jogos de futebol, desenvolvido especificamente para grupos de futebol que utilizam o Campo do Viana. O bot facilita a organização dos jogos, controle de presenças, pagamentos e até mesmo anúncios automáticos de vídeos do canal do YouTube.

## 🚀 Funcionalidades Principais

### 🎯 Gestão de Listas de Jogos
- **Listas automáticas**: Cria listas com 16 vagas principais + suplentes
- **Horários específicos**: Terça-feira às 21h30 e Quinta-feira às 20h30
- **Agendamento automático**: Envia listas automaticamente aos domingos e terças
- **Sincronização**: Comando para carregar listas existentes e sincronizar dados

### 👥 Controle de Jogadores
- **Sistema de inscrição**: `/bora` para se inscrever automaticamente (vagas de linha)
- **Sistema de goleiros**: `/goleiro` para se inscrever especificamente como goleiro
- **Sistema de convidados**: `/convidado` para adicionar jogadores externos à lista
- **Sistema de desistência**: `/desistir` para sair da lista
- **Promoção automática**: Suplentes são promovidos automaticamente quando há vagas
- **Controle de pagamentos**: Marca jogadores como pagos com `/pago`
- **Chamada geral**: `/marcar` para notificar todos os participantes do grupo

### 🎥 Integração com YouTube
- **Monitoramento automático**: Verifica novos vídeos no canal do Viana
- **Anúncios inteligentes**: Identifica vídeos de jogos e anuncia nos grupos corretos
- **Agendamento flexível**: Configurável para verificar em horários específicos

### 🔐 Sistema de Administração
- **Controle de acesso**: Apenas administradores podem usar comandos sensíveis
- **Múltiplos grupos**: Suporte para grupos de terça, quinta e teste
- **Configuração flexível**: Variáveis de ambiente para personalização

## 📱 Comandos Disponíveis

### 👤 Para Todos os Jogadores
- **`/bora`** - Inscreve-se na lista de jogo (vagas de linha)
- **`/goleiro`** - Inscreve-se especificamente como goleiro (vagas 1-2)
- **`/desistir`** - Remove-se da lista de jogo
- **`/convidado <nome>`** - Adiciona um convidado à lista (ex: `/convidado João Silva` para linha ou `/convidado 🧤 Pedro` para goleiro)

### 👑 Apenas para Administradores
- **`/lista`** - Cria uma nova lista de jogo
- **`/carregar`** - Sincroniza lista existente com o bot
- **`/pago <número>`** - Marca jogador como pago (ex: `/pago 5`)
- **`/desmarcar <número>`** - Remove marcação de pagamento
- **`/marcar`** - Marca todos os participantes do grupo (chamada geral)
- **`/testeyt`** - Testa verificação do YouTube manualmente
- **`/resetvideos`** - Reseta histórico de vídeos anunciados

## 📖 Como Usar os Comandos

### 🎯 Comandos de Inscrição
- **`/bora`**: Inscreve-se automaticamente nas vagas de linha (posições 3-16)
- **`/goleiro`**: Inscreve-se especificamente como goleiro (posições 1-2)
- **`/convidado João Silva`**: Adiciona um convidado nas vagas de linha
- **`/convidado 🧤 Pedro`**: Adiciona um convidado como goleiro (⚠️ **Obrigatório usar a luva 🧤**)

### 💰 Comandos de Pagamento
- **`/pago 5`**: Marca o jogador da posição 5 como pago (aparece com ✅)
- **`/desmarcar 5`**: Remove a marcação de pagamento da posição 5

### 📢 Comandos de Comunicação
- **`/marcar`**: Marca todos os participantes do grupo (útil para chamadas gerais)

### 🔄 Comandos de Gestão
- **`/carregar`**: Sincroniza uma lista existente com o bot
  ```
  /carregar
  ⚽ CAMPO DO VIANA
  15/12 às 20h30
  ...
  ```

### 👥 Comando de Convidados
- **`/convidado <nome>`**: Adiciona jogadores externos à lista
  - **Para jogadores de linha**: `/convidado João Silva`
  - **Para goleiros**: `/convidado 🧤 Pedro` (⚠️ **A luva 🧤 é obrigatória**)
  - O bot identifica automaticamente se é goleiro pela presença da luva
  - Se não houver vagas na lista principal, o convidado vai para suplência

## ⚙️ Configuração

### Variáveis de Ambiente Obrigatórias
```env
ID_GRUPO_TERCA=ID_DO_GRUPO_TERCA
ID_GRUPO_QUINTA=ID_DO_GRUPO_QUINTA
ID_GRUPO_TESTE=ID_DO_GRUPO_TESTE
ADMIN_NUMBERS=NUMERO1,NUMERO2,NUMERO3
```

### Variáveis Opcionais
```env
YOUTUBE_API_KEY=SUA_API_KEY_YOUTUBE
YOUTUBE_TARGET_GROUP_ID=ID_GRUPO_PARA_VIDEOS
YOUTUBE_CHECKER_SCHEDULE=0 8-23/2 * * 3,5,6
PORT=8080
DATA_PATH=./dados
```

## 🏗️ Estrutura do Projeto

```
bot-grupo-futebol/
├── bot.js                    # Bot principal com todas as funcionalidades
├── package.json              # Dependências e configurações do Node.js
├── package-lock.json         # Lock file das dependências
├── nixpacks.toml             # Configuração de deploy (Nixpacks)
├── README.md                 # Documentação do projeto
├── assets/                   # Arquivos de mídia e recursos
│   └── joao.webp            # Imagem de exemplo
├── data/                     # Dados persistentes do bot
│   ├── videos_anunciados.json  # Histórico de vídeos do YouTube
│   └── wwebjs_auth/         # Autenticação do WhatsApp Web
│       └── session/         # Sessões e cache do WhatsApp
├── node_modules/             # Dependências instaladas (npm)
└── .env                      # Configurações de ambiente (criar)
```

## 🚀 Instalação e Uso

### 1. Pré-requisitos
- Node.js 16+ instalado
- WhatsApp com número dedicado para o bot
- Acesso aos grupos onde o bot será usado

### 2. Instalação
```bash
# Clone o repositório
git clone git@github.com:eaj1998/bot-fut.git
cd bot-grupo-futebol

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

### 3. Execução
```bash
# Inicie o bot
npm start

# Ou execute diretamente
node bot.js
```

### 4. Primeira Execução
1. O bot gerará um QR Code no terminal
2. Escaneie com o WhatsApp do número que será usado pelo bot
3. Aguarde a conexão ser estabelecida
4. O bot estará pronto para operar!

## 🔄 Funcionamento Automático

### Agendamentos
- **Domingo 10h**: Envia lista para grupo da terça
- **Terça 10h**: Envia lista para grupo da quinta
- **Horários configuráveis**: Verificação do YouTube conforme agendamento

### Listas de Jogos
- **16 vagas principais**: Numeradas de 1 a 16
- **Posições 1-2**: Reservadas para goleiros (🧤)
- **Suplentes**: Lista separada para jogadores excedentes
- **Promoção automática**: Suplentes sobem quando há vagas

## 💰 Sistema de Pagamentos

- **Controle**: Marcação automática com ✅ após confirmação
- **Comandos**: `/pago` e `/desmarcar` para gestão

## 🎥 Integração YouTube

### Funcionalidades
- Monitora canal específico para notificações no Grupo
- Identifica vídeos de jogos por padrão de título
- Anuncia automaticamente nos grupos corretos
- Evita anúncios duplicados

### Padrão de Títulos
- Formato: "Viana - DD/MM/AAAA - A" ou "Viana - DD/MM/AAAA - B"
- Distribuição automática por dia da semana
- Configuração de grupo específico para testes

## 🛠️ Tecnologias Utilizadas

- **Node.js**: Runtime JavaScript
- **WhatsApp Web.js**: Cliente WhatsApp Web
- **Express**: Servidor web para manter bot ativo
- **Node-cron**: Agendamento de tarefas
- **Axios**: Requisições HTTP para API do YouTube
- **Dotenv**: Gerenciamento de variáveis de ambiente

## 🔧 Personalização

### Horários de Jogos
- Terça-feira: 21h30
- Quinta-feira: 20h30
- Configurável via código

### Estrutura de Listas
- 16 vagas principais
- Sistema de suplentes ilimitado
- Posições reservadas para goleiros
- Formatação personalizável

### Agendamentos
- Horários configuráveis
- Fuso horário: America/Sao_Paulo
- Tarefas personalizáveis via cron

## 📞 Suporte

Para dúvidas, sugestões ou problemas:
- Verifique os logs no terminal
- Confirme as variáveis de ambiente
- Teste comandos básicos primeiro
- Verifique permissões de administrador

## 📝 Licença

Este projeto é de uso livre para grupos de futebol que utilizam o Campo do Viana.

---

**⚽ Desenvolvido para facilitar a organização dos jogos e melhorar a experiência dos jogadores!**
