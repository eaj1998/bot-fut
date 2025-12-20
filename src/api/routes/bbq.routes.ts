import { Router } from 'express';
import { container } from 'tsyringe';
import { BBQController } from '../controllers/bbq.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();
const controller = container.resolve(BBQController);

router.use(authenticate);

/**
 * @swagger
 * /api/bbq:
 *   get:
 *     summary: Lista todos os churrascos
 *     description: Retorna uma lista paginada de churrascos com filtros opcionais
 *     tags: [BBQ]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, closed, finished, cancelled]
 *         description: Filtrar por status do churrasco
 *       - in: query
 *         name: chatId
 *         schema:
 *           type: string
 *         description: Filtrar por ID do chat
 *       - in: query
 *         name: workspaceId
 *         schema:
 *           type: string
 *         description: Filtrar por ID do workspace
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Data inicial (ISO 8601)
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Data final (ISO 8601)
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
 *         description: Lista de churrascos retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     bbqs:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/BBQResponseDto'
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     limit:
 *                       type: integer
 */
router.get('/', controller.listBBQs);

/**
 * @swagger
 * /api/bbq/stats:
 *   get:
 *     summary: Obtém estatísticas de churrascos
 *     description: Retorna estatísticas agregadas sobre churrascos
 *     tags: [BBQ]
 *     parameters:
 *       - in: query
 *         name: workspaceId
 *         schema:
 *           type: string
 *         description: Filtrar estatísticas por workspace
 *     responses:
 *       200:
 *         description: Estatísticas retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Total de churrascos
 *                     open:
 *                       type: integer
 *                       description: Churrascos abertos
 *                     closed:
 *                       type: integer
 *                       description: Churrascos fechados
 *                     finished:
 *                       type: integer
 *                       description: Churrascos finalizados
 *                     cancelled:
 *                       type: integer
 *                       description: Churrascos cancelados
 */
router.get('/stats', controller.getStats);

/**
 * @swagger
 * /api/bbq/{id}:
 *   get:
 *     summary: Obtém detalhes de um churrasco
 *     description: Retorna informações detalhadas de um churrasco específico
 *     tags: [BBQ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do churrasco
 *     responses:
 *       200:
 *         description: Detalhes do churrasco
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/BBQResponseDto'
 *       404:
 *         description: Churrasco não encontrado
 */
router.get('/:id', controller.getBBQById);

/**
 * @swagger
 * /api/bbq:
 *   post:
 *     summary: Cria um novo churrasco
 *     description: Cria um novo churrasco (requer autenticação de admin)
 *     tags: [BBQ]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chatId
 *               - workspaceId
 *             properties:
 *               chatId:
 *                 type: string
 *                 description: ID do chat
 *               workspaceId:
 *                 type: string
 *                 description: ID do workspace
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Data do churrasco (ISO 8601)
 *               valuePerPerson:
 *                 type: number
 *                 description: Valor por pessoa
 *     responses:
 *       201:
 *         description: Churrasco criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/BBQResponseDto'
 *                 message:
 *                   type: string
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.post('/', requireAdmin, controller.createBBQ);

/**
 * @swagger
 * /api/bbq/{id}:
 *   put:
 *     summary: Atualiza um churrasco
 *     description: Atualiza informações de um churrasco existente (requer autenticação de admin)
 *     tags: [BBQ]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do churrasco
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Data do churrasco (ISO 8601)
 *               valuePerPerson:
 *                 type: number
 *                 description: Valor por pessoa
 *               status:
 *                 type: string
 *                 enum: [open, closed, finished, cancelled]
 *                 description: Status do churrasco
 *     responses:
 *       200:
 *         description: Churrasco atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/BBQResponseDto'
 *                 message:
 *                   type: string
 *       404:
 *         description: Churrasco não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.put('/:id', requireAdmin, controller.updateBBQ);

/**
 * @swagger
 * /api/bbq/{id}/status:
 *   patch:
 *     summary: Atualiza status do churrasco
 *     description: Atualiza apenas o status de um churrasco (requer autenticação de admin)
 *     tags: [BBQ]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do churrasco
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
 *                 enum: [open, closed, finished, cancelled]
 *                 description: Novo status do churrasco
 *     responses:
 *       200:
 *         description: Status atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/BBQResponseDto'
 *                 message:
 *                   type: string
 *       404:
 *         description: Churrasco não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.patch('/:id/status', requireAdmin, controller.updateStatus);

/**
 * @swagger
 * /api/bbq/{id}/close:
 *   post:
 *     summary: Fecha um churrasco
 *     description: Fecha um churrasco e processa débitos (requer autenticação de admin)
 *     tags: [BBQ]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do churrasco
 *     responses:
 *       200:
 *         description: Churrasco fechado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/BBQResponseDto'
 *                 message:
 *                   type: string
 *       400:
 *         description: "Erro ao fechar churrasco (ex: valor não definido)"
 *       404:
 *         description: Churrasco não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.post('/:id/close', requireAdmin, controller.closeBBQ);

/**
 * @swagger
 * /api/bbq/{id}/cancel:
 *   post:
 *     summary: Cancela um churrasco
 *     description: Cancela um churrasco (requer autenticação de admin)
 *     tags: [BBQ]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do churrasco
 *     responses:
 *       200:
 *         description: Churrasco cancelado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/BBQResponseDto'
 *                 message:
 *                   type: string
 *       404:
 *         description: Churrasco não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão de admin
 */
