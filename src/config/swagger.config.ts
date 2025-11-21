import swaggerJsdoc from 'swagger-jsdoc';
import { Options } from 'swagger-jsdoc';

const options: Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Bot Futebol API',
            version: '1.0.0',
            description: 'API REST para gerenciamento de jogos de futebol com sistema de pagamentos e controle de jogadores',
            contact: {
                name: 'API Support',
                email: 'support@botfutebol.com',
            },
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Servidor de Desenvolvimento',
            },
            {
                url: 'https://api.botfutebol.com',
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
