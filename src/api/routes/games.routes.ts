import { Router } from 'express';
import { container } from 'tsyringe';
import { GamesController } from '../controllers/games.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();
const controller = container.resolve(GamesController);

/**
 * @swagger
 * /api/games:
 *   get:
 *     summary: Lista todos os jogos
 *     description: Retorna uma lista paginada de jogos com filtros opcionais
 *     tags: [Games]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, open, closed, finished, cancelled]
 *         description: Filtrar por status do jogo
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filtrar por tipo de jogo
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por título ou localização
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
 *         description: Lista de jogos retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 games:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/GameResponseDto'
 *                 total:
 *                   type: integer
 *                   description: Total de jogos
 *                 page:
 *                   type: integer
 *                   description: Página atual
 *                 totalPages:
 *                   type: integer
 *                   description: Total de páginas
 */
router.get('/', controller.listGames);

/**
 * @swagger
 * /api/games/{gameId}:
 *   get:
 *     summary: Obtém detalhes de um jogo
 *     description: Retorna informações detalhadas de um jogo específico incluindo jogadores, lista de espera e resumo financeiro
 *     tags: [Games]
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do jogo
 *     responses:
 *       200:
 *         description: Detalhes do jogo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameDetailResponseDto'
 *       404:
 *         description: Jogo não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:gameId', controller.getGameDetail);

router.use(authenticate);

/**
 * @swagger
 * /api/games:
 *   post:
 *     summary: Cria um novo jogo
 *     description: Cria um novo jogo agendado (requer autenticação de admin)
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateGameDto'
 *     responses:
 *       201:
 *         description: Jogo criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameResponseDto'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.post('/', requireAdmin, controller.createGame);

/**
 * @swagger
 * /api/games/{gameId}:
 *   put:
 *     summary: Atualiza um jogo
 *     description: Atualiza informações de um jogo existente (requer autenticação de admin)
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do jogo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateGameDto'
 *     responses:
 *       200:
 *         description: Jogo atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameResponseDto'
 *       404:
 *         description: Jogo não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.put('/:gameId', requireAdmin, controller.updateGame);

/**
 * @swagger
 * /api/games/{gameId}:
 *   delete:
 *     summary: Cancela um jogo
 *     description: Cancela um jogo agendado (requer autenticação de admin)
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do jogo
 *     responses:
 *       204:
 *         description: Jogo cancelado com sucesso
 *       404:
 *         description: Jogo não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.delete('/:gameId', requireAdmin, controller.cancelGame);

/**
 * @swagger
 * /api/games/{gameId}/close:
 *   post:
 *     summary: Fecha um jogo
 *     description: Fecha um jogo e processa pagamentos/débitos (requer autenticação de admin)
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do jogo
 *     responses:
 *       200:
 *         description: Jogo fechado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameResponseDto'
 *       404:
 *         description: Jogo não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.post('/:gameId/close', requireAdmin, controller.closeGame);

/**
 * @swagger
 * /api/games/{gameId}/send-reminder:
 *   post:
 *     summary: Envia lembrete do jogo
 *     description: Envia um lembrete via WhatsApp para o grupo do jogo (requer autenticação de admin)
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do jogo
 *     responses:
 *       204:
 *         description: Lembrete enviado com sucesso
 *       404:
 *         description: Jogo não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.post('/:gameId/send-reminder', requireAdmin, controller.sendReminder);

/**
 * @swagger
 * /api/games/{gameId}/export:
 *   get:
 *     summary: Exporta lista de jogadores em CSV
 *     description: Exporta a lista de jogadores do jogo em formato CSV (requer autenticação de admin)
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do jogo
 *     responses:
 *       200:
 *         description: Arquivo CSV gerado com sucesso
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       404:
 *         description: Jogo não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.get('/:gameId/export', requireAdmin, controller.exportCSV);

/**
 * @swagger
 * /api/games/{gameId}/players:
 *   post:
 *     summary: Adiciona um jogador ao jogo
 *     description: Adiciona um novo jogador à lista do jogo (requer autenticação)
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do jogo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddPlayerToGameDto'
 *     responses:
 *       201:
 *         description: Jogador adicionado com sucesso
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Jogo não encontrado
 *       401:
 *         description: Não autenticado
 */
router.post('/:gameId/players', controller.addPlayer);

/**
 * @swagger
 * /api/games/{gameId}/players/{playerId}:
 *   delete:
 *     summary: Remove um jogador do jogo
 *     description: Remove um jogador da lista do jogo (requer autenticação)
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do jogo
 *       - in: path
 *         name: playerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do jogador
 *     responses:
 *       204:
 *         description: Jogador removido com sucesso
 *       404:
 *         description: Jogo ou jogador não encontrado
 *       401:
 *         description: Não autenticado
 */
router.delete('/:gameId/players/:playerId', controller.removePlayer);

/**
 * @swagger
 * /api/games/{gameId}/players/{playerId}/payment:
 *   patch:
 *     summary: Marca/desmarca pagamento de jogador
 *     description: Atualiza o status de pagamento de um jogador (requer autenticação)
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do jogo
 *       - in: path
 *         name: playerId
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
 *             required:
 *               - isPaid
 *             properties:
 *               isPaid:
 *                 type: boolean
 *                 description: Status de pagamento
 *                 example: true
 *     responses:
 *       204:
 *         description: Status de pagamento atualizado com sucesso
 *       404:
 *         description: Jogo ou jogador não encontrado
 *       401:
 *         description: Não autenticado
 */
router.patch('/:gameId/players/:playerId/payment', controller.markPayment);

export default router;