router.post('/:id/cancel', requireAdmin, controller.cancelBBQ);

/**
 * @swagger
 * /api/bbq/{id}/participants:
 *   post:
 *     summary: Adiciona um participante ao churrasco
 *     description: Adiciona um usuário ou convidado à lista de participantes do churrasco
 *     tags: [BBQ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do churrasco
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - userName
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID do usuário (ou ID gerado para convidado)
 *               userName:
 *                 type: string
 *                 description: Nome do participante
 *               invitedBy:
 *                 type: string
 *                 nullable: true
 *                 description: ID do usuário que convidou (null se for participante direto)
 *     responses:
 *       200:
 *         description: Participante adicionado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/BBQResponseDto'
 *                 message:
 *                   type: string
 *       400:
 *         description: Dados inválidos ou BBQ não permite adição de participantes
 *       404:
 *         description: Churrasco não encontrado
 *       401:
 *         description: Não autenticado
 */
router.post('/:id/participants', controller.addParticipant);

/**
 * @swagger
 * /api/bbq/{id}/participants/{userId}:
 *   delete:
 *     summary: Remove um participante do churrasco
 *     description: Remove um usuário ou convidado da lista de participantes do churrasco
 *     tags: [BBQ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do churrasco
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do participante a ser removido
 *     responses:
 *       200:
 *         description: Participante removido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/BBQResponseDto'
 *                 message:
 *                   type: string
 *       400:
 *         description: BBQ não permite remoção de participantes
 *       404:
 *         description: Churrasco ou participante não encontrado
 *       401:
 *         description: Não autenticado
 */
router.delete('/:id/participants/:userId', controller.removeParticipant);

/**
 * @swagger
 * /api/bbq/{id}/participants/{userId}/payment:
 *   patch:
 *     summary: Marca ou desmarca um participante como pago
 *     description: Atualiza o status de pagamento de um participante do churrasco
 *     tags: [BBQ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do churrasco
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do participante
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
 *                 description: Status de pagamento (true = pago, false = pendente)
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
 *                 data:
 *                   $ref: '#/components/schemas/BBQResponseDto'
 *                 message:
 *                   type: string
 *       400:
 *         description: BBQ não está fechado ou dados inválidos
 *       404:
 *         description: Churrasco ou participante não encontrado
 *       401:
 *         description: Não autenticado
 */
router.patch('/:id/participants/:userId/payment', controller.toggleParticipantPayment);

export default router;
