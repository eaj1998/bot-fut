import { Router } from 'express';
import { container } from 'tsyringe';
import { GamesController } from '../controllers/games.controller';
import { authenticate } from '../middleware/auth.middleware';
import { ensureWorkspace } from '../middleware/ensureWorkspace';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();
const controller = container.resolve(GamesController);

router.use(authenticate);
router.use(ensureWorkspace);

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
 * /api/games/stats:
 *   get:
 *     summary: Obtém estatísticas de jogos
 *     description: Retorna estatísticas agregadas sobre jogos
 *     tags: [Games]
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
 *                   description: Total de jogos
 *                 open:
 *                   type: integer
 *                   description: Jogos abertos
 *                 closed:
 *                   type: integer
 *                   description: Jogos fechados
 *                 finished:
 *                   type: integer
 *                   description: Jogos finalizados
 *                 cancelled:
 *                   type: integer
 *                   description: Jogos cancelados
 *                 upcoming:
 *                   type: integer
 *                   description: Jogos próximos (próximos 7 dias)
 *                 activePlayers:
 *                   type: integer
 *                   description: Total de jogadores ativos
 */
router.get('/stats', controller.getStats);

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

/**
 * @swagger
 * /api/games/{gameId}/teams/generate:
 *   post:
 *     summary: Gera times equilibrados
 *     description: Gera e retorna a sugestão de times equilibrados com base no rating dos jogadores confirmados (requer autenticação).
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
 *         description: Times gerados com sucesso
 */
router.post('/:gameId/teams/generate', controller.generateTeams);

/**
 * @swagger
 * /api/games/{gameId}/teams:
 *   put:
 *     summary: Salva atribuições de times
 *     description: Persiste as atribuições de jogadores aos times A e B (requer autenticação de admin)
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
 *             type: object
 *             required:
 *               - assignments
 *             properties:
 *               assignments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - playerId
 *                     - team
 *                   properties:
 *                     playerId:
 *                       type: string
 *                       description: ID do jogador
 *                     team:
 *                       type: string
 *                       enum: [A, B]
 *                       description: Time atribuído
 *     responses:
 *       200:
 *         description: Atribuições salvas com sucesso
 *       400:
 *         description: Formato de atribuições inválido
 *       404:
 *         description: Jogo não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.put('/:gameId/teams', requireAdmin, controller.saveTeamAssignments);


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
 *       200:
 *         description: Jogo cancelado com sucesso
 *       404:
 *         description: Jogo não encontrado
 */
router.delete('/:gameId', requireAdmin, controller.deleteGame);

/**
 * @swagger
 * /api/games/{gameId}/status:
 *   put:
 *     summary: Atualiza status do jogo
 *     description: Atualiza apenas o status de um jogo (requer autenticação de admin)
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
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [scheduled, open, closed, finished, cancelled]
 *                 description: Novo status do jogo
 *                 example: "open"
 *     responses:
 *       200:
 *         description: Status atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameResponseDto'
 *       400:
 *         description: Status inválido
 *       404:
 *         description: Jogo não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.put('/:gameId/status', requireAdmin, controller.updateStatus);

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
 *     summary: Adiciona um jogador ou convidado ao jogo
 *     description: |
 *       Adiciona um novo jogador à lista do jogo (requer autenticação).
 *       
 *       **Para adicionar jogador normal:**
 *       - Envie `phone` e `name`
 *       
 *       **Para adicionar convidado:**
 *       - Envie `phone` (de quem convida), `name` (de quem convida), e `guestName` (nome do convidado)
 *       - O convidado será adicionado com formato: "NomeConvidado (conv. NomeQuemConvida)"
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
 * /api/games/{gameId}/remove-guest:
 *   post:
 *     summary: Remove um convidado por slot (Preciso)
 *     tags: [Games]
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [slot]
 *             properties:
 *               slot: { type: integer }
 *     responses:
 *       200: { description: Sucesso }
 */
router.post('/:gameId/remove-guest', controller.removeGuest);

/**
 * @swagger
 * /api/games/{gameId}/remove-player:
 *   post:
 *     summary: Remove um jogador por ID (Preciso)
 *     tags: [Games]
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId: { type: string }
 *     responses:
 *       200: { description: Sucesso }
 */
router.post('/:gameId/remove-player', controller.removePlayerFromBody);

/**
 * @swagger
 * /api/games/{gameId}/players/{slot}/payment:
 *   patch:
 *     summary: Marca/desmarca pagamento de jogador
 *     description: |
 *       Atualiza o status de pagamento de um jogador (requer autenticação).
 *       
 *       **Diferenciação automática:**
 *       - Se for **vaga própria**: débito/crédito vai para o próprio jogador
 *       - Se for **convidado**: débito/crédito vai para quem convidou (invitedByUserId)
 *       - **Goleiros**: não geram débito/crédito (não pagam)
 *       
 *       **Fluxo:**
 *       1. Busca débito pendente no ledger
 *       2. Confirma o débito pendente
 *       3. Cria crédito confirmado
 *       4. Atualiza saldo do usuário
 *       
 *       **Importante:** Use o **slot** do jogador, não o userId. O slot identifica
 *       inequivocamente o jogador na lista, mesmo quando há convidados.
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
 *         name: slot
 *         required: true
 *         schema:
 *           type: integer
 *         description: Número do slot do jogador na lista (1, 2, 3, etc.)
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
 *                 description: Status de pagamento (true = marcar como pago, false = desmarcar)
 *                 example: true
 *     responses:
 *       200:
 *         description: Status de pagamento atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Pagamento marcado com sucesso"
 *       404:
 *         description: Jogo ou jogador não encontrado
 *       401:
 *         description: Não autenticado
 */
router.patch('/:gameId/players/:slot/payment', controller.markPayment);

export default router;
