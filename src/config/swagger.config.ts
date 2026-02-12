import swaggerJsdoc from 'swagger-jsdoc';
import { Options } from 'swagger-jsdoc';

const options: Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Faz o Simples API',
            version: '1.0.0',
            description: 'API REST para gerenciamento de jogos de futebol com sistema de pagamentos e controle de jogadores',
            contact: {
                name: 'API Support',
                email: 'support@fazosimples.com',
            },
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Servidor de Desenvolvimento',
            },
            {
                url: 'https://api.fazosimplesfc.app',
                description: 'Servidor de Produção',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                GameResponseDto: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'ID único do jogo',
                            example: '507f1f77bcf86cd799439011',
                        },
                        name: {
                            type: 'string',
                            description: 'Nome/título do jogo',
                            example: '⚽ CAMPO DO VIANA',
                        },
                        date: {
                            type: 'string',
                            format: 'date',
                            description: 'Data do jogo (YYYY-MM-DD)',
                            example: '2024-12-25',
                        },
                        time: {
                            type: 'string',
                            description: 'Horário do jogo (HH:MM)',
                            example: '20:30',
                        },
                        maxPlayers: {
                            type: 'integer',
                            description: 'Número máximo de jogadores',
                            example: 16,
                        },
                        currentPlayers: {
                            type: 'integer',
                            description: 'Número atual de jogadores confirmados',
                            example: 12,
                        },
                        pricePerPlayer: {
                            type: 'number',
                            description: 'Preço por jogador em reais',
                            example: 14.0,
                        },
                        status: {
                            type: 'string',
                            enum: ['scheduled', 'open', 'closed', 'finished', 'cancelled'],
                            description: 'Status atual do jogo',
                            example: 'open',
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data de criação do jogo',
                            example: '2024-12-20T10:00:00.000Z',
                        },
                    },
                },
                PlayerInGameDto: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'ID do jogador',
                            example: '507f1f77bcf86cd799439011',
                        },
                        name: {
                            type: 'string',
                            description: 'Nome do jogador',
                            example: 'João Silva',
                        },
                        phone: {
                            type: 'string',
                            description: 'Telefone do jogador',
                            example: '+5549999999999',
                        },
                        isPaid: {
                            type: 'boolean',
                            description: 'Indica se o jogador já pagou',
                            example: true,
                        },
                    },
                },
                GameDetailResponseDto: {
                    allOf: [
                        { $ref: '#/components/schemas/GameResponseDto' },
                        {
                            type: 'object',
                            properties: {
                                players: {
                                    type: 'array',
                                    items: { $ref: '#/components/schemas/PlayerInGameDto' },
                                    description: 'Lista de jogadores confirmados',
                                },
                                substitutes: {
                                    type: 'array',
                                    items: { $ref: '#/components/schemas/PlayerInGameDto' },
                                    description: 'Lista de jogadores substitutos',
                                },
                                waitlist: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string' },
                                            name: { type: 'string' },
                                            phone: { type: 'string' },
                                            position: { type: 'integer' },
                                        },
                                    },
                                    description: 'Lista de espera',
                                },
                                outlist: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string' },
                                            name: { type: 'string' },
                                            phone: { type: 'string' },
                                        },
                                    },
                                    description: 'Jogadores que não participarão',
                                },
                                financialSummary: {
                                    type: 'object',
                                    properties: {
                                        totalToReceive: {
                                            type: 'number',
                                            description: 'Total a receber',
                                            example: 224.0,
                                        },
                                        totalPaid: {
                                            type: 'number',
                                            description: 'Total já pago',
                                            example: 168.0,
                                        },
                                        totalPending: {
                                            type: 'number',
                                            description: 'Total pendente',
                                            example: 56.0,
                                        },
                                        paidCount: {
                                            type: 'integer',
                                            description: 'Quantidade de jogadores que pagaram',
                                            example: 12,
                                        },
                                        unpaidCount: {
                                            type: 'integer',
                                            description: 'Quantidade de jogadores que não pagaram',
                                            example: 4,
                                        },
                                    },
                                },
                            },
                        },
                    ],
                },
                CreateGameDto: {
                    type: 'object',
                    required: ['name', 'date', 'time', 'location', 'maxPlayers', 'pricePerPlayer'],
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Nome/título do jogo',
                            example: '⚽ CAMPO DO VIANA',
                        },
                        type: {
                            type: 'string',
                            description: 'Tipo do jogo',
                            example: 'society',
                        },
                        date: {
                            type: 'string',
                            format: 'date',
                            description: 'Data do jogo (YYYY-MM-DD)',
                            example: '2024-12-25',
                        },
                        time: {
                            type: 'string',
                            description: 'Horário do jogo (HH:MM)',
                            example: '20:30',
                        },
                        location: {
                            type: 'string',
                            description: 'Local do jogo',
                            example: 'Campo do Viana',
                        },
                        maxPlayers: {
                            type: 'integer',
                            description: 'Número máximo de jogadores',
                            example: 16,
                        },
                        pricePerPlayer: {
                            type: 'number',
                            description: 'Preço por jogador em reais',
                            example: 14.0,
                        },
                        chatId: {
                            type: 'string',
                            description: 'ID do chat do WhatsApp',
                            example: '120363123456789012@g.us',
                        },
                    },
                },
                AddPlayerToGameDto: {
                    type: 'object',
                    required: ['phone', 'name'],
                    properties: {
                        phone: {
                            type: 'string',
                            description: 'Telefone do jogador',
                            example: '+5549999999999',
                        },
                        name: {
                            type: 'string',
                            description: 'Nome do jogador',
                            example: 'João Silva',
                        },
                        isGoalkeeper: {
                            type: 'boolean',
                            description: 'Indica se é goleiro',
                            example: false,
                        },
                    },
                },
                UpdateGameDto: {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Nome/título do jogo',
                            example: '⚽ CAMPO DO VIANA',
                        },
                        date: {
                            type: 'string',
                            format: 'date',
                            description: 'Data do jogo (YYYY-MM-DD)',
                            example: '2024-12-25',
                        },
                        time: {
                            type: 'string',
                            description: 'Horário do jogo (HH:MM)',
                            example: '20:30',
                        },
                        location: {
                            type: 'string',
                            description: 'Local do jogo',
                            example: 'Campo do Viana',
                        },
                        maxPlayers: {
                            type: 'integer',
                            description: 'Número máximo de jogadores',
                            example: 16,
                        },
                        pricePerPlayer: {
                            type: 'number',
                            description: 'Preço por jogador em reais',
                            example: 14.0,
                        },
                        status: {
                            type: 'string',
                            enum: ['scheduled', 'open', 'closed', 'finished', 'cancelled'],
                            description: 'Status do jogo',
                            example: 'open',
                        },
                    },
                },
                PlayerResponseDto: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'ID único do jogador',
                            example: '507f1f77bcf86cd799439011',
                        },
                        name: {
                            type: 'string',
                            description: 'Nome do jogador',
                            example: 'João Silva',
                        },
                        email: {
                            type: 'string',
                            description: 'Email do jogador',
                            example: 'joao@email.com',
                        },
                        phone: {
                            type: 'string',
                            description: 'Telefone do jogador',
                            example: '+5511999999999',
                        },
                        cpf: {
                            type: 'string',
                            description: 'CPF do jogador',
                            example: '123.456.789-00',
                        },
                        nick: {
                            type: 'string',
                            description: 'Apelido do jogador',
                            example: 'Joãozinho',
                        },
                        isGoalie: {
                            type: 'boolean',
                            description: 'Indica se é goleiro',
                            example: false,
                        },
                        status: {
                            type: 'string',
                            enum: ['active', 'inactive', 'suspended'],
                            description: 'Status do jogador',
                            example: 'active',
                        },
                        balance: {
                            type: 'number',
                            description: 'Saldo do jogador em reais',
                            example: 50.0,
                        },
                        totalDebt: {
                            type: 'number',
                            description: 'Débito total em reais',
                            example: 28.0,
                        },
                        role: {
                            type: 'string',
                            enum: ['admin', 'user'],
                            description: 'Papel do usuário',
                            example: 'user',
                        },
                        joinDate: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data de cadastro',
                            example: '2024-01-15T10:00:00.000Z',
                        },
                        lastActivity: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Última atividade',
                            example: '2024-12-20T15:30:00.000Z',
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data de criação',
                            example: '2024-01-15T10:00:00.000Z',
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data da última atualização',
                            example: '2024-12-20T15:30:00.000Z',
                        },
                    },
                },
                DebtResponseDto: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'ID único do débito',
                            example: '507f1f77bcf86cd799439011',
                        },
                        playerId: {
                            type: 'string',
                            description: 'ID do jogador',
                            example: '507f1f77bcf86cd799439012',
                        },
                        playerName: {
                            type: 'string',
                            description: 'Nome do jogador',
                            example: 'João Silva',
                        },
                        gameId: {
                            type: 'string',
                            description: 'ID do jogo',
                            example: '507f1f77bcf86cd799439013',
                        },
                        gameName: {
                            type: 'string',
                            description: 'Nome do jogo',
                            example: '⚽ CAMPO DO VIANA',
                        },
                        workspaceId: {
                            type: 'string',
                            description: 'ID do workspace',
                            example: '507f1f77bcf86cd799439014',
                        },
                        amount: {
                            type: 'number',
                            description: 'Valor do débito em reais',
                            example: 14.0,
                        },
                        amountCents: {
                            type: 'integer',
                            description: 'Valor do débito em centavos',
                            example: 1400,
                        },
                        status: {
                            type: 'string',
                            enum: ['pending', 'paid', 'overdue', 'cancelled'],
                            description: 'Status do débito',
                            example: 'pending',
                        },
                        notes: {
                            type: 'string',
                            description: 'Observações sobre o débito',
                            example: 'Débito referente ao jogo do dia 25/12',
                        },
                        category: {
                            type: 'string',
                            description: 'Categoria do débito',
                            example: 'player-debt',
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data de criação',
                            example: '2024-12-20T10:00:00.000Z',
                        },
                        paidAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data do pagamento',
                            example: '2024-12-21T14:30:00.000Z',
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data da última atualização',
                            example: '2024-12-21T14:30:00.000Z',
                        },
                    },
                },
                WorkspaceResponseDto: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'ID único do workspace',
                            example: '507f1f77bcf86cd799439011',
                        },
                        name: {
                            type: 'string',
                            description: 'Nome do workspace',
                            example: 'Arena Viana',
                        },
                        slug: {
                            type: 'string',
                            description: 'Slug único do workspace',
                            example: 'viana',
                        },
                        description: {
                            type: 'string',
                            description: 'Descrição do workspace',
                            example: 'Workspace Arena Viana',
                        },
                        platform: {
                            type: 'string',
                            enum: ['whatsapp', 'telegram', 'discord'],
                            description: 'Plataforma do workspace',
                            example: 'whatsapp',
                        },
                        status: {
                            type: 'string',
                            enum: ['active', 'inactive', 'maintenance'],
                            description: 'Status do workspace',
                            example: 'active',
                        },
                        timezone: {
                            type: 'string',
                            description: 'Fuso horário',
                            example: 'America/Sao_Paulo',
                        },
                        totalChats: {
                            type: 'integer',
                            description: 'Total de chats',
                            example: 5,
                        },
                        activeChats: {
                            type: 'integer',
                            description: 'Chats ativos',
                            example: 3,
                        },
                        settings: {
                            type: 'object',
                            properties: {
                                maxPlayers: {
                                    type: 'integer',
                                    description: 'Máximo de jogadores',
                                    example: 16,
                                },
                                pricePerGame: {
                                    type: 'number',
                                    description: 'Preço por jogo em reais',
                                    example: 14.0,
                                },
                                pricePerGameCents: {
                                    type: 'integer',
                                    description: 'Preço por jogo em centavos',
                                    example: 1400,
                                },
                                commandsEnabled: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Comandos habilitados',
                                    example: ['/lista', '/entrar', '/sair'],
                                },
                                pix: {
                                    type: 'string',
                                    description: 'Chave PIX',
                                    example: '+5549999999999',
                                },
                                title: {
                                    type: 'string',
                                    description: 'Título',
                                    example: '⚽ VIANA',
                                },
                            },
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data de criação',
                            example: '2024-01-15T10:00:00.000Z',
                        },
                        lastSync: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Última sincronização',
                            example: '2024-12-20T15:30:00.000Z',
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data da última atualização',
                            example: '2024-12-20T15:30:00.000Z',
                        },
                    },
                },
                ChatScheduleDto: {
                    type: 'object',
                    properties: {
                        weekday: {
                            type: 'integer',
                            minimum: 0,
                            maximum: 6,
                            description: 'Dia da semana (0=Dom, 1=Seg, ..., 6=Sáb)',
                            example: 1,
                        },
                        time: {
                            type: 'string',
                            description: 'Horário (HH:mm)',
                            example: '20:30',
                        },
                        title: {
                            type: 'string',
                            description: 'Título do jogo',
                            example: '⚽ CAMPO DO VIANA',
                        },
                        priceCents: {
                            type: 'integer',
                            description: 'Preço em centavos',
                            example: 1400,
                        },
                        pix: {
                            type: 'string',
                            description: 'Chave PIX',
                            example: '+5549999999999',
                        },
                    },
                },
                ChatResponseDto: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'ID único do chat',
                            example: '507f1f77bcf86cd799439011',
                        },
                        workspaceId: {
                            type: 'string',
                            description: 'ID do workspace',
                            example: '507f1f77bcf86cd799439012',
                        },
                        name: {
                            type: 'string',
                            description: 'Nome do chat',
                            example: 'Grupo Campo Viana',
                        },
                        chatId: {
                            type: 'string',
                            description: 'ID do chat na plataforma',
                            example: '120363123456789012@g.us',
                        },
                        label: {
                            type: 'string',
                            description: 'Label do chat',
                            example: 'Viana Segunda',
                        },
                        type: {
                            type: 'string',
                            enum: ['group', 'private'],
                            description: 'Tipo do chat',
                            example: 'group',
                        },
                        status: {
                            type: 'string',
                            enum: ['active', 'inactive', 'archived'],
                            description: 'Status do chat',
                            example: 'active',
                        },
                        memberCount: {
                            type: 'integer',
                            description: 'Número de membros',
                            example: 15,
                        },
                        schedule: {
                            $ref: '#/components/schemas/ChatScheduleDto',
                        },
                        lastMessage: {
                            type: 'string',
                            description: 'Última mensagem',
                        },
                        lastMessageAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data/hora da última mensagem',
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data de criação',
                            example: '2024-01-15T10:00:00.000Z',
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Data da última atualização',
                            example: '2024-12-20T15:30:00.000Z',
                        },
                    },
                },
                DashboardStatsDto: {
                    type: 'object',
                    properties: {
                        totalPlayers: {
                            type: 'integer',
                            description: 'Total de jogadores',
                            example: 45,
                        },
                        activePlayers: {
                            type: 'integer',
                            description: 'Jogadores ativos',
                            example: 38,
                        },
                        inactivePlayers: {
                            type: 'integer',
                            description: 'Jogadores inativos',
                            example: 7,
                        },
                        totalGames: {
                            type: 'integer',
                            description: 'Total de jogos',
                            example: 24,
                        },
                        upcomingGames: {
                            type: 'integer',
                            description: 'Jogos próximos',
                            example: 5,
                        },
                        completedGames: {
                            type: 'integer',
                            description: 'Jogos concluídos',
                            example: 18,
                        },
                        totalDebt: {
                            type: 'number',
                            description: 'Débito total em reais',
                            example: 1250.0,
                        },
                        totalPending: {
                            type: 'integer',
                            description: 'Total de débitos pendentes',
                            example: 8,
                        },
                        totalOverdue: {
                            type: 'integer',
                            description: 'Total de débitos vencidos',
                            example: 3,
                        },
                        paidThisMonth: {
                            type: 'number',
                            description: 'Pago no mês atual em reais',
                            example: 3840.0,
                        },
                        revenue: {
                            type: 'number',
                            description: 'Receita total em reais',
                            example: 15680.0,
                        },
                        revenueGrowth: {
                            type: 'number',
                            description: 'Crescimento de receita em %',
                            example: 12.5,
                        },
                        totalWorkspaces: {
                            type: 'integer',
                            description: 'Total de workspaces',
                            example: 3,
                        },
                        activeWorkspaces: {
                            type: 'integer',
                            description: 'Workspaces ativos',
                            example: 2,
                        },
                        totalChats: {
                            type: 'integer',
                            description: 'Total de chats',
                            example: 12,
                        },
                    },
                },
                Error: {
                    type: 'object',
                    properties: {
                        message: {
                            type: 'string',
                            description: 'Mensagem de erro',
                            example: 'Game not found',
                        },
                        statusCode: {
                            type: 'integer',
                            description: 'Código HTTP do erro',
                            example: 404,
                        },
                    },
                },
                MembershipStatus: {
                    type: 'string',
                    enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'CANCELED_SCHEDULED', 'INACTIVE'],
                    description: 'Status da mensalidade',
                    example: 'ACTIVE',
                },
                CreateMembershipDto: {
                    type: 'object',
                    required: ['workspaceId', 'userId', 'planValue'],
                    properties: {
                        workspaceId: { type: 'string' },
                        userId: { type: 'string' },
                        planValue: { type: 'number', description: 'Valor do plano em reais' },
                        startDate: { type: 'string', format: 'date' },
                        notes: { type: 'string' },
                    },
                },
                UpdateMembershipDto: {
                    type: 'object',
                    properties: {
                        status: { $ref: '#/components/schemas/MembershipStatus' },
                        planValue: { type: 'number', description: 'Valor do plano em reais' },
                        nextDueDate: { type: 'string', format: 'date-time' },
                        notes: { type: 'string' },
                    },
                },
                MembershipResponseDto: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        workspaceId: { type: 'string' },
                        userId: { type: 'string' },
                        userName: { type: 'string' },
                        userPhone: { type: 'string' },
                        status: { $ref: '#/components/schemas/MembershipStatus' },
                        planValue: { type: 'number', description: 'Valor em reais' },
                        planValueCents: { type: 'integer', description: 'Valor em centavos' },
                        startDate: { type: 'string', format: 'date-time' },
                        endDate: { type: 'string', format: 'date-time' },
                        nextDueDate: { type: 'string', format: 'date-time' },
                        canceledAt: { type: 'string', format: 'date-time' },
                        suspendedAt: { type: 'string', format: 'date-time' },
                        notes: { type: 'string' },
                        isOverdue: { type: 'boolean' },
                        daysUntilDue: { type: 'integer' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
                TransactionType: {
                    type: 'string',
                    enum: ['INCOME', 'EXPENSE'],
                    description: 'Tipo de transação',
                },
                TransactionCategory: {
                    type: 'string',
                    enum: ['PLAYER_PAYMENT', 'PLAYER_DEBT', 'FIELD_PAYMENT', 'OTHER'],
                    description: 'Categoria da transação',
                },
                TransactionStatus: {
                    type: 'string',
                    enum: ['PENDING', 'COMPLETED', 'CANCELLED'],
                    description: 'Status da transação',
                },
                CreateTransactionDto: {
                    type: 'object',
                    required: ['workspaceId', 'type', 'category', 'amount', 'dueDate'],
                    properties: {
                        workspaceId: { type: 'string' },
                        userId: { type: 'string' },
                        gameId: { type: 'string' },
                        membershipId: { type: 'string' },
                        type: { $ref: '#/components/schemas/TransactionType' },
                        category: { $ref: '#/components/schemas/TransactionCategory' },
                        amount: { type: 'number', description: 'Valor em reais' },
                        dueDate: { type: 'string', format: 'date-time' },
                        description: { type: 'string' },
                        method: { type: 'string', enum: ['pix', 'dinheiro', 'transf', 'ajuste'] },
                    },
                },
                UpdateTransactionDto: {
                    type: 'object',
                    properties: {
                        status: { $ref: '#/components/schemas/TransactionStatus' },
                        paidAt: { type: 'string', format: 'date-time' },
                        description: { type: 'string' },
                        method: { type: 'string', enum: ['pix', 'dinheiro', 'transf', 'ajuste'] },
                    },
                },
                TransactionResponseDto: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        workspaceId: { type: 'string' },
                        user: {
                            type: 'object',
                            properties: {
                                _id: { type: 'string' },
                                name: { type: 'string' },
                            }
                        },
                        gameId: { type: 'string' },
                        gameName: { type: 'string' },
                        membershipId: { type: 'string' },
                        type: { $ref: '#/components/schemas/TransactionType' },
                        category: { $ref: '#/components/schemas/TransactionCategory' },
                        status: { $ref: '#/components/schemas/TransactionStatus' },
                        amount: { type: 'number' },
                        amountCents: { type: 'integer' },
                        dueDate: { type: 'string', format: 'date-time' },
                        paidAt: { type: 'string', format: 'date-time' },
                        description: { type: 'string' },
                        method: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
                HelpCommandDto: {
                    type: 'object',
                    properties: {
                        command: { type: 'string' },
                        description: { type: 'string' },
                        usage: { type: 'string' },
                        category: { type: 'string' },
                        role: { type: 'string', enum: ['user', 'admin'] },
                    },
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: [
        './src/api/controllers/*.ts',
        './src/api/routes/*.ts',
    ],
};

export const swaggerSpec = swaggerJsdoc(options);
