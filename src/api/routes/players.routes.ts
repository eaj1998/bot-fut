import { Router } from 'express';
import { container } from 'tsyringe';
import { PlayersController } from '../controllers/players.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();
const controller = container.resolve(PlayersController);

// Rotas protegidas (requerem autenticação)
router.use(authenticate);

/**
 * @swagger
 * /api/players:
 *   get:
 *     summary: Lista todos os jogadores
 *     description: Retorna uma lista paginada de jogadores com filtros opcionais
 *     tags: [Players]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended, all]
 *         description: Filtrar por status do jogador
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nome, email, telefone ou CPF
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Itens por página
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, createdAt, totalDebt, lastActivity]
 *         description: Campo para ordenação
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Direção da ordenação
 *     responses:
 *       200:
 *         description: Lista de jogadores retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 players:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PlayerResponseDto'
 *                 total:
 *                   type: integer
 *                   description: Total de jogadores (considerando filtros)
 *                 page:
 *                   type: integer
 *                   description: Página atual
 *                 totalPages:
 *                   type: integer
 *                   description: Total de páginas
 *                 limit:
 *                   type: integer
 *                   description: Itens por página
 *                 activeCount:
 *                   type: integer
 *                   description: Quantidade de jogadores ativos na página atual
 *                 withDebtsCount:
 *                   type: integer
 *                   description: Quantidade de jogadores com débitos na página atual
 *                 inactiveCount:
 *                   type: integer
 *                   description: Quantidade de jogadores inativos na página atual
 */
router.get('/', controller.listPlayers);

/**
 * @swagger
 * /api/players/stats:
 *   get:
 *     summary: Obtém estatísticas de jogadores
 *     description: Retorna estatísticas agregadas sobre jogadores
 *     tags: [Players]
 *     responses:
 *       200:
 *         description: Estatísticas retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 active:
 *                   type: integer
 *                 inactive:
 *                   type: integer
 *                 suspended:
 *                   type: integer
 *                 withDebts:
 *                   type: integer
 *                 totalDebt:
 *                   type: number
 */
router.get('/stats', controller.getStats);

/**
 * @swagger
 * /api/players/export:
 *   get:
 *     summary: Exporta jogadores em CSV
 *     description: Exporta lista de jogadores em formato CSV (requer autenticação de admin)
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended, all]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Arquivo CSV gerado com sucesso
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.get('/export', authenticate, requireAdmin, controller.exportPlayers);

/**
 * @swagger
 * /api/players/{id}:
 *   get:
 *     summary: Obtém detalhes de um jogador
 *     description: Retorna informações detalhadas de um jogador específico
 *     tags: [Players]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do jogador
 *     responses:
 *       200:
 *         description: Detalhes do jogador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlayerResponseDto'
 *       404:
 *         description: Jogador não encontrado
 */
router.get('/:id', controller.getPlayerById);

/**
 * @swagger
 * /api/players/{id}/debts:
 *   get:
 *     summary: Obtém débitos de um jogador
 *     description: Retorna lista de débitos de um jogador específico
 *     tags: [Players]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do jogador
 *     responses:
 *       200:
 *         description: Lista de débitos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       404:
 *         description: Jogador não encontrado
 */
router.get('/:id/debts', authenticate, controller.getPlayerDebts);

/**
 * @swagger
 * /api/players/{id}/games:
 *   get:
 *     summary: Obtém jogos de um jogador
 *     description: Retorna lista de jogos que um jogador participou
 *     tags: [Players]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do jogador
 *     responses:
 *       200:
 *         description: Lista de jogos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       404:
 *         description: Jogador não encontrado
 */
router.get('/:id/games', controller.getPlayerGames);

/**
 * @swagger
 * /api/players/{id}/transactions:
 *   get:
 *     summary: Obtém movimentações (transações) de um jogador
 *     description: Retorna lista paginada de movimentações do ledger de um jogador ordenadas por data
 *     tags: [Players]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do jogador
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Itens por página
 *     responses:
 *       200:
 *         description: Lista de movimentações
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ledgers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [debit, credit]
 *                       status:
 *                         type: string
 *                         enum: [pendente, confirmado, estornado]
 *                       amountCents:
 *                         type: integer
 *                       note:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *       404:
 *         description: Jogador não encontrado
 */
router.get('/:id/transactions', controller.getPlayerTransactions);

/**
 * @swagger
 * /api/players:
 *   post:
 *     summary: Cria um novo jogador
 *     description: Cria um novo jogador (requer autenticação de admin)
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phoneE164
 *             properties:
 *               name:
 *                 type: string
 *                 example: "João Silva"
 *               phoneE164:
 *                 type: string
 *                 example: "+5511999999999"
 *               email:
 *                 type: string
 *                 example: "joao@email.com"
 *               cpf:
 *                 type: string
 *                 example: "123.456.789-00"
 *               nick:
 *                 type: string
 *                 example: "Joãozinho"
 *               isGoalie:
 *                 type: boolean
 *                 default: false
 *               role:
 *                 type: string
 *                 enum: [admin, user]
 *                 default: user
 *     responses:
 *       201:
 *         description: Jogador criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlayerResponseDto'
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Jogador já existe
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.post('/', requireAdmin, controller.createPlayer);

/**
 * @swagger
 * /api/players/{id}:
 *   put:
 *     summary: Atualiza um jogador
 *     description: Atualiza informações de um jogador existente (requer autenticação de admin)
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do jogador
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phoneE164:
 *                 type: string
 *               email:
 *                 type: string
 *               cpf:
 *                 type: string
 *               nick:
 *                 type: string
 *               isGoalie:
 *                 type: boolean
 *               role:
 *                 type: string
 *                 enum: [admin, user]
 *               status:
 *                 type: string
 *                 enum: [active, inactive, suspended]
 *     responses:
 *       200:
 *         description: Jogador atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlayerResponseDto'
 *       404:
 *         description: Jogador não encontrado
 *       409:
 *         description: Conflito (email ou telefone já existe)
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.put('/:id', authenticate, controller.updatePlayer);

/**
 * @swagger
 * /api/players/{id}:
 *   delete:
 *     summary: Deleta um jogador
 *     description: Remove um jogador do sistema (requer autenticação de admin)
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do jogador
 *     responses:
 *       204:
 *         description: Jogador deletado com sucesso
 *       400:
 *         description: Jogador possui débitos pendentes
 *       404:
 *         description: Jogador não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.delete('/:id', requireAdmin, controller.deletePlayer);

/**
 * @swagger
 * /api/players/{id}/suspend:
 *   post:
 *     summary: Suspende um jogador
 *     description: Suspende um jogador do sistema (requer autenticação de admin)
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do jogador
 *     responses:
 *       200:
 *         description: Jogador suspenso com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlayerResponseDto'
 *       404:
 *         description: Jogador não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.post('/:id/suspend', requireAdmin, controller.suspendPlayer);

/**
 * @swagger
 * /api/players/{id}/activate:
 *   post:
 *     summary: Ativa um jogador
 *     description: Ativa um jogador suspenso ou inativo (requer autenticação de admin)
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do jogador
 *     responses:
 *       200:
 *         description: Jogador ativado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlayerResponseDto'
 *       404:
 *         description: Jogador não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.post('/:id/activate', requireAdmin, controller.activatePlayer);

export default router;
